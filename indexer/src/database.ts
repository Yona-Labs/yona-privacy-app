import { Pool, PoolConfig } from "pg";
import { DataSource, DataSourceOptions } from "typeorm";
import * as dotenv from "dotenv";
import { CommitmentEvent } from "./entities/CommitmentEvent";
import { Referral } from "./entities/Referral";
import { Deposit } from "./entities/Deposit";

// Load .env file
dotenv.config();

/**
 * Simple config service to match the provided API
 */
class ConfigService {
  getOrThrow(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Environment variable ${key} is required but not set`);
    }
    return value;
  }

  get(key: string): string | undefined {
    return process.env[key];
  }
}

const configService = new ConfigService();

/**
 * Create PostgreSQL connection pool
 */
export function createDatabasePool(): Pool {
  const poolConfig: PoolConfig = {
    connectionString: configService
      .getOrThrow("DATABASE_URL")
      .replace("?sslmode=require", ""),
    ssl: configService.get("CA_CERT")
      ? {
          rejectUnauthorized: false,
          ca: configService.getOrThrow("CA_CERT"),
        }
      : false,
  };

  return new Pool(poolConfig);
}

/**
 * Get a database connection pool instance
 */
let pool: Pool | null = null;

export function getDatabasePool(): Pool {
  if (!pool) {
    pool = createDatabasePool();
  }
  return pool;
}

/**
 * Close the database connection pool
 */
export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * TypeORM DataSource configuration
 */
function getDataSourceOptions(): DataSourceOptions {
  const databaseUrl = configService
    .getOrThrow("DATABASE_URL")
    .replace("?sslmode=require", "");

  return {
    type: "postgres",
    url: databaseUrl,
    ssl: configService.get("CA_CERT")
      ? {
          rejectUnauthorized: false,
          ca: configService.getOrThrow("CA_CERT"),
        }
      : false,
    entities: [CommitmentEvent, Referral, Deposit],
    synchronize: true, // Auto-create tables (set to false in production with migrations)
    logging: false,
  };
}

/**
 * TypeORM DataSource instance
 */
let dataSource: DataSource | null = null;

/**
 * Get or create TypeORM DataSource
 */
export async function getDataSource(): Promise<DataSource> {
  if (!dataSource) {
    dataSource = new DataSource(getDataSourceOptions());
    await dataSource.initialize();
  }
  return dataSource;
}

/**
 * Close TypeORM DataSource
 */
export async function closeDataSource(): Promise<void> {
  if (dataSource && dataSource.isInitialized) {
    await dataSource.destroy();
    dataSource = null;
  }
}
