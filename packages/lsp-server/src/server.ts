#!/usr/bin/env node

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { FileSystemService, TemplateSearchService, WorkspaceCacheService } from '@uranus-yaml/core';
import { cacheOpenDocument, getDocumentFilePath, removeClosedDocument } from './documentCacheSync';
import { DefinitionHandler, ReferencesHandler } from './handlers';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const workspaceCacheService = new WorkspaceCacheService();

let definitionHandler: DefinitionHandler;
let referencesHandler: ReferencesHandler;

connection.onInitialize((params: InitializeParams) => {
  const workspaceRoot =
    getDocumentFilePath(params.workspaceFolders?.[0]?.uri ?? params.rootUri ?? '') ??
    params.rootPath ?? '';

  const templateSearchService = new TemplateSearchService(new FileSystemService(), workspaceCacheService);
  definitionHandler = new DefinitionHandler(templateSearchService, documents, workspaceRoot);
  referencesHandler = new ReferencesHandler(templateSearchService, documents, workspaceRoot);

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      definitionProvider: true,
      referencesProvider: true
    }
  };

  if (params.capabilities.workspace?.workspaceFolders) {
    result.capabilities.workspace = { workspaceFolders: { supported: true } };
  }

  return result;
});

connection.onDefinition(async (params) => {
  try {
    return await definitionHandler.handleDefinition(params);
  } catch (error) {
    connection.console.error(`Error handling definition request: ${error}`);
    return null;
  }
});

connection.onReferences(async (params) => {
  try {
    return await referencesHandler.handleReferences(params);
  } catch (error) {
    connection.console.error(`Error handling references request: ${error}`);
    return [];
  }
});

// Keep the workspace cache in sync with editor buffers.
documents.onDidOpen((change) => cacheOpenDocument(workspaceCacheService, change.document));
documents.onDidChangeContent((change) => cacheOpenDocument(workspaceCacheService, change.document));
documents.onDidClose((change) => removeClosedDocument(workspaceCacheService, change.document));

documents.listen(connection);
connection.listen();
