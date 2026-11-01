import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

async function runMigrationsForDb(dbUrl: string, migrationsDir: string, dbName: string) {
  console.log(`Running migrations for ${dbName}...`);
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // Migration table to track executed migrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const res = await client.query(`SELECT 1 FROM schema_migrations WHERE name = $1`, [file]);
      if (res.rowCount === 0) {
        console.log(`  Applying ${file} to ${dbName}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
      } else {
        console.log(`  Already applied ${file} to ${dbName}`);
      }
    }
  } finally {
    await client.end();
  }
}

export async function runAllMigrations() {
  const mainUrl = process.env.DATABASE_URL_MAIN || 'postgresql://main_user:main_pass@localhost:5432/eventhive_main';
  const issuerUrl = process.env.DATABASE_URL_ISSUER || 'postgresql://issuer_user:issuer_pass@localhost:5432/eventhive_issuer';
  const collectorUrl = process.env.DATABASE_URL_COLLECTOR || 'postgresql://collector_user:collector_pass@localhost:5432/eventhive_collector';

  const rootDir = path.resolve(__dirname, '..');
  await runMigrationsForDb(mainUrl, path.join(rootDir, 'migrations/main'), 'eventhive_main');
  await runMigrationsForDb(issuerUrl, path.join(rootDir, 'migrations/issuer'), 'eventhive_issuer');
  await runMigrationsForDb(collectorUrl, path.join(rootDir, 'migrations/collector'), 'eventhive_collector');
  console.log('All migrations applied successfully.');
}

if (require.main === module) {
  runAllMigrations().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
