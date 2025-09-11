import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
    Definition,
    Location,
    Position,
    Range,
    ReferenceParams
} from 'vscode-languageserver/node';

import {
    TextDocument
} from 'vscode-languageserver-textdocument';
import { FileSystemService } from '../core/services/fileSystemService';
import { TemplateSearchService } from '../core/services/templateSearchService';
import { URI } from 'vscode-uri';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

const fileSystemService = new FileSystemService();
const templateSearchService = new TemplateSearchService(fileSystemService);

let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

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

connection.onDefinition(async (params: TextDocumentPositionParams): Promise<Definition | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    const position = params.position;

    const wordRange = getWordRangeAtPosition(document, position);
    if (!wordRange) {
        return null;
    }

    const word = document.getText(wordRange);

    if (!word) {
        return null;
    }

    const workspaceFolders = await connection.workspace.getWorkspaceFolders();
    if (!workspaceFolders) {
        return null;
    }
    const rootPath = URI.parse(workspaceFolders[0].uri).fsPath;

    const result = await templateSearchService.findTemplateDefinition(rootPath, word);

    if (!result) {
        return null;
    }

    return result.locations.map(location => {
        return Location.create(URI.file(location.file).toString(), { start: { line: location.line, character: 0 }, end: { line: location.line, character: 0 } });
    });
});

connection.onReferences(async (params: ReferenceParams): Promise<Location[] | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    const position = params.position;

    const wordRange = getWordRangeAtPosition(document, position);
    if (!wordRange) {
        return null;
    }

    const word = document.getText(wordRange);

    if (!word) {
        return null;
    }

    const workspaceFolders = await connection.workspace.getWorkspaceFolders();
    if (!workspaceFolders) {
        return null;
    }
    const rootPath = URI.parse(workspaceFolders[0].uri).fsPath;

    // This is a simplified implementation. A real implementation would need to
    // determine the context of the word (e.g., is it a template definition or a reference)
    // and then call the appropriate method on the templateSearchService.
    const result = await templateSearchService.findTemplateDefinition(rootPath, word);

    if (!result) {
        return null;
    }

    return result.locations.map(location => {
        return Location.create(URI.file(location.file).toString(), { start: { line: location.line, character: 0 }, end: { line: location.line, character: 0 } });
    });
});

function getWordRangeAtPosition(document: TextDocument, position: Position): Range | undefined {
    const line = document.getText({ start: { line: position.line, character: 0 }, end: { line: position.line, character: Infinity } });
    const wordRegex = /[\w-]+/g;
    let match;
    while ((match = wordRegex.exec(line))) {
        const word = match[0];
        const start = match.index;
        const end = start + word.length;
        if (position.character >= start && position.character <= end) {
            return { start: { line: position.line, character: start }, end: { line: position.line, character: end } };
        }
    }
    return undefined;
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();