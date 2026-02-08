const { createClient } = require("redis");
const logger = require("./logger");

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      logger.info("[Redis] Attempting to connect to Redis...", {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT) || 6379,
        database: parseInt(process.env.REDIS_DB) || 0,
        hasPassword: !!process.env.REDIS_PASSWORD,
      });

      if (this.client && (this.client.isOpen || this.client.isReady)) {
        logger.info("[Redis] Client already connected");
        return this.client;
      }

      this.client = createClient({
        socket: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT) || 6379,
          connectTimeout: 10000, // 10 seconds timeout for initial connection
          reconnectStrategy: (retries) => {
            logger.warn(`[Redis] Reconnection attempt ${retries}`, {
              maxRetries: 10,
              nextRetryIn: Math.min(retries * 1000, 5000),
            });
            if (retries > 10) {
              logger.error(
                "[Redis] Max retry attempts reached, disabling cache",
              );
              this.isConnected = false;
              return false; // Stop reconnecting
            }
            // Exponential backoff: 1s, 2s, 3s, 4s, 5s (max)
            return Math.min(retries * 1000, 5000);
          },
          // Keep connection alive
          keepAlive: 5000,
          noDelay: true,
        },
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseInt(process.env.REDIS_DB) || 0,
        // Increase command timeout to prevent premature disconnections
        commandTimeout: 5000, // 5 seconds for commands
        // Don't connect immediately, wait for explicit connect() call
        lazyConnect: false,
      });

      this.client.on("error", (error) => {
        logger.error("[Redis] Client Error:", {
          message: error.message,
          code: error.code,
          stack: error.stack,
        });
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        logger.info("[Redis] Client Connected successfully");
        this.isConnected = true;
      });

      this.client.on("ready", () => {
        logger.info("[Redis] Client Ready to accept commands");
        this.isConnected = true;
      });

      this.client.on("reconnecting", () => {
        logger.warn("[Redis] Client Reconnecting...");
      });

      this.client.on("end", () => {
        logger.warn("[Redis] Client Connection Ended");
        this.isConnected = false;
      });

      await this.client.connect();
      logger.info("[Redis] Connection established successfully", {
        isOpen: this.client.isOpen,
        isReady: this.client.isReady,
      });

      return this.client;
    } catch (error) {
      logger.error("[Redis] Failed to connect:", {
        message: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        address: error.address,
        port: error.port,
      });
      this.isConnected = false;
      // Don't throw, let the app run without cache
      return null;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit().catch(() => {});
      this.isConnected = false;
      logger.info("Redis connection closed");
    }
  }

  getClient() {
    return this.client;
  }

  // Cache management methods
  async set(key, value, expirationInSeconds = 3600) {
    try {
      if (!this.client || !this.client.isReady) {
        logger.warn("Redis client not ready, skipping set operation");
        return false;
      }
      const serializedValue = JSON.stringify(value);
      await this.client.setEx(key, expirationInSeconds, serializedValue);
      return true;
    } catch (error) {
      logger.error("Redis SET error:", error);
      return false;
    }
  }

  async get(key) {
    try {
      if (!this.client || !this.client.isReady) {
        logger.warn("Redis client not ready, skipping get operation");
        return null;
      }
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error("Redis GET error:", error);
      return null;
    }
  }

  async del(key) {
    try {
      if (!this.client || !this.client.isReady) {
        logger.warn("Redis client not ready, skipping delete operation");
        return false;
      }
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error("Redis DEL error:", error);
      return false;
    }
  }

  async exists(key) {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error("Redis EXISTS error:", error);
      return false;
    }
  }

  async incr(key) {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error("Redis INCR error:", error);
      return null;
    }
  }

  async expire(key, seconds) {
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error("Redis EXPIRE error:", error);
      return false;
    }
  }

  // Pub/Sub methods for real-time features
  async publish(channel, message) {
    try {
      const serializedMessage = JSON.stringify(message);
      return await this.client.publish(channel, serializedMessage);
    } catch (error) {
      logger.error("Redis PUBLISH error:", error);
      return 0;
    }
  }

  async subscribe(channel, callback) {
    try {
      const subscriber = this.client.duplicate();
      await subscriber.connect();

      await subscriber.subscribe(channel, (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          logger.error("Error parsing Redis message:", error);
          callback(message);
        }
      });

      return subscriber;
    } catch (error) {
      logger.error("Redis SUBSCRIBE error:", error);
      throw error;
    }
  }

  // Session management
  async setSession(sessionId, sessionData, expirationInSeconds = 24 * 60 * 60) {
    const key = `session:${sessionId}`;
    return await this.set(key, sessionData, expirationInSeconds);
  }

  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.get(key);
  }

  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.del(key);
  }

  // User caching
  async cacheUser(userId, userData, expirationInSeconds = 30 * 60) {
    const key = `user:${userId}`;
    return await this.set(key, userData, expirationInSeconds);
  }

  async getCachedUser(userId) {
    const key = `user:${userId}`;
    return await this.get(key);
  }

  async invalidateUserCache(userId) {
    const key = `user:${userId}`;
    return await this.del(key);
  }

  // CA caching
  async cacheCAList(filters, caList, expirationInSeconds = 10 * 60) {
    const key = `ca_list:${Buffer.from(JSON.stringify(filters)).toString("base64")}`;
    return await this.set(key, caList, expirationInSeconds);
  }

  async getCachedCAList(filters) {
    const key = `ca_list:${Buffer.from(JSON.stringify(filters)).toString("base64")}`;
    return await this.get(key);
  }

  async invalidateCACache() {
    const pattern = "ca_list:*";
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      logger.error("Error invalidating CA cache:", error);
      return false;
    }
  }
}

// Create singleton instance
const redisManager = new RedisManager();

module.exports = redisManager;
