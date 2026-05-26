# Uranus YAML VS Code Extension

This package provides the VS Code adapter for Uranus YAML. It registers YAML definition and reference providers and delegates Argo Workflow navigation to `@uranus-yaml/core`.

## Install

From the VS Code Marketplace:

```bash
code --install-extension ThaiPham.uranus-yaml-lsp
```

From this repository:

```bash
make install
npm run build:vscode
npm run package:vscode
code --install-extension packages/vscode-extension/uranus-yaml-*.vsix
```

## Usage

1. Open a workspace that contains Argo Workflow YAML files.
2. Open a `.yaml` or `.yml` file.
3. Use `F12` on a call to go to its definition or `Shift+F12` on a definition to find uses.

Supported navigation:

- `templateRef.template`: jump to the template definition.
- `templateRef.name`: jump to the WorkflowTemplate definition.
- `workflowTemplateRef.name`: jump to the WorkflowTemplate definition.
- Local `template`, `entrypoint`, `onExit`, and hook calls: jump to local template definitions.
- DAG `dependencies` and enhanced `depends`: jump to DAG task declarations and find dependent tasks.
- `clusterScope: true`: resolve against `ClusterWorkflowTemplate`, not same-named `WorkflowTemplate` resources.
- Template definitions and reusable-template `metadata.name`: find their references with `Shift+F12`.

## Example

Reference:

```yaml
templateRef:
  name: tem-tem1
  template: step1
```

Definition:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: tem-tem1
spec:
  templates:
    - name: step1
      container:
        image: alpine
```

## Development

Build only the VS Code extension:

```bash
npm run build:vscode
```

Watch extension sources:

```bash
cd packages/vscode-extension
npm run watch
```

Manual test flow:

1. Press F5 in VS Code to open an Extension Development Host.
2. Open `packages/core/test-files`.
3. Use `F12` on the call forms in `argo-call-methods.yaml` and `dag-dependencies.yaml`.
4. Use `Shift+F12` from their template and DAG task definitions.
5. Confirm the colliding `cluster-library` resources resolve according to `clusterScope`.

Package the extension:

```bash
npm run package:vscode
```

## Troubleshooting

- Confirm the file is a `.yaml` or `.yml` file.
- Confirm the workspace contains the referenced WorkflowTemplate files.
- Place the cursor directly on the template or WorkflowTemplate name.
- Open VS Code Developer Tools to inspect extension errors.

## Package boundary

The VS Code extension should stay thin. Shared parsing, context resolution, workspace search, and cache logic belong in `@uranus-yaml/core`.
