import type { Redis } from "ioredis";

export const ATOMIC_MOVE_DELAYED = `
-- KEYS[1] = delayed zset
-- KEYS[2] = main stream
-- ARGV[1] = now_ms
-- ARGV[2] = limit
local due = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[2])
local moved = 0
for _, jobId in ipairs(due) do
  local jobKey = 'jq:job:' .. jobId
  local data = redis.call('HGET', jobKey, 'data')
  if data then
    redis.call('XADD', KEYS[2], '*', 'id', jobId, 'data', data)
    redis.call('HSET', jobKey, 'state', 'waiting')
    redis.call('ZREM', KEYS[1], jobId)
    moved = moved + 1
  else
    redis.call('ZREM', KEYS[1], jobId)
  end
end
return moved
`;

export const ACK_AND_COMPLETE = `
-- KEYS[1] = stream
-- KEYS[2] = job hash
-- ARGV[1] = group
-- ARGV[2] = stream entry id
-- ARGV[3] = now_ms
redis.call('XACK', KEYS[1], ARGV[1], ARGV[2])
redis.call('XDEL', KEYS[1], ARGV[2])
redis.call('HSET', KEYS[2], 'state', 'completed', 'updatedAt', ARGV[3])
redis.call('EXPIRE', KEYS[2], 3600)
return 1
`;

export const ACK_AND_RETRY = `
-- KEYS[1] = stream
-- KEYS[2] = job hash
-- KEYS[3] = delayed zset
-- ARGV[1] = group
-- ARGV[2] = stream entry id
-- ARGV[3] = job id
-- ARGV[4] = run_at_ms
-- ARGV[5] = now_ms
-- ARGV[6] = error string
-- ARGV[7] = attempts
redis.call('XACK', KEYS[1], ARGV[1], ARGV[2])
redis.call('XDEL', KEYS[1], ARGV[2])
redis.call('HSET', KEYS[2],
  'state', 'delayed',
  'updatedAt', ARGV[5],
  'lastError', ARGV[6],
  'attempts', ARGV[7],
  'scheduledFor', ARGV[4])
redis.call('ZADD', KEYS[3], ARGV[4], ARGV[3])
return 1
`;

export const ACK_AND_DEAD = `
-- KEYS[1] = stream
-- KEYS[2] = job hash
-- KEYS[3] = dlq stream
-- ARGV[1] = group
-- ARGV[2] = stream entry id
-- ARGV[3] = job id
-- ARGV[4] = data string
-- ARGV[5] = now_ms
-- ARGV[6] = error string
-- ARGV[7] = attempts
redis.call('XACK', KEYS[1], ARGV[1], ARGV[2])
redis.call('XDEL', KEYS[1], ARGV[2])
redis.call('HSET', KEYS[2],
  'state', 'dead',
  'updatedAt', ARGV[5],
  'lastError', ARGV[6],
  'attempts', ARGV[7])
redis.call('XADD', KEYS[3], '*', 'id', ARGV[3], 'data', ARGV[4], 'error', ARGV[6])
return 1
`;

export interface LuaScripts {
  atomicMoveDelayed(
    delayedKey: string,
    streamKey: string,
    nowMs: number,
    limit: number,
  ): Promise<number>;
  ackAndComplete(
    streamKey: string,
    jobHashKey: string,
    group: string,
    entryId: string,
    nowMs: number,
  ): Promise<number>;
  ackAndRetry(
    streamKey: string,
    jobHashKey: string,
    delayedKey: string,
    group: string,
    entryId: string,
    jobId: string,
    runAtMs: number,
    nowMs: number,
    err: string,
    attempts: number,
  ): Promise<number>;
  ackAndDead(
    streamKey: string,
    jobHashKey: string,
    dlqKey: string,
    group: string,
    entryId: string,
    jobId: string,
    data: string,
    nowMs: number,
    err: string,
    attempts: number,
  ): Promise<number>;
}

export function loadLuaScripts(redis: Redis): LuaScripts {
  const r = redis as Redis & {
    atomicMoveDelayed?: (...args: unknown[]) => Promise<number>;
    ackAndComplete?: (...args: unknown[]) => Promise<number>;
    ackAndRetry?: (...args: unknown[]) => Promise<number>;
    ackAndDead?: (...args: unknown[]) => Promise<number>;
  };
  r.defineCommand("atomicMoveDelayed", {
    numberOfKeys: 2,
    lua: ATOMIC_MOVE_DELAYED,
  });
  r.defineCommand("ackAndComplete", {
    numberOfKeys: 2,
    lua: ACK_AND_COMPLETE,
  });
  r.defineCommand("ackAndRetry", {
    numberOfKeys: 3,
    lua: ACK_AND_RETRY,
  });
  r.defineCommand("ackAndDead", {
    numberOfKeys: 3,
    lua: ACK_AND_DEAD,
  });
  return {
    atomicMoveDelayed: (delayedKey, streamKey, nowMs, limit) =>
      r.atomicMoveDelayed!(delayedKey, streamKey, String(nowMs), String(limit)),
    ackAndComplete: (streamKey, jobHashKey, group, entryId, nowMs) =>
      r.ackAndComplete!(streamKey, jobHashKey, group, entryId, String(nowMs)),
    ackAndRetry: (
      streamKey,
      jobHashKey,
      delayedKey,
      group,
      entryId,
      jobId,
      runAtMs,
      nowMs,
      err,
      attempts,
    ) =>
      r.ackAndRetry!(
        streamKey,
        jobHashKey,
        delayedKey,
        group,
        entryId,
        jobId,
        String(runAtMs),
        String(nowMs),
        err,
        String(attempts),
      ),
    ackAndDead: (
      streamKey,
      jobHashKey,
      dlqKey,
      group,
      entryId,
      jobId,
      data,
      nowMs,
      err,
      attempts,
    ) =>
      r.ackAndDead!(
        streamKey,
        jobHashKey,
        dlqKey,
        group,
        entryId,
        jobId,
        data,
        String(nowMs),
        err,
        String(attempts),
      ),
  };
}
