"use client";
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Board, PlayerColor } from "@/games/strata/engine/types";
import { size, type Cube, type Cubes } from "@/games/strata/engine/pieces";
import type { Placement } from "@/games/strata/engine/placement";
import { toWorld } from "./BoardScene";
import { Outline } from "./Territory";

const TOP = 0.06; // board surface height
const UNIT = 1; // one cube is 1 unit tall
const CUBE = 0.94;

export type PlacedPiece = { id: number; world: Cube[] };

// Small imperative helpers live outside the components so render stays pure.
const setCursor = (v: string) => { document.body.style.cursor = v; };
const setEnabled = (c: { enabled: boolean } | null, on: boolean) => { if (c) c.enabled = on; };

let geo: RoundedBoxGeometry | null = null;
const cubeGeo = () => (geo ??= new RoundedBoxGeometry(CUBE, CUBE * UNIT, CUBE, 3, 0.07));
const insetGeo = new THREE.PlaneGeometry(CUBE * 0.62, CUBE * 0.62);

type MatKind = "solid" | "dim";
function useMaterials() {
  return useMemo(() => ({
    // the blocks in the reference photos are a pale periwinkle blue, not pure white
    solid: new THREE.MeshStandardMaterial({ color: "#c3d4ec", roughness: 0.45, metalness: 0 }),
    dim: new THREE.MeshStandardMaterial({ color: "#c3d4ec", roughness: 0.5, transparent: true, opacity: 0.4 }),
    inset: new THREE.MeshStandardMaterial({ color: "#aebfdc", roughness: 0.6 }),
  }), []);
}

/** A block made of real cubes with rounded edges and a shallow square on each top face, like the pieces in the reference. Positions are in cells. */
export const PieceMesh = memo(function PieceMesh({ cubes, kind = "solid", shadow = true }: { cubes: Cubes; kind?: MatKind; shadow?: boolean }) {
  const m = useMaterials();
  const s = size(cubes);
  const top = useMemo(() => { const t = new Set<string>(); for (const c of cubes) t.add(`${c[0]},${c[1]},${c[2] + 1}`); return (c: Cube) => !t.has(`${c[0]},${c[1]},${c[2] + 1}`); }, [cubes]);
  useEffect(() => () => { /* shared geometry and per-mount materials are small; materials are released with the component tree */ }, []);
  return (
    <group>
      {cubes.map((c, i) => (
        <group key={i} position={[c[0] - (s.w - 1) / 2, (c[2] + 0.5) * UNIT, c[1] - (s.d - 1) / 2]}>
          <mesh geometry={cubeGeo()} material={m[kind]} castShadow={shadow && kind === "solid"} receiveShadow />
          {kind === "solid" && top(c) && <mesh geometry={insetGeo} material={m.inset} rotation={[-Math.PI / 2, 0, 0]} position={[0, CUBE * UNIT * 0.5 + 0.004, 0]} />}
        </group>
      ))}
    </group>
  );
});

/** World position of a block's footprint centre when its min corner is at cell (x, y) and it rests at height h. */
const anchor = (board: Board, cubes: Cubes, x: number, y: number, h: number): [number, number, number] => {
  const s = size(cubes);
  const [wx, wz] = toWorld(board, x + (s.w - 1) / 2, y + (s.d - 1) / 2);
  return [wx, TOP + h * UNIT, wz];
};

