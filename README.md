# Uranus YAML - Argo Workflow Navigator

🚀 **Universal Argo YAML navigation for both VSCode and Neovim!**

A powerful, intelligent navigation system for Argo Workflows that provides seamless **Ctrl+Click** (VSCode) and **go-to-definition** (Neovim) functionality across WorkflowTemplate references in YAML files.

## ✨ What's New in v2.0

- 🏗️ **Complete Restructure**: Monorepo architecture with shared core functionality
- 🔧 **Neovim Support**: Full LSP server implementation for Neovim users
- ⚡ **90% Code Reuse**: Shared core logic eliminates duplication
- 🎯 **Better Performance**: Optimized architecture with improved caching
- 🧩 **Modular Design**: Clean separation between editor-specific and core functionality

## 🎯 Features

### Core Functionality (Both Editors)

- **🎯 Smart Context-Aware Navigation**: Automatically detects whether to go to definition or find references
- **📍 Go to Definition**: Navigate from template references to their definitions
- **🔍 Find All References**: Show all usages of templates and WorkflowTemplates
- **🎨 Intelligent Disambiguation**: Handles multiple templates with same names correctly
- **🌐 Cross-Resource Support**: Works with Workflows, WorkflowTemplates, CronWorkflows, etc.

### Performance & Quality

- **⚡ High Performance**: Parallel processing, intelligent caching, and smart filtering
- **🧠 Smart Context Detection**: Understands Argo Workflow YAML structure
- **🔄 Real-time Updates**: File changes are detected and processed automatically
- **🛡️ Error Handling**: Graceful handling of malformed YAML and missing files

## 📦 Installation

### For VSCode Users

```bash
# Install from marketplace
code --install-extension ThaiPham.uranus-yaml

# Or build from source
npm run build:vscode
npm run package:vscode
```

### For Neovim Users

```bash
# Install globally via npm
npm install -g @uranus-yaml/lsp-server

# Or build from source
make install
make build
make install-lsp
```

## 🚀 Quick Start

### VSCode Setup

1. Install the extension from the marketplace
2. Open any YAML file with Argo Workflows
3. **Ctrl+Click** on template names to navigate!

### Neovim Setup

```lua
-- Add to your Neovim config
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

## 🎯 Navigation Examples

### 1. Template Reference → Definition

```yaml
# In workflow.yaml - Ctrl+Click or gd on "step1"
templateRef:
  name: my-workflow-template
  template: step1  # ← Navigate to definition
```

### 2. Template Definition → References

```yaml
# In template.yaml - Ctrl+Click or gr on "step1"
spec:
  templates:
    - name: step1  # ← Find all references
      container:
        image: alpine
```

### 3. WorkflowTemplate → All References

```yaml
# In template.yaml - Ctrl+Click or gr on template name
metadata:
  name: my-workflow-template  # ← Find all uses
```

## 🏗️ Architecture

```
packages/
├── core/                    # 🎯 Shared functionality (90% of code)
│   ├── services/           # Template search, file system, caching
│   ├── types/              # TypeScript definitions
│   └── index.ts            # Public API
├── vscode-extension/        # 📝 VSCode-specific implementation
│   ├── providers/          # VSCode definition provider
│   └── extension.ts        # Extension entry point
├── lsp-server/             # 🔧 Neovim LSP server
│   ├── handlers/           # LSP protocol handlers
│   ├── server.ts           # LSP server implementation
│   └── bin/                # Executable
└── shared-config/          # ⚙️ Shared build configuration
```

### Key Benefits of New Architecture

1. **🔄 Code Reuse**: 90% of functionality is shared between editors
2. **🧪 Easier Testing**: Core logic can be tested independently
3. **🚀 Faster Development**: New features benefit both editors automatically
4. **📈 Better Maintainability**: Single source of truth for business logic
5. **🎯 Editor-Specific Optimization**: Each package optimized for its target

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm 8+
- TypeScript 5+

### Build All Packages

```bash
# Install dependencies
make install

