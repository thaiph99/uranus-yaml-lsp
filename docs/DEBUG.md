# Debugging Navigation

Navigation has three stages:

1. `argoYamlDocumentContext.ts` finds the enclosing resource, template, DAG section, or reusable-reference block at the cursor.
2. `ArgoYamlNavigationService` classifies that YAML value as a definition search or a reference search target.
3. Shared target-search routing calls `TemplateSearchService`, which scans cached workspace files and delegates YAML location matching to `argoYamlLocationSearch.ts`.

VS Code and the LSP server are adapters: they convert editor documents and positions to core inputs and convert core locations back to editor locations.

Shared YAML vocabulary, such as Argo resource kinds, navigation scalar values, and indentation, belongs in `argoYamlSyntax.ts`. Cursor-relative containing-block lookup belongs in `argoYamlDocumentContext.ts`; reusable resource and template traversal belongs in `argoYamlStructure.ts`; content matches and exact result ranges belong in `argoYamlLocationSearch.ts`. Parsing of DAG `dependencies` and `depends` expressions belongs in `dagDependencySyntax.ts`. Keep editor protocol concerns out of core parsing and keep YAML regular expressions out of adapters.

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
