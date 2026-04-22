// Redis / BullMQ Connection Configuration Mock
// In production, this file connects to a managed Redis cluster.

module.exports = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
  retryStrategy: (times) => {
    // Exponential backoff for redis connection
    return Math.min(times * 50, 2000);
  }
};
