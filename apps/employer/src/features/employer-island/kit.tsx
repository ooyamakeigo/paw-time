"use client";

import { createContext, type ReactNode, type SVGProps, useContext } from "react";
import { DEPTH_K, HEIGHT_K, type Projected, darken, lighten, project, round2 } from "@/lib/shop-island";

/**
 * The worker app's island kit, drawn flat. Every part here mirrors a builder
 * in apps/worker/scripts/island_props.gd: same palette, same sizes in metres.
 * Parts are drawn inside a `Place`, which fixes a spot on the island; every
 * point is then projected through the worker camera, so a box shows its top
 * and its front with true perspective. The sun stands high to the right and
 * front: tops are brightest, right faces lit, left faces shaded.
 */
export const WOOD = "#c08a5c";
export const WOOD_D = "#8a5a3c";
export const WOOD_L = "#e0b98a";
export const STONE = "#b9b3ad";
export const STONE_D = "#8f8a88";
export const PAPER = "#fff4e2";
export const RED = "#e8575b";
export const ROOF = "#6f86c9";
export const LEAF = "#7cc46a";
export const LEAF_D = "#4f9a57";
export const WATER = "#7fd0e6";
export const GOLD = "#f2c14e";
export const INK = "#3a2e3c";
export const TRUNK = "#9a6a4a";
export const IRON = "#4a4f63";
export const TERRACOTTA = "#d9774f";
export const CREAM = "#fdf7ee";
export const PALE = "#f3e2c8";
export const STEP = "#e8dcc6";
export const CANOPY = "#86cc6c";
export const CANOPY_PINE = "#4f9a6a";
export const CANOPY_SAKURA = "#f8bfd0";
export const LANTERN = "#ffb48a";
export const GLOW = "#fff1c0";
export const SHADOW = "#1d4a12";

export const top = (color: string): string => lighten(color, 0.3);
export const lit = (color: string): string => lighten(color, 0.1);
export const shade = (color: string): string => darken(color, 0.16);

const r2 = round2;

// ---- Frames: where on the island a part stands ------------------------------------

type Frame = { ox: number; oz: number; k: number; mirror: boolean; stage: number; root: Projected };
const FrameContext = createContext<Frame>({ ox: 0, oz: 0, k: 1, mirror: false, stage: 0, root: { x: 0, y: 0, s: 40 } });

export type LocalPoint = { x: number; y: number; s: number };
/** Maps a local point (metres: x right, y up, z toward the camera) to the group's coordinates; `s` scales sizes there. */
export type Local = (x: number, y: number, z: number) => LocalPoint;

export function useLocal(): Local {
  const frame = useContext(FrameContext);
  return (x, y, z) => {
    const p = project(frame.ox + (frame.mirror ? -x : x) * frame.k, frame.oz + z * frame.k, frame.stage, y * frame.k);
    return {
      x: r2((p.x - frame.root.x) / frame.root.s),
      y: r2((p.y - frame.root.y) / frame.root.s),
      s: r2((frame.k * p.s) / frame.root.s),
    };
  };
}

/** Fixes a spot (x, z metres) on the island; everything inside is drawn in metres around it. */
export function Place({ x, z, stage, children, groupProps }: { x: number; z: number; stage: number; children: ReactNode; groupProps?: SVGProps<SVGGElement> }) {
  const root = project(x, z, stage);
  return (
    <FrameContext.Provider value={{ ox: x, oz: z, k: 1, mirror: false, stage, root }}>
      <g {...groupProps} transform={`translate(${root.x} ${root.y}) scale(${root.s})`}>
        {children}
      </g>
    </FrameContext.Provider>
  );
}

/** A child part moved by (x, z) metres, optionally scaled or mirrored left-right. */
export function Node({ x = 0, z = 0, scale = 1, mirror = false, children }: { x?: number; z?: number; scale?: number; mirror?: boolean; children: ReactNode }) {
  const frame = useContext(FrameContext);
  const value: Frame = {
    ...frame,
    ox: frame.ox + (frame.mirror ? -x : x) * frame.k,
    oz: frame.oz + z * frame.k,
    k: frame.k * scale,
    mirror: frame.mirror !== mirror,
  };
  return <FrameContext.Provider value={value}>{children}</FrameContext.Provider>;
}