/** Blocks standing on the board. A newly placed one drops in with a short ease. */
export function PlacedBlocks({ board, placed, vanish = false }: { board: Board; placed: PlacedPiece[]; vanish?: boolean }) {
  return <>{placed.map((p) => <Dropped key={p.id} board={board} piece={p} vanish={vanish} />)}</>;
}
function Dropped({ board, piece, vanish }: { board: Board; piece: PlacedPiece; vanish: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const y = useRef(1.1);
  const k = useRef(1);
  const invalidate = useThree((s) => s.invalidate);
  const min = useMemo(() => ({ x: Math.min(...piece.world.map((c) => c[0])), y: Math.min(...piece.world.map((c) => c[1])), z: Math.min(...piece.world.map((c) => c[2])) }), [piece]);
  const local = useMemo(() => piece.world.map((c): Cube => [c[0] - min.x, c[1] - min.y, c[2] - min.z]), [piece, min]);
  const pos = useMemo(() => anchor(board, local, min.x, min.y, min.z), [board, local, min]);
  // The group starts lifted and eases down; position is set here rather than as a prop so re-renders don't reset it.
  useLayoutEffect(() => { ref.current?.position.set(pos[0], pos[1] + y.current, pos[2]); invalidate(); }, [pos, invalidate]);
  useFrame((_, dt) => {
    if (ref.current && vanish && k.current > 0) {
      // the temporary block shrinks into the board once the move is confirmed
      k.current = Math.max(0, k.current - dt * 2.4);
      ref.current.scale.setScalar(Math.max(0.001, k.current * k.current));
      ref.current.visible = k.current > 0.01;
      invalidate();
      return;
    }
    if (!ref.current || y.current <= 0.0005) return;
    y.current *= Math.pow(0.0009, dt);
    if (y.current < 0.0005) y.current = 0;
    ref.current.position.y = pos[1] + y.current;
    invalidate();
  });
  return <group ref={ref}><PieceMesh cubes={local} /></group>;
}

/** The blocks waiting beside the board. Tap one to pick it up. */
export function Tray({ board, items, activeId, onSelect }: { board: Board; items: Array<{ id: string; cubes: Cubes }>; activeId: string | null; onSelect: (id: string) => void }) {
  const perRow = 3, scale = 0.55, gapX = 3.1, gapZ = 2.3, z0 = board.height / 2 + 1.7;
  return (
    <>
      {items.map((it, i) => {
        const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, items.length - row * perRow);
        const x = (col - (inRow - 1) / 2) * gapX, z = z0 + row * gapZ;
        return (
          <group key={it.id} position={[x, TOP, z]} scale={scale}
            onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(it.id); }}
            onPointerOver={() => setCursor("pointer")} onPointerOut={() => setCursor("")}>
            <PieceMesh cubes={it.cubes} kind={activeId === it.id ? "dim" : "solid"} />
            {/* a generous invisible hit area so small blocks are easy to tap on a phone */}
            <mesh position={[0, 1, 0]}><boxGeometry args={[4.4, 3, 3.8]} /><meshBasicMaterial visible={false} /></mesh>
          </group>
        );
      })}
    </>
  );
}

/**
 * The block you are holding: lifted above the board with a shadow, plus a coloured preview where it will land and the
 * tiles it covers. Drag the lifted block to move it; it snaps to whole tiles.
 */
export function Held({ board, cubes, x, y, placement, onMove, color }: { color?: PlayerColor | null; board: Board; cubes: Cubes; x: number; y: number; placement: Placement; onMove: (x: number, y: number) => void }) {
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const dragging = useRef(false);
  const s = size(cubes);
  const lift = placement.base + 1.1;
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    // intersect the pointer ray with a horizontal plane through the lifted block, so it doesn't jump when grabbed
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TOP + lift * UNIT + s.h / 2));
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(plane, hit)) return;
    const cx = hit.x / 1 + (board.width - 1) / 2, cy = hit.z / 1 + (board.height - 1) / 2; // pointer in cell units
    const nx = Math.round(cx - (s.w - 1) / 2), ny = Math.round(cy - (s.d - 1) / 2);
    if (nx !== x || ny !== y) onMove(Math.max(-s.w, Math.min(board.width, nx)), Math.max(-s.d, Math.min(board.height, ny)));
  };
  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation(); dragging.current = true;
    setEnabled(controls, false);
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    dragging.current = false;
    setEnabled(controls, true);
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
  };
  useEffect(() => () => setEnabled(controls, true), [controls]);
  const float = anchor(board, cubes, x, y, lift);
  return (
    <>
      {/* where it would land: the player's colour outline when it fits, a plain grey footprint when it doesn't (the reason is shown in words) */}
      {placement.valid && color ? <Outline board={board} cells={placement.cells} color={color} strong={false} />
        : placement.cells.map((c) => {
          if (!board.cells[c.y]?.[c.x]) return null;
          const [wx, wz] = toWorld(board, c.x, c.y);
          return <mesh key={`${c.x},${c.y}`} position={[wx, TOP + 0.02, wz]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.92, 0.92]} /><meshBasicMaterial color="#6b6b73" transparent opacity={0.28} depthWrite={false} /></mesh>;
        })}
      <group position={float} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onPointerOver={() => setCursor("grab")} onPointerOut={() => setCursor("")}>
        <PieceMesh cubes={cubes} />
      </group>
    </>
  );
}
