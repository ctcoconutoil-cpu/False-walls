"use client";
import { useLayoutEffect } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import type { Cubes } from "@/games/strata/engine/pieces";
import { size } from "@/games/strata/engine/pieces";
import { PieceMesh } from "./Blocks";

const GAP = 1.7;

/** Sets the camera so every block fits across the width, looking at them from the front. */
function FrontCamera({ width, height }: { width: number; height: number }) {
  const { camera, size: vp, invalidate } = useThree();
  useLayoutEffect(() => {
    const tan = Math.tan((30 * Math.PI) / 360), aspect = vp.width / Math.max(1, vp.height);
    const d = Math.max((width + 1) / (2 * tan * aspect), (height + 0.8) / (2 * tan));
    camera.position.set(0, height / 2 + d * 0.16, d);
    camera.lookAt(0, height / 2, 0);
    camera.updateProjectionMatrix(); invalidate();
  }, [camera, vp, width, height, invalidate]);
  return null;
}

/**
 * The blocks waiting for you, in a row of their own below the board and seen from the front, standing upright as in the
 * reference. Tap one to pick it up.
 */
export function TrayView({ items, activeId, onSelect }: { items: Array<{ id: string; cubes: Cubes }>; activeId: string | null; onSelect: (id: string) => void }) {
  const dims = items.map((it) => size(it.cubes));
  const total = dims.reduce((a, d) => a + d.w, 0) + GAP * Math.max(0, items.length - 1);
  const tall = Math.max(3, ...dims.map((d) => d.h));
  const lefts = dims.map((_, i) => -total / 2 + dims.slice(0, i).reduce((a, d) => a + d.w + GAP, 0));
  return (
    <Canvas flat frameloop="demand" dpr={[1, 2]} camera={{ fov: 30, near: 0.1, far: 80, position: [0, 3, 14] }} style={{ touchAction: "manipulation" }}>
      <color attach="background" args={["#1b1230"]} />
      <ambientLight intensity={1.9} />
      <directionalLight position={[3, 8, 10]} intensity={1.1} />
      <FrontCamera width={total} height={tall} />
      {items.map((it, i) => {
        const w = dims[i].w, cx = lefts[i] + w / 2;
        return (
          <group key={it.id} position={[cx, 0, 0]} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(it.id); }}>
            <PieceMesh cubes={it.cubes} kind={activeId === it.id ? "dim" : "solid"} />
            {/* a generous invisible hit area so a block is easy to tap */}
            <mesh position={[0, tall / 2, 0]}><boxGeometry args={[w + GAP * 0.9, tall + 0.4, 3]} /><meshBasicMaterial visible={false} /></mesh>
          </group>
        );
      })}
    </Canvas>
  );
}
