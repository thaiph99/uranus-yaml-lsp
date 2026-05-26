const assert = require('node:assert/strict');
const { test } = require('node:test');

const { TextDocument } = require('vscode-languageserver-textdocument');
const {
  TemplateSearchService,
  WorkspaceCacheService,
} = require('../dist/node_modules/@uranus-yaml/core');
const {
  cacheOpenDocument,
  getDocumentFilePath,
  removeClosedDocument,
} = require('../dist/documentCacheSync');

test('live LSP document content refreshes cached local-template reference searches', async () => {
  const savedContent = `apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: local-workflow
spec:
  templates:
    - name: main
    - name: shared`;
  const changedContent = `apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: local-workflow
spec:
  templates:
    - name: main
      steps:
        - - name: call-shared
            template: shared
    - name: shared`;
  const filePath = '/workspace/source.yaml';
  let reads = 0;
  const fileSystem = {
    async findYamlFiles() {
      return [filePath];
    },
    async readFileContent() {
      reads += 1;
      return savedContent;
    },
  };
  const cache = new WorkspaceCacheService();
  const service = new TemplateSearchService(fileSystem, cache);

  const initial = await service.findLocalTemplateReferences(
    '/workspace',
    'local-workflow',
    'shared',
    filePath
  );
  assert.deepStrictEqual(initial.locations, []);
  assert.equal(reads, 1);

  const document = TextDocument.create(`file://${filePath}`, 'yaml', 2, changedContent);
  cacheOpenDocument(cache, document);
  const changed = await service.findLocalTemplateReferences(
    '/workspace',
    'local-workflow',
    'shared',
    filePath
  );
  assert.deepStrictEqual(changed.locations, [{
    file: filePath,
    line: 9,
    character: 22,
    endCharacter: 28,
  }]);
  assert.equal(reads, 1);

  removeClosedDocument(cache, document);
  const closed = await service.findLocalTemplateReferences(
    '/workspace',
    'local-workflow',
    'shared',
    filePath
  );
  assert.deepStrictEqual(closed.locations, []);
  assert.equal(reads, 2);
});

test('file document URIs are converted to decoded filesystem paths', () => {
  assert.equal(
    getDocumentFilePath('file:///workspace/my%20workflow.yaml'),
    '/workspace/my workflow.yaml'
  );
});
