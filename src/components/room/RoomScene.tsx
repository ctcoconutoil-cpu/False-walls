"use client";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { FRAME_COLOUR, ROOM_SIZES, THEMES, byKind, footprint, roomImageUrl, type RoomData, type RoomDecor, type RoomItem } from "@/lib/room/catalog";

export type Sel = { type: "item" | "decor"; id: string } | null;
type Dims = { w: number; d: number; h: number };

/** Where a wall sits and which way it faces. Every wall faces into the room, so from outside it is see-through. */
function wallPose(wall: number, { w, d }: Dims): { pos: [number, number, number]; ry: number; len: number } {
  if (wall === 0) return { pos: [0, 0, -d / 2], ry: 0, len: w };
  if (wall === 1) return { pos: [w / 2, 0, 0], ry: -Math.PI / 2, len: d };
  if (wall === 2) return { pos: [0, 0, d / 2], ry: Math.PI, len: w };
  return { pos: [-w / 2, 0, 0], ry: Math.PI / 2, len: d };
}

function Furniture({ it, selected, editable, onDown }: { it: RoomItem; selected: boolean; editable: boolean; onDown: (e: ThreeEvent<PointerEvent>) => void }) {
  const cat = byKind(it.kind);
  if (!cat) return null;
  return (
    <group position={[it.x, 0, it.z]} rotation={[0, it.rot, 0]} scale={it.scale} onPointerDown={onDown}>
      {cat.parts.map((p, i) => (
        <mesh key={i} position={p.p} castShadow={!cat.flat} receiveShadow>
          {p.s === "box" ? <boxGeometry args={p.d as [number, number, number]} /> : p.s === "cyl" ? <cylinderGeometry args={[p.d[0], p.d[0], p.d[1], 18]} /> : <sphereGeometry args={[p.d[0], 16, 12]} />}
          <meshStandardMaterial color={p.c} roughness={0.7} emissive={p.glow ? p.c : "#000"} emissiveIntensity={p.glow ? 0.9 : 0} />
        </mesh>
      ))}
      {selected && editable && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(cat.size[0], cat.size[2]) * 0.62, Math.max(cat.size[0], cat.size[2]) * 0.62 + 0.05, 40]} />
          <meshBasicMaterial color="#F9A719" />
        </mesh>
      )}
    </group>
  );
}

function Picture({ dc }: { dc: RoomDecor }) {
  const url = roomImageUrl(dc.image_path);
  const tex = useTexture(url ?? "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==", (t) => { const x = (Array.isArray(t) ? t[0] : t) as THREE.Texture; x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 4; });
  return <mesh position={[0, 0, 0.024]}><planeGeometry args={[dc.w, dc.h]} /><meshBasicMaterial map={url ? tex : null} color={url ? "#fff" : "#c79a5a"} toneMapped={false} /></mesh>;
}

function Decor({ dc, selected, editable, onDown }: { dc: RoomDecor; selected: boolean; editable: boolean; onDown: (e: ThreeEvent<PointerEvent>) => void }) {
  const f = dc.frame === "none" ? 0 : dc.kind === "noticeboard" ? 0.06 : 0.05;
  return (
    <group position={[dc.u, dc.v, 0.01 + dc.z_index * 0.004]} rotation={[0, 0, dc.rot]} onPointerDown={onDown}>
      {f > 0 && <mesh castShadow><boxGeometry args={[dc.w + f * 2, dc.h + f * 2, 0.04]} /><meshStandardMaterial color={dc.kind === "noticeboard" ? "#8a5a3c" : FRAME_COLOUR[dc.frame]} roughness={0.5} /></mesh>}
      <Suspense fallback={null}><Picture dc={dc} /></Suspense>
      {selected && editable && <mesh position={[0, 0, 0.03]}><planeGeometry args={[dc.w + 0.16, dc.h + 0.16]} /><meshBasicMaterial color="#F9A719" transparent opacity={0.35} /></mesh>}
    </group>
  );
}

