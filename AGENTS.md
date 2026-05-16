# Repository Guidelines

## Project layout

- `Makefile` and root `package.json` define the main install, build, watch, and package commands.
- `packages/core/src` contains shared YAML search and navigation logic. Fixtures live in `packages/core/test-files`.
- `packages/lsp-server/src` contains the Language Server Protocol implementation and Neovim-facing handlers.
- `packages/vscode-extension/src` contains VS Code activation code and definition providers.
- `packages/shared-config/tsconfig.base.json` holds shared TypeScript compiler settings.

## Commands

- `make install`: install root and workspace dependencies.
- `make build`: build all packages.
- `make watch`: run workspace TypeScript watch mode.
- `make dev-lsp`: build and run the local LSP server.
- `make package`: build and package the VS Code extension and LSP server.
- `npm run build:core`, `npm run build:lsp`, `npm run build:vscode`: build one package.

## Code style

- Use strict TypeScript with the shared base config.
- Use two-space indentation, camelCase for variables and functions, PascalCase for classes, and kebab-case package names.
- Keep imports relative inside a package unless importing another workspace package.
- Re-export public APIs from each package's `src/index.ts`.
- Add comments only when they explain non-obvious behavior.

## Testing

- `make test` runs focused core navigation tests.
- Use `packages/core/test-files` for YAML navigation scenarios.
- Before editor manual verification, run `make build`.
- Manually test VS Code Ctrl+Click and Neovim `gd`/`gr` against the fixture names in `packages/core/test-files`.

## Pull requests

- Use Conventional Commits such as `feat:`, `fix:`, and `docs:`.
- Keep changes scoped to one purpose.
- Include a short summary, verification steps, and editor-specific manual test notes.
- Document breaking changes to the `uranus-yaml-lsp` binary or editor setup.
