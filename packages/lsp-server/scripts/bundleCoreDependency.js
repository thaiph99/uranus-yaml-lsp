const fs = require('node:fs');
const path = require('node:path');

const lspRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(lspRoot, '..', '..');
const coreRoot = path.resolve(repositoryRoot, 'packages', 'core');
const bundledCoreRoot = path.resolve(lspRoot, 'dist', 'node_modules', '@uranus-yaml', 'core');

const coreDist = path.resolve(coreRoot, 'dist');
if (!fs.existsSync(coreDist)) {
  throw new Error(`@uranus-yaml/core dist not found at ${coreDist}. Run "npm run build -w packages/core" first.`);
}

fs.rmSync(bundledCoreRoot, { recursive: true, force: true });
fs.mkdirSync(bundledCoreRoot, { recursive: true });

fs.cpSync(coreDist, path.resolve(bundledCoreRoot, 'dist'), { recursive: true });

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
