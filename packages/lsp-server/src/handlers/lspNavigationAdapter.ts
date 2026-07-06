import { Location } from 'vscode-languageserver';
import { WorkflowTemplateLocation } from '@uranus-yaml/core';

export function toLspLocations(locations: readonly WorkflowTemplateLocation[]): Location[] {
  return locations.map((location) => ({
    uri: `file://${location.file}`,
    range: {
      start: { line: location.line, character: location.character },
      end: { line: location.line, character: location.endCharacter }
    }
  }));
}
