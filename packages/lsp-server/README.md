# Uranus YAML LSP Server

This package provides the `uranus-yaml-lsp` Language Server Protocol server. It adapts editor LSP requests to the shared `@uranus-yaml/core` navigation engine.

## Install

From npm:

```bash
npm install -g @uranus-yaml/lsp-server
```

From this repository:

```bash
make install
make build
make install-lsp
```

Verify the binary is available:

```bash
uranus-yaml-lsp --stdio
```

Stop the command with Ctrl+C after the server starts.

## Neovim setup

Add this configuration if your `nvim-lspconfig` version does not provide `uranus_yaml` yet:

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

Optional key mappings:

```lua
lspconfig.uranus_yaml.setup{
  on_attach = function(_, bufnr)
    local opts = { noremap = true, silent = true, buffer = bufnr }
    vim.keymap.set('n', 'gd', vim.lsp.buf.definition, opts)
    vim.keymap.set('n', 'gr', vim.lsp.buf.references, opts)
  end,
}
```

## Usage

Open an Argo Workflow YAML file and use normal LSP commands:

- `gd` on `templateRef.template`: jump to the template definition.
- `gd` on `templateRef.name` or `workflowTemplateRef.name`: jump to the WorkflowTemplate definition.
- `gd` on local `template`, `entrypoint`, `onExit`, or DAG dependency values: jump to local template or DAG task definitions.
- `clusterScope: true` calls resolve against `ClusterWorkflowTemplate` resources.
- `gr` on a template definition: list template references.
- `gr` on a DAG task declaration: list `dependencies` and `depends` references.
- `gr` on a WorkflowTemplate name: list WorkflowTemplate references.

## Development

Build only the LSP package:

```bash
npm run build:lsp
```

Run the server from source output:

```bash
cd packages/lsp-server
node dist/server.js --stdio
```

Package it for distribution:

```bash
npm run package:lsp
```

## Troubleshooting

- Run `which uranus-yaml-lsp` to confirm the binary is on `PATH`.
- Run `:LspInfo` in Neovim to confirm the server is attached to YAML buffers.
- Run `:LspLog` in Neovim to inspect server errors.
- Confirm the workspace contains the referenced WorkflowTemplate YAML files.

## Package boundary

The LSP server should stay thin. Shared parsing, context resolution, workspace search, and cache logic belong in `@uranus-yaml/core`.
