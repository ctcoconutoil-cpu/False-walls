"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Board, PlayerColor } from "@/games/strata/engine/types";
import { PLAYER_COLORS } from "@/games/strata/config/palette";
import { fillDuration, type FillStep } from "@/games/strata/engine/animation";
import { patternTexture, toWorld } from "./BoardScene";

const TOP = 0.06;
const SIZE = 0.96;

/**
 * Outline of where this turn's temporary blocks stand, in the player's colour. Shown while blocks are being placed (a subtle tint),
 * and stronger once the whole arrangement is down and valid.
 */
export function Outline({ board, cells, color, strong }: { board: Board; cells: Array<{ x: number; y: number }>; color: PlayerColor; strong: boolean }) {
  const hex = PLAYER_COLORS[color].hex;
  const set = useMemo(() => new Set(cells.map((c) => `${c.x},${c.y}`)), [cells]);
  return (
    <>
      {cells.map((c) => {
        if (!board.cells[c.y]?.[c.x]) return null;
        const [x, z] = toWorld(board, c.x, c.y), h = SIZE / 2;
        // draw only the edges that face outside the arrangement, so it reads as one outline
        const edges: Array<[[number, number], [number, number]]> = [];
        if (!set.has(`${c.x},${c.y - 1}`)) edges.push([[-h, -h], [h, -h]]);
        if (!set.has(`${c.x + 1},${c.y}`)) edges.push([[h, -h], [h, h]]);
        if (!set.has(`${c.x},${c.y + 1}`)) edges.push([[h, h], [-h, h]]);
        if (!set.has(`${c.x - 1},${c.y}`)) edges.push([[-h, h], [-h, -h]]);
        return (
          <group key={`${c.x},${c.y}`} position={[x, TOP + 0.012, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[SIZE, SIZE]} /><meshBasicMaterial color={hex} transparent opacity={strong ? 0.62 : 0.34} depthWrite={false} /></mesh>
            {edges.map((e, i) => <Line key={i} points={[[e[0][0], 0.004, e[0][1]], [e[1][0], 0.004, e[1][1]]]} color={hex} lineWidth={strong ? 4 : 2.5} />)}
          </group>
        );
      })}
    </>
  );
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/**
 * The colour filling the board after a turn is confirmed: each changed tile grows from its centre in the player's colour, flashing bright,
 * then settles into its claimed pattern or its solid captured colour. `plan` says when each tile starts. Calls `onDone` when everything has settled.
 */
export function FillLayer({ board, plan, onDone }: { board: Board; plan: FillStep[]; onDone: () => void }) {
  const invalidate = useThree((s) => s.invalidate);
  const start = useRef<number | null>(null);
  const finished = useRef(false);
  const meshes = useRef<Array<THREE.Mesh | null>>([]);
  const total = useMemo(() => fillDuration(plan, 520), [plan]);
  const textures = useMemo(() => {
    const m = new Map<PlayerColor, THREE.CanvasTexture>();
    for (const p of plan) if (p.status === "claimed" && !m.has(p.owner)) m.set(p.owner, patternTexture(p.owner));
    return m;
  }, [plan]);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  useEffect(() => { start.current = null; finished.current = false; invalidate(); }, [plan, invalidate]);
  useFrame(({ clock }) => {
    if (finished.current) return;
    if (start.current == null) start.current = clock.getElapsedTime() * 1000;
    const now = clock.getElapsedTime() * 1000 - start.current;
    plan.forEach((p, i) => {
      const m = meshes.current[i]; if (!m) return;
      const k = ease((now - p.delay) / 520);
      m.visible = now >= p.delay;
      m.scale.setScalar(Math.max(0.001, k));
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (1 - k) * 0.9; // a bright flash that fades as the tile settles
    });
    if (now >= total) { finished.current = true; onDone(); }
    invalidate();
  });
  return (
    <>
      {plan.map((p, i) => {
        const [x, z] = toWorld(board, p.x, p.y);
        return (
          <mesh key={`${p.x},${p.y}`} ref={(m) => { meshes.current[i] = m; }} position={[x, TOP + 0.02, z]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <planeGeometry args={[SIZE, SIZE]} />
            <meshStandardMaterial map={p.status === "claimed" ? textures.get(p.owner) : null} color={p.status === "claimed" ? "#ffffff" : PLAYER_COLORS[p.owner].hex} emissive={PLAYER_COLORS[p.owner].hex} emissiveIntensity={0.9} roughness={0.6} />
          </mesh>
        );
      })}
    </>
  );
}

