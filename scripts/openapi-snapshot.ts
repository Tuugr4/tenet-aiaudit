/** Write the generated OpenAPI spec to openapi/openapi.json (no DB needed). */
import { mkdir, writeFile } from 'node:fs/promises';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import postgres from 'postgres';

const config = loadConfig({ ...process.env, DATABASE_URL: 'postgres://unused:unused@localhost:1/unused' });
// Inject a client that never connects — spec generation does not touch the DB.
const app = await buildApp({ config, db: postgres('postgres://unused:unused@localhost:1/unused', { max: 1 }) });
await app.ready();

await mkdir('openapi', { recursive: true });
await writeFile('openapi/openapi.json', JSON.stringify(app.swagger(), null, 2));
console.log('Wrote openapi/openapi.json');
await app.close();
process.exit(0);
