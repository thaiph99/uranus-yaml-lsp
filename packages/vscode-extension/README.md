# Uranus YAML - VSCode Extension

A VS Code extension that enables intelligent **Ctrl+Click** navigation for Argo WorkflowTemplate references in YAML files. Navigate seamlessly between template definitions and their usages across your entire workspace.

## Features

- **Smart Context-Aware Navigation**: Single Ctrl+Click does different actions based on where you click
- **Go to Definition**: Navigate from template references to their definitions
- **Find All References**: Show all usages of templates and WorkflowTemplates
- **High Performance**: Parallel processing, intelligent caching, and smart filtering
- **Intelligent Disambiguation**: Handles multiple templates with same names correctly
- **Cross-Resource Support**: Works with Workflows, WorkflowTemplates, CronWorkflows, etc.

## Installation

### From VSCode Marketplace
```bash
# Search for "Uranus YAML" in VSCode Extensions marketplace
# Or install via command line:
code --install-extension ThaiPham.uranus-yaml
```

### Manual Installation
```bash
# Build and install from source
npm run build:vscode
npm run package:vscode
code --install-extension uranus-yaml-*.vsix
```

## Usage

1. **Open** any YAML file containing Argo Workflow definitions
2. **Ctrl+Click** on any template or WorkflowTemplate name
3. **Let the extension decide** what action to take based on context

### Navigation Contexts

#### Template Reference to Go to Definition
**When**: Ctrl+Click on template references in usage files
**Action**: Navigate to template definition

```yaml
# In workflow.yaml - Ctrl+Click on "step1":
templateRef:
  name: tem-tem1
  template: step1  # Ctrl+Click here goes to definition in tem1.yaml
```

#### Template Definition to Find All References
**When**: Ctrl+Click on template names in WorkflowTemplate definition files
**Action**: Show all references to this template

```yaml
# In tem1.yaml - Ctrl+Click on "step1":
spec:
  templates:
    - name: step1  # Ctrl+Click here shows all references
      container:
        image: alpine
```

#### WorkflowTemplate Name to Find All References
**When**: Ctrl+Click on WorkflowTemplate names in metadata section
**Action**: Show all references to this WorkflowTemplate

```yaml
# In tem1.yaml - Ctrl+Click on "tem-tem1":
apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: tem-tem1  # Ctrl+Click here shows all WorkflowTemplate references
```

## Requirements

- VS Code 1.80.0 or higher
- YAML language support (usually built-in)
- Files must be in a workspace folder

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Test extension (Press F5 in VS Code)
```

## Configuration

The extension works out-of-the-box with no configuration required. It automatically:
- Detects YAML files with Argo Workflow content
- Caches file contents for performance
- Filters out irrelevant directories (node_modules, .git, etc.)
- Provides context-aware navigation

## Performance Features

- **Parallel Processing**: Multiple files processed concurrently
- **Intelligent Caching**: File contents cached with auto-invalidation
- **Smart Filtering**: Automatically skips irrelevant directories
- **Cancellation Support**: Long operations can be cancelled for responsive UI

## Troubleshooting

### Extension not working?
- Confirm the extension is enabled and the current file is a `.yaml` or `.yml` file
- Try clicking directly on the template name, not surrounding whitespace

### No results found?
- Verify YAML structure is correct (proper indentation)
- Check that WorkflowTemplate and template names match exactly
- Look for typos in template names

### Performance issues?
- Large workspaces may take longer to search
- Check VS Code Developer Console for error messages
- Try reloading the window (Ctrl+R)

## License

MIT License - see LICENSE file for details.

## Contributing

This extension is part of a monorepo that also includes an LSP server for Neovim. See the main README for contributing guidelines.
