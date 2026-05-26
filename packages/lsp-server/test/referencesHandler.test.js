const assert = require('node:assert/strict');
const { test } = require('node:test');

const { TextDocument } = require('vscode-languageserver-textdocument');
const { ReferencesHandler } = require('../dist/handlers');

const dagDependenciesYaml = `apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: dag-dependency-workflow
spec:
  entrypoint: dependency-dag
  templates:
    - name: dependency-dag
      dag:
        tasks:
          - name: A
            template: template-name-collision
          - name: B
            template: task-body
          - name: C
            template: task-body
          - name: train-model-1
            template: task-body
          - name: fan_in
            template: task-body
          - name: inline-dependencies
            template: task-body
            dependencies: [A, train-model-1]
          - name: multiline-dependencies
            template: task-body
            dependencies:
              - A
              - fan_in
          - name: enhanced-depends
            template: task-body
            depends: "A && (B.Succeeded || !C.Failed) && train-model-1.AnySucceeded"
          - name: downstream-task
            template: task-body
            dependencies: [inline-dependencies, multiline-dependencies]
          - name: template-name-collision
            template: task-body
            depends: A
    - name: dependency-dag-duplicate
      dag:
        tasks:
          - name: A
            template: task-body
          - name: B
            template: task-body
          - name: duplicate-downstream
            template: task-body
            dependencies: [A, B]
    - name: steps-negative-tests
      steps:
        - - name: invalid-step-depends
            template: task-body
            depends: A
            dependencies: [B]
    - name: task-body
      container:
        image: alpine:3.19
    - name: template-name-collision
      container:
        image: alpine:3.19`;

function createHandler(content) {
  const uri = 'file:///workspace/dag-dependencies.yaml';
  const document = TextDocument.create(uri, 'yaml', 1, content);
  const documents = {
    get(documentUri) {
      return documentUri === uri ? document : undefined;
    },
  };

  return {
    handler: new ReferencesHandler(
      {
        findDagTaskReferences() {
          throw new Error('references handler test should override the DAG reference search');
        },
      },
      documents,
      '/workspace'
    ),
    uri,
  };
}

test('gr on a DAG task name searches DAG task references', async () => {
  const { uri } = createHandler(dagDependenciesYaml);
  const document = TextDocument.create(uri, 'yaml', 1, dagDependenciesYaml);
  const documents = {
    get(documentUri) {
      return documentUri === uri ? document : undefined;
    },
  };
  const searchService = {
    findDagTaskReferences(rootPath, resourceName, templateName, taskName) {
      assert.equal(rootPath, '/workspace');
      assert.equal(resourceName, 'dag-dependency-workflow');
      assert.equal(templateName, 'dependency-dag');
      assert.equal(taskName, 'A');

      return Promise.resolve({
        templateName: taskName,
        locations: [
          {
            file: '/workspace/dag-dependencies.yaml',
            line: 22,
            character: 22,
            endCharacter: 23,
          },
        ],
      });
    },
  };

  const handler = new ReferencesHandler(searchService, documents, '/workspace');
  const locations = await handler.handleReferences({
    textDocument: { uri },
    position: { line: 10, character: 18 },
  });

  assert.deepStrictEqual(locations, [
    {
      uri: 'file:///workspace/dag-dependencies.yaml',
      range: {
        start: { line: 22, character: 22 },
        end: { line: 22, character: 23 },
      },
    },
  ]);
});

test('gr on a ClusterWorkflowTemplate name keeps cluster scope in reference search', async () => {
  const content = `apiVersion: argoproj.io/v1alpha1
kind: ClusterWorkflowTemplate
metadata:
  name: shared-library
spec:
  templates:
    - name: step1`;
  const uri = 'file:///workspace/cluster-library.yaml';
  const document = TextDocument.create(uri, 'yaml', 1, content);
  const documents = { get(documentUri) { return documentUri === uri ? document : undefined; } };
  const searchService = {
    findWorkflowTemplateReferences(rootPath, workflowTemplateName, clusterScope) {
      assert.equal(rootPath, '/workspace');
      assert.equal(workflowTemplateName, 'shared-library');
      assert.equal(clusterScope, true);
      return Promise.resolve({
        templateName: workflowTemplateName,
        locations: [{ file: '/workspace/workflow.yaml', line: 12, character: 20, endCharacter: 34 }],
      });
    },
  };

  const handler = new ReferencesHandler(searchService, documents, '/workspace');
  const locations = await handler.handleReferences({
    textDocument: { uri },
    position: { line: 3, character: 10 },
    context: { includeDeclaration: false },
  });

  assert.deepStrictEqual(locations, [
    {
      uri: 'file:///workspace/workflow.yaml',
      range: {
        start: { line: 12, character: 20 },
        end: { line: 12, character: 34 },
      },
    },
  ]);
});

test('gr on a local template scopes references to its source file', async () => {
  const content = `apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: duplicate-local-workflow
spec:
  templates:
    - name: main
      steps:
        - - name: call-shared
            template: shared
    - name: shared`;
  const uri = 'file:///workspace/source.yaml';
  const document = TextDocument.create(uri, 'yaml', 1, content);
  const documents = { get(documentUri) { return documentUri === uri ? document : undefined; } };
  const searchService = {
    findLocalTemplateReferences(rootPath, resourceName, templateName, sourceFilePath) {
      assert.equal(rootPath, '/workspace');
      assert.equal(resourceName, 'duplicate-local-workflow');
      assert.equal(templateName, 'shared');
      assert.equal(sourceFilePath, '/workspace/source.yaml');
      return Promise.resolve({
        templateName,
        locations: [{ file: sourceFilePath, line: 9, character: 22, endCharacter: 28 }],
      });
    },
  };

  const handler = new ReferencesHandler(searchService, documents, '/workspace');
  const locations = await handler.handleReferences({
    textDocument: { uri },
    position: { line: 10, character: 13 },
    context: { includeDeclaration: false },
  });

  assert.deepStrictEqual(locations, [
    {
      uri: 'file:///workspace/source.yaml',
      range: {
        start: { line: 9, character: 22 },
        end: { line: 9, character: 28 },
      },
    },
  ]);
});
