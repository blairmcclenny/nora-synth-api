import assert from 'node:assert/strict';
import { test } from 'node:test';
import SwaggerParser from '@apidevtools/swagger-parser';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { fullFormats } from 'ajv-formats/dist/formats.js';
import { generateOpenAPIDocument } from './openapi.js';

// Dereference before validating examples, including nested shared schemas.
const document = JSON.parse(
  JSON.stringify(
    await SwaggerParser.validate(JSON.parse(JSON.stringify(generateOpenAPIDocument()))),
  ),
);
const ajv = new Ajv2020({ strict: false });
ajv.addFormat('uuid', fullFormats.uuid);
ajv.addFormat('date-time', fullFormats['date-time']);

test('generated request and response examples satisfy their JSON Schemas', () => {
  let checked = 0;
  for (const schema of Object.values(document.components.schemas) as Record<string, unknown>[]) {
    if (!schema.example) continue;
    const validate = ajv.compile(schema);
    assert.ok(validate(schema.example), JSON.stringify(validate.errors));
    checked++;
  }
  assert.equal(checked, 4);
});

test('the generated full preset schema accepts responses and rejects ownership fields', () => {
  const schema = document.components.schemas.Preset;
  const validate = ajv.compile(schema);
  assert.ok(validate(schema.example), JSON.stringify(validate.errors));
  assert.equal(validate({ ...schema.example, ownerId: 'untrusted' }), false);
  assert.equal(
    validate({ ...schema.example, parameters: { ...schema.example.parameters, filter: 1.1 } }),
    false,
  );
});

test('generated operations document authentication, pagination, creation, and empty deletion', () => {
  const { paths } = document;
  assert.equal(
    Object.values(paths)
      .flatMap((path) => Object.keys(path as object))
      .filter((key) => ['get', 'post', 'patch', 'put', 'delete'].includes(key)).length,
    7,
  );
  assert.deepEqual(document.security, [{ BearerAuth: [] }]);
  assert.deepEqual(paths['/health'].get.security, []);
  assert.equal(document.components.securitySchemes.BearerAuth.scheme, 'bearer');
  const list = paths['/v1/presets'].get;
  assert.equal(
    list.parameters.find((p: { name: string }) => p.name === 'limit').schema.default,
    50,
  );
  assert.equal(
    list.parameters.find((p: { name: string }) => p.name === 'limit').schema.maximum,
    100,
  );
  assert.equal(
    list.parameters.find((p: { name: string }) => p.name === 'offset').schema.default,
    0,
  );
  const get = paths['/v1/presets/{id}'].get;
  assert.equal(get.requestBody, undefined);
  assert.equal(get.parameters[0].required, true);
  assert.equal(get.parameters[0].schema.format, 'uuid');
  assert.ok(paths['/v1/presets'].post.responses['201'].headers.Location);
  assert.equal(paths['/v1/presets/{id}'].delete.responses['204'].content, undefined);
});
