const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const binPath = path.resolve(__dirname, '..', 'bin', 'uranus-yaml-lsp');

function sendRequest(child, message) {
  const body = JSON.stringify(message);
  child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

test('the generated launcher shim exists and is executable', () => {
  const stats = fs.statSync(binPath);
  assert.ok(stats.isFile(), 'bin/uranus-yaml-lsp should be a file after build');
  // Owner-executable bit must be set so editors (Neovim/Zed) can launch it.
  assert.ok((stats.mode & 0o100) !== 0, 'bin/uranus-yaml-lsp should be executable');
});

test('the launcher boots and advertises navigation capabilities', async () => {
  const child = spawn(process.execPath, [binPath, '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  try {
    const result = await new Promise((resolve, reject) => {
      let buffer = '';
      const timer = setTimeout(() => reject(new Error('timed out waiting for initialize response')), 8000);
      child.stdout.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const match = buffer.match(/\r\n\r\n(\{.*\})/s);
        if (match && buffer.includes('"capabilities"')) {
          clearTimeout(timer);
          resolve(JSON.parse(match[1]));
        }
      });
      child.on('error', reject);
      sendRequest(child, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { processId: process.pid, rootUri: null, capabilities: {} },
      });
    });

    assert.equal(result.result.capabilities.definitionProvider, true);
    assert.equal(result.result.capabilities.referencesProvider, true);
  } finally {
    child.kill();
  }
});
