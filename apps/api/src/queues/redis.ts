import { Redis } from "ioredis";

let _connection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!_connection) {
    const url = process.env["REDIS_URL"] ?? "redis://localhost:6379";
    _connection = new Redis(url, {
      maxRetriesPerRequest: null, // obrigatório para BullMQ
    });
  }
  return _connection!;
}
