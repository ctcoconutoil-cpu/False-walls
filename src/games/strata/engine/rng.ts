/** Small seeded generator (mulberry32). The same seed always gives the same sequence, which replays, daily challenges and server checks rely on. */
export function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next };
}

/** Picks `count` distinct items in a seeded shuffle. Returns the picks and the advanced seed. */
export function draw<T>(items: readonly T[], count: number, seed: number): { picks: T[]; seed: number } {
  const pool = [...items];
  const picks: T[] = [];
  let s = seed;
  while (picks.length < count && pool.length) {
    const r = nextRandom(s); s = r.seed;
    picks.push(pool.splice(Math.floor(r.value * pool.length), 1)[0]);
  }
  return { picks, seed: s };
}
