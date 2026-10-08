import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.ts';

// Global connection pool cache to survive HMR/hot-reloads
declare global {
  var _postgresPool: InstanceType<typeof Pool> | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (connectionString) {
      const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
      global._postgresPool = new Pool({
        connectionString,
        ssl: isLocal ? false : { rejectUnauthorized: false },
        max: process.env.VERCEL ? 3 : 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      const isUnixSocket = Boolean(process.env.SQL_HOST && process.env.SQL_HOST.startsWith('/'));
      const isLocalHost = !process.env.SQL_HOST || process.env.SQL_HOST === 'localhost' || process.env.SQL_HOST === '127.0.0.1' || isUnixSocket;
      const shouldUseSsl = !isLocalHost && (process.env.SQL_SSL === 'true' || process.env.NODE_ENV === 'production');

      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
        ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
        max: process.env.VERCEL ? 3 : 10,
        connectionTimeoutMillis: 15000,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