const quad = (points: LocalPoint[]) => `M${points.map((p) => `${p.x} ${p.y}`).join(" L")} Z`;

type Pos = { x?: number; y?: number; z?: number };

/** A box centred at (x, y, z) with size w × h × d: its sunlit top and its front face. */
export function Box({ w, h, d, x = 0, y = 0, z = 0, color, bevel = 0.02 }: Pos & { w: number; h: number; d: number; color: string; bevel?: number }) {
  const L = useLocal();
  const c = (dx: number, dy: number, dz: number) => L(x + dx, y + dy, z + dz);
  const topFace = quad([c(-w / 2, h / 2, -d / 2), c(w / 2, h / 2, -d / 2), c(w / 2, h / 2, d / 2), c(-w / 2, h / 2, d / 2)]);
  const frontFace = quad([c(-w / 2, h / 2, d / 2), c(w / 2, h / 2, d / 2), c(w / 2, -h / 2, d / 2), c(-w / 2, -h / 2, d / 2)]);
  const rounding = bevel > 0 ? { stroke: color, strokeWidth: r2(bevel), strokeLinejoin: "round" as const } : {};
  return (
    <g>
      <path d={topFace} fill={top(color)} {...(bevel > 0 ? { ...rounding, stroke: top(color) } : {})} />
      <path d={frontFace} fill={color} {...rounding} />
    </g>
  );
}

/** A vertical cylinder (or a cone when `rt` is 0) standing on its centre at (x, y, z). */
export function Cyl({ rt, rb, h, x = 0, y = 0, z = 0, color }: Pos & { rt: number; rb: number; h: number; color: string }) {
  const L = useLocal();
  const b = L(x, y - h / 2, z);
  const t = L(x, y + h / 2, z);
  const rbs = rb * b.s;
  const rts = rt * t.s;
  const body = `M${r2(b.x - rbs)} ${b.y} L${r2(t.x - rts)} ${t.y} L${r2(t.x + rts)} ${t.y} L${r2(b.x + rbs)} ${b.y} A${r2(rbs)} ${r2(rbs * DEPTH_K)} 0 0 1 ${r2(b.x - rbs)} ${b.y} Z`;
  return (
    <g>
      <path d={body} fill={color} />
      {rt > 0.004 ? <ellipse cx={t.x} cy={t.y} fill={top(color)} rx={r2(rts)} ry={r2(rts * DEPTH_K)} /> : null}
    </g>
  );
}

/** A ball, squashed with `sx` / `syk`, lit from the upper right. */
export function Sph({ r, x = 0, y = 0, z = 0, color, sx = 1, syk = 1, highlight = true }: Pos & { r: number; color: string; sx?: number; syk?: number; highlight?: boolean }) {
  const L = useLocal();
  const c = L(x, y, z);
  const rx = r * sx * c.s;
  const ry = r * syk * c.s;
  return (
    <g>
      <ellipse cx={c.x} cy={c.y} fill={color} rx={r2(rx)} ry={r2(ry)} />
      {highlight ? <ellipse cx={r2(c.x + rx * 0.28)} cy={r2(c.y - ry * 0.3)} fill={top(color)} opacity=".75" rx={r2(rx * 0.42)} ry={r2(ry * 0.32)} /> : null}
    </g>
  );
}

/** A disc standing up and facing the camera (a clock face, a lantern cap seen from the front). */
export function Disc({ r, x = 0, y = 0, z = 0, color }: Pos & { r: number; color: string }) {
  const L = useLocal();
  const c = L(x, y, z);
  return <ellipse cx={c.x} cy={c.y} fill={color} rx={r2(r * c.s)} ry={r2(r * HEIGHT_K * c.s)} />;
}

