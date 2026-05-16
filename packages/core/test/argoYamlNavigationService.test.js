const assert = require('node:assert/strict');
const { test } = require('node:test');

const { ArgoYamlNavigationService } = require('../dist');

class TestDocumentReader {
  constructor(content) {
    this.lines = content.split('\n');
    this.lineCount = this.lines.length;
  }

  getLine(line) {
    return this.lines[line] ?? '';
  }

  getTextInRange(startLine, endLine) {
    return this.lines.slice(startLine, endLine).join('\n');
  }
}

const service = new ArgoYamlNavigationService();

test('resolves templateRef.template as a template definition target', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
spec:
  templates:
    - name: main
      steps:
        - - name: run-step
            templateRef:
              name: tem-tem1
              template: step1`);

  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 9, character: 25 }),
    {
      kind: 'templateDefinition',
      workflowTemplateName: 'tem-tem1',
      templateName: 'step1',
    }
  );
});

test('resolves template definitions as template reference targets', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: tem-tem1
spec:
  templates:
    - name: step1`);

  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 6, character: 13 }),
    {
      kind: 'templateReferences',
      workflowTemplateName: 'tem-tem1',
      templateName: 'step1',
    }
  );
});

test('resolves WorkflowTemplate metadata names as reference targets', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: tem-tem1
spec:
  templates:
    - name: step1`);

  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 3, character: 9 }),
    {
      kind: 'workflowTemplateReferences',
      workflowTemplateName: 'tem-tem1',
    }
  );
});
