import SwaggerParser from '@apidevtools/swagger-parser';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../docs/openapi.json', import.meta.url));
await SwaggerParser.validate(path);
console.log('OpenAPI specification is valid.');
