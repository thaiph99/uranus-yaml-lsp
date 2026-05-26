const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const { FileSystemService, TemplateSearchService } = require('../dist');

const fixturesRoot = path.resolve(__dirname, '..', 'test-files');
const service = new TemplateSearchService(new FileSystemService());

function summarizeLocations(result) {
  return result.locations.map((location) => ({
    file: path.basename(location.file),
    line: location.line + 1,
    character: location.character,
    endCharacter: location.endCharacter,
  }));
}

test('findTemplateDefinition locates WorkflowTemplate tem-tem1', async () => {
  const result = await service.findTemplateDefinition(fixturesRoot, 'tem-tem1');

  assert.deepStrictEqual(summarizeLocations(result), [
    { file: 'tem1.yaml', line: 4, character: 8, endCharacter: 16 },
  ]);
});

test('findTemplateInWorkflowTemplate locates step1 inside tem-tem1', async () => {
  const result = await service.findTemplateInWorkflowTemplate(
    fixturesRoot,
    'tem-tem1',
    'step1'
  );

  assert.deepStrictEqual(summarizeLocations(result), [
    { file: 'tem1.yaml', line: 7, character: 12, endCharacter: 17 },
  ]);
});

test('findWorkflowTemplateReferences includes workflow reference fixture', async () => {
  const result = await service.findWorkflowTemplateReferences(
    fixturesRoot,
    'tem-tem1'
  );

  assert.ok(
    summarizeLocations(result).some(
      (location) =>
        location.file === 'workflow-with-workflowtemplate-ref.yaml' &&
        location.line === 7 &&
        location.character === 10 &&
        location.endCharacter === 18
    )
  );
});

test('locations start at the value when key and value text overlap', async () => {
  const workflowTemplateDefinition = await service.findTemplateDefinition(
    fixturesRoot,
    'name'
  );
  const templateReferences = await service.findTemplateReferences(
    fixturesRoot,
    'name',
    'template'
  );

  assert.ok(
    summarizeLocations(workflowTemplateDefinition).some(
      (location) =>
        location.file === 'value-overlap.yaml' &&
        location.line === 4 &&
        location.character === 8 &&
        location.endCharacter === 12
    )
  );
  assert.ok(
    summarizeLocations(templateReferences).some(
      (location) =>
        location.file === 'value-overlap.yaml' &&
        location.line === 23 &&
        location.character === 24 &&
        location.endCharacter === 32
    )
  );
});

test('findTemplateInArgoResource locates inline Workflow templates', async () => {
  const result = await service.findTemplateInArgoResource(
    fixturesRoot,
    'local-function-workflow',
    'step-template'
  );

  assert.deepStrictEqual(summarizeLocations(result), [
    { file: 'argo-call-methods.yaml', line: 34, character: 12, endCharacter: 25 },
  ]);
});

test('findTemplateInWorkflowTemplate locates ClusterWorkflowTemplate templates', async () => {
  const result = await service.findTemplateInWorkflowTemplate(
    fixturesRoot,
    'cluster-library',
    'cluster-step',
    true
  );

  assert.deepStrictEqual(summarizeLocations(result), [
    { file: 'argo-call-methods.yaml', line: 56, character: 12, endCharacter: 24 },
  ]);
});

test('findLocalTemplateReferences includes entrypoint, onExit, steps, dag, and hooks', async () => {
  const expectations = [
    ['main', 6, 14, 18],
    ['exit-handler', 7, 10, 22],
    ['workflow-hook', 11, 16, 29],
    ['step-template', 16, 22, 35],
    ['hook-template', 19, 26, 39],
    ['dag-template', 33, 22, 34],
  ];

  for (const [templateName, line, character, endCharacter] of expectations) {
    const result = await service.findLocalTemplateReferences(
      fixturesRoot,
      'local-function-workflow',
      templateName
    );

    assert.ok(
      summarizeLocations(result).some(
        (location) =>
          location.file === 'argo-call-methods.yaml' &&
          location.line === line &&
          location.character === character &&
          location.endCharacter === endCharacter
      )
    );
  }
});

test('findLocalTemplateReferences scopes same-named local resources to the source file', async () => {
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
  const fileSystem = {
    async findYamlFiles() {
      return ['/workspace/source.yaml', '/workspace/other.yaml'];
    },
    async readFileContent() {
      return content;
    },
  };
  const scopedService = new TemplateSearchService(fileSystem);

  const result = await scopedService.findLocalTemplateReferences(
    '/workspace',
    'duplicate-local-workflow',
    'shared',
    '/workspace/source.yaml'
  );

  assert.deepStrictEqual(summarizeLocations(result), [
    { file: 'source.yaml', line: 10, character: 22, endCharacter: 28 },
  ]);
});

