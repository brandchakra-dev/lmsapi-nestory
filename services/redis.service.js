const redis = require('redis');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return;

    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.error('❌ REDIS_URL not set in environment');
      return;
    }

    this.client = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Max Redis reconnection attempts reached');
            return new Error('Max reconnection attempts');
          }
          return Math.min(retries * 100, 3000);
        },
        connectTimeout: 10000,
        keepAlive: 5000,
      },
      pingInterval: 30000, // Keep connection alive
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected successfully');
      this.isConnected = true;
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    await this.client.connect();
  }

  async set(key, value, ttl = 600) { // ttl in seconds
    if (!this.isConnected) await this.connect();
    
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await this.client.setEx(key, ttl, stringValue);
  }

  async get(key) {
    if (!this.isConnected) await this.connect();
    
    const value = await this.client.get(key);
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async delete(key) {
    if (!this.isConnected) await this.connect();
    await this.client.del(key);
  }

  async exists(key) {
    if (!this.isConnected) await this.connect();
    const result = await this.client.exists(key);
    return result === 1;
  }

  async incrementAttempts(key) {
    if (!this.isConnected) await this.connect();
    
    const multi = this.client.multi();
    multi.incr(`${key}:attempts`);
    multi.expire(`${key}:attempts`, 600);
    const results = await multi.exec();
    return results[0];
  }

  async getAttempts(key) {
    if (!this.isConnected) await this.connect();
    
    const attempts = await this.client.get(`${key}:attempts`);
    return attempts ? parseInt(attempts) : 0;
  }

  async quit() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      console.log('👋 Redis connection closed');
    }
  }
}

// Singleton instance
const redisService = new RedisService();

// Graceful shutdown
process.on('SIGINT', async () => {
  await redisService.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await redisService.quit();
  process.exit(0);
});

module.exports = redisService;