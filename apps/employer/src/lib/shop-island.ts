import {
  SHOP_LANDMARK_LEVELS,
  SHOP_REVIEW_TAGS,
  type ShopLandmark,
  type ShopLandmarkId,
} from "@paw-time/api-contracts";
import type { Messages } from "./i18n/messages";

/**
 * The scene is the worker app's shop island (apps/worker, screen_shop_island.gd)
 * seen through the same camera: a Camera3D at (0, 6.3, 6.9) looking at
 * (0, 0, -0.5), moved back a little on wider islands. Everything is laid out
 * in metres on the island and projected onto a 600 × 420 picture, so the
 * positions, sizes and foreshortening match what workers see in their app.
 */
export const SCENE_WIDTH = 600;
export const SCENE_HEIGHT = 420;
/** Where the flat sky meets the sea. */
export const HORIZON_Y = 118;
const CENTER_X = 300;
const CENTER_Y = 240;
/** Picture pixels per unit of the camera plane; smaller than the phone so the whole island fits a landscape frame. */
const FOCAL = 360;
const CAMERA = { y: 6.3, z: 6.9 };
const TARGET = { y: 0, z: -0.5 };

/** Island radius in metres per terrain stage, as in the worker app's IslandKit.STAGES. */
const STAGE_RADIUS = [3.9, 4.5, 5.0] as const;

export function islandMetres(stage: number): number {
  return STAGE_RADIUS[Math.min(2, Math.max(0, stage))] ?? 3.9;
}

/** The camera for a terrain stage: its position (x is always 0) and its forward and up vectors. */
function camera(stage: number) {
  const k = 1 + 0.6 * (islandMetres(stage) / 3.9 - 1);
  const position = { y: CAMERA.y * k, z: CAMERA.z * k };
  const dy = TARGET.y - position.y;
  const dz = TARGET.z - position.z;
  const length = Math.hypot(dy, dz);
  const forward = { y: dy / length, z: dz / length };
  // up = right × forward, with right = (1, 0, 0)
  const up = { y: -forward.z, z: forward.y };
  return { position, forward, up };
}

export type Projected = { x: number; y: number; s: number };

/** Projects a world point (metres; z grows toward the camera) onto the picture. `s` is picture pixels per metre there. */
export function project(x: number, z: number, stage: number, y = 0): Projected {
  const cam = camera(stage);
  const dy = y - cam.position.y;
  const dz = z - cam.position.z;
  const depth = dy * cam.forward.y + dz * cam.forward.z;
  const rise = dy * cam.up.y + dz * cam.up.z;
  return {
    x: round2(CENTER_X + (x / depth) * FOCAL),
    y: round2(CENTER_Y - (rise / depth) * FOCAL),
    s: round2(FOCAL / depth),
  };
}

/** Inside a group scaled by `s`: a metre of depth runs this far down the picture, a metre of height this far up. */
export const DEPTH_K = 0.648;
export const HEIGHT_K = 0.761;

const SLOTS: Record<ShopLandmarkId, { x: number; z: number }> = {
  clock_tower: { x: -2.45, z: -1.3 },
  rest_grove: { x: 2.25, z: -1.25 },
  guide_post: { x: -1.5, z: 1.2 },
  payday_bell: { x: 1.55, z: 1.25 },
  lantern_path: { x: 0, z: 0.1 },
  fair_fountain: { x: -2.75, z: 0.35 },
  welcome_arch: { x: 0, z: 2.55 },
};
export const SHOP_AT = { x: 0, z: -3.1 };
export const PIER_DIRECTION = { x: 0.93, z: 0.36 };
/** Trees on the rim: the same scenery on every shop island, nothing to do with reviews. */
export const RIM_TREES: readonly { x: number; z: number; kind: "round" | "pine" }[] = [
  { x: -3.2, z: -2.4, kind: "round" },
  { x: 3.3, z: -2.3, kind: "pine" },
  { x: -3.5, z: 1.7, kind: "round" },
];

/** Where the obake who moved in stand: the front of the island, clear of every landmark slot. */
const RESIDENT_SPOTS: readonly [{ x: number; z: number }, ...{ x: number; z: number }[]] = [
  { x: 1.9, z: 3.0 },
  { x: -2.3, z: 2.65 },
  { x: 2.75, z: 2.2 },
  { x: -3.0, z: 2.0 },
];

/** The worker app widens the slots with the island: x by the radius ratio, z only in front of the middle. */
export function slotPosition(x: number, z: number, stage: number): { x: number; z: number } {
  const k = islandMetres(stage) / 3.9;
  return { x: x * k, z: z > 0 ? z * k : z };
}

export function landmarkSlot(id: ShopLandmarkId, stage: number): { x: number; z: number } {
  return slotPosition(SLOTS[id].x, SLOTS[id].z, stage);
}

export function landmarkPosition(id: ShopLandmarkId, stage: number): Projected {
  const slot = landmarkSlot(id, stage);
  return project(slot.x, slot.z, stage);
}

export function residentSlot(index: number, stage: number): { x: number; z: number } {
  const spot = RESIDENT_SPOTS[index % RESIDENT_SPOTS.length] ?? RESIDENT_SPOTS[0];
  return slotPosition(spot.x, spot.z, stage);
}

/** The island's edge in metres: a round island with gentle capes and coves, as in the worker terrain build. */
export function edgeRadius(theta: number, stage: number, offset = 0): number {
  return islandMetres(stage) * (1 + 0.045 * Math.sin(3 * theta + 1.1) + 0.03 * Math.sin(5 * theta + 0.3)) + offset;
}

/** SVG path of the island's outline pushed out by `offset` metres (negative = inside). */
export function islandPath(stage: number, offset: number, samples = 96): string {
  const points: string[] = [];
  for (let index = 0; index < samples; index += 1) {
    const theta = (Math.PI * 2 * index) / samples;
    const r = edgeRadius(theta, stage, offset);
    const p = project(r * Math.cos(theta), r * Math.sin(theta), stage);
    points.push(`${p.x} ${p.y}`);
  }
  return `M${points.join(" L")} Z`;
}

/** An open stretch of the island's outline between two angles (radians, atan2(z, x)), pushed out by `offset` metres. */
export function islandArcPath(stage: number, offset: number, from: number, to: number, samples = 64): string {
  const points: string[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const theta = from + ((to - from) * index) / samples;
    const r = edgeRadius(theta, stage, offset);
    const p = project(r * Math.cos(theta), r * Math.sin(theta), stage);
    points.push(`${p.x} ${p.y}`);
  }
  return `M${points.join(" L")}`;
}

/** The angles (radians) where the island's own rim is the coast, i.e. in front of the back hill's edge at z = -2.4. */
export function coastAngles(stage: number): { from: number; to: number } {
  const a = Math.asin(Math.min(1, 2.1 / islandMetres(stage)));
  return { from: -a, to: Math.PI + a };
}

/** Clips an angular range (radians) to the coast; returns null when nothing of it is on the coast. */
export function clipToCoast(stage: number, from: number, to: number): { from: number; to: number } | null {
  const coast = coastAngles(stage);
  // angles here run from -π/2 … 3π/2 so the front (θ = π/2) is inside one range
  const wrap = (theta: number) => (theta < -Math.PI / 2 ? theta + Math.PI * 2 : theta);
  const lo = Math.max(wrap(from), coast.from);
  const hi = Math.min(wrap(to), coast.to);
  return hi > lo ? { from: lo, to: hi } : null;
}

type CoastEdge = { offset: number; y: number };

function coastPoints(stage: number, from: number, to: number, edge: CoastEdge, samples: number): string[] {
  const points: string[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const theta = from + ((to - from) * index) / samples;
    const r = edgeRadius(theta, stage, edge.offset);
    const p = project(r * Math.cos(theta), r * Math.sin(theta), stage, edge.y);
    points.push(`${p.x} ${p.y}`);
  }
  return points;
}

/** An open line along the coast between two angles, `offset` metres out from the edge and `y` metres up. */
export function coastArcPath(stage: number, from: number, to: number, edge: CoastEdge, samples = 48): string {
  return `M${coastPoints(stage, from, to, edge, samples).join(" L")}`;
}

/** The surface between two lines along the coast: a cliff face (top edge raised, foot lower and further out) or a ledge. */
export function coastBandPath(stage: number, from: number, to: number, inner: CoastEdge, outer: CoastEdge, samples = 48): string {
  const innerPoints = coastPoints(stage, from, to, inner, samples);
  const outerPoints = coastPoints(stage, from, to, outer, samples).reverse();
  return `M${innerPoints.join(" L")} L${outerPoints.join(" L")} Z`;
}

