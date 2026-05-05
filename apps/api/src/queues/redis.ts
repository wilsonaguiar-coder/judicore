import IORedis from "ioredis";

let _connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!_connection) {
    const url = process.env["REDIS_URL"] ?? "redis://localhost:6379";
    _connection = new IORedis(url, {
      maxRetriesPerRequest: null, // obrigatório para BullMQ
    });
  }
  return _connection;
}
