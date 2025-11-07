import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'ddrc_surveys',
  charset: 'utf8mb4',
};

let pool: mysql.Pool | null = null;

export function getDbPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

export async function dbQuery<T = any>(
  query: string,
  params?: any[]
): Promise<T[]> {
  const pool = getDbPool();
  const [rows] = await pool.execute(query, params || []);
  return rows as T[];
}

export async function dbQueryOne<T = any>(
  query: string,
  params?: any[]
): Promise<T | null> {
  const rows = await dbQuery<T>(query, params);
  return rows.length > 0 ? rows[0] : null;
}

