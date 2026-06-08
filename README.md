# Uranus YAML

Uranus YAML is a TypeScript workspace for Argo Workflow YAML navigation. The project has one shared navigation engine and editor adapters for VS Code, Neovim/LSP clients, and Zed.

## Architecture

```text
packages/
├── core/              Shared YAML navigation engine
├── lsp-server/        LSP adapter and `uranus-yaml-lsp` binary
├── zed-extension/     Zed extension that launches the LSP server
├── vscode-extension/  VS Code adapter and extension manifest
└── shared-config/     Shared TypeScript compiler configuration
```

The core package owns workspace scanning, template search, caching, and cursor-context resolution. Editor packages should only translate editor APIs to core inputs and convert core results back to editor locations.

## Features

- Go from `templateRef.template` to the matching template definition.
- Go from `templateRef.name` or `workflowTemplateRef.name` to the WorkflowTemplate definition.
- Go between inline `template`, `entrypoint`, `onExit`, DAG `dependencies`, and enhanced `depends` calls and their definitions/references.
- Distinguish `WorkflowTemplate` and `ClusterWorkflowTemplate` calls through `clusterScope: true`.
- Find references from template definitions, DAG task names, and WorkflowTemplate names.
- Resolve same-named templates through the surrounding WorkflowTemplate context.
- Share the same behavior between VS Code and LSP clients.

## VS Code usage

Install the extension from the marketplace:

```bash
code --install-extension ThaiPham.uranus-yaml-lsp
```

Or build it from source:

```bash
make install
npm run build:vscode
npm run package:vscode
code --install-extension packages/vscode-extension/uranus-yaml-*.vsix
```

Open a workspace that contains Argo YAML files, then use Go to Definition (`F12`) on a call or Find All References (`Shift+F12`) on a definition.

## Neovim usage

Install the LSP server globally:

```bash
npm install -g @uranus-yaml/lsp-server
```

Or build and install it from source:

```bash
make install
make build
make install-lsp
```

On Neovim 0.11+ you can register the server with the built-in LSP client (no `nvim-lspconfig` required):

```lua
vim.lsp.config('uranus_yaml', {
  cmd = { 'uranus-yaml-lsp', '--stdio' },
  filetypes = { 'yaml', 'yml' },
  root_markers = { '.git', 'package.json' },
})
vim.lsp.enable('uranus_yaml')
```

If you use `nvim-lspconfig` and your version does not already include this server, register it explicitly:

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

if not configs.uranus_yaml then
  configs.uranus_yaml = {
    default_config = {
      cmd = { 'uranus-yaml-lsp', '--stdio' },
      filetypes = { 'yaml', 'yml' },
      root_dir = lspconfig.util.root_pattern('.git', 'package.json'),
      settings = {},
    },
  }
end

lspconfig.uranus_yaml.setup{}
```

Use normal LSP commands in YAML buffers:

- `gd`: go to definition.
- `gr`: find references.

## Zed usage

The Zed adapter is a local Zed extension in `packages/zed-extension`. It attaches Uranus YAML to Zed's built-in YAML language and starts the existing `uranus-yaml-lsp` server.

Install Rust with `rustup`, then install the Rust target that Zed uses for extensions:

```bash
rustup target add wasm32-wasip2
```

Then install the extension in Zed:

1. Open Zed.
2. Open the command palette.
3. Run `zed: extensions`.
4. Click **Install Dev Extension**.
5. Select this repo's `packages/zed-extension` directory, which contains `extension.toml`.

Open a workspace that contains Argo YAML files, then use Zed's normal go-to-definition and find-references actions on WorkflowTemplate names or template names.

Server startup behavior:

1. If `uranus-yaml-lsp` is already on `PATH`, Zed runs `uranus-yaml-lsp --stdio`.
2. Otherwise, the extension installs `@uranus-yaml/lsp-server` with npm and runs the installed server with `--stdio`.

For local development against this checkout, install the local server globally before opening Zed:

```bash
make install
make build
make install-lsp
```

That makes Zed use your locally built `uranus-yaml-lsp` binary instead of downloading the npm package.

## YAML example

Reference:

```yaml
templateRef:
  name: my-workflow-template
  template: step1
```

Definition:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: my-workflow-template
spec:
  templates:
    - name: step1
      container:
        image: alpine
```

## Development

Prerequisites:

- Node.js 18+
- npm 8+
- TypeScript 5+

Common commands:

```bash
make install        # install dependencies
make build          # build all packages
make test           # run core navigation tests
make watch          # watch all packages
make package        # build release artifacts
make dev-lsp        # build and run the LSP server locally
```

Package-specific commands:

```bash
npm run build:core
npm run build:lsp
npm run build:vscode
npm run package:lsp
npm run package:vscode
```

Zed extension development:

```bash
cargo check --manifest-path packages/zed-extension/Cargo.toml --target wasm32-wasip2
```

## Manual verification

Use fixtures in `packages/core/test-files` after running `make build`.

VS Code:

1. Press F5 to launch the Extension Development Host.
2. Open a fixture YAML file.
3. Use `F12` on local `template`, cross-resource `templateRef`, `workflowTemplateRef`, and DAG `depends` values.
4. Use `Shift+F12` on template and DAG task definitions.
5. Confirm `clusterScope: true` calls in `argo-call-methods.yaml` resolve only to the `ClusterWorkflowTemplate` document.

Neovim:

1. Run `make install-lsp` or make sure `uranus-yaml-lsp` is on `PATH`.
2. Open the fixture folder in Neovim.
3. Use `gd` on `tem-tem1` and `step1`.
4. Use `gr` from template definitions to confirm references are listed.

Zed:

1. Run `rustup target add wasm32-wasip2` once.
2. Install `packages/zed-extension` with **Install Dev Extension** in Zed.
3. Open `packages/core/test-files` in Zed.
4. Use go-to-definition on `tem-tem1` and `step1`.
5. Use find-references from template definitions to confirm references are listed.

## Troubleshooting

- Confirm files use `.yaml` or `.yml` extensions.
- Confirm the workspace root contains the referenced WorkflowTemplate files.
- Place the cursor directly on the template or WorkflowTemplate name.
- In VS Code, inspect Developer Tools for extension errors.
- In Neovim, use `:LspInfo` and `:LspLog` to inspect LSP status.
- In Zed, confirm the dev extension is installed and `@uranus-yaml/lsp-server` can be installed by npm if `uranus-yaml-lsp` is not on `PATH`.

## License

MIT. See `LICENSE` for details.