/** A band of the island's rim between two angles (radians, atan2(z, x)) and two offsets. */
export function rimBandPath(stage: number, from: number, to: number, inner: number, outer: number, samples = 24): string {
  const outerPoints: string[] = [];
  const innerPoints: string[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const theta = from + ((to - from) * index) / samples;
    const ro = edgeRadius(theta, stage, outer);
    const ri = edgeRadius(theta, stage, inner);
    const po = project(ro * Math.cos(theta), ro * Math.sin(theta), stage);
    const pi = project(ri * Math.cos(theta), ri * Math.sin(theta), stage);
    outerPoints.push(`${po.x} ${po.y}`);
    innerPoints.unshift(`${pi.x} ${pi.y}`);
  }
  return `M${outerPoints.join(" L")} L${innerPoints.join(" L")} Z`;
}

/** The back hill the shop stands on, in metres: |x| ≤ 7.6, -8 ≤ z ≤ -2.4 with round corners. */
export function hillPath(stage: number, offset: number): string {
  const halfW = 7.6 + offset;
  const zBack = -8 - offset;
  const zFront = -2.4 + offset;
  const radius = Math.min(1.3 + offset, (zFront - zBack) / 2);
  const points: string[] = [];
  const corner = (cx: number, cz: number, start: number) => {
    for (let index = 0; index <= 8; index += 1) {
      const theta = start + (Math.PI / 2) * (index / 8);
      const p = project(cx + radius * Math.cos(theta), cz + radius * Math.sin(theta), stage);
      points.push(`${p.x} ${p.y}`);
    }
  };
  corner(-halfW + radius, zBack + radius, Math.PI);
  corner(halfW - radius, zBack + radius, Math.PI * 1.5);
  corner(halfW - radius, zFront - radius, 0);
  corner(-halfW + radius, zFront - radius, Math.PI / 2);
  return `M${points.join(" L")} Z`;
}

/** The small islet off to the right on the widest island (stage 2), as in the worker terrain build. */
export const ISLET = { x: 6.9, z: 1.4, r: 1.35 };

export function isletPath(stage: number, offset: number, samples = 40): string {
  const points: string[] = [];
  for (let index = 0; index < samples; index += 1) {
    const theta = (Math.PI * 2 * index) / samples;
    const r = ISLET.r * (1 + 0.06 * Math.sin(4 * theta)) + offset;
    const p = project(ISLET.x + r * Math.cos(theta), ISLET.z + r * Math.sin(theta), stage);
    points.push(`${p.x} ${p.y}`);
  }
  return `M${points.join(" L")} Z`;
}

/** Where the rim turns to rock on the wider islands (degrees around the island, atan2(z, x), and half-width). */
export const CLIFFS: readonly { at: number; width: number }[] = [
  { at: -150, width: 28 },
  { at: -35, width: 24 },
  { at: 160, width: 16 },
];

export const LANDMARK_MAX_LEVEL = SHOP_LANDMARK_LEVELS.length;

export function landmarkName(id: ShopLandmarkId, m: Messages): string {
  return m.shopIsland.landmarks[id].name;
}

export function landmarkBody(id: ShopLandmarkId, m: Messages): string {
  return m.shopIsland.landmarks[id].body;
}

export function reviewTagLabel(tag: (typeof SHOP_REVIEW_TAGS)[number], m: Messages): string {
  return m.shopIsland.tags[tag];
}

/** The landmarks that appear on the island: grown ones and sprouts. */
export function visibleLandmarks(landmarks: ShopLandmark[]): ShopLandmark[] {
  return landmarks.filter((landmark) => landmark.level > 0 || landmark.sprout);
}

/** Rounds to two decimals so the server and the browser print the same SVG attributes. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function channels(hex: string): [number, number, number] | null {
  const value = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)) as [number, number, number];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("")}`;
}

/** Darkens a #RRGGBB color by a share, for roofs and shaded faces. */
export function darken(hex: string, amount: number): string {
  const rgb = channels(hex);
  if (!rgb) return hex;
  return toHex(rgb.map((channel) => channel * (1 - amount)) as [number, number, number]);
}

/** Lightens a #RRGGBB color toward white by a share, for faces that catch the sun. */
export function lighten(hex: string, amount: number): string {
  const rgb = channels(hex);
  if (!rgb) return hex;
  return toHex(rgb.map((channel) => channel + (255 - channel) * amount) as [number, number, number]);
}
