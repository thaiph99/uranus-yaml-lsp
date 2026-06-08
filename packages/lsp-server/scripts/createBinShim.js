const fs = require('node:fs');
const path = require('node:path');

const lspRoot = path.resolve(__dirname, '..');
const binDir = path.resolve(lspRoot, 'bin');
const binFile = path.resolve(binDir, 'uranus-yaml-lsp');

const shim = "#!/usr/bin/env node\n\nrequire('../dist/server.js');\n";

fs.mkdirSync(binDir, { recursive: true });
fs.writeFileSync(binFile, shim);
fs.chmodSync(binFile, 0o755);