/** A flat disc lying on the ground (water, a stepping stone, a slab). */
export function Pad({ rx, rz = rx, x = 0, y = 0, z = 0, color }: Pos & { rx: number; rz?: number; color: string }) {
  const L = useLocal();
  const c = L(x, y, z);
  return <ellipse cx={c.x} cy={c.y} fill={color} rx={r2(rx * c.s)} ry={r2(rz * DEPTH_K * c.s)} />;
}

/** A gable roof: two tilted boards meeting on a ridge that runs front to back, as IslandProps.roof builds it. */
export function Gable({ w, d, h, x = 0, y = 0, z = 0, color }: Pos & { w: number; d: number; h: number; color: string }) {
  const L = useLocal();
  const zf = z + d / 2 + 0.08;
  const zb = z - d / 2 - 0.08;
  const half = w / 2 + 0.06;
  const ridgeFront = L(x, y + h, zf);
  const ridgeBack = L(x, y + h, zb);
  return (
    <g>
      <path d={quad([L(x - half, y, zf), ridgeFront, ridgeBack, L(x - half, y, zb)])} fill={shade(color)} />
      <path d={quad([L(x + half, y, zf), ridgeFront, ridgeBack, L(x + half, y, zb)])} fill={lit(color)} />
      <line stroke={top(color)} strokeLinecap="round" strokeWidth={r2(0.04 * ridgeFront.s)} x1={ridgeFront.x} x2={ridgeBack.x} y1={ridgeFront.y} y2={ridgeBack.y} />
    </g>
  );
}

/** The soft shadow a thing throws to its left and back. */
export function Shadow({ rx, rz = rx * 0.7, x = 0, z = 0, opacity = 0.26 }: { rx: number; rz?: number; x?: number; z?: number; opacity?: number }) {
  const L = useLocal();
  const c = L(x - rx * 0.3, 0, z - rz * 0.2);
  return <ellipse cx={c.x} cy={c.y} fill={SHADOW} filter="url(#soft)" opacity={opacity} rx={r2(rx * c.s)} ry={r2(rz * DEPTH_K * c.s)} />;
}

/** A small flower on a stem, as IslandProps._flower. */
export function Flower({ x = 0, y = 0, z = 0, color, h = 0.24, s = 1 }: Pos & { color: string; h?: number; s?: number }) {
  const L = useLocal();
  const base = L(x, y, z);
  const head = L(x, y + h, z);
  return (
    <g>
      <line stroke={LEAF_D} strokeWidth={r2(0.02 * base.s)} x1={base.x} x2={head.x} y1={base.y} y2={head.y} />
      <circle cx={head.x} cy={head.y} fill={color} r={r2(0.055 * s * head.s)} />
      <circle cx={head.x} cy={head.y} fill="#ffd54d" r={r2(0.022 * s * head.s)} />
    </g>
  );
}

