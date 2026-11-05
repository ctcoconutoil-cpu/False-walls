"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Board, Cell, PlayerColor } from "@/games/strata/engine/types";
import { BOARD_COLORS, PLAYER_COLORS } from "@/games/strata/config/palette";

export type CameraCmd = { kind: "angled" | "top" | "zoomIn" | "zoomOut"; nonce: number };

const CELL = 1;
const GAP = 0.04;
const TOP = 0.06; // thickness of a tile

/** World position of the centre of a cell. The board is centred on the origin. */
export const toWorld = (b: Board, x: number, y: number): [number, number] => [(x - (b.width - 1) / 2) * CELL, (y - (b.height - 1) / 2) * CELL];

/** One small pattern per colour, so colour is never the only signal. */
function patternTexture(color: PlayerColor): THREE.CanvasTexture {
  const S = 128, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = PLAYER_COLORS[color].hex;
  g.fillRect(0, 0, S, S);
  g.strokeStyle = "rgba(255,255,255,.85)"; g.fillStyle = "rgba(255,255,255,.85)"; g.lineWidth = 5; g.lineCap = "round";
  if (color === "orange" || color === "turquoise") {
    for (let i = 0; i < 4; i++) { g.beginPath(); const y = 16 + i * 32; g.moveTo(0, y); for (let x = 0; x <= S; x += 32) { g.quadraticCurveTo(x + 8, y - 12, x + 16, y); g.quadraticCurveTo(x + 24, y + 12, x + 32, y); } g.stroke(); }
  } else if (color === "blue") {
    for (const [x, y] of [[32, 32], [96, 32], [32, 96], [96, 96], [64, 64]]) { g.beginPath(); g.moveTo(x - 9, y - 9); g.lineTo(x + 9, y + 9); g.moveTo(x + 9, y - 9); g.lineTo(x - 9, y + 9); g.stroke(); }
  } else if (color === "yellow") {
    for (const [x, y] of [[32, 32], [96, 32], [32, 96], [96, 96], [64, 64]]) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
  } else if (color === "purple") {
    for (let i = 0; i < 4; i++) { g.beginPath(); const y = 20 + i * 32; g.moveTo(0, y); for (let x = 0; x <= S; x += 32) { g.lineTo(x + 16, y - 10); g.lineTo(x + 32, y); } g.stroke(); }
  } else {
    for (let i = -2; i < 6; i++) { g.beginPath(); g.moveTo(i * 32, S); g.lineTo(i * 32 + S, 0); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const baseColor = (c: Cell) => {
  if (c.type === "black") return BOARD_COLORS.black;
  if (c.owner && (c.status === "captured" || c.type === "start")) return PLAYER_COLORS[c.owner].hex;
  return BOARD_COLORS.tile;
};

function Tiles({ board, onPick }: { board: Board; onPick: (c: Cell) => void }) {
  const cells = useMemo(() => board.cells.flat(), [board]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const m = mesh.current; if (!m) return;
    const d = new THREE.Object3D(), col = new THREE.Color();
    cells.forEach((c, i) => {
      const [wx, wz] = toWorld(board, c.x, c.y);
      d.position.set(wx, c.type === "black" ? TOP / 2 - 0.015 : TOP / 2, wz);
      d.scale.set(CELL - GAP, c.type === "black" ? TOP * 0.8 : TOP, CELL - GAP);
      d.updateMatrix(); m.setMatrixAt(i, d.matrix);
      m.setColorAt(i, col.set(baseColor(c)));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    invalidate();
  }, [cells, board, invalidate]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, cells.length]} receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.instanceId != null) onPick(cells[e.instanceId]); }}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.55} metalness={0} />
    </instancedMesh>
  );
}

/** Dots on height tiles: 2 or 3 small dots stacked in a column, as printed on the reference board. */
function Dots({ board }: { board: Board }) {
  const dots = useMemo(() => {
    const out: Array<[number, number]> = [];
    for (const c of board.cells.flat()) {
      if (c.type !== "height" || !c.height) continue;
      const [wx, wz] = toWorld(board, c.x, c.y);
      for (let i = 0; i < c.height; i++) out.push([wx, wz + (i - (c.height - 1) / 2) * 0.2]);
    }
    return out;
  }, [board]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const m = mesh.current; if (!m) return;
    const d = new THREE.Object3D();
    dots.forEach(([x, z], i) => { d.position.set(x, TOP + 0.004, z); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    m.instanceMatrix.needsUpdate = true; invalidate();
  }, [dots, invalidate]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, dots.length]}>
      <cylinderGeometry args={[0.052, 0.052, 0.008, 14]} />
      <meshBasicMaterial color={BOARD_COLORS.dot} />
    </instancedMesh>
  );
}

function Diamonds({ board }: { board: Board }) {
  const items = board.cells.flat().filter((c) => c.diamond);
  return (
    <>
      {items.map((c) => {
        const [x, z] = toWorld(board, c.x, c.y), r = 0.3;
        const pts: Array<[number, number, number]> = [[0, 0, -r], [r, 0, 0], [0, 0, r], [-r, 0, 0], [0, 0, -r]];
        return <group key={`${c.x},${c.y}`} position={[x, TOP + 0.012, z]}><Line points={pts} color="#ffffff" lineWidth={2.2} /></group>;
      })}
    </>
  );
}

