import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import type { Preset } from './types/preset.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || new URL(connectionString).pathname !== '/nora_synth_test') {
  throw new Error('Server persistence tests must use nora_synth_test');
}

async function unusedPort() {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  return address.port;
}

async function start(port: number, ownerId: string) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      AUTH_SECRET: 'restart-test-secret',
      AUTH_OWNER_ID: ownerId,
      HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Consume diagnostics without printing environment or connection details.
  child.stderr.resume();
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10_000);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Server exited before startup')); });
      child.stdout.on('data', (data: Buffer) => {
        if (data.toString().includes('Nora API listening')) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    return child;
  } catch (error) {
    child.kill('SIGKILL');
    throw error;
  }
}

async function stop(child: ChildProcess, signal: NodeJS.Signals) {
  const exited = once(child, 'exit');
  const timer = setTimeout(() => child.kill('SIGKILL'), 12_000);
  child.kill(signal);
  try {
    const [code, exitSignal] = await exited;
    assert.equal(exitSignal, null);
    assert.equal(code, 0);
  } finally {
    clearTimeout(timer);
  }
}

test('preset persists across server restarts and both shutdown signals exit cleanly', { timeout: 35_000 }, async () => {
  const ownerId = `restart-test-${randomUUID()}`;
  const port = await unusedPort();
  const base = `http://127.0.0.1:${port}`;
  let child: ChildProcess | undefined;
  let created: Preset | undefined;
  const headers = { Authorization: 'Bearer restart-test-secret', 'Content-Type': 'application/json' };
  try {
    child = await start(port, ownerId);
    assert.equal((await fetch(`${base}/ready`)).status, 200);
    const response = await fetch(`${base}/v1/presets`, {
      method: 'POST', headers,
      body: JSON.stringify({
        name: 'Restart persistence fixture', schemaVersion: 1,
        parameters: {
          filter: 0.1, mood: 0.2, movement: 0.3, space: 0.4, expression: 0.5,
          attack: 0.6, decay: 0.7, sustain: 0.8, release: 0.9,
        },
      }),
    });
    assert.equal(response.status, 201);
    created = await response.json() as Preset;
    await stop(child, 'SIGTERM');
    child = undefined;
    child = await start(port, ownerId);
    assert.equal((await fetch(`${base}/ready`)).status, 200);
    const recalled = await fetch(`${base}/v1/presets/${created.id}`, { headers });
    assert.equal(recalled.status, 200);
    assert.deepEqual(await recalled.json(), created);
    await stop(child, 'SIGINT');
    child = undefined;
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await once(child, 'exit');
    }
    if (created) {
      // Cleanup remains possible even when the server under test has failed.
      const { Pool } = await import('pg');
      const cleanup = new Pool({ connectionString });
      try {
        await cleanup.query('DELETE FROM presets WHERE id = $1 AND owner_id = $2', [created.id, ownerId]);
      } finally {
        await cleanup.end();
      }
    }
  }
});