test('findLocalTemplateReferences locates local template calls in a second workflow file', async () => {
  const sourceFile = path.join(fixturesRoot, 'dag-dependencies-copy.yaml');
  const dagReference = await service.findLocalTemplateReferences(
    fixturesRoot,
    'dag-dependency-workflow-copy',
    'dependency-dag-duplicate',
    sourceFile
  );
  const stepsReference = await service.findLocalTemplateReferences(
    fixturesRoot,
    'dag-dependency-workflow-copy',
    'steps-negative-tests',
    sourceFile
  );

  assert.deepStrictEqual(summarizeLocations(dagReference), [
    { file: 'dag-dependencies-copy.yaml', line: 25, character: 22, endCharacter: 46 },
  ]);
  assert.deepStrictEqual(summarizeLocations(stepsReference), [
    { file: 'dag-dependencies-copy.yaml', line: 33, character: 22, endCharacter: 42 },
  ]);
});

test('findTemplateReferences includes cluster-scoped templateRef calls', async () => {
  const result = await service.findTemplateReferences(
    fixturesRoot,
    'cluster-library',
    'cluster-step',
    true
  );

  assert.deepStrictEqual(summarizeLocations(result), [
    { file: 'argo-call-methods.yaml', line: 27, character: 24, endCharacter: 36 },
    { file: 'argo-call-methods.yaml', line: 85, character: 24, endCharacter: 36 },
  ]);
});

test('reusable template lookups separate namespaced and cluster-scoped resources with the same name', async () => {
  const namespacedDefinition = await service.findTemplateInWorkflowTemplate(
    fixturesRoot,
    'cluster-library',
    'cluster-step'
  );
  const namespacedReferences = await service.findTemplateReferences(
    fixturesRoot,
    'cluster-library',
    'cluster-step'
  );
  const clusterWorkflowReferences = await service.findWorkflowTemplateReferences(
    fixturesRoot,
    'cluster-library',
    true
  );
  const namespacedWorkflowReferences = await service.findWorkflowTemplateReferences(
    fixturesRoot,
    'cluster-library'
  );

  assert.deepStrictEqual(summarizeLocations(namespacedDefinition), [
    { file: 'argo-call-methods.yaml', line: 66, character: 12, endCharacter: 24 },
  ]);
  assert.deepStrictEqual(summarizeLocations(namespacedReferences), [
    { file: 'argo-call-methods.yaml', line: 81, character: 24, endCharacter: 36 },
  ]);
  assert.deepStrictEqual(summarizeLocations(namespacedWorkflowReferences), [
    { file: 'argo-call-methods.yaml', line: 80, character: 20, endCharacter: 35 },
    { file: 'argo-call-methods.yaml', line: 94, character: 10, endCharacter: 25 },
  ]);
  assert.deepStrictEqual(summarizeLocations(clusterWorkflowReferences), [
    { file: 'argo-call-methods.yaml', line: 26, character: 20, endCharacter: 35 },
    { file: 'argo-call-methods.yaml', line: 84, character: 20, endCharacter: 35 },
    { file: 'argo-call-methods.yaml', line: 102, character: 10, endCharacter: 25 },
  ]);
});

test('findDagTaskDefinition locates only direct tasks in the scoped DAG template', async () => {
  const result = await service.findDagTaskDefinition(
    fixturesRoot,
    'dag-dependency-workflow',
    'dependency-dag',
    'template-name-collision'
  );

  assert.deepStrictEqual(summarizeLocations(result), [
    { file: 'dag-dependencies.yaml', line: 35, character: 18, endCharacter: 41 },
  ]);
});

test('findDagTaskReferences locates inline, multiline, and depends references in one DAG', async () => {
  const result = await service.findDagTaskReferences(
    fixturesRoot,
    'dag-dependency-workflow',
    'dependency-dag',
    'A'
  );

  assert.deepStrictEqual(summarizeLocations(result), [
    { file: 'dag-dependencies.yaml', line: 23, character: 27, endCharacter: 28 },
    { file: 'dag-dependencies.yaml', line: 27, character: 16, endCharacter: 17 },
    { file: 'dag-dependencies.yaml', line: 31, character: 22, endCharacter: 23 },
    { file: 'dag-dependencies.yaml', line: 37, character: 21, endCharacter: 22 },
  ]);
});