/** A rope, rail or arch drawn through points of (x, y, z). */
export function Tube({ points, width, color }: { points: readonly (readonly [number, number, number])[]; width: number; color: string }) {
  const L = useLocal();
  const mapped = points.map(([x, y, z]) => L(x, y, z));
  const d = mapped.map((p, index) => `${index === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  return <path d={d} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={r2(width * (mapped[0]?.s ?? 1))} />;
}

/** A tree trunk, as IslandProps._trunk. */
export function Trunk({ h, r, x = 0, z = 0 }: { h: number; r: number; x?: number; z?: number }) {
  return <Cyl color={TRUNK} h={h} rb={r * 1.35} rt={r * 0.8} x={x} y={h / 2} z={z} />;
}

/** The round canopy blob (canopy_round.glb), about 0.75 m across before scaling. */
export function CanopyRound({ x = 0, y = 0, z = 0, color = CANOPY, scale = 1 }: Pos & { color?: string; scale?: number }) {
  const L = useLocal();
  const c = L(x, y, z);
  const k = scale * c.s;
  return (
    <g>
      <ellipse cx={r2(c.x - 0.4 * k)} cy={r2(c.y + 0.14 * k)} fill={shade(color)} rx={r2(0.46 * k)} ry={r2(0.4 * k)} />
      <ellipse cx={r2(c.x + 0.42 * k)} cy={r2(c.y + 0.12 * k)} fill={lit(color)} rx={r2(0.44 * k)} ry={r2(0.38 * k)} />
      <ellipse cx={c.x} cy={c.y} fill={color} rx={r2(0.7 * k)} ry={r2(0.62 * k)} />
      <ellipse cx={r2(c.x + 0.18 * k)} cy={r2(c.y - 0.26 * k)} fill={top(color)} opacity=".7" rx={r2(0.32 * k)} ry={r2(0.2 * k)} />
    </g>
  );
}

/** The three-tier pine canopy (canopy_pine.glb). */
export function CanopyPine({ x = 0, y = 0, z = 0, color = CANOPY_PINE, sx = 1, syk = 1 }: Pos & { color?: string; sx?: number; syk?: number }) {
  const tiers: readonly [number, number, number][] = [
    [0, 0.62, 0.55],
    [0.38, 0.5, 0.5],
    [0.72, 0.36, 0.45],
  ];
  return (
    <g>
      {tiers.map(([y0, radius, height]) => (
        <Cyl color={color} h={height * syk} key={y0} rb={radius * sx} rt={0} x={x} y={y + (y0 + height / 2) * syk} z={z} />
      ))}
    </g>
  );
}

export function TreeRound({ scale = 1 }: { scale?: number }) {
  return (
    <Node scale={scale}>
      <Shadow rx={0.6} />
      <Trunk h={0.8} r={0.08} />
      <CanopyRound scale={0.82} y={1.15} />
    </Node>
  );
}

export function TreeSakura({ scale = 1 }: { scale?: number }) {
  return (
    <Node scale={scale}>
      <Shadow rx={0.7} />
      {[0, 1, 2, 3, 4].map((index) => (
        <Pad color="#fbd3de" key={index} rx={0.05} rz={0.04} x={-0.5 + index * 0.25} z={0.3 + (index % 2) * 0.2} />
      ))}
      <Trunk h={0.85} r={0.08} />
      <CanopyRound color={CANOPY_SAKURA} scale={1.0} x={0.08} y={1.2} />
    </Node>
  );
}

export function TreePine({ scale = 1 }: { scale?: number }) {
  return (
    <Node scale={scale}>
      <Shadow rx={0.55} />
      <Trunk h={0.5} r={0.07} />
      <CanopyPine sx={0.9} syk={1.05} y={0.42} />
    </Node>
  );
}

/** A bench, as IslandProps._b_bench. */
export function Bench() {
  return (
    <g>
      <Shadow rx={0.6} rz={0.3} />
      {[-0.42, 0.42].map((px) => (
        <Box color="#5b5d6b" d={0.05} h={0.36} key={px} w={0.05} x={px} y={0.44} z={-0.24} />
      ))}
      <Box color={WOOD} d={0.04} h={0.1} w={1.0} y={0.46} z={-0.24} />
      <Box color={WOOD} d={0.04} h={0.1} w={1.0} y={0.59} z={-0.24} />
      {[-0.42, 0.42].map((px) => (
        <Box color="#5b5d6b" d={0.36} h={0.3} key={px} w={0.06} x={px} y={0.15} z={-0.02} />
      ))}
      {[-0.13, 0, 0.13].map((pz) => (
        <Box color={WOOD} d={0.11} h={0.04} key={pz} w={1.0} y={0.3} z={pz} />
      ))}
    </g>
  );
}

/** A hammock between two posts, as IslandProps._b_hammock. */
export function Hammock() {
  const L = useLocal();
  const sling: readonly [number, number, number][] = [
    [-0.7, 0.8, 0.02],
    [-0.35, 0.45, 0.1],
    [0, 0.38, 0.12],
    [0.35, 0.45, 0.1],
    [0.7, 0.8, 0.02],
  ];
  const upper = sling.map(([x, y, radius]) => L(x, y + radius * 0.5, -0.3));
  const lower = [...sling].reverse().map(([x, y, radius]) => L(x, y - radius * 1.4, 0.3));
  return (
    <g>
      {[-0.72, 0.72].map((px) => (
        <g key={px}>
          <Cyl color={WOOD_D} h={1.0} rb={0.06} rt={0.05} x={px} y={0.5} />
          <Sph color={WOOD_D} r={0.06} x={px} y={1.02} />
        </g>
      ))}
      <path d={quad([...upper, ...lower])} fill="#7cc4c0" />
    </g>
  );
}

export function Cushion() {
  const L = useLocal();
  const centre = L(0, 0.105, 0);
  return (
    <g>
      <Box bevel={0.05} color="#e36b6f" d={0.48} h={0.1} w={0.48} y={0.05} />
      <circle cx={centre.x} cy={centre.y} fill={GOLD} r={r2(0.025 * centre.s)} />
      {[
        [0.22, 0.22],
        [-0.22, 0.22],
        [0.22, -0.22],
        [-0.22, -0.22],
      ].map(([px, pz]) => {
        const c = L(px ?? 0, 0.1, pz ?? 0);
        return <circle cx={c.x} cy={c.y} fill={GOLD} key={`${px},${pz}`} r={r2(0.02 * c.s)} />;
      })}
    </g>
  );
}

/** A table under a striped parasol with two stools, as IslandProps._b_parasol_table. */
export function ParasolTable() {
  const L = useLocal();
  const c = L(0, 1.38, 0);
  const rx = 0.62 * c.s;
  const ry = (0.62 * DEPTH_K + 0.08) * c.s;
  const wedges = Array.from({ length: 8 }, (_, index) => {
    const a0 = (Math.PI * 2 * index) / 8;
    const a1 = (Math.PI * 2 * (index + 1)) / 8;
    const p0 = `${r2(c.x + Math.cos(a0) * rx)} ${r2(c.y + Math.sin(a0) * ry)}`;
    const p1 = `${r2(c.x + Math.cos(a1) * rx)} ${r2(c.y + Math.sin(a1) * ry)}`;
    return <path d={`M${c.x} ${c.y} L${p0} A${r2(rx)} ${r2(ry)} 0 0 1 ${p1} Z`} fill={index % 2 === 0 ? "#f28c8c" : CREAM} key={index} />;
  });
  return (
    <g>
      <Shadow rx={0.65} />
      {[-0.45, 0.45].map((px) => (
        <g key={px}>
          <Cyl color="#6a6470" h={0.3} rb={0.02} rt={0.02} x={px} y={0.15} z={0.1} />
          <Cyl color="#f7c56b" h={0.05} rb={0.14} rt={0.14} x={px} y={0.3} z={0.1} />
        </g>
      ))}
      <Cyl color="#6a6470" h={0.03} rb={0.18} rt={0.16} y={0.015} />
      <Cyl color="#6a6470" h={0.5} rb={0.03} rt={0.03} y={0.25} />
      <Cyl color={CREAM} h={0.04} rb={0.34} rt={0.34} y={0.5} />
      <Cyl color={CREAM} h={1.0} rb={0.022} rt={0.022} y={1.0} />
      {wedges}
      <Sph color="#f28c8c" r={0.04} y={1.52} />
    </g>
  );
}

/** A paper lantern hanging from an arm, as IslandProps._b_paper_lantern. */
export function PaperLantern() {
  return (
    <g>
      <Cyl color={WOOD_D} h={1.0} rb={0.02} rt={0.02} y={0.5} />
      <Box color={WOOD_D} d={0.03} h={0.03} w={0.3} x={0.12} y={1.0} />
      <Sph color={LANTERN} r={0.13} syk={1.25} x={0.24} y={0.8} />
      <Disc color={INK} r={0.07} x={0.24} y={0.64} />
      <Disc color={INK} r={0.07} x={0.24} y={0.96} />
    </g>
  );
}

export function StreetLamp() {
  return (
    <g>
      <Cyl color={IRON} h={0.1} rb={0.15} rt={0.12} y={0.05} />
      <Cyl color={IRON} h={1.2} rb={0.045} rt={0.035} y={0.66} />
      <Cyl color={GLOW} h={0.2} rb={0.08} rt={0.12} y={1.36} />
      <Cyl color={IRON} h={0.1} rb={0.16} rt={0} y={1.51} />
      <Sph color={GOLD} r={0.03} y={1.58} />
    </g>
  );
}

/** A string of coloured lights between two posts, as IslandProps._b_string_lights. */
export function StringLights() {
  const colors = ["#ffd98a", "#ff9a9a", "#9ad7ff", "#b9f59a"];
  const wire: [number, number, number][] = Array.from({ length: 9 }, (_, index) => {
    const t = index / 8;
    return [r2(-0.78 + t * 1.56), r2(1.05 - Math.sin(t * Math.PI) * 0.22), 0];
  });
  return (
    <g>
      {[-0.78, 0.78].map((px) => (
        <Cyl color={WOOD_D} h={1.1} key={px} rb={0.035} rt={0.03} x={px} y={0.55} />
      ))}
      <Tube color={INK} points={wire} width={0.016} />
      {Array.from({ length: 7 }, (_, index) => {
        const t = (index + 1) / 8;
        return <Sph color={colors[index % 4] ?? GOLD} key={index} r={0.04} syk={1.3} x={r2(-0.78 + t * 1.56)} y={r2(1.0 - Math.sin(t * Math.PI) * 0.22)} />;
      })}
    </g>
  );
}

export function SteppingStone({ x = 0, z = 0, color = STEP, scale = 1 }: { x?: number; z?: number; color?: string; scale?: number }) {
  return <Pad color={color} rx={0.17 * 1.1 * scale} rz={0.17 * 0.85 * scale} x={x} y={0.02} z={z} />;
}

/** A terracotta pot with two flowers, as IslandProps._b_flower_pot. */
export function FlowerPot() {
  return (
    <g>
      <Cyl color={TERRACOTTA} h={0.22} rb={0.11} rt={0.15} y={0.11} />
      <Cyl color="#e08a62" h={0.04} rb={0.16} rt={0.16} y={0.22} />
      <Pad color="#6b4a3a" rx={0.13} y={0.24} />
      <Flower color="#ff8fb1" h={0.18} s={1.3} y={0.22} />
      <Flower color="#fff5f8" h={0.12} x={0.06} y={0.22} z={0.04} />
    </g>
  );
}

/** A red mailbox on a post, as IslandProps._b_mailbox. */
export function Mailbox() {
  const L = useLocal();
  const c = L(0, 0.88, 0);
  return (
    <g>
      <Cyl color={WOOD_D} h={0.7} rb={0.035} rt={0.03} y={0.35} />
      <Box bevel={0.03} color={RED} d={0.32} h={0.2} w={0.22} y={0.78} />
      <ellipse cx={c.x} cy={c.y} fill={top(RED)} rx={r2(0.11 * c.s)} ry={r2(0.11 * HEIGHT_K * c.s)} />
      <Box color={GOLD} d={0.04} h={0.14} w={0.02} x={0.12} y={0.92} z={0.08} />
      <Box color={GOLD} d={0.02} h={0.06} w={0.1} x={0.14} y={1.0} z={0.08} />
    </g>
  );
}

/** A notice board with four notes, as IslandProps._b_bulletin_board. */
export function BulletinBoard() {
  const L = useLocal();
  const notes = ["#fff6e0", "#ffe0ea", "#e0f4ff", "#f0ffe0"];
  return (
    <g>
      {[-0.42, 0.42].map((px) => (
        <Cyl color={WOOD_D} h={1.1} key={px} rb={0.035} rt={0.035} x={px} y={0.55} />
      ))}
      <Box color="#c69a6c" d={0.05} h={0.56} w={0.9} y={0.75} />
      <Box color="#7a5a8c" d={0.16} h={0.07} w={1.0} y={1.08} />
      {notes.map((color, index) => {
        const c = L(-0.3 + index * 0.2, 0.74 + (index % 2) * 0.08, 0.03);
        const pin = L(-0.3 + index * 0.2, 0.82 + (index % 2) * 0.08, 0.045);
        const w = 0.22 * c.s;
        const h = 0.2 * c.s;
        return (
          <g key={color}>
            <rect fill={color} height={r2(h)} transform={`rotate(${r2(((index - 1.5) * 0.08 * 180) / Math.PI)} ${c.x} ${c.y})`} width={r2(w)} x={r2(c.x - w / 2)} y={r2(c.y - h / 2)} />
            <circle cx={pin.x} cy={pin.y} fill={RED} r={r2(0.012 * pin.s)} />
          </g>
        );
      })}
    </g>
  );
}

/** A post with three arrow boards, as IslandProps._b_signpost. Boards point right, turned away or toward the camera. */
export function Signpost({ scale = 1 }: { scale?: number }) {
  return (
    <Node scale={scale}>
      <Cyl color={WOOD_D} h={1.0} rb={0.04} rt={0.035} y={0.5} />
      {["#fdf1dc", "#ffd9c4", "#dff0ff"].map((color, index) => (
        <SignBoard color={color} key={color} y={0.88 - index * 0.2} yaw={(index - 1) * 0.9} />
      ))}
    </Node>
  );
}

function SignBoard({ color, y, yaw }: { color: string; y: number; yaw: number }) {
  const L = useLocal();
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const at = (along: number, dy: number) => L(r2(along * cos), y + dy, r2(-along * sin));
  const d = quad([at(-0.05, -0.065), at(0.55, -0.065), at(0.66, 0), at(0.55, 0.065), at(-0.05, 0.065)]);
  return <path d={d} fill={color} stroke={shade(color)} strokeWidth="0.01" />;
}

/** The bright arrow board of a level-2 guide post. */
export function ArrowBoard() {
  const L = useLocal();
  const stripe = L(0.08, 0.62, 0.03);
  return (
    <g>
      <Cyl color={WOOD_D} h={0.6} rb={0.035} rt={0.03} y={0.3} />
      <path d={quad([L(-0.12, 0.52, 0), L(0.32, 0.52, 0), L(0.48, 0.62, 0), L(0.32, 0.72, 0), L(-0.12, 0.72, 0)])} fill="#5fc4c0" />
      <rect fill={CREAM} height={r2(0.04 * stripe.s)} rx={r2(0.01 * stripe.s)} width={r2(0.28 * stripe.s)} x={r2(stripe.x - 0.14 * stripe.s)} y={r2(stripe.y - 0.02 * stripe.s)} />
    </g>
  );
}

/** A stone fountain, as IslandProps._b_fountain. */
export function Fountain() {
  const L = useLocal();
  return (
    <g>
      <Cyl color={STONE} h={0.2} rb={0.52} rt={0.5} y={0.1} />
      <Pad color={WATER} rx={0.44} y={0.19} />
      <Cyl color={STONE} h={0.5} rb={0.1} rt={0.07} y={0.4} />
      <Cyl color={STONE} h={0.1} rb={0.1} rt={0.24} y={0.66} />
      <Pad color={WATER} rx={0.2} y={0.7} />
      <Sph color="#dff4ff" r={0.05} y={0.84} />
      {Array.from({ length: 6 }, (_, index) => {
        const a = (Math.PI * 2 * index) / 6;
        const c = L(r2(Math.cos(a) * 0.18), 0.62, r2(Math.sin(a) * 0.18));
        return <circle cx={c.x} cy={c.y} fill="#dff4ff" key={index} r={r2(0.025 * c.s)} />;
      })}
    </g>
  );
}
