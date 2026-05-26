const assert = require('node:assert/strict');
const { test } = require('node:test');

const { TextDocument } = require('vscode-languageserver-textdocument');
const { DefinitionHandler } = require('../dist/handlers');

const workflowTemplateYaml = `apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: tem-tem1
spec:
  templates:
    - name: step1`;

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
  const uri = 'file:///workspace/workflow-template.yaml';
  const document = TextDocument.create(uri, 'yaml', 1, content);
  const documents = {
    get(documentUri) {
      return documentUri === uri ? document : undefined;
    },
  };
  const searchService = {
    findTemplateInWorkflowTemplate() {
      throw new Error('definition-line gd should not search template definitions');
    },
    findDagTaskDefinition() {
      throw new Error('definition-line gd should not search DAG task definitions');
    },
    findTemplateDefinition() {
      throw new Error('definition-line gd should not search workflow template definitions');
    },
    findTemplateReferences() {
      throw new Error('definition-line gd should not search template references');
    },
    findDagTaskReferences() {
      throw new Error('definition-line gd should not search DAG task references');
    },
    findWorkflowTemplateReferences() {
      throw new Error('definition-line gd should not search workflow template references');
    },
  };

  return {
    handler: new DefinitionHandler(searchService, documents, '/workspace'),
    uri,
  };
}

const currentDefinitionCases = [
  {
    name: 'WorkflowTemplate metadata name',
    position: { line: 3, character: 12 },
    target: { line: 3, character: 8 },
  },
  {
    name: 'template definition name',
    position: { line: 6, character: 15 },
    target: { line: 6, character: 12 },
  },
];

for (const testCase of currentDefinitionCases) {
  test(`gd on ${testCase.name} returns name start location`, async () => {
    const { handler, uri } = createHandler(workflowTemplateYaml);

    const locations = await handler.handleDefinition({
      textDocument: { uri },
      position: testCase.position,
    });

    assert.deepStrictEqual(locations, [
      {
        uri,
        range: {
          start: testCase.target,
          end: testCase.target,
        },
      },
    ]);
  });
}

test('gd on same-resource template call uses local Argo resource search', async () => {
  const content = `apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: local-function-workflow
spec:
  entrypoint: main
  templates:
    - name: main`;
  const uri = 'file:///workspace/workflow.yaml';
  const document = TextDocument.create(uri, 'yaml', 1, content);
  const documents = {
    get(documentUri) {
      return documentUri === uri ? document : undefined;
    },
  };
  const searchService = {
    findTemplateInWorkflowTemplate() {
      throw new Error('local template call should not search WorkflowTemplate refs');
    },
    findTemplateInArgoResource(rootPath, resourceName, templateName) {
      assert.equal(rootPath, '/workspace');
      assert.equal(resourceName, 'local-function-workflow');
      assert.equal(templateName, 'main');

      return Promise.resolve({
        templateName,
        locations: [
          {
            file: '/workspace/workflow.yaml',
            line: 7,
            character: 12,
            endCharacter: 16,
          },
        ],
      });
    },
    findTemplateDefinition() {
      throw new Error('local template call should not search workflow template definitions');
    },
    findTemplateReferences() {
      throw new Error('gd should not search template references');
    },
    findLocalTemplateReferences() {
      throw new Error('gd should not search local template references');
    },
    findWorkflowTemplateReferences() {
      throw new Error('gd should not search workflow template references');
    },
  };

  const handler = new DefinitionHandler(searchService, documents, '/workspace');
  const locations = await handler.handleDefinition({
    textDocument: { uri },
    position: { line: 5, character: 16 },
  });

  assert.deepStrictEqual(locations, [
    {
      uri,
      range: {
        start: { line: 7, character: 12 },
        end: { line: 7, character: 16 },
      },
    },
  ]);
});

test('gd on workflowTemplateRef.name searches WorkflowTemplate definitions', async () => {
  const content = `apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: workflow-using-workflowtemplate-
spec:
  workflowTemplateRef:
    name: tem-tem1`;
  const uri = 'file:///workspace/workflow.yaml';
  const document = TextDocument.create(uri, 'yaml', 1, content);
  const documents = {
    get(documentUri) {
      return documentUri === uri ? document : undefined;
    },
  };
  const searchService = {
    findTemplateInWorkflowTemplate() {
      throw new Error('workflowTemplateRef.name should not search inner templates');
    },
    findTemplateInArgoResource() {
      throw new Error('workflowTemplateRef.name should not search local templates');
    },
    findTemplateDefinition(rootPath, workflowTemplateName) {
      assert.equal(rootPath, '/workspace');
      assert.equal(workflowTemplateName, 'tem-tem1');

      return Promise.resolve({
        templateName: workflowTemplateName,
        locations: [
          {
            file: '/workspace/tem1.yaml',
            line: 3,
            character: 8,
            endCharacter: 16,
          },
        ],
      });
    },
    findTemplateReferences() {
      throw new Error('gd should not search template references');
    },
    findLocalTemplateReferences() {
      throw new Error('gd should not search local template references');
    },
    findWorkflowTemplateReferences() {
      throw new Error('gd should not search workflow template references');
    },
  };

  const handler = new DefinitionHandler(searchService, documents, '/workspace');
  const locations = await handler.handleDefinition({
    textDocument: { uri },
    position: { line: 6, character: 12 },
  });

  assert.deepStrictEqual(locations, [
    {
      uri: 'file:///workspace/tem1.yaml',
      range: {
        start: { line: 3, character: 8 },
        end: { line: 3, character: 16 },
      },
    },
  ]);
});

