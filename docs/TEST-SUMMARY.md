# Navigation Test Coverage

Automated coverage is split by ownership:

| Test suite | Covered behavior |
| --- | --- |
| `packages/core/test/argoYamlNavigationService.test.js` | Maps cursor positions to definition or reference targets, including local calls, DAG dependencies, and `clusterScope` |
| `packages/core/test/templateSearchService.test.js` | Finds exact definition/reference locations in fixtures and preserves resource/DAG scope |
| `packages/lsp-server/test/definitionHandler.test.js` | Routes `gd` targets to core searches and preserves exact LSP result ranges |
| `packages/lsp-server/test/referencesHandler.test.js` | Routes `gr` targets, including DAG and cluster-scoped references, with exact ranges |

Run all automated navigation checks with:

```bash
make test
```

Manual editor verification remains useful for provider registration and editor UI behavior. Use the matrix in [TESTING.md](TESTING.md).
