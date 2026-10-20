import SwaggerParser from '@apidevtools/swagger-parser';
import { readFile } from 'node:fs/promises';
import { generateOpenAPIDocument } from '../src/openapi.ts';

const document = generateOpenAPIDocument();
const saved = JSON.parse(await readFile(new URL('../docs/openapi.json', import.meta.url), 'utf8'));
if (JSON.stringify(saved) !== JSON.stringify(document)) {
  throw new Error('OpenAPI document is stale. Run npm run openapi:generate.');
}
await SwaggerParser.validate(document);
console.log('OpenAPI specification is valid and matches the route schemas.');
