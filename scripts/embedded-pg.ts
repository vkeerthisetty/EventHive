import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import path from 'path';

const dataDir = path.resolve(__dirname, '../.pgdata');
const port = parseInt(process.env.PGPORT || '5432', 10);

export async function startEmbeddedPostgres(targetPort = port) {
  const pg = new EmbeddedPostgres({
    port: targetPort,
    databaseDir: dataDir,
    user: 'postgres',
    password: 'password',
  });

  try {
    await pg.initialise();
  } catch (err: any) {
    // Already initialised
  }

  await pg.start();
  console.log(`Embedded PostgreSQL started on port ${targetPort}`);

  // Setup databases & roles if needed
  const adminClient = new Client({
    connectionString: `postgresql://postgres:password@localhost:${targetPort}/postgres`,
  });
  await adminClient.connect();

  const roles = [
    { name: 'main_user', pass: 'main_pass' },
    { name: 'issuer_user', pass: 'issuer_pass' },
    { name: 'collector_user', pass: 'collector_pass' },
  ];

  for (const r of roles) {
    const res = await adminClient.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [r.name]);
    if (res.rowCount === 0) {
      await adminClient.query(`CREATE ROLE ${r.name} WITH LOGIN PASSWORD '${r.pass}' SUPERUSER`);
    }
  }

  const dbs = ['eventhive_main', 'eventhive_issuer', 'eventhive_collector'];
  for (const db of dbs) {
    const res = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [db]);
    if (res.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${db}`);
    }
  }
  await adminClient.end();

  // Extensions per database
  for (const db of dbs) {
    const dbClient = new Client({
      connectionString: `postgresql://postgres:password@localhost:${targetPort}/${db}`,
    });
    await dbClient.connect();
    for (const ext of ['btree_gist', 'pg_trgm', 'citext']) {
      try {
        await dbClient.query(`CREATE EXTENSION IF NOT EXISTS "${ext}"`);
      } catch (e: any) {
        console.warn(`Extension ${ext} warning on ${db}:`, e.message);
      }
    }
    try {
      await dbClient.query(`CREATE EXTENSION IF NOT EXISTS "vector"`);
    } catch {
      // vector extension might not be compiled on some native platforms, fall back gracefully
    }
    await dbClient.end();
  }

  return pg;
}

if (require.main === module) {
  startEmbeddedPostgres().then(() => {
    console.log('Postgres ready and listening. Press Ctrl+C to stop.');
  }).catch((err) => {
    console.error('Failed to start embedded postgres:', err);
    process.exit(1);
  });
}
