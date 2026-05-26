# Testing Navigation

## Automated Tests

Run the build-backed core and LSP tests:

```bash
make test
```

Build the VS Code adapter after changes to its provider registration or routing:

```bash
npm run build:vscode
```

The automated tests cover cursor-context routing, workspace searches, exact location ranges, LSP handler routing, local template calls, DAG task dependencies, and cluster-scoped lookups.

## VS Code Manual Check

1. Run `make build`, then press `F5` to open the Extension Development Host.
2. Open `packages/core/test-files` in that window.
3. Run the checks in the following table.

| Fixture and cursor value | Command | Expected result |
| --- | --- | --- |
| `workflow.yaml`, `template: step1` | `F12` | `tem1.yaml`, `- name: step1` |
| `tem1.yaml`, `- name: step1` | `Shift+F12` | Cross-resource call sites including `workflow.yaml` |
| `argo-call-methods.yaml`, `entrypoint: main` | `F12` | Local `- name: main` |
| `argo-call-methods.yaml`, cluster-scoped `template: cluster-step` | `F12` | The `ClusterWorkflowTemplate` definition, not the namespaced collision |
| `dag-dependencies.yaml`, `B.Succeeded` in `depends` | `F12` | DAG task `- name: B` in `dependency-dag` |
| `dag-dependencies.yaml`, task declaration `- name: A` | `Shift+F12` | Inline, multiline, and enhanced dependency uses in the same DAG |

## LSP Client Manual Check

Open the same fixtures in Neovim or Zed after installing or launching `uranus-yaml-lsp`:

- Use `gd` for each `F12` check above.
- Use `gr` for each `Shift+F12` check above.

## Troubleshooting

- Place the cursor on the YAML value, such as `step1` or `A`, rather than on the key.
- Confirm the workspace root includes `packages/core/test-files` or your target YAML documents.
- In VS Code, inspect Developer Tools for extension errors.
- In Neovim, inspect `:LspInfo` and `:LspLog`.
- In Zed, confirm its Uranus YAML dev extension can find or install `uranus-yaml-lsp`.
