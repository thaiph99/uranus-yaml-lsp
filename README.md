# Uranus YAML

Uranus YAML is a TypeScript workspace for Argo Workflow YAML navigation. The project has one shared navigation engine and two editor adapters: a VS Code extension and a standard Language Server Protocol server for Neovim or any LSP-compatible editor.

## Architecture

```text
packages/
├── core/              Shared YAML navigation engine
├── lsp-server/        LSP adapter and `uranus-yaml-lsp` binary
├── vscode-extension/  VS Code adapter and extension manifest
└── shared-config/     Shared TypeScript compiler configuration
```

The core package owns workspace scanning, template search, caching, and cursor-context resolution. Editor packages should only translate editor APIs to core inputs and convert core results back to editor locations.

## Features

- Go from `templateRef.template` to the matching template definition.
- Go from `templateRef.name` or `workflowTemplateRef.name` to the WorkflowTemplate definition.
- Find references from template definitions and WorkflowTemplate names.
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
code --install-extension packages/vscode-extension/uranus-yaml-lsp-*.vsix
```

Open a workspace that contains Argo YAML files, then Ctrl+Click a WorkflowTemplate name or template name. VS Code uses the extension's definition provider to jump to definitions or show references.

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

Add this server definition to your Neovim LSP configuration if your `nvim-lspconfig` version does not already include it:

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

## Manual verification

Use fixtures in `packages/core/test-files` after running `make build`.

VS Code:

1. Press F5 to launch the Extension Development Host.
2. Open a fixture YAML file.
3. Ctrl+Click `tem-tem1` and `step1`.
4. Confirm definitions resolve to `tem1.yaml` and references include `workflow-with-workflowtemplate-ref.yaml`.

Neovim:

1. Run `make install-lsp` or make sure `uranus-yaml-lsp` is on `PATH`.
2. Open the fixture folder in Neovim.
3. Use `gd` on `tem-tem1` and `step1`.
4. Use `gr` from template definitions to confirm references are listed.

## Troubleshooting

- Confirm files use `.yaml` or `.yml` extensions.
- Confirm the workspace root contains the referenced WorkflowTemplate files.
- Place the cursor directly on the template or WorkflowTemplate name.
- In VS Code, inspect Developer Tools for extension errors.
- In Neovim, use `:LspInfo` and `:LspLog` to inspect LSP status.

## License

MIT. See `LICENSE` for details.
