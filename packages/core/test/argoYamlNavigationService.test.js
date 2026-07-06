const assert = require('node:assert/strict');
const { test } = require('node:test');

const { ArgoYamlNavigationService } = require('../dist');

// getNavigationTarget takes the document as an array of lines.
function TestDocumentReader(content) {
  return content.split('\n');
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

test('resolves workflowTemplateRef.name as a WorkflowTemplate definition target', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: workflow-using-workflowtemplate-
spec:
  workflowTemplateRef:
    name: tem-tem1`);

  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 6, character: 12 }),
    {
      kind: 'workflowTemplateDefinition',
      workflowTemplateName: 'tem-tem1',
    }
  );
});

test('resolves same-resource entrypoint as a local template definition target', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: local-function-workflow
spec:
  entrypoint: main
  templates:
    - name: main`);

  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 5, character: 16 }),
    {
      kind: 'localTemplateDefinition',
      resourceName: 'local-function-workflow',
      templateName: 'main',
    }
  );
});

test('resolves same-resource step, dag, hook, and onExit template calls', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: local-function-workflow
spec:
  entrypoint: main
  onExit: exit-handler
  hooks:
    running:
      expression: workflow.status == "Running"
      template: workflow-hook
  templates:
    - name: main
      steps:
        - - name: run-step-template
            template: step-template
            hooks:
              exit:
                template: hook-template
      dag:
        tasks:
          - name: run-dag-template
            template: dag-template
    - name: step-template
    - name: dag-template
    - name: hook-template
    - name: workflow-hook
    - name: exit-handler`);

  const cases = [
    { line: 6, character: 12, templateName: 'exit-handler' },
    { line: 10, character: 18, templateName: 'workflow-hook' },
    { line: 15, character: 24, templateName: 'step-template' },
    { line: 18, character: 28, templateName: 'hook-template' },
    { line: 22, character: 24, templateName: 'dag-template' },
  ];

  for (const testCase of cases) {
    assert.deepStrictEqual(
      service.getNavigationTarget(document, testCase),
      {
        kind: 'localTemplateDefinition',
        resourceName: 'local-function-workflow',
        templateName: testCase.templateName,
      }
    );
  }
});

test('resolves inline Workflow template definitions as local reference targets', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: local-function-workflow
spec:
  templates:
    - name: main
      steps:
        - - name: run-step-template
            template: step-template
    - name: step-template`);

  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 10, character: 15 }),
    {
      kind: 'localTemplateReferences',
      resourceName: 'local-function-workflow',
      templateName: 'step-template',
    }
  );
});

test('keeps local template calls after templateRef blocks in local scope', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: mixed-calls
spec:
  templates:
    - name: main
      steps:
        - - name: external
            templateRef:
              name: shared-library
              template: remote-step
        - - name: local
            template: local-step
    - name: local-step`);

  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 13, character: 24 }),
    {
      kind: 'localTemplateDefinition',
      resourceName: 'mixed-calls',
      templateName: 'local-step',
    }
  );
});

test('does not treat step names as template definitions', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: local-function-workflow
spec:
  templates:
    - name: main
      steps:
        - - name: run-step-template
            template: step-template
    - name: step-template`);

  assert.equal(
    service.getNavigationTarget(document, { line: 8, character: 19 }),
    undefined
  );
});

test('resolves ClusterWorkflowTemplate metadata names as reference targets', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: ClusterWorkflowTemplate
metadata:
  name: cluster-library
spec:
  templates:
    - name: cluster-step`);

  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 3, character: 10 }),
    {
      kind: 'workflowTemplateReferences',
      workflowTemplateName: 'cluster-library',
      clusterScope: true,
    }
  );
});

test('preserves cluster scope for templateRef and workflowTemplateRef calls', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: cluster-calls
spec:
  workflowTemplateRef:
    name: shared-library
    clusterScope: true
  templates:
    - name: main
      steps:
        - - name: run-template
            templateRef:
              name: shared-library
              template: step1
              clusterScope: true`);

  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 6, character: 12 }),
    {
      kind: 'workflowTemplateDefinition',
      workflowTemplateName: 'shared-library',
      clusterScope: true,
    }
  );
  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 14, character: 25 }),
    {
      kind: 'templateDefinition',
      workflowTemplateName: 'shared-library',
      templateName: 'step1',
      clusterScope: true,
    }
  );
  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 13, character: 20 }),
    {
      kind: 'workflowTemplateDefinition',
      workflowTemplateName: 'shared-library',
      clusterScope: true,
    }
  );
});

test('resolves direct DAG task definitions as DAG task reference targets', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: dag-workflow
spec:
  templates:
    - name: main
      dag:
        tasks:
          - name: A
            template: echo
    - name: echo`);

  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 9, character: document[9].indexOf('A') }),
    {
      kind: 'dagTaskReferences',
      resourceName: 'dag-workflow',
      templateName: 'main',
      taskName: 'A',
    }
  );
});

test('resolves inline DAG dependencies as DAG task definition targets', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: dag-workflow
spec:
  templates:
    - name: main
      dag:
        tasks:
          - name: A
            template: echo
          - name: B
            template: echo
          - name: C
            dependencies: [A, B]
            template: echo
    - name: echo`);

  for (const taskName of ['A', 'B']) {
    assert.deepStrictEqual(
      service.getNavigationTarget(document, {
        line: 14,
        character: document[14].indexOf(taskName),
      }),
      {
        kind: 'dagTaskDefinition',
        resourceName: 'dag-workflow',
        templateName: 'main',
        taskName,
      }
    );
  }
});

