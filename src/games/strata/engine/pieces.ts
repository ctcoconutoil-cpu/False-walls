/**
 * Polycube blocks. A block is a set of unit cubes [x, y, z]: x and y run across the board, z is height.
 * Every function returns a NEW normalised array (minimum corner at 0,0,0, sorted), so two blocks are equal when their keys are equal.
 */
export type Cube = readonly [number, number, number];
export type Cubes = ReadonlyArray<Cube>;

export const normalize = (cubes: Cubes): Cube[] => {
  const mx = Math.min(...cubes.map((c) => c[0])), my = Math.min(...cubes.map((c) => c[1])), mz = Math.min(...cubes.map((c) => c[2]));
  return cubes.map((c): Cube => [c[0] - mx, c[1] - my, c[2] - mz]).sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
};
export const keyOf = (cubes: Cubes) => normalize(cubes).map((c) => c.join(",")).join(";");

/** Turn flat on the board (clockwise seen from above). */
export const rotateYaw = (c: Cubes): Cube[] => normalize(c.map(([x, y, z]): Cube => [-y, x, z]));
/** Tip over towards or away from you (about the board's x axis). */
export const tiltPitch = (c: Cubes): Cube[] => normalize(c.map(([x, y, z]): Cube => [x, -z, y]));
/** Roll sideways (about the board's y axis). */
export const rollSide = (c: Cubes): Cube[] => normalize(c.map(([x, y, z]): Cube => [z, y, -x]));
/** Mirror image, where the rules permit it. */
export const flip = (c: Cubes): Cube[] => normalize(c.map(([x, y, z]): Cube => [-x, y, z]));

export const size = (c: Cubes) => {
  const n = normalize(c);
  return { w: Math.max(...n.map((q) => q[0])) + 1, d: Math.max(...n.map((q) => q[1])) + 1, h: Math.max(...n.map((q) => q[2])) + 1 };
};

/** Every distinct orientation. 24 are plain rotations; mirror images add up to 24 more when `mirror` is true. */
export function orientations(cubes: Cubes, mirror = false): Cube[][] {
  const seen = new Map<string, Cube[]>();
  const queue: Cube[][] = [normalize(cubes)];
  while (queue.length) {
    const c = queue.pop()!;
    const k = keyOf(c);
    if (seen.has(k)) continue;
    seen.set(k, c);
    queue.push(rotateYaw(c), tiltPitch(c), rollSide(c));
    if (mirror) queue.push(flip(c));
  }
  return [...seen.values()];
}

export type PieceDef = { id: string; name: string; cubes: Cubes };

/**
 * The six STRATA blocks, read from the reference image of the Custom Piece Set (left to right: cross, zigzag, tall T, tall L, bridge, step).
 * Each is five cubes joined face to face. The exact cube positions are estimated from the picture, so they live here as data and can be corrected in one place.
 */
export const PIECES: Record<string, PieceDef> = {
  cross: { id: "cross", name: "Cross", cubes: [[1, 0, 0], [0, 1, 0], [1, 1, 0], [2, 1, 0], [1, 2, 0]] },
  zigzag: { id: "zigzag", name: "Zigzag", cubes: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [1, 0, 2], [2, 0, 2]] },
  tallT: { id: "tallT", name: "Tall T", cubes: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 0, 1], [1, 0, 2]] },
  tallL: { id: "tallL", name: "Tall L", cubes: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 0, 1], [2, 0, 2]] },
  bridge: { id: "bridge", name: "Bridge", cubes: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [2, 0, 1], [2, 0, 0]] },
  step: { id: "step", name: "Step", cubes: [[0, 0, 0], [0, 0, 1], [1, 0, 0], [1, 1, 0], [2, 1, 0]] },
};

/** The blocks every player has to choose from. The three for a turn are dealt from these six. */
export const STARTER_SET = ["cross", "zigzag", "tallT", "tallL", "bridge", "step"] as const;

const key3 = (c: Cube) => c.join(",");

/**
 * Does the block stand by itself? Its centre of mass, seen from above, has to lie over the area its lowest cubes touch
 * (the convex hull of their footprints). A block that would tip over is not allowed.
 */
export function stands(cubes: Cubes): boolean {
  const n = normalize(cubes);
  const pts: Array<[number, number]> = [];
  for (const [x, y, z] of n) if (z === 0) pts.push([x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]);
  const cx = n.reduce((a, c) => a + c[0] + 0.5, 0) / n.length, cy = n.reduce((a, c) => a + c[1] + 0.5, 0) / n.length;
  // convex hull (monotone chain)
  const P = [...new Map(pts.map((p) => [p.join(","), p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const hull: Array<[number, number]> = [];
  for (const half of [P, [...P].reverse()]) {
    const start = hull.length;
    for (const p of half) { while (hull.length >= start + 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop(); hull.push(p); }
    hull.pop();
  }
  if (hull.length < 3) return false;
  const eps = 1e-9;
  return hull.every((a, i) => { const b = hull[(i + 1) % hull.length]; return cross(a, b, [cx, cy]) >= -eps; });
}

/** Cubes with open space directly beneath them inside the block (they hang in the air). */
export function hangingCubes(cubes: Cubes): Cube[] {
  const n = normalize(cubes), set = new Set(n.map(key3));
  return n.filter(([x, y, z]) => z > 0 && !set.has(key3([x, y, z - 1])));
}

/**
 * A bridge spans a gap: every hanging cube sits in a straight run of cubes that is held up at both ends.
 * Only a bridge may cross over black tiles or tiles another player has captured.
 */
export function isBridge(cubes: Cubes): boolean {
  const n = normalize(cubes), set = new Set(n.map(key3));
  const hang = hangingCubes(n);
  if (!hang.length) return false;
  const held = ([x, y, z]: Cube) => set.has(key3([x, y, z - 1]));
  const reaches = (c: Cube, dx: number, dy: number) => {
    let x = c[0], y = c[1]; const z = c[2];
    for (;;) { x += dx; y += dy; if (!set.has(key3([x, y, z]))) return false; if (held([x, y, z])) return true; }
  };
  return hang.every((c) => (reaches(c, 1, 0) && reaches(c, -1, 0)) || (reaches(c, 0, 1) && reaches(c, 0, -1)));
}

/** The tiles a resting block hangs over without touching them (columns with no cube on the ground). */
export function spanColumns(cubes: Cubes): Array<[number, number]> {
  const n = normalize(cubes), ground = new Set(n.filter((c) => c[2] === 0).map((c) => `${c[0]},${c[1]}`));
  return [...new Set(n.filter((c) => !ground.has(`${c[0]},${c[1]}`)).map((c) => `${c[0]},${c[1]}`))].map((k) => k.split(",").map(Number) as [number, number]);
}