# Build everything
make build

# Watch for changes
make watch

# Package for distribution
make package
```

### Individual Package Development

```bash
# Core package
npm run build:core

# LSP server
npm run build:lsp
make dev-lsp  # Start in development mode

# VSCode extension
npm run build:vscode
```

### Testing

```bash
# Test VSCode extension
# Press F5 in VSCode to launch Extension Development Host

# Test LSP server
make dev-lsp
# Then configure Neovim to connect to the server
```

## 📊 Performance Optimizations

### Intelligent Caching

- **File Content Caching**: 30-second cache with automatic cleanup
- **Search Result Caching**: Avoid redundant searches
- **Smart Invalidation**: Cache invalidated on file changes

### Parallel Processing

- **Concurrent File Processing**: Up to 10 files processed simultaneously
- **Batch Operations**: Directory traversal in controlled batches
- **Cancellation Support**: Long operations can be cancelled

### Smart Filtering

- **Directory Exclusion**: Automatically skips `node_modules`, `.git`, etc.
- **File Type Detection**: Only processes `.yaml` and `.yml` files
- **Depth Limiting**: Prevents infinite recursion in symlinked directories

## 🔧 Configuration

### VSCode

No configuration required - works out of the box!

### Neovim

```lua
-- Optional: Custom root detection
lspconfig.uranus_yaml.setup{
  root_dir = lspconfig.util.root_pattern(
    '.git',
    'package.json',
    'kustomization.yaml',
    '.argocd'
  ),

  -- Optional: Custom file types
  filetypes = { 'yaml', 'yml' },

  -- Optional: Performance tuning
  flags = {
    debounce_text_changes = 150,
  }
}
```

## 🐛 Troubleshooting

### Common Issues

**Extension/LSP not working?**

- Ensure you're in a YAML file with valid Argo Workflow syntax
- Check that you're clicking directly on template names
- Verify workspace has proper root directory structure

**No results found?**

- Verify YAML indentation is correct
- Check for typos in template/WorkflowTemplate names
- Ensure referenced templates exist in the workspace

**Performance issues?**

- Check workspace size (very large repositories may be slower)
- Monitor memory usage and consider excluding large directories
- Enable debug logging to identify bottlenecks

### Debug Logging

**VSCode:**

```typescript
// Open Developer Tools → Console
// Look for "ArgoTemplateDefinitionProvider" logs
```

**Neovim:**

```lua
-- Enable debug logging
vim.lsp.set_log_level("debug")

-- View logs
:LspLog
```

## 📈 Roadmap

### Planned Features

- 🎨 **Hover Information**: Show template details on hover
- 🔍 **Workspace Symbols**: Search for templates across workspace
- 🎯 **Auto-completion**: Intelligent template name suggestions
- 📝 **Validation**: Real-time YAML structure validation
- 🔗 **Link Following**: Navigate to external template files

### Editor Support

- 🎯 **Vim/Neovim**: ✅ Complete LSP implementation
- 📝 **VSCode**: ✅ Native extension
- ⚡ **Sublime Text**: 🔄 LSP client support (planned)
- 🎨 **Emacs**: 🔄 LSP client support (planned)

## 🤝 Contributing

We welcome contributions! The new monorepo architecture makes it easier than ever to contribute.

### Getting Started

1. Fork the repository
2. Run `make install && make build`
3. Make your changes in the appropriate package
4. Test with both VSCode and Neovim
5. Submit a pull request

### Development Guidelines

- Core functionality goes in `packages/core/`
- Editor-specific features go in respective packages
- All new features should work in both editors
- Add tests for new functionality
- Update documentation

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🎉 Acknowledgments

- Thanks to the Argo Workflows community for inspiration
- Built with TypeScript, VSCode API, and Language Server Protocol
- Special thanks to contributors who helped design the new architecture

---

**Ready to supercharge your Argo Workflow development? Install now and experience seamless YAML navigation! 🚀**
