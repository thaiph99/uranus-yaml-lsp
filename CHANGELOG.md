# Change Log

All notable changes to the "uranus-yaml-lsp" extension will be documented in this file.

## [Unreleased]

### Added
- Added go-to-definition and find-references navigation for local template calls through `entrypoint`, `onExit`, `template`, hooks, and DAG tasks.
- Added DAG task navigation for `dependencies` lists and enhanced `depends` expressions.
- Added `ClusterWorkflowTemplate` lookup support when `clusterScope: true` is set on `templateRef` or `workflowTemplateRef`.
- Registered the VS Code reference provider so Find All References uses the shared navigation engine.

### Changed
- Split cursor context lookup, YAML structure traversal, content-level location matching, and DAG dependency parsing out of target classification and workspace scan orchestration to clarify core navigation responsibilities.
- Consolidated workspace file caching so editor lifecycle disposal clears the cache used for navigation searches.

## [1.0.2] - 2026-05-17

### Added
- Added a Zed editor extension that connects Zed's built-in YAML language to `uranus-yaml-lsp`.
- Added Zed development checks and setup documentation.

### Fixed
- Fixed LSP reference requests so Neovim `gr` resolves references from definition locations consistently.
- Fixed go-to-definition and find-references target ranges so editors jump to the matched YAML value instead of the beginning or end of the line.

### Documentation
- Documented Zed installation, local development, publishing, and troubleshooting workflows.

## [1.0.1] - 2026-05-16

### Changed
- Refactored navigation logic into a shared `yaml-navigation` service in the core package, eliminating duplication between the LSP server and VS Code extension adapters
- VS Code extension and LSP handlers now both delegate to the shared navigation service
- Reduced notification noise in the VS Code extension (fewer pop-up messages during normal usage)
- Renamed workspace and package metadata for consistency across the monorepo

### Added
- Navigation tests for the core package

### Fixed
- Quieter editor experience: suppressed redundant status notifications

### Documentation
- Rewrote editor usage guides (VS Code and LSP) for clarity
- Simplified root project README
- Cleaned up package READMEs (removed decorative icons)

## [1.0.0] - 2025-09-12

### Added
- Full LSP (Language Server Protocol) server implementation for Argo WorkflowTemplate navigation
- Standalone `lsp-server` package enabling editor-agnostic go-to-definition and find-references
- Core navigation package extracted as a shared library

## [0.0.1] - 2025-07-03

### Added
- Initial release of Uranus YAML extension
- Intelligent Ctrl+Click navigation for Argo WorkflowTemplate references
- Go to definition functionality for template references
- Find all references functionality for template definitions
- Support for Workflows, WorkflowTemplates, and CronWorkflows
- Smart context-aware navigation
- High-performance caching and parallel processing
- Intelligent disambiguation for multiple templates with same names

### Features
- **Smart Context-Aware Navigation**: Single Ctrl+Click performs different actions based on context
- **Cross-Resource Support**: Works across different Argo resource types
- **Performance Optimized**: Efficient file scanning and caching mechanisms
- **Workspace-wide Search**: Finds templates across entire VS Code workspace

## Future Plans
- Enhanced template validation
- Additional Argo resource support
- Improved error handling and user feedback
- Template autocomplete functionality
