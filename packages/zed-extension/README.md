# Uranus YAML for Zed

This Zed extension connects Zed's built-in YAML language to the `uranus-yaml-lsp` language server.

## What it does

When this extension is installed, Zed starts Uranus YAML for YAML files. You can then use Zed's normal go-to-definition and find-references actions for Argo WorkflowTemplate references.

The extension starts the server in this order:

1. Use `uranus-yaml-lsp --stdio` from `PATH` when available.
2. If the binary is not on `PATH`, install `@uranus-yaml/lsp-server` with npm and run the installed server with `--stdio`.

## Requirements

- Zed
- Rust installed with `rustup`, for loading this local dev extension
- Node.js/npm, unless `uranus-yaml-lsp` is already on `PATH`

Install the Zed extension target once:

```bash
rustup target add wasm32-wasip2
```

## Install in Zed

1. Open Zed.
2. Open the command palette.
3. Run `zed: extensions`.
4. Click **Install Dev Extension**.
5. Select the `packages/zed-extension` directory from this repo. This is the directory that contains `extension.toml`.

## Use the local LSP server from this repo

If you want Zed to use your local checkout instead of the published npm package, install the server globally from this repo before opening Zed:

```bash
make install
make build
make install-lsp
```

Then confirm the binary is available:

```bash
uranus-yaml-lsp --stdio
```

Stop it with Ctrl+C after it starts.

## Use in YAML files

1. Open a workspace that contains Argo Workflow YAML files.
2. Open a `.yaml` or `.yml` file.
3. Use Zed's go-to-definition action on:
   - `templateRef.template` to jump to the template definition.
   - `templateRef.name` or `workflowTemplateRef.name` to jump to the WorkflowTemplate definition.
4. Use Zed's find-references action on:
   - template definitions under `spec.templates`.
   - WorkflowTemplate `metadata.name` values.

## Development check

From the repo root:

```bash
make check-zed
```

## Troubleshooting

- If navigation does not work, confirm the file is detected as YAML in Zed.
- If using the local server, confirm `uranus-yaml-lsp` is on `PATH` before launching Zed.
- If not using the local server, confirm npm can install `@uranus-yaml/lsp-server`.
- Confirm the opened workspace contains the WorkflowTemplate YAML files you want to navigate to.
- Put the cursor directly on the WorkflowTemplate or template name before running navigation.
