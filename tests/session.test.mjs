import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

test('relocated session module reads and clears the existing root session', async () => {
  const root = await mkdtemp(join(tmpdir(), 'okmotu-session-test-'));
  try {
    const directory = join(root, 'src', 'game');
    await mkdir(directory, { recursive: true });
    for (const name of ['session.mjs', 'client.mjs', 'metadata.mjs']) {
      await copyFile(new URL(`../src/game/${name}`, import.meta.url), join(directory, name));
    }
    const saved = { baseUrl: 'http://localhost:5177', code: 'ABCDEF', token: 'test-only' };
    const path = join(root, '.aiyl-session.json');
    await writeFile(path, JSON.stringify(saved), { mode: 0o600 });
    const { readSession, saveSession, clearSession } = await import(pathToFileURL(join(directory, 'session.mjs')).href);
    // Working directory is outside this isolated copy, as with a typical MCP client.
    assert.deepEqual(await readSession(), saved);
    await clearSession();
    await assert.rejects(access(path), { code: 'ENOENT' });
    assert.equal(await readSession(),null);
    await saveSession(saved);
    assert.deepEqual(await readSession(),saved);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
