#!/bin/bash

# Build standalone LSP server
echo "Building standalone LSP server..."

# Build all packages first
make build

# Create a temporary directory for the standalone build
TEMP_DIR=$(mktemp -d)
LSP_DIR="$TEMP_DIR/uranus-yaml-lsp"

# Create the standalone directory structure
mkdir -p "$LSP_DIR/dist"
mkdir -p "$LSP_DIR/bin"

# Copy the built LSP server
cp -r packages/lsp-server/dist/* "$LSP_DIR/dist/"

# Copy the built core package (inline the dependency)
mkdir -p "$LSP_DIR/dist/node_modules/@uranus-yaml/core"
cp -r packages/core/dist/* "$LSP_DIR/dist/node_modules/@uranus-yaml/core/"
cp packages/core/package.json "$LSP_DIR/dist/node_modules/@uranus-yaml/core/"

# Create the executable
cat > "$LSP_DIR/bin/uranus-yaml-lsp" << 'EOF'
#!/usr/bin/env node

const path = require('path');
const serverPath = path.join(__dirname, '..', 'dist', 'server.js');
require(serverPath);
EOF

chmod +x "$LSP_DIR/bin/uranus-yaml-lsp"

# Copy to a permanent location
INSTALL_DIR="$HOME/.local/share/uranus-yaml-lsp"
rm -rf "$INSTALL_DIR"
cp -r "$LSP_DIR" "$INSTALL_DIR"

# Create symlink in PATH
mkdir -p "$HOME/.local/bin"
ln -sf "$INSTALL_DIR/bin/uranus-yaml-lsp" "$HOME/.local/bin/uranus-yaml-lsp"

echo "✅ Standalone LSP server installed to: $INSTALL_DIR"
echo "✅ Executable symlinked to: $HOME/.local/bin/uranus-yaml-lsp"
echo ""
echo "Make sure $HOME/.local/bin is in your PATH:"
echo "export PATH=\$HOME/.local/bin:\$PATH"
echo ""
echo "Then use this Neovim configuration:"
echo "lspconfig.uranus_yaml.setup{ cmd = { 'uranus-yaml-lsp', '--stdio' } }"

# Cleanup
rm -rf "$TEMP_DIR"