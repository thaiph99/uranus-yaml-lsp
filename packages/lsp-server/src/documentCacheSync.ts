import { fileURLToPath } from 'node:url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { WorkspaceCacheService } from '@uranus-yaml/core';

export function getDocumentFilePath(uri: string): string | undefined {
  return uri.startsWith('file:') ? fileURLToPath(uri) : undefined;
}

export function cacheOpenDocument(
  cache: WorkspaceCacheService,
  document: TextDocument
): void {
  const filePath = getDocumentFilePath(document.uri);
  if (filePath) {
    cache.set(filePath, document.getText());
  }
}

export function removeClosedDocument(
  cache: WorkspaceCacheService,
  document: TextDocument
): void {
  const filePath = getDocumentFilePath(document.uri);
  if (filePath) {
    cache.delete(filePath);
  }
}
