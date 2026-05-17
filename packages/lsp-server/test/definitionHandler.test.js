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
    findTemplateDefinition() {
      throw new Error('definition-line gd should not search workflow template definitions');
    },
    findTemplateReferences() {
      throw new Error('definition-line gd should not search template references');
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
