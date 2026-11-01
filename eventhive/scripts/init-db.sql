-- PostgreSQL 16 Initialization Script for EventHive
-- Creates three databases and three distinct database roles

-- 1. Create Roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'main_user') THEN
    CREATE ROLE main_user WITH LOGIN PASSWORD 'main_pass';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'issuer_user') THEN
    CREATE ROLE issuer_user WITH LOGIN PASSWORD 'issuer_pass';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'collector_user') THEN
    CREATE ROLE collector_user WITH LOGIN PASSWORD 'collector_pass';
  END IF;
END $$;

-- 2. Create Databases
SELECT 'CREATE DATABASE eventhive_main OWNER main_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'eventhive_main')\gexec

SELECT 'CREATE DATABASE eventhive_issuer OWNER issuer_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'eventhive_issuer')\gexec

SELECT 'CREATE DATABASE eventhive_collector OWNER collector_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'eventhive_collector')\gexec

-- Connect to eventhive_main and enable extensions
\c eventhive_main
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "vector";
GRANT ALL ON SCHEMA public TO main_user;

-- Connect to eventhive_issuer and enable extensions
\c eventhive_issuer
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "citext";
GRANT ALL ON SCHEMA public TO issuer_user;

-- Connect to eventhive_collector and enable extensions
\c eventhive_collector
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "citext";
GRANT ALL ON SCHEMA public TO collector_user;
