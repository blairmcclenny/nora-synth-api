import { writeFile } from 'node:fs/promises';
import { generateOpenAPIDocument } from '../src/openapi.ts';

await writeFile(
  new URL('../docs/openapi.json', import.meta.url),
  `${JSON.stringify(generateOpenAPIDocument(), null, 2)}\n`,
);
console.log('Generated docs/openapi.json from route schemas.');
