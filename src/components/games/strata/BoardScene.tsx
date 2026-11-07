"use client";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Board, Cell, PlayerColor } from "@/games/strata/engine/types";
import { BOARD_COLORS, PLAYER_COLORS, PLAYER_PATTERN, type PatternId } from "@/games/strata/config/palette";


const CELL = 1;
const GAP = 0.04;
const TOP = 0.06; // thickness of a tile

/** World position of the centre of a cell. The board is centred on the origin. */
export const toWorld = (b: Board, x: number, y: number): [number, number] => [(x - (b.width - 1) / 2) * CELL, (y - (b.height - 1) / 2) * CELL];

/** Draws one territory pattern. Patterns are only a look for claimed tiles; they never change how a tile plays. */
function drawPattern(g: CanvasRenderingContext2D, S: number, id: PatternId) {
  g.strokeStyle = "rgba(255,255,255,.85)"; g.fillStyle = "rgba(255,255,255,.85)"; g.lineWidth = 5; g.lineCap = "round"; g.lineJoin = "round";
  const spots: Array<[number, number]> = [[32, 32], [96, 32], [32, 96], [96, 96], [64, 64]];
  if (id === "waves") {
    for (let i = 0; i < 4; i++) { g.beginPath(); const y = 16 + i * 32; g.moveTo(0, y); for (let x = 0; x <= S; x += 32) { g.quadraticCurveTo(x + 8, y - 12, x + 16, y); g.quadraticCurveTo(x + 24, y + 12, x + 32, y); } g.stroke(); }
  } else if (id === "crosses") {
    for (const [x, y] of spots) { g.beginPath(); g.moveTo(x - 9, y - 9); g.lineTo(x + 9, y + 9); g.moveTo(x + 9, y - 9); g.lineTo(x - 9, y + 9); g.stroke(); }
  } else if (id === "dots") {
    for (const [x, y] of spots) { g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); }
  } else if (id === "zigzag") {
    for (let i = 0; i < 4; i++) { g.beginPath(); const y = 20 + i * 32; g.moveTo(0, y); for (let x = 0; x <= S; x += 32) { g.lineTo(x + 16, y - 10); g.lineTo(x + 32, y); } g.stroke(); }
  } else if (id === "grid") {
    g.lineWidth = 4; for (const v of [32, 96]) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, S); g.moveTo(0, v); g.lineTo(S, v); g.stroke(); }
  } else {
    for (let i = -2; i < 6; i++) { g.beginPath(); g.moveTo(i * 32, S); g.lineTo(i * 32 + S, 0); g.stroke(); }
  }
}

/** The claimed-tile texture for a colour: its solid colour with its own pattern (see PLAYER_PATTERN). */
export function patternTexture(color: PlayerColor, pattern: PatternId = PLAYER_PATTERN[color]): THREE.CanvasTexture {
  const S = 128, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = PLAYER_COLORS[color].hex;
  g.fillRect(0, 0, S, S);
  drawPattern(g, S, pattern);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const baseColor = (c: Cell) => {
  if (c.owner && (c.status === "captured" || c.type === "start")) return PLAYER_COLORS[c.owner].hex;
  if (c.type === "black") return BOARD_COLORS.black;
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
    <instancedMesh ref={mesh} args={[undefined, undefined, cells.length]}
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

/** How much the board is stretched front to back so it fills the space it is given (1 = square tiles). */
const StretchContext = createContext(1);
export const useStretch = () => useContext(StretchContext);

const TILT = (24 * Math.PI) / 180; // how far the camera leans toward you from straight above
const aim = (cam: THREE.OrthographicCamera, zoom: number, flip: boolean) => {
  const D = 60, sg = flip ? -1 : 1;
  cam.up.set(0, 1, 0);
  cam.position.set(0, D * Math.cos(TILT), sg * D * Math.sin(TILT));
  cam.zoom = zoom; cam.near = 0.1; cam.far = 200;
  cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
};
/**
 * Looks at the board from slightly in front and above with a flat (orthographic) camera, like a chess screen: the board reads
 * as a flat rectangle, while every block shows its front and top, so the whole body of each block is visible. The board is
 * stretched front to back just enough to fill the height it is given, so there is no empty space around it.
 */
function View({ board, flip, children }: { board: Board; flip: boolean; children: ReactNode }) {
  const { camera, size, invalidate } = useThree();
  const { zoom, k } = useMemo(() => {
    const W = board.width * CELL + 0.5, L = board.height * CELL + 0.5;
    const z = size.width / W;
    return { zoom: z, k: THREE.MathUtils.clamp((size.height * 0.99) / (z * L * Math.cos(TILT)), 1, 1.7) };
  }, [board, size]);
  useLayoutEffect(() => { aim(camera as THREE.OrthographicCamera, zoom, flip); invalidate(); }, [camera, zoom, flip, invalidate]);
  return <StretchContext.Provider value={k}><group scale={[1, 1, k]}>{children}</group></StretchContext.Provider>;
}

export function BoardScene({ board, selected, onPick, children, flip = false }: { flip?: boolean; board: Board; selected: Cell | null; onPick: (c: Cell) => void; children?: ReactNode }) {
  return (
    <Canvas flat orthographic frameloop="demand" dpr={[1, 2]} camera={{ position: [0, 50, 32], zoom: 30, near: 0.1, far: 200 }} gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ touchAction: "none" }} onPointerMissed={() => onPick(null as unknown as Cell)}>
      <color attach="background" args={[BOARD_COLORS.backdrop]} />
      <ambientLight intensity={1.9} />
      <directionalLight position={[6, 12, 5]} intensity={1.1} />
      <hemisphereLight args={["#ffffff", "#2a1d4a", 0.35]} />
      <View board={board} flip={flip}>
      {/* the slab the tiles sit in */}
      <mesh position={[0, -0.16, 0]}><boxGeometry args={[board.width * CELL + 0.7, 0.3, board.height * CELL + 0.7]} /><meshStandardMaterial color={BOARD_COLORS.line} roughness={0.7} /></mesh>
      <mesh position={[0, -0.02, 0]}><boxGeometry args={[board.width * CELL + 0.4, 0.05, board.height * CELL + 0.4]} /><meshStandardMaterial color="#d8d8d4" roughness={0.7} /></mesh>
      <Tiles board={board} onPick={onPick} />
      <Claimed board={board} />
      <Dots board={board} />
      <Diamonds board={board} />
      <Selection board={board} cell={selected} />
      {children}
      </View>
    </Canvas>
  );
}
