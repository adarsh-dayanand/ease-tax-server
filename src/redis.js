const redis = require("redis");

const client = redis.createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  retry_strategy: (options) => {
    if (options.error && options.error.code === "ECONNREFUSED") {
      // End reconnecting with a built in error
      console.warn("Redis server connection refused - running without cache");
      return new Error("Redis server connection refused");
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      // End reconnecting after a specific timeout and flush all commands
      return new Error("Redis retry time exhausted");
    }
    // reconnect after
    return Math.min(options.attempt * 100, 3000);
  },
});

client.on("error", (err) => {
  console.warn("Redis Client Error (cache disabled):", err.message);
});

client.on("connect", () => {
  console.log("Redis client connected");
});

async function connectRedis() {
  try {
    if (!client.isOpen) {
      await client.connect();
      return true;
    }
    return true;
  } catch (error) {
    console.warn(
      "Redis connection failed - cache will be disabled:",
      error.message
    );
    return false;
  }
}

module.exports = { client, connectRedis };
