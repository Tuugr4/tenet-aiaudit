/** Bootstrap the first admin API key. Usage: npm run bootstrap */
import { uuidv7 } from 'uuidv7';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db/client.js';
import { generateApiKey } from '../src/plugins/auth.js';

const config = loadConfig();
const sql = createDb(config.DATABASE_URL);

const key = generateApiKey('admin');
const id = uuidv7();
await sql`
  INSERT INTO api_keys (id, tenant_id, key_hash, key_prefix, role, label)
  VALUES (${id}, NULL, ${key.keyHash}, ${key.keyPrefix}, 'admin', 'bootstrap admin key')
`;

console.log('Admin API key created. The secret is shown ONCE — store it securely:\n');
console.log(`  ${key.secret}\n`);
console.log(`Key id: ${id}`);

await sql.end();
