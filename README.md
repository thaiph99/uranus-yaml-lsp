# Uranus YAML

Uranus YAML provides Argo Workflow YAML navigation for VSCode and Neovim. It lets you jump from `templateRef` and WorkflowTemplate references to their definitions, and find references from template definitions.

## Features

- Go to WorkflowTemplate and template definitions from YAML references.
- Find usages of templates and WorkflowTemplates across the workspace.
- Share one TypeScript core between the VSCode extension and the LSP server.
- Search YAML files with caching, directory filtering, and bounded concurrency.
- Handle common Argo resources such as `Workflow`, `WorkflowTemplate`, and `CronWorkflow`.

## Packages

```text
packages/
├── core/              Shared search, parsing, and filesystem logic
├── lsp-server/        Language Server Protocol server for Neovim and other LSP clients
├── vscode-extension/  VSCode extension entry point and providers
└── shared-config/     Shared TypeScript configuration
```

## Installation

### VSCode

Install from the marketplace:

```bash
code --install-extension ThaiPham.uranus-yaml
```

Or build from source:

```bash
npm run build:vscode
npm run package:vscode
```

### Neovim

Install the LSP server globally:

```bash
npm install -g @uranus-yaml/lsp-server
```

Or build from source:

```bash
make install
make build
make install-lsp
```

Add the server to your Neovim LSP config:

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

## Usage

Open an Argo YAML file and use the editor's normal navigation commands:

- VSCode: Ctrl+Click on a template or WorkflowTemplate name.
- Neovim: use LSP commands such as `gd` for definition and `gr` for references.

Example reference:

```yaml
templateRef:
  name: my-workflow-template
  template: step1
```

Example definition:

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
make watch          # watch all packages
make package        # create release packages
make dev-lsp        # build and run the LSP server locally
```

Package-specific commands:

```bash
npm run build:core
npm run build:lsp
npm run build:vscode
```

## Testing and verification

Run the automated core navigation tests:

```bash
make test
```

Before editor checks, build all packages:

```bash
make build
```

Manual checklist with fixtures from `packages/core/test-files`:

- VSCode: open a fixture YAML file in the Extension Development Host, then Ctrl+Click a WorkflowTemplate reference and a template name.
- Neovim: run the LSP server, open the same fixtures, then use `gd` for definitions and `gr` for references.
- Confirm `tem-tem1` and `step1` navigate to `tem1.yaml`, and references include `workflow-with-workflowtemplate-ref.yaml`.

## Troubleshooting

If navigation does not work:

- Confirm the file extension is `.yaml` or `.yml`.
- Confirm the file contains valid Argo Workflow YAML.
- Click or place the cursor directly on the template or WorkflowTemplate name.
- Check that the referenced template exists in the workspace.

For Neovim, use `:LspInfo` and `:LspLog` to inspect server status and logs.

## Contributing

- Put shared behavior in `packages/core`.
- Keep editor-specific behavior in the VSCode extension or LSP server package.
- Keep public package APIs exported from each package's `src/index.ts`.
- Validate changes with `make build` and manual cross-editor navigation checks.

## License

MIT. See `LICENSE` for details.
