
# Development Guide

This guide explains how to develop and contribute to the Uranus YAML project.

## 🛠️ Development

### Setup

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes during development
npm run watch
```

### Testing the Extension

1. **Launch Extension Development Host**: Press `F5` in VS Code
2. **Open Test Files**: Open the `test-files` folder in the new VS Code window
3. **Test Navigation**: Try Ctrl+Click on different template names and references
4. **Check Console**: Open Developer Tools (Help → Toggle Developer Tools) for debug logs

## 🏗️ Architecture

```
src/
├── core/
│   ├── services/
│   │   ├── fileSystemService.ts
│   │   ├── templateSearchService.ts
│   │   └── workspaceCacheService.ts
│   └── types/
│       └── index.ts
├── vscode/
│   ├── providers/
│   │   ├── argoTemplateDefinitionProvider.ts
│   │   └── argoTemplateReferenceProvider.ts
│   └── extension.ts
└── vim/
    └── server.ts
```

## 🎯 Key Features in Detail

### Smart Context Detection

The extension automatically detects:

- **Template References**: `templateRef.template` usage
- **Template Definitions**: `- name:` in templates section
- **WorkflowTemplate Names**: `metadata.name` in WorkflowTemplate files
- **WorkflowTemplate References**: `templateRef.name` and `workflowTemplateRef.name`

### Performance Optimizations

- **Parallel Processing**: Multiple files processed concurrently
- **Intelligent Caching**: File contents cached with auto-invalidation (30s timeout)
- **Smart Filtering**: Automatically skips irrelevant directories (node_modules, .git, etc.)
- **Cancellation Support**: Long operations can be cancelled for responsive UI

### Disambiguation Logic

When multiple WorkflowTemplates contain templates with the same name:

1. Extension identifies the `templateRef.name` (WorkflowTemplate name)
2. Searches specifically within that WorkflowTemplate
3. Locates the correct template definition
4. Navigates to the exact line

## 🤝 Contributing

This extension provides a foundation for Argo Workflow development productivity. The codebase is structured for easy extension and maintenance.

### Key Extension Points

- **New Resource Types**: Add support for other Argo resources
- **Enhanced Search**: Improve search algorithms and filtering
- **UI Improvements**: Add status indicators, progress bars, etc.
- **Additional Features**: Hover information, auto-completion, etc.
