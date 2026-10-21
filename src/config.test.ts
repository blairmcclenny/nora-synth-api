import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runtimeConfig } from './config.js';

const valid = {
  DATABASE_URL: 'postgresql://user:password@localhost/database',
  AUTH_SECRET: 'test-secret',
  AUTH_OWNER_ID: 'test-owner',
};

test('configuration defaults and explicit host/port', () => {
  assert.equal(runtimeConfig(valid).port, 3000);
  assert.equal(runtimeConfig(valid).hostname, '127.0.0.1');
  assert.equal(runtimeConfig({ ...valid, HOST: '0.0.0.0', PORT: '8080' }).port, 8080);
});

for (const [key, values] of Object.entries({
  DATABASE_URL: ['', 'secret-value', 'https://localhost/db', 'postgresql://localhost/'],
  HOST: ['', ' localhost', 'http://localhost'],
  PORT: ['', '0', '65536', '3.5', '1e3', ' 3000'],
  AUTH_SECRET: ['', 'has space'],
  AUTH_OWNER_ID: ['', ' owner'],
})) {
  for (const value of values) {
    test(`configuration rejects invalid ${key}: ${JSON.stringify(value)}`, () => {
      assert.throws(() => runtimeConfig({ ...valid, [key]: value }));
    });
  }
}

test('database URL errors do not expose credentials', () => {
  assert.throws(
    () => runtimeConfig({ ...valid, DATABASE_URL: 'sensitive-password' }),
    (error: Error) => !error.message.includes('sensitive-password'),
  );
});
