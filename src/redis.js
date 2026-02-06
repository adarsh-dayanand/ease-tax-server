const redis = require("redis");

const client = redis.createClient({
  socket: {
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error("Redis max retry attempts reached");
        return false;
      }
      return Math.min(retries * 100, 3000);
    },
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
      error.message,
    );
    return false;
  }
}

module.exports = { client, connectRedis };
