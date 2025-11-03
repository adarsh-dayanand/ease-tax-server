const { client } = require("../redis");
const logger = require("../config/logger");

class CacheService {
  constructor() {
    this.defaultExpire = 3600; // 1 hour in seconds
    this.keyPrefix = "easetax:";
  }

  /**
   * Generate cache key with prefix
   */
  getKey(key) {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Set cache with optional expiration
   */
  async set(key, value, expire = this.defaultExpire) {
    try {
      if (!client.isOpen) {
        logger.debug(`Cache set skipped (Redis unavailable): ${key}`);
        return false;
      }

      const cacheKey = this.getKey(key);
      const serializedValue = JSON.stringify(value);

      if (expire) {
        await client.setEx(cacheKey, expire, serializedValue);
      } else {
        await client.set(cacheKey, serializedValue);
      }

      logger.debug(`Cache set for key: ${cacheKey}`);
      return true;
    } catch (error) {
      logger.warn(`Cache set failed for key: ${key}`, error.message);
      return false;
    }
  }

  /**
   * Get cached value
   */
  async get(key) {
    try {
      if (!client.isOpen) {
        logger.debug(`Cache get skipped (Redis unavailable): ${key}`);
        return null;
      }

      const cacheKey = this.getKey(key);
      const cachedValue = await client.get(cacheKey);

      if (cachedValue) {
        logger.debug(`Cache hit for key: ${cacheKey}`);
        return JSON.parse(cachedValue);
      }

      logger.debug(`Cache miss for key: ${cacheKey}`);
      return null;
    } catch (error) {
      logger.warn(`Cache get failed for key: ${key}`, error.message);
      return null;
    }
  }

  /**
   * Delete cache
   */
  async del(key) {
    try {
      const cacheKey = this.getKey(key);
      await client.del(cacheKey);
      logger.info(`Cache deleted for key: ${cacheKey}`);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple cache keys by pattern
   */
  async delPattern(pattern) {
    try {
      const searchPattern = this.getKey(pattern);
      const keys = await client.keys(searchPattern);

      if (keys.length > 0) {
        await client.del(keys);
        logger.info(
          `Cache pattern deleted: ${searchPattern}, keys: ${keys.length}`
        );
      }

      return true;
    } catch (error) {
      logger.error(`Cache pattern delete error for pattern ${pattern}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      const cacheKey = this.getKey(key);
      const exists = await client.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment counter
   */
  async incr(key, expire = this.defaultExpire) {
    try {
      const cacheKey = this.getKey(key);
      const value = await client.incr(cacheKey);

      if (value === 1 && expire) {
        await client.expire(cacheKey, expire);
      }

      return value;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set hash field
   */
  async hSet(key, field, value) {
    try {
      const cacheKey = this.getKey(key);
      await client.hSet(cacheKey, field, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Cache hSet error for key ${key}, field ${field}:`, error);
      return false;
    }
  }

  /**
   * Get hash field
   */
  async hGet(key, field) {
    try {
      const cacheKey = this.getKey(key);
      const value = await client.hGet(cacheKey, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache hGet error for key ${key}, field ${field}:`, error);
      return null;
    }
  }

  /**
   * Get all hash fields
   */
  async hGetAll(key) {
    try {
      const cacheKey = this.getKey(key);
      const hash = await client.hGetAll(cacheKey);

      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value);
      }

      return result;
    } catch (error) {
      logger.error(`Cache hGetAll error for key ${key}:`, error);
      return {};
    }
  }

  /**
   * Add to set
   */
  async sAdd(key, ...members) {
    try {
      const cacheKey = this.getKey(key);
      const serializedMembers = members.map((m) => JSON.stringify(m));
      await client.sAdd(cacheKey, serializedMembers);
      return true;
    } catch (error) {
      logger.error(`Cache sAdd error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get all set members
   */
  async sMembers(key) {
    try {
      const cacheKey = this.getKey(key);
      const members = await client.sMembers(cacheKey);
      return members.map((m) => JSON.parse(m));
    } catch (error) {
      logger.error(`Cache sMembers error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Remove from set
   */
  async sRem(key, ...members) {
    try {
      const cacheKey = this.getKey(key);
      const serializedMembers = members.map((m) => JSON.stringify(m));
      await client.sRem(cacheKey, serializedMembers);
      return true;
    } catch (error) {
      logger.error(`Cache sRem error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Cache patterns for different data types
   */
  getCacheKeys() {
    return {
      // User related
      USER_PROFILE: (userId) => `user:profile:${userId}`,
      USER_CONSULTATIONS: (userId) => `user:consultations:${userId}`,
      USER_PAYMENTS: (userId) => `user:payments:${userId}`,
      USER_FILINGS: (userId) => `user:filings:${userId}`,

      // CA related
      CA_PROFILE: (caId) => `ca:profile:${caId}`,
      CA_DASHBOARD: (caId) => `ca:dashboard:${caId}`,
      CA_LIST: (filters) =>
        `ca:list:${Buffer.from(JSON.stringify(filters)).toString("base64")}`,
      CA_REVIEWS: (caId) => `ca:reviews:${caId}`,
      CA_RATING_DISTRIBUTION: (caId) => `ca:rating_distribution:${caId}`,

      // Consultation related
      CONSULTATION: (consultationId) => `consultation:${consultationId}`,
      CONSULTATION_MESSAGES: (consultationId) =>
        `consultation:messages:${consultationId}`,
      CONSULTATION_DOCUMENTS: (consultationId) =>
        `consultation:documents:${consultationId}`,

      // Session related
      USER_SESSION: (sessionId) => `session:${sessionId}`,

      // Rate limiting
      RATE_LIMIT: (ip, endpoint) => `rate_limit:${ip}:${endpoint}`,

      // Notifications
      USER_NOTIFICATIONS: (userId) => `notifications:${userId}`,

      // Payment related
      PAYMENT_STATUS: (paymentId) => `payment:status:${paymentId}`,

      // Popular/trending
      POPULAR_CAS: () => "popular:cas",
      TRENDING_SERVICES: () => "trending:services",
    };
  }
}

module.exports = new CacheService();
