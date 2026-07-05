const FNV_PRIME = 16777619n;
const FNV_OFFSET = 2166136261n;
const U32 = 0xffffffffn;

function fnv1a32(input: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    h = (h ^ BigInt(input.charCodeAt(i))) & U32;
    h = (h * FNV_PRIME) & U32;
  }
  return Number(h);
}

export function bucket(userId: string, flagKey: string): number {
  const h = fnv1a32(`${flagKey}|${userId}`);
  return h % 10000;
}

export function inRollout(
  userId: string,
  flagKey: string,
  percentage: number,
): boolean {
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;
  return bucket(userId, flagKey) < percentage * 100;
}
