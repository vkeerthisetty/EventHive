import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString =
  process.env.DATABASE_URL_ISSUER ||
  'postgresql://issuer_user:issuer_pass@localhost:5432/eventhive_issuer';

export const pool = new Pool({
  connectionString,
});