function Scene({ data, dims, editable, sel, onSelect, onItem, onDecor, setDragging }: {
  data: Pick<RoomData, "theme" | "items" | "decor">; dims: Dims; editable: boolean; sel: Sel; onSelect: (s: Sel) => void;
  onItem: (id: string, p: Partial<RoomItem>) => void; onDecor: (id: string, p: Partial<RoomDecor>) => void; setDragging: (b: boolean) => void;
}) {
  const th = THEMES[data.theme];
  const drag = useRef<{ type: "item" | "decor"; id: string; dx: number; dy: number } | null>(null);
  const wallGroups = useRef<(THREE.Group | null)[]>([]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { const up = () => { if (drag.current) { drag.current = null; setDragging(false); } }; window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up); return () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); }; }, [setDragging]);

  const overlaps = (cand: RoomItem) => {
    if (byKind(cand.kind)?.flat) return false;
    const a = footprint(cand);
    return data.items.some((o) => o.id !== cand.id && !byKind(o.kind)?.flat && (() => { const b = footprint(o); return Math.abs(o.x - cand.x) < a.hx + b.hx - 0.02 && Math.abs(o.z - cand.z) < a.hz + b.hz - 0.02; })());
  };

  const move = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current; if (!d || !editable) return;
    if (d.type === "item") {
      const it = data.items.find((i) => i.id === d.id); if (!it) return;
      const hit = e.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tmp); if (!hit) return;
      const { hx, hz } = footprint(it);
      const cand = { ...it, x: THREE.MathUtils.clamp(hit.x - d.dx, -dims.w / 2 + hx, dims.w / 2 - hx), z: THREE.MathUtils.clamp(hit.z - d.dy, -dims.d / 2 + hz, dims.d / 2 - hz) };
      if (!overlaps(cand)) onItem(it.id, { x: cand.x, z: cand.z });
    } else {
      const dc = data.decor.find((i) => i.id === d.id); const g = wallGroups.current[dc?.wall ?? 0]; if (!dc || !g) return;
      g.updateWorldMatrix(true, false);
      const inv = g.matrixWorld.clone().invert();
      const ray = e.ray.clone().applyMatrix4(inv);
      const hit = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), tmp); if (!hit) return;
      const len = wallPose(dc.wall, dims).len;
      onDecor(dc.id, { u: THREE.MathUtils.clamp(hit.x - d.dx, -len / 2 + dc.w / 2, len / 2 - dc.w / 2), v: THREE.MathUtils.clamp(hit.y - d.dy, dc.h / 2 + 0.05, dims.h - dc.h / 2 - 0.05) });
    }
  };

  const startItem = (it: RoomItem) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation(); onSelect({ type: "item", id: it.id }); if (!editable) return;
    const hit = e.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    drag.current = { type: "item", id: it.id, dx: hit ? hit.x - it.x : 0, dy: hit ? hit.z - it.z : 0 }; setDragging(true);
  };
  const startDecor = (dc: RoomDecor) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation(); onSelect({ type: "decor", id: dc.id }); if (!editable) return;
    const g = wallGroups.current[dc.wall]; if (!g) return;
    g.updateWorldMatrix(true, false);
    const ray = e.ray.clone().applyMatrix4(g.matrixWorld.clone().invert());
    const hit = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3());
    drag.current = { type: "decor", id: dc.id, dx: hit ? hit.x - dc.u : 0, dy: hit ? hit.y - dc.v : 0 }; setDragging(true);
  };

  const { w, d, h } = dims;
  return (
    <group onPointerMove={move} onPointerMissed={() => onSelect(null)}>
      <ambientLight intensity={0.75} />
      <hemisphereLight args={["#fff4e6", "#6a5a7a", 0.5]} />
      <directionalLight position={[w * 0.6, h * 2, d * 0.8]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-w} shadow-camera-right={w} shadow-camera-top={d} shadow-camera-bottom={-d} />
      <pointLight position={[0, h - 0.3, 0]} intensity={8} distance={8} color="#ffe2b8" />
      {/* floor (also the surface furniture is dragged across) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[w, d]} /><meshStandardMaterial color={th.floor} roughness={0.85} /></mesh>
      {/* ceiling: visible only from inside */}
      <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[w, d]} /><meshStandardMaterial color="#f6f1ea" /></mesh>
      {[0, 1, 2, 3].map((wall) => {
        const p = wallPose(wall, dims);
        return (
          <group key={wall} position={p.pos} rotation={[0, p.ry, 0]} ref={(g) => { wallGroups.current[wall] = g; }}>
            <mesh position={[0, h / 2, 0]} receiveShadow><planeGeometry args={[p.len, h]} /><meshStandardMaterial color={th.wall} roughness={0.95} /></mesh>
            <mesh position={[0, 0.06, 0.01]}><boxGeometry args={[p.len, 0.12, 0.02]} /><meshStandardMaterial color="#f6f1ea" /></mesh>
            {wall === 0 && (
              <group position={[w * 0.18, 1.6, 0.01]}>
                <mesh><boxGeometry args={[1.2, 1, 0.04]} /><meshStandardMaterial color="#f4f1ea" /></mesh>
                <mesh position={[0, 0, 0.025]}><planeGeometry args={[1.08, 0.88]} /><meshBasicMaterial color="#9fd4ff" /></mesh>
                <mesh position={[0, 0, 0.03]}><boxGeometry args={[0.03, 0.88, 0.01]} /><meshStandardMaterial color="#f4f1ea" /></mesh>
              </group>
            )}
            {wall === 3 && (
              <group position={[d * 0.28, 1.0, 0.01]}>
                <mesh><boxGeometry args={[0.95, 2, 0.04]} /><meshStandardMaterial color="#6b4a35" /></mesh>
                <mesh position={[0.3, -0.05, 0.03]}><sphereGeometry args={[0.04, 10, 8]} /><meshStandardMaterial color="#d6b04f" /></mesh>
              </group>
            )}
            {data.decor.filter((x) => x.wall === wall).map((dc) => <Decor key={dc.id} dc={dc} editable={editable} selected={sel?.type === "decor" && sel.id === dc.id} onDown={startDecor(dc)} />)}
          </group>
        );
      })}
      {data.items.map((it) => <Furniture key={it.id} it={it} editable={editable} selected={sel?.type === "item" && sel.id === it.id} onDown={startItem(it)} />)}
    </group>
  );
}

