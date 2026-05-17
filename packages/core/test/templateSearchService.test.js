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
