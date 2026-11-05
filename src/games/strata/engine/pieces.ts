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

/** The block library. New shapes are added here as data. */
export const PIECES: Record<string, PieceDef> = {
  single: { id: "single", name: "Single cube", cubes: [[0, 0, 0]] },
  domino: { id: "domino", name: "Two in a row", cubes: [[0, 0, 0], [1, 0, 0]] },
  line3: { id: "line3", name: "Three in a row", cubes: [[0, 0, 0], [1, 0, 0], [2, 0, 0]] },
  el: { id: "el", name: "L block", cubes: [[0, 0, 0], [0, 1, 0], [0, 2, 0], [1, 0, 0]] },
  tee: { id: "tee", name: "T block", cubes: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0]] },
  square: { id: "square", name: "Square", cubes: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]] },
  cross: { id: "cross", name: "Cross", cubes: [[1, 0, 0], [0, 1, 0], [1, 1, 0], [2, 1, 0], [1, 2, 0]] },
  tower: { id: "tower", name: "Tower", cubes: [[0, 0, 0], [0, 0, 1], [0, 0, 2]] },
  bridge: { id: "bridge", name: "Bridge", cubes: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [2, 0, 1], [2, 0, 0]] },
  stair: { id: "stair", name: "Stair", cubes: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [2, 0, 1]] },
};

/**
 * Which blocks a player holds. The real STRATA set is six blocks but their exact shapes aren't published,
 * so this is a configurable stand-in modelled on the shapes in the reference video (cross, step, T, L, bridge, tower).
 */
export const STARTER_SET = ["cross", "stair", "tee", "el", "bridge", "tower"] as const;
