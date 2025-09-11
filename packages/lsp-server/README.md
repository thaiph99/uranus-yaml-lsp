# Uranus YAML - LSP Server

A Language Server Protocol (LSP) implementation for Argo YAML template navigation in Neovim and other LSP-compatible editors.

## ✨ Features

- **🎯 Go to Definition**: Navigate from template references to their definitions
- **🔍 Find References**: Show all usages of templates and WorkflowTemplates
- **⚡ High Performance**: Parallel processing and intelligent caching
- **🧠 Smart Context Detection**: Understands Argo Workflow structure
- **🌐 Cross-Resource Support**: Works with Workflows, WorkflowTemplates, CronWorkflows

## 🚀 Installation

### From npm (Recommended)
```bash
npm install -g @uranus-yaml/lsp-server
```

### From Source
```bash
# Clone and build
git clone <repo-url>
cd uranus-yaml-vscode
make install
make build
make install-lsp
```

## 🔧 Neovim Setup

### Using nvim-lspconfig

Add this to your Neovim configuration:

```lua
-- Basic setup (if uranus-yaml is included in lspconfig)
require('lspconfig').uranus_yaml.setup{}
```

### Custom Setup

If the server isn't included in lspconfig yet, use this custom setup:

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

-- Define the custom LSP server
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

-- Setup the LSP
lspconfig.uranus_yaml.setup{
  -- Optional: add custom configuration here
  on_attach = function(client, bufnr)
    -- Your custom on_attach logic
    print("Uranus YAML LSP attached to buffer " .. bufnr)
  end,
}
```

### Complete Example Configuration

```lua
-- ~/.config/nvim/lua/lsp-config.lua

local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

-- Uranus YAML LSP setup
if not configs.uranus_yaml then
  configs.uranus_yaml = {
    default_config = {
      cmd = { 'uranus-yaml-lsp', '--stdio' },
      filetypes = { 'yaml', 'yml' },
      root_dir = lspconfig.util.root_pattern(
        '.git',
        'package.json',
        'Dockerfile',
        '.argocd',
        'workflow.yaml'
      ),
      settings = {},
    },
  }
end

lspconfig.uranus_yaml.setup{
  on_attach = function(client, bufnr)
    local opts = { noremap = true, silent = true, buffer = bufnr }
    
    -- Key mappings for LSP functions
    vim.keymap.set('n', 'gd', vim.lsp.buf.definition, opts)
    vim.keymap.set('n', 'gr', vim.lsp.buf.references, opts)
    vim.keymap.set('n', 'K', vim.lsp.buf.hover, opts)
    
    print("Uranus YAML LSP ready!")
  end,
  
  -- Optional: enable logging for debugging
  flags = {
    debounce_text_changes = 150,
  }
}
```

## 🎯 Usage

Once configured, the LSP provides these features in YAML files:

### Go to Definition (`gd`)
- Click on template references to jump to their definitions
- Works with `templateRef.template` and `workflowTemplateRef.name`

### Find References (`gr`)
- From template definitions: shows all places where the template is used
- From WorkflowTemplate names: shows all references to the WorkflowTemplate

### Example Workflow

1. **Open an Argo Workflow YAML file**
2. **Position cursor on a template name**
3. **Press `gd`** to go to definition or **`gr`** to find references
4. **Navigate between files** seamlessly

## 🔧 Configuration

The LSP server works with minimal configuration but supports these options:

### Root Directory Detection
The server automatically detects project roots using these patterns:
- `.git` directory
- `package.json` file
- `Dockerfile`
- `.argocd` directory
- `workflow.yaml` file

### File Types
By default, the server activates for:
- `*.yaml` files
- `*.yml` files

### Performance Settings
- **Caching**: 30-second file cache with automatic cleanup
- **Concurrency**: Processes up to 10 files in parallel
- **Directory Filtering**: Skips `node_modules`, `.git`, etc.

## 🐛 Troubleshooting

### LSP not starting?
```bash
# Check if the binary is installed and accessible
which uranus-yaml-lsp

# Test the LSP server manually
uranus-yaml-lsp --stdio
```

### LSP not attaching to YAML files?
1. Check that the server is configured for the right file types
2. Verify you're in a directory with a proper root pattern
3. Check Neovim's LSP logs: `:LspLog`

### No results from go-to-definition?
1. Ensure you're clicking on actual template/WorkflowTemplate names
2. Check that YAML files contain valid Argo Workflow syntax
3. Verify file paths are accessible and readable

### Performance issues?
1. Check if you're in a very large directory
2. Consider adding more directories to the ignore list
3. Monitor memory usage with `:LspInfo`

## 🔍 Debugging

### Enable LSP Logging
```lua
-- Add to your Neovim config
vim.lsp.set_log_level("debug")
```

### View LSP Logs
```vim
:LspLog
```

### Check LSP Status
```vim
:LspInfo
```

## 🛠️ Development

### Building from Source
```bash
# Clone the repository
git clone <repo-url>
cd uranus-yaml-vscode

# Install dependencies and build
make install
make build

# Test the LSP server
make dev-lsp
```

### Testing
```bash
# Manual testing
echo '{}' | uranus-yaml-lsp --stdio

# In Neovim, test with a YAML file containing Argo Workflows
```

## 📄 API

The LSP server implements these LSP methods:

- `textDocument/definition` - Go to definition
- `textDocument/references` - Find references
- `initialize` - Server initialization
- `textDocument/didOpen` - Document opened
- `textDocument/didChange` - Document changed

## 🤝 Contributing

This LSP server shares core functionality with the VSCode extension. See the main repository README for contributing guidelines.

## 📄 License

MIT License - see LICENSE file for details.