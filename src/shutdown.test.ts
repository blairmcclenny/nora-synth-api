import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { createShutdown } from './shutdown.js';

test('shutdown drains an active request before ending the pool, once across repeated signals', async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let started!: () => void;
  const active = new Promise<void>((resolve) => { started = resolve; });
  const events: string[] = [];
  const server = createServer(async (_req, res) => {
    started();
    await pending;
    events.push('response');
    res.end('completed');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  let exited!: (code: number) => void;
  const exitCode = new Promise<number>((resolve) => { exited = resolve; });
  const shutdown = createShutdown(server, {
    async end() { events.push('pool'); },
  }, { exit: exited });
  try {
    const response = fetch(`http://127.0.0.1:${address.port}`);
    await active;
    shutdown();
    shutdown();
    assert.deepEqual(events, []);
    release();
    assert.equal(await (await response).text(), 'completed');
    assert.equal(await exitCode, 0);
    assert.deepEqual(events, ['response', 'pool']);
  } finally {
    release();
    server.closeAllConnections();
    server.close();
  }
});

test('pool cleanup errors produce a failing exit', async () => {
  const failure = new Error('pool cleanup failed');
  const errors: unknown[] = [];
  let exited!: (code: number) => void;
  const exitCode = new Promise<number>((resolve) => { exited = resolve; });
  const shutdown = createShutdown({
    close(callback) { callback?.(); return this; },
    closeAllConnections() {},
  }, { async end() { throw failure; } }, {
    exit: exited,
    logError: (error) => { errors.push(error); },
  });
  shutdown();
  assert.equal(await exitCode, 1);
  assert.deepEqual(errors, [failure]);
});

test('shutdown deadline terminates stalled requests', async () => {
  let forced = false;
  let exited!: (code: number) => void;
  const exitCode = new Promise<number>((resolve) => { exited = resolve; });
  const shutdown = createShutdown({
    close() { return this; },
    closeAllConnections() { forced = true; },
  }, { async end() { assert.fail('pool must wait for HTTP draining'); } }, {
    timeoutMs: 10,
    exit: exited,
    logError: () => {},
  });
  shutdown();
  assert.equal(await exitCode, 1);
  assert.equal(forced, true);
});
