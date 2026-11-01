import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString =
  process.env.DATABASE_URL_COLLECTOR ||
  'postgresql://collector_user:collector_pass@localhost:5432/eventhive_collector';

export const pool = new Pool({
  connectionString,
});
