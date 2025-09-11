#!/usr/bin/env node

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { FileSystemService, TemplateSearchService } from '@uranus-yaml/core';
import { DefinitionHandler, ReferencesHandler } from './handlers';

const connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let workspaceRoot = '';

// Core services
let fileSystemService: FileSystemService;
let templateSearchService: TemplateSearchService;
let definitionHandler: DefinitionHandler;
let referencesHandler: ReferencesHandler;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  // Get workspace root
  if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    workspaceRoot = params.workspaceFolders[0].uri.replace('file://', '');
  } else if (params.rootUri) {
    workspaceRoot = params.rootUri.replace('file://', '');
  } else if (params.rootPath) {
    workspaceRoot = params.rootPath;
  }

  // Initialize services
  fileSystemService = new FileSystemService();
  templateSearchService = new TemplateSearchService(fileSystemService);
  definitionHandler = new DefinitionHandler(templateSearchService, documents, workspaceRoot);
  referencesHandler = new ReferencesHandler(templateSearchService, documents, workspaceRoot);

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      definitionProvider: true,
      referencesProvider: true
    }
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }

  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

// Handle definition requests
connection.onDefinition(async (params) => {
  try {
    return await definitionHandler.handleDefinition(params);
  } catch (error) {
    connection.console.error(`Error handling definition request: ${error}`);
    return null;
  }
});

// Handle references requests
connection.onReferences(async (params) => {
  try {
    return await referencesHandler.handleReferences(params);
  } catch (error) {
    connection.console.error(`Error handling references request: ${error}`);
    return [];
  }
});

// Handle configuration changes
connection.onDidChangeConfiguration(_change => {
  // Placeholder for configuration handling
});

// Handle document changes
documents.onDidChangeContent(_change => {
  // Placeholder for document change handling
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

export { connection, documents };