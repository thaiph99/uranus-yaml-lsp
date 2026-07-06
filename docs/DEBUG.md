# Debugging Navigation

Navigation has four stages:

1. `argoYamlCursorSyntax.ts` reads the navigable token under the cursor, and `argoYamlDocumentContext.ts` finds its enclosing resource, template, DAG section, or reusable-reference block.
2. `argoYamlTargetContext.ts` recognizes whether that value is a DAG task, template declaration, reusable-template call, or local call.
3. `ArgoYamlNavigationService.getNavigationTarget()` is the public classification API; it maps the recognized context to a definition or reference search target.
4. Shared target-search routing calls `TemplateSearchService`, which reads workspace files through `WorkspaceCacheService` and delegates YAML location matching to `argoYamlLocationSearch.ts`.

VS Code and the LSP server are adapters: they pass the editor document to core as a plain array of lines and convert core locations back to editor locations.
LSP handlers share their result-range conversion in `lspNavigationAdapter.ts`, so returned locations retain the YAML value span identified by core search.

Shared YAML vocabulary, such as Argo resource kinds, navigation scalar values, and indentation, belongs in `argoYamlSyntax.ts`. Cursor token recognition belongs in `argoYamlCursorSyntax.ts`; cursor-relative containing-block lookup belongs in `argoYamlDocumentContext.ts`; semantic context detection belongs in `argoYamlTargetContext.ts`; reusable resource and template traversal belongs in `argoYamlStructure.ts`; content matches and exact result ranges belong in `argoYamlLocationSearch.ts`. `WorkspaceCacheService` owns cached file contents used during workspace scans. Parsing of DAG `dependencies` and `depends` expressions belongs in `dagDependencySyntax.ts`. Keep editor protocol concerns out of core parsing and keep YAML regular expressions out of adapters.

## Commands

- Use Go to Definition (`F12`, Ctrl+Click in VS Code, or `gd` in Neovim) on a call value.
- Use Find All References (`Shift+F12` in VS Code or `gr` in Neovim) on a declaration.

Do not use Ctrl+Click as a reference-search test: VS Code invokes its definition provider for Ctrl+Click.

## Diagnosis Checklist

1. Reproduce the issue in one of the fixtures under `packages/core/test-files`.
2. Determine whether the cursor should resolve a local template, reusable template, DAG task, or reusable-template resource.
3. Add or adjust a core navigation test if the target kind is wrong.
4. Add or adjust a core search test if the target is correct but its locations are wrong.
5. Add an LSP handler test only when protocol conversion or target routing is at fault.

For manual reproduction steps, see [TESTING.md](TESTING.md).
