const fs = require('node:fs');
const path = require('node:path');

const extensionRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(extensionRoot, '..', '..');
const coreRoot = path.resolve(repositoryRoot, 'packages', 'core');
const bundledCoreRoot = path.resolve(extensionRoot, 'out', 'node_modules', '@uranus-yaml', 'core');

fs.rmSync(bundledCoreRoot, { recursive: true, force: true });
fs.mkdirSync(bundledCoreRoot, { recursive: true });

fs.cpSync(
  path.resolve(coreRoot, 'dist'),
  path.resolve(bundledCoreRoot, 'dist'),
  { recursive: true }
);

const corePackageJson = JSON.parse(
  fs.readFileSync(path.resolve(coreRoot, 'package.json'), 'utf8')
);

fs.writeFileSync(
  path.resolve(bundledCoreRoot, 'package.json'),
  JSON.stringify(
    {
      name: corePackageJson.name,
      version: corePackageJson.version,
      main: corePackageJson.main,
      types: corePackageJson.types,
      license: corePackageJson.license || 'MIT'
    },
    null,
    2
  ) + '\n'
);