export function RoomScene(props: {
  data: Pick<RoomData, "size" | "theme" | "items" | "decor">; editable: boolean; sel: Sel; onSelect: (s: Sel) => void;
  onItem?: (id: string, p: Partial<RoomItem>) => void; onDecor?: (id: string, p: Partial<RoomDecor>) => void; resetKey?: number; light?: boolean;
}) {
  const dims = ROOM_SIZES[props.data.size];
  const [dragging, setDragging] = useState(false);
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => { controls.current?.reset(); }, [props.resetKey]);
  const far = Math.max(dims.w, dims.d) * 1.7;
  return (
    <Canvas shadows={!props.light} dpr={props.light ? 1 : [1, 1.75]} camera={{ position: [far * 0.7, dims.h * 1.6, far * 0.95], fov: 42, near: 0.1, far: 60 }} gl={{ antialias: !props.light, powerPreference: "high-performance" }} style={{ touchAction: "none" }}>
      <Scene data={props.data} dims={dims} editable={props.editable} sel={props.sel} onSelect={props.onSelect} onItem={props.onItem ?? (() => {})} onDecor={props.onDecor ?? (() => {})} setDragging={setDragging} />
      <OrbitControls ref={controls} makeDefault enabled={!dragging} enablePan={false} target={[0, dims.h * 0.35, 0]} minDistance={2.2} maxDistance={far * 1.8} maxPolarAngle={Math.PI / 2.05} />
    </Canvas>
  );
}