/** Claimed tiles show their owner's pattern; captured tiles are solid (already coloured by Tiles). */
function Claimed({ board }: { board: Board }) {
  const claimed = board.cells.flat().filter((c) => c.status === "claimed" && c.owner && c.type !== "start");
  const textures = useMemo(() => {
    const m = new Map<PlayerColor, THREE.CanvasTexture>();
    for (const c of claimed) if (c.owner && !m.has(c.owner)) m.set(c.owner, patternTexture(c.owner));
    return m;
  }, [claimed]);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  return (
    <>
      {claimed.map((c) => {
        const [x, z] = toWorld(board, c.x, c.y);
        return (
          <mesh key={`${c.x},${c.y}`} position={[x, TOP + 0.003, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[CELL - GAP, CELL - GAP]} />
            <meshStandardMaterial map={textures.get(c.owner as PlayerColor)} roughness={0.6} />
          </mesh>
        );
      })}
    </>
  );
}

function Selection({ board, cell }: { board: Board; cell: Cell | null }) {
  if (!cell) return null;
  const [x, z] = toWorld(board, cell.x, cell.y), h = (CELL - GAP) / 2;
  const pts: Array<[number, number, number]> = [[-h, 0, -h], [h, 0, -h], [h, 0, h], [-h, 0, h], [-h, 0, -h]];
  return <group position={[x, TOP + 0.02, z]}><Line points={pts} color="#FF6B4A" lineWidth={3} /></group>;
}

/** Moves the camera to a view or zooms it, easing over ~0.7s, then hands control back to the player. */
function CameraRig({ cmd }: { cmd: CameraCmd }) {
  const { camera, size, invalidate } = useThree();
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const goal = useRef<THREE.Vector3 | null>(null);
  const last = useRef(-1); // -1 so the first run fits the camera to the screen
  useEffect(() => {
    if (cmd.nonce === last.current) return;
    last.current = cmd.nonce;
    const aspect = size.width / Math.max(1, size.height);
    const fit = aspect < 1 ? 1 / Math.max(0.55, aspect) : 1; // pull back on tall phones so the whole board stays visible
    if (cmd.kind === "angled") goal.current = new THREE.Vector3(0, 11.5 * fit * 1.18, 11 * fit * 1.18 + 2.2);
    else if (cmd.kind === "top") goal.current = new THREE.Vector3(0, 18 * fit * 1.1, 2.2);
    else {
      const t = controls?.target ?? new THREE.Vector3();
      const dir = camera.position.clone().sub(t);
      const dist = THREE.MathUtils.clamp(dir.length() * (cmd.kind === "zoomIn" ? 0.8 : 1.25), 7, 28);
      goal.current = t.clone().add(dir.setLength(dist));
    }
    invalidate();
  }, [cmd, camera, controls, size, invalidate]);
  useFrame((_, dt) => {
    if (!goal.current) return;
    camera.position.lerp(goal.current, 1 - Math.pow(0.0006, dt));
    controls?.update();
    if (camera.position.distanceTo(goal.current) < 0.02) { camera.position.copy(goal.current); goal.current = null; }
    invalidate();
  });
  return null;
}

export function BoardScene({ board, selected, onPick, cmd, children }: { board: Board; selected: Cell | null; onPick: (c: Cell) => void; cmd: CameraCmd; children?: ReactNode }) {
  const w = board.width * CELL + 0.7, h = board.height * CELL + 0.7;
  return (
    <Canvas flat shadows="soft" frameloop="demand" dpr={[1, 2]} camera={{ position: [0, 13.5, 15], fov: 36, near: 0.1, far: 80 }} gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ touchAction: "none" }} onPointerMissed={() => onPick(null as unknown as Cell)}>
      <color attach="background" args={["#1b1230"]} />
      <ambientLight intensity={1.9} />
      <directionalLight position={[6, 12, 5]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-bias={-0.0004} />
      <hemisphereLight args={["#ffffff", "#2a1d4a", 0.35]} />
      {/* the slab the tiles sit in */}
      <mesh position={[0, -0.16, 0]} receiveShadow castShadow><boxGeometry args={[w, 0.3, h]} /><meshStandardMaterial color={BOARD_COLORS.line} roughness={0.7} /></mesh>
      <mesh position={[0, -0.02, 0]} receiveShadow><boxGeometry args={[w - 0.3, 0.05, h - 0.3]} /><meshStandardMaterial color="#d8d8d4" roughness={0.7} /></mesh>
      <Tiles board={board} onPick={onPick} />
      <Claimed board={board} />
      <Dots board={board} />
      <Diamonds board={board} />
      <Selection board={board} cell={selected} />
      {children}
      <OrbitControls makeDefault enablePan={false} target={[0, 0, 2.2]} enableDamping dampingFactor={0.12} minDistance={7} maxDistance={28} minPolarAngle={0} maxPolarAngle={1.25} rotateSpeed={0.7} zoomSpeed={0.8}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }} />
      <CameraRig cmd={cmd} />
    </Canvas>
  );
}
