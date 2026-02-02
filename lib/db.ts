import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'ddrc_surveys',
  charset: 'utf8mb4',
};

let pool: mysql.Pool | null = null;

export function resetDbPool(): void {
  if (pool) {
    pool.end().catch(() => { });
    pool = null;
  }
}

export function getDbPool(): mysql.Pool {
  if (!pool) {
    try {
      pool = mysql.createPool({
        ...dbConfig,
        waitForConnections: true,
        connectionLimit: 50, // Increased from 10 to handle more concurrent requests
        queueLimit: 0,
        // Connection timeout to fail fast on initial connection
        connectTimeout: 10000, // 10 seconds to establish initial connection
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      } as mysql.PoolOptions);

      // Test connection on pool creation, but skip during build to prevent hangs
      const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
      if (!isBuildPhase) {
        pool.getConnection()
          .then((conn) => {
            conn.release();
          })
          .catch((err) => {
            console.error('Database pool connection test failed:', err.message);
          });
      }
    } catch (error: any) {
      console.error('Failed to create database pool:', error.message);
      throw error;
    }
  }
  return pool;
}

export async function dbQuery<T = any>(
  query: string,
  params?: any[]
): Promise<T[]> {
  const pool = getDbPool();
  try {
    const [rows] = await pool.execute(query, params || []);
    return rows as T[];
  } catch (error: any) {
    // If connection error, reset pool to force recreation on next call
    if (error.code === 'ECONNREFUSED' || error.code === 'PROTOCOL_CONNECTION_LOST' || error.message?.includes('Connection lost')) {
      resetDbPool();
    }
    throw error;
  }
}

export async function dbQueryOne<T = any>(
  query: string,
  params?: any[]
): Promise<T | null> {
  const rows = await dbQuery<T>(query, params);
  return rows.length > 0 ? rows[0] : null;
}