test('resolves multiline DAG dependencies as DAG task definition targets', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: dag-workflow
spec:
  templates:
    - name: main
      dag:
        tasks:
          - name: A
            template: echo
          - name: B
            template: echo
          - name: C
            dependencies:
              - A
              - B
            template: echo
    - name: echo`);

  const cases = [
    { line: 15, taskName: 'A' },
    { line: 16, taskName: 'B' },
  ];

  for (const testCase of cases) {
    assert.deepStrictEqual(
      service.getNavigationTarget(document, {
        line: testCase.line,
        character: document[testCase.line].indexOf(testCase.taskName),
      }),
      {
        kind: 'dagTaskDefinition',
        resourceName: 'dag-workflow',
        templateName: 'main',
        taskName: testCase.taskName,
      }
    );
  }
});

test('resolves enhanced DAG depends task-name prefixes as DAG task definition targets', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: dag-workflow
spec:
  templates:
    - name: main
      dag:
        tasks:
          - name: A
            template: echo
          - name: B
            template: echo
          - name: C
            template: echo
          - name: D
            depends: "!(A.Succeeded && B.Failed) || C"
            template: echo
    - name: echo`);

  const dependsLine = document[16];
  const cases = [
    { character: dependsLine.indexOf('A.Succeeded'), taskName: 'A' },
    { character: dependsLine.indexOf('B.Failed'), taskName: 'B' },
    { character: dependsLine.indexOf('C"'), taskName: 'C' },
  ];

  for (const testCase of cases) {
    assert.deepStrictEqual(
      service.getNavigationTarget(document, { line: 16, character: testCase.character }),
      {
        kind: 'dagTaskDefinition',
        resourceName: 'dag-workflow',
        templateName: 'main',
        taskName: testCase.taskName,
      }
    );
  }
});

test('does not resolve enhanced DAG depends suffixes or operators as task targets', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: dag-workflow
spec:
  templates:
    - name: main
      dag:
        tasks:
          - name: A
            template: echo
          - name: B
            depends: "!(A.Succeeded && B.Failed) || A"
            template: echo
    - name: echo`);

  const dependsLine = document[12];
  const cases = [
    { label: 'dot', character: dependsLine.indexOf('.') },
    { label: 'Succeeded', character: dependsLine.indexOf('Succeeded') },
    { label: '&&', character: dependsLine.indexOf('&&') },
    { label: 'Failed', character: dependsLine.indexOf('Failed') },
    { label: '||', character: dependsLine.indexOf('||') },
    { label: '!', character: dependsLine.indexOf('!') },
    { label: '(', character: dependsLine.indexOf('(') },
    { label: ')', character: dependsLine.indexOf(')') },
  ];

  for (const testCase of cases) {
    assert.equal(
      service.getNavigationTarget(document, {
        line: 12,
        character: testCase.character,
      }),
      undefined,
      testCase.label
    );
  }
});

test('does not resolve step dependency-like fields as DAG task targets', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: step-workflow
spec:
  templates:
    - name: main
      steps:
        - - name: A
            template: echo
        - - name: B
            dependencies: [A]
            depends: A.Succeeded
            template: echo
    - name: echo`);

  assert.equal(
    service.getNavigationTarget(document, {
      line: 11,
      character: document[11].indexOf('A'),
    }),
    undefined
  );
  assert.equal(
    service.getNavigationTarget(document, {
      line: 12,
      character: document[12].indexOf('A.Succeeded'),
    }),
    undefined
  );
});

test('resolves dependency navigation in DAGs larger than lookback-sized documents', () => {
  const fillerTasks = Array.from(
    { length: 110 },
    (_, index) => `          - name: filler-${index}\n            template: echo`
  ).join('\n');
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: large-dag-workflow
spec:
  templates:
    - name: main
      dag:
        tasks:
          - name: upstream
            template: echo
${fillerTasks}
          - name: downstream
            depends: upstream.Succeeded
            template: echo
    - name: echo`);
  const dependencyLine = Array.from({ length: document.length }, (_, line) => line)
    .find((line) => document[line].includes('depends: upstream'));

  assert.notEqual(dependencyLine, undefined);
  assert.deepStrictEqual(
    service.getNavigationTarget(document, {
      line: dependencyLine,
      character: document[dependencyLine].indexOf('upstream'),
    }),
    {
      kind: 'dagTaskDefinition',
      resourceName: 'large-dag-workflow',
      templateName: 'main',
      taskName: 'upstream',
    }
  );
  const echoDefinitionLine = document.length - 1;
  assert.deepStrictEqual(
    service.getNavigationTarget(document, {
      line: echoDefinitionLine,
      character: document[echoDefinitionLine].indexOf('echo'),
    }),
    {
      kind: 'localTemplateReferences',
      resourceName: 'large-dag-workflow',
      templateName: 'echo',
    }
  );
});

test('resolves navigation when list items align with their parent key', () => {
  const document = new TestDocumentReader(`apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: same-indent
spec:
  entrypoint: main
  templates:
  - name: main
    dag:
      tasks:
      - name: task-a
        template: helper
      - name: task-b
        dependencies: [task-a]
  - name: helper`);

  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 14, character: 10 }),
    {
      kind: 'templateReferences',
      workflowTemplateName: 'same-indent',
      templateName: 'helper',
    }
  );
  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 10, character: 14 }),
    {
      kind: 'dagTaskReferences',
      resourceName: 'same-indent',
      templateName: 'main',
      taskName: 'task-a',
    }
  );
  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 13, character: document[13].indexOf('task-a') }),
    {
      kind: 'dagTaskDefinition',
      resourceName: 'same-indent',
      templateName: 'main',
      taskName: 'task-a',
    }
  );
  assert.deepStrictEqual(
    service.getNavigationTarget(document, { line: 11, character: 18 }),
    {
      kind: 'localTemplateDefinition',
      resourceName: 'same-indent',
      templateName: 'helper',
    }
  );
});
