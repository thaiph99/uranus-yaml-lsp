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
  }));
}

test('findTemplateDefinition locates WorkflowTemplate tem-tem1', async () => {
  const result = await service.findTemplateDefinition(fixturesRoot, 'tem-tem1');

  assert.deepStrictEqual(summarizeLocations(result), [
    { file: 'tem1.yaml', line: 4 },
  ]);
});

test('findTemplateInWorkflowTemplate locates step1 inside tem-tem1', async () => {
  const result = await service.findTemplateInWorkflowTemplate(
    fixturesRoot,
    'tem-tem1',
    'step1'
  );

  assert.deepStrictEqual(summarizeLocations(result), [
    { file: 'tem1.yaml', line: 7 },
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
        location.line === 7
    )
  );
});
