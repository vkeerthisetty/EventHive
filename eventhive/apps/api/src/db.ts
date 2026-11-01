import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString =
  process.env.DATABASE_URL_MAIN ||
  'postgresql://main_user:main_pass@localhost:5432/eventhive_main';

export const pool = new Pool({
  connectionString,
});
