const redisManager = require("./config/redis");

const client = {
  get isOpen() {
    return redisManager.client?.isOpen || false;
  },
  get isReady() {
    return redisManager.client?.isReady || false;
  },
  // Proxy common methods
  get: (...args) => redisManager.client?.get(...args),
  set: (...args) => redisManager.client?.set(...args),
  setEx: (...args) => redisManager.client?.setEx(...args),
  del: (...args) => redisManager.client?.del(...args),
  exists: (...args) => redisManager.client?.exists(...args),
  keys: (...args) => redisManager.client?.keys(...args),
  incr: (...args) => redisManager.client?.incr(...args),
  expire: (...args) => redisManager.client?.expire(...args),
  hSet: (...args) => redisManager.client?.hSet(...args),
  hGet: (...args) => redisManager.client?.hGet(...args),
  hGetAll: (...args) => redisManager.client?.hGetAll(...args),
  sAdd: (...args) => redisManager.client?.sAdd(...args),
  sMembers: (...args) => redisManager.client?.sMembers(...args),
  sRem: (...args) => redisManager.client?.sRem(...args),
  publish: (...args) => redisManager.client?.publish(...args),
  on: (...args) => redisManager.client?.on(...args),
  connect: () => redisManager.connect(),
};

async function connectRedis() {
  return await redisManager.connect();
}

module.exports = { client, connectRedis };
