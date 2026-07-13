require("dotenv").config();

/**
 * SSL is required for managed Postgres (RDS) in production.
 * Local / docker Postgres usually has no SSL — set DB_SSL=true/false to override.
 */
function getDialectOptions() {
  const sslEnabled =
    process.env.DB_SSL != null
      ? process.env.DB_SSL === "true"
      : process.env.NODE_ENV === "production";

  if (!sslEnabled) {
    return {};
  }

  return {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  };
}

const pool = {
  max: Number(process.env.DB_POOL_MAX) || 10,
  min: Number(process.env.DB_POOL_MIN) || 0,
  acquire: Number(process.env.DB_POOL_ACQUIRE) || 30000,
  idle: Number(process.env.DB_POOL_IDLE) || 10000,
};

const shared = {
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: "postgres",
  dialectOptions: getDialectOptions(),
  pool,
  logging: process.env.DB_LOGGING === "true" ? console.log : false,
};

module.exports = {
  development: { ...shared },
  test: { ...shared },
  production: { ...shared },
};