test('gd on cluster-scoped templateRef selects ClusterWorkflowTemplate definitions', async () => {
  const content = `apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: call-cluster-library
spec:
  templates:
    - name: main
      steps:
        - - name: call-cluster
            templateRef:
              name: shared-library
              template: step1
              clusterScope: true`;
  const uri = 'file:///workspace/workflow.yaml';
  const document = TextDocument.create(uri, 'yaml', 1, content);
  const documents = { get(documentUri) { return documentUri === uri ? document : undefined; } };
  const searchService = {
    findTemplateInWorkflowTemplate(rootPath, workflowTemplateName, templateName, clusterScope) {
      assert.equal(rootPath, '/workspace');
      assert.equal(workflowTemplateName, 'shared-library');
      assert.equal(templateName, 'step1');
      assert.equal(clusterScope, true);
      return Promise.resolve({
        templateName,
        locations: [{ file: '/workspace/cluster-library.yaml', line: 6, character: 12, endCharacter: 17 }],
      });
    },
  };

  const handler = new DefinitionHandler(searchService, documents, '/workspace');
  const locations = await handler.handleDefinition({
    textDocument: { uri },
    position: { line: 11, character: 25 },
  });

  assert.deepStrictEqual(locations, [
    {
      uri: 'file:///workspace/cluster-library.yaml',
      range: {
        start: { line: 6, character: 12 },
        end: { line: 6, character: 17 },
      },
    },
  ]);
});

test('gd on DAG dependency token searches DAG task definitions', async () => {
  const uri = 'file:///workspace/dag-dependencies.yaml';
  const document = TextDocument.create(uri, 'yaml', 1, dagDependenciesYaml);
  const documents = {
    get(documentUri) {
      return documentUri === uri ? document : undefined;
    },
  };
  const searchService = {
    findTemplateInWorkflowTemplate() {
      throw new Error('dag dependency token should not search template definitions');
    },
    findTemplateInArgoResource() {
      throw new Error('dag dependency token should not search local templates');
    },
    findDagTaskDefinition(rootPath, resourceName, templateName, taskName) {
      assert.equal(rootPath, '/workspace');
      assert.equal(resourceName, 'dag-dependency-workflow');
      assert.equal(templateName, 'dependency-dag');
      assert.equal(taskName, 'B');

      return Promise.resolve({
        templateName: taskName,
        locations: [
          {
            file: '/workspace/dag-dependencies.yaml',
            line: 10,
            character: 18,
            endCharacter: 19,
          },
        ],
      });
    },
    findTemplateDefinition() {
      throw new Error('dag dependency token should not search workflow template definitions');
    },
    findTemplateReferences() {
      throw new Error('dag dependency token should not search template references');
    },
    findDagTaskReferences() {
      throw new Error('dag dependency token should not search DAG task references');
    },
    findLocalTemplateReferences() {
      throw new Error('dag dependency token should not search local template references');
    },
    findWorkflowTemplateReferences() {
      throw new Error('dag dependency token should not search workflow template references');
    },
  };

  const handler = new DefinitionHandler(searchService, documents, '/workspace');
  const locations = await handler.handleDefinition({
    textDocument: { uri },
    position: { line: 30, character: 28 },
  });

  assert.deepStrictEqual(locations, [
    {
      uri: 'file:///workspace/dag-dependencies.yaml',
      range: {
        start: { line: 10, character: 18 },
        end: { line: 10, character: 19 },
      },
    },
  ]);
});

test('gd on direct DAG task name returns the task name start location', async () => {
  const uri = 'file:///workspace/dag-dependencies.yaml';
  const document = TextDocument.create(uri, 'yaml', 1, dagDependenciesYaml);
  const documents = {
    get(documentUri) {
      return documentUri === uri ? document : undefined;
    },
  };
  const searchService = {
    findTemplateInWorkflowTemplate() {
      throw new Error('direct DAG task name should not search template definitions');
    },
    findTemplateInArgoResource() {
      throw new Error('direct DAG task name should not search local templates');
    },
    findDagTaskDefinition() {
      throw new Error('direct DAG task name should not search DAG task definitions');
    },
    findTemplateDefinition() {
      throw new Error('direct DAG task name should not search workflow template definitions');
    },
    findTemplateReferences() {
      throw new Error('direct DAG task name should not search template references');
    },
    findDagTaskReferences() {
      throw new Error('direct DAG task name should not search DAG task references');
    },
    findWorkflowTemplateReferences() {
      throw new Error('direct DAG task name should not search workflow template references');
    },
  };
  const navigationService = {
    getNavigationTarget() {
      return {
        kind: 'dagTaskReferences',
        resourceName: 'dag-dependency-workflow',
        templateName: 'dependency-dag',
        taskName: 'A',
      };
    },
  };

  const handler = new DefinitionHandler(searchService, documents, '/workspace', navigationService);
  const locations = await handler.handleDefinition({
    textDocument: { uri },
    position: { line: 24, character: 18 },
  });

  assert.deepStrictEqual(locations, [
    {
      uri,
      range: {
        start: { line: 24, character: 18 },
        end: { line: 24, character: 18 },
      },
    },
  ]);
});