test('findDagTaskReferences excludes matching task names from other DAG templates', async () => {
  const result = await service.findDagTaskReferences(
    fixturesRoot,
    'dag-dependency-workflow',
    'dependency-dag',
    'B'
  );

  assert.deepStrictEqual(summarizeLocations(result), [
    { file: 'dag-dependencies.yaml', line: 31, character: 28, endCharacter: 29 },
  ]);
});

test('findDagTaskReferences excludes local template calls and template definitions', async () => {
  const result = await service.findDagTaskReferences(
    fixturesRoot,
    'dag-dependency-workflow',
    'dependency-dag',
    'template-name-collision'
  );

  assert.deepStrictEqual(summarizeLocations(result), []);
});

test('findDagTaskReferences supports complex task names in dependencies and depends', async () => {
  const trainModel = await service.findDagTaskReferences(
    fixturesRoot,
    'dag-dependency-workflow',
    'dependency-dag',
    'train-model-1'
  );
  const fanIn = await service.findDagTaskReferences(
    fixturesRoot,
    'dag-dependency-workflow',
    'dependency-dag',
    'fan_in'
  );

  assert.deepStrictEqual(summarizeLocations(trainModel), [
    { file: 'dag-dependencies.yaml', line: 23, character: 30, endCharacter: 43 },
    { file: 'dag-dependencies.yaml', line: 31, character: 57, endCharacter: 70 },
  ]);
  assert.deepStrictEqual(summarizeLocations(fanIn), [
    { file: 'dag-dependencies.yaml', line: 28, character: 16, endCharacter: 22 },
    { file: 'dag-dependencies.yaml', line: 31, character: 87, endCharacter: 93 },
  ]);
});

test('findDagTaskReferences ignores result suffix names in enhanced depends expressions', async () => {
  const succeeded = await service.findDagTaskReferences(
    fixturesRoot,
    'dag-dependency-workflow',
    'dependency-dag',
    'Succeeded'
  );
  const b = await service.findDagTaskReferences(
    fixturesRoot,
    'dag-dependency-workflow',
    'dependency-dag',
    'B'
  );
  const c = await service.findDagTaskReferences(
    fixturesRoot,
    'dag-dependency-workflow',
    'dependency-dag',
    'C'
  );

  assert.deepStrictEqual(summarizeLocations(succeeded), []);
  assert.deepStrictEqual(summarizeLocations(b), [
    { file: 'dag-dependencies.yaml', line: 31, character: 28, endCharacter: 29 },
  ]);
  assert.deepStrictEqual(summarizeLocations(c), [
    { file: 'dag-dependencies.yaml', line: 31, character: 44, endCharacter: 45 },
  ]);
});

test('findDagTaskReferences returns exact ranges for downstream task dependencies', async () => {
  const inlineDependencies = await service.findDagTaskReferences(
    fixturesRoot,
    'dag-dependency-workflow',
    'dependency-dag',
    'inline-dependencies'
  );
  const multilineDependencies = await service.findDagTaskReferences(
    fixturesRoot,
    'dag-dependency-workflow',
    'dependency-dag',
    'multiline-dependencies'
  );

  assert.deepStrictEqual(summarizeLocations(inlineDependencies), [
    { file: 'dag-dependencies.yaml', line: 34, character: 27, endCharacter: 46 },
  ]);
  assert.deepStrictEqual(summarizeLocations(multilineDependencies), [
    { file: 'dag-dependencies.yaml', line: 34, character: 48, endCharacter: 70 },
  ]);
});

test('uses an injected workspace cache for repeated searches', async () => {
  const content = `apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: cached-library`;
  let cachedContent;
  let reads = 0;
  const fileSystem = {
    async findYamlFiles() {
      return ['/workspace/cached.yaml'];
    },
    async readFileContent() {
      reads += 1;
      return content;
    },
  };
  const cache = {
    get() {
      return cachedContent;
    },
    set(_key, value) {
      cachedContent = value;
    },
  };
  const cachedService = new TemplateSearchService(fileSystem, cache);

  const first = await cachedService.findTemplateDefinition('/workspace', 'cached-library');
  const second = await cachedService.findTemplateDefinition('/workspace', 'cached-library');

  assert.deepStrictEqual(summarizeLocations(first), [
    { file: 'cached.yaml', line: 4, character: 8, endCharacter: 22 },
  ]);
  assert.deepStrictEqual(summarizeLocations(second), summarizeLocations(first));
  assert.equal(reads, 1);
});
