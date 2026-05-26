import { Location } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  TextDocumentReader,
  WorkflowTemplateLocation
} from '@uranus-yaml/core';

export class LspDocumentReader implements TextDocumentReader {
  public readonly lineCount: number;

  constructor(private readonly document: TextDocument) {
    this.lineCount = document.lineCount;
  }

  public getLine(line: number): string {
    return this.document.getText({
      start: { line, character: 0 },
      end: { line, character: Number.MAX_VALUE }
    });
  }
}

export function toLspLocations(locations: readonly WorkflowTemplateLocation[]): Location[] {
  return locations.map((location) => ({
    uri: `file://${location.file}`,
    range: {
      start: { line: location.line, character: location.character },
      end: { line: location.line, character: location.endCharacter }
    }
  }));
}
