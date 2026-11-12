import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

for (const failure of ['TypeError', 'TimeoutError']) {
  test(`CLI stops after one LLM request on ${failure}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'okmotu-play-test-'));
    try {
      await cp(new URL('../src/', import.meta.url), join(root, 'src'), { recursive: true });
      await writeFile(join(root, '.aiyl-session.json'), JSON.stringify({
        baseUrl: 'http://localhost:5177', code: 'ABCDEF', token: 'test-only-session',
      }), { mode: 0o600 });
      const transport = join(root, 'transport.mjs');
      // Replace all fetches before loading the actual CLI: no network or paid model.
      await writeFile(transport, `
        globalThis.fetch = async url => {
          if (String(url).endsWith('/bot')) return Response.json({
            playerId: 'p', version: 1, gameNumber: 1,
            actions: [{type: 'pass'}, {type: 'buy', card: 'wheat'}],
            catalog: [], landmarks: [], game: {phase: 'buy', players: [], log: []}
          });
          process.stdout.write('MODEL_REQUEST\\n');
          throw ${failure === 'TypeError' ? "new TypeError('test-only-secret')" : "new DOMException('test-only-secret', 'TimeoutError')"};
        };
      `);
      const result = spawnSync(process.execPath, ['--import', transport, join(root, 'src/cli/play.mjs')], {
        encoding: 'utf8', timeout: 5000,
        env: { ...process.env, LLM_MODEL: 'test-model', LLM_API_KEY: 'test-only-key', LLM_BASE_URL: 'https://example.com/v1/' },
      });
      assert.ifError(result.error);
      assert.equal(result.status, 1);
      assert.equal(result.stdout.split('MODEL_REQUEST').length - 1, 1);
      assert.doesNotMatch(result.stdout + result.stderr, /test-only-secret|test-only-key|test-only-session/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
