"use client";

import type { GameWorld, ShopFeedbackSummary, ShopLandmark, ShopLandmarkId, Store, WorkerHistory } from "@paw-time/api-contracts";
import { type ReactNode, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useMessages } from "@/lib/i18n/client";
import { fill } from "@/lib/i18n/messages";
import { islandCatalog, islandResident } from "@/lib/island";
import {
  CLIFFS,
  DEPTH_K,
  HORIZON_Y,
  clipToCoast,
  coastAngles,
  coastArcPath,
  coastBandPath,
  islandArcPath,
  LANDMARK_MAX_LEVEL,
  PIER_DIRECTION,
  type Projected,
  RIM_TREES,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  SHOP_AT,
  hillPath,
  islandMetres,
  islandPath,
  isletPath,
  landmarkBody,
  landmarkName,
  landmarkSlot,
  lighten,
  project,
  residentSlot,
  reviewTagLabel,
  rimBandPath,
  round2,
  slotPosition,
  visibleLandmarks,
} from "@/lib/shop-island";
import { Bench, CREAM, Node, PaperLantern, Place, RED, TreePine, TreeRound, WOOD, WOOD_D, WOOD_L } from "./kit";
import { Landmark, Shop } from "./landmarks";

type ShopIslandProps = {
  store: Store;
  summary: ShopFeedbackSummary;
  world: GameWorld | null;
  regulars: WorkerHistory[];
  /** Sample data notice for the demo shop. */
  sample: boolean;
};

/** The terrain as the worker app renders it: the build script's grass, sand and rock, lit by its noon sun. */
const SKY = "#c0e9fa";
const SEA = "#2a9fbd";
const SEA_FAR = "#3db0cc";
const SHALLOW = "#4dbdd2";
const SAND = "#f4e07f";
const SAND_WET = "#d9c26f";
const GRASS = "#68d233";
const GRASS_2 = "#5cc42a";
const GRASS_AO = "#4aa824";
const ROCK = "#7a5c4f";
const ROCK_D = "#5a4238";

const r2 = round2;

/**
 * The shop island exactly as the worker app draws it: the shop on the back
 * hill with the company logo on its signboard, one landmark per review tag
 * that grows with votes, the pier to the right. Tap a landmark to read what
 * workers said. Paw Points only decorate the shore.
 */
export function ShopIsland({ store, summary, world, regulars, sample }: ShopIslandProps) {
  const m = useMessages();
  const [selected, setSelected] = useState<ShopLandmarkId | null>(null);
  const stage = summary.published ? summary.stage : 0;
  const landmarks = visibleLandmarks(summary.landmarks);
  const active = summary.landmarks.find((landmark) => landmark.id === selected) ?? null;
  const has = (item: string) => (world?.inventory[item] ?? 0) > 0;
  const residents = islandCatalog.levels
    .filter((entry) => entry.level <= (world?.level ?? 1))
    .flatMap((entry) => entry.unlocks)
    .filter((item) => islandResident[item]);

  return (
    <section className="shopIsland">
      <div className="shopIslandScene" data-selected={active ? "true" : undefined}>
        <Scene
          has={has}
          landmarks={landmarks}
          onSelect={setSelected}
          residents={residents}
          selected={selected}
          stage={stage}
          store={store}
          labelFor={(landmark) =>
            `${landmarkName(landmark.id, m)} ・ ${fill(m.shopIsland.workersSaid, { tag: reviewTagLabel(landmark.tag, m), votes: landmark.votes })}`
          }
        />
        <div className="shopCard shopCardTop">
          <div className="shopCardName">
            <span aria-hidden="true" className="shopDot" style={{ background: store.signColor }} />
            <strong>{store.name}</strong>
            {summary.averageStars !== null ? <span className="shopStars">{fill(m.shopIsland.averageStars, { stars: summary.averageStars.toFixed(1) })}</span> : null}
          </div>
          <p className="shopWords">{store.values ? fill(m.shopIsland.inTheirWords, { values: store.values }) : m.shopIsland.noWords}</p>
          <p className={summary.published ? "shopPill shopPill-green" : "shopPill"}>
            {fill(summary.published ? m.shopIsland.basedOn : m.shopIsland.basedOnPending, { count: summary.responses })}
          </p>
          <p className="shopRule">{m.shopIsland.rule}</p>
        </div>
        {regulars.length > 0 ? (
          <ul aria-label={m.island.regularsTitle} className="regulars" role="list">
            {regulars.slice(0, 6).map((history) => (
              <li key={history.workerId} title={history.displayName}>
                <Avatar name={history.displayName} seed={history.workerId} />
                <small>{history.displayName}</small>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="shopFoot">
          <p className="shopHint">{landmarks.length === 0 ? m.shopIsland.notYet : m.shopIsland.hint}</p>
          {sample ? <p className="shopSample">{m.shopIsland.sampleNote}</p> : null}
        </div>
        {active ? (
          <div aria-live="polite" className="shopCard shopCardBottom">
            <div className="shopCardRow">
              <span className={active.level > 0 ? "shopChip shopChip-level" : "shopChip shopChip-sprout"}>
                {active.level > 0 ? fill(m.shopIsland.level, { level: active.level, max: LANDMARK_MAX_LEVEL }) : m.shopIsland.sprout}
              </span>
              <button className="shopClose" onClick={() => setSelected(null)} type="button">{m.shopIsland.close}</button>
            </div>
            <h3>{landmarkName(active.id, m)}</h3>
            <p className="shopPill shopPill-green">
              {fill(m.shopIsland.workersSaid, { tag: reviewTagLabel(active.tag, m), votes: active.votes })}
            </p>
            <p className="shopBody">{active.level > 0 ? landmarkBody(active.id, m) : m.shopIsland.sproutBody}</p>
          </div>
        ) : null}
      </div>
      <p className="hint shopSceneNote">{m.island.sceneNote}</p>
    </section>
  );
}

type SceneProps = {
  store: Store;
  stage: number;
  landmarks: ShopLandmark[];
  selected: ShopLandmarkId | null;
  onSelect: (id: ShopLandmarkId) => void;
  labelFor: (landmark: ShopLandmark) => string;
  has: (item: string) => boolean;
  residents: string[];
};

type Placed = { z: number; node: ReactNode };

/** Soft darker patches that give the grass its mottle, in island metres. */
const MOTTLE: readonly [number, number][] = [
  [-5.2, -6.6], [-1.4, -7.1], [2.6, -6.3], [5.8, -7.0], [-3.9, -4.1], [0.8, -4.6], [4.4, -3.6],
  [-2.2, -2.2], [1.9, -1.8], [-1.0, 0.4], [2.4, 0.9], [-2.6, 1.9], [0.6, 2.4], [-0.4, -0.9],
];

function Scene({ store, stage, landmarks, selected, onSelect, labelFor, has, residents }: SceneProps) {
  const R = islandMetres(stage);
  const items: Placed[] = [];
  const place = (x: number, z: number, key: string, node: ReactNode) => {
    items.push({ z, node: <Place key={key} stage={stage} x={x} z={z}>{node}</Place> });
  };

  place(SHOP_AT.x, SHOP_AT.z, "shop", <Shop accent={store.accentColor} logoUrl={store.logoUrl} name={store.name} sign={store.signColor} />);
  RIM_TREES.forEach((tree, index) => {
    place(tree.x, tree.z, `tree-${index}`, tree.kind === "round" ? <TreeRound scale={0.9} /> : <TreePine scale={0.9} />);
  });

  for (const landmark of landmarks) {
    const slot = landmarkSlot(landmark.id, stage);
    const isSelected = landmark.id === selected;
    items.push({
      z: slot.z,
      node: (
        <Place
          groupProps={{
            "aria-label": labelFor(landmark),
            "aria-pressed": isSelected,
            className: `landmark${isSelected ? " landmark-selected" : ""}`,
            onClick: () => onSelect(landmark.id),
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(landmark.id);
              }
            },
            role: "button",
            tabIndex: 0,
          }}
          key={landmark.id}
          stage={stage}
          x={slot.x}
          z={slot.z}
        >
          {isSelected ? <ellipse className="landmarkRing" cx="0" cy="0" fill="none" rx="1" ry={r2(DEPTH_K)} stroke="#fff" strokeDasharray="0.16 0.1" strokeWidth="0.06" /> : null}
          <Landmark id={landmark.id} level={landmark.level} sprout={landmark.sprout} />
          <rect fill="transparent" height="2.1" width="1.9" x="-0.95" y="-1.7" />
        </Place>
      ),
    });
  }

  // Paw Points decorate the shore by the pier: a bench, lanterns where the pier starts, a boat at its end
  const pierBase = { x: PIER_DIRECTION.x * (R - 0.75), z: PIER_DIRECTION.z * (R - 0.75) };
  const across = { x: -PIER_DIRECTION.z, z: PIER_DIRECTION.x };
  if (has("island_bench")) {
    const spot = slotPosition(3.2, -0.2, stage);
    place(spot.x, spot.z, "bench", <Node scale={0.9}><Bench /></Node>);
  }
  if (has("island_lanterns")) {
    for (const side of [-1, 1]) {
      place(pierBase.x + across.x * 0.7 * side, pierBase.z + across.z * 0.7 * side, `pier-lantern-${side}`, <Node mirror={side > 0}><PaperLantern /></Node>);
    }
  }
  items.push({ z: PIER_DIRECTION.z * (R + 0.2), node: <Pier boat={has("island_pier")} key="pier" radius={R} stage={stage} /> });

  residents.forEach((item, index) => {
    const slot = residentSlot(index, stage);
    const at = project(slot.x, slot.z, stage);
    const size = r2(1.1 * at.s);
    items.push({
      z: slot.z,
      node: (
        <image
          className={index === residents.length - 1 ? "resident resident-new" : "resident"}
          height={size}
          href={`/obake/${islandResident[item]}.webp`}
          key={`resident-${item}`}
          width={size}
          x={r2(at.x - size / 2)}
          y={r2(at.y - size * 0.92)}
        />
      ),
    });
  });

  items.sort((left, right) => left.z - right.z);

  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const cliffs = (stage >= 1 ? CLIFFS : [])
    .map((cliff) => clipToCoast(stage, toRad(cliff.at - cliff.width), toRad(cliff.at + cliff.width)))
    .filter((range): range is { from: number; to: number } => range !== null);
  const coast = coastAngles(stage);

  return (
    <svg
      aria-hidden="true"
      className="shopSvg"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter height="220%" id="soft" width="220%" x="-60%" y="-60%">
          <feGaussianBlur stdDeviation="0.06" />
        </filter>
        <filter height="200%" id="softPx" width="200%" x="-50%" y="-50%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <linearGradient id="seaFade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={SEA_FAR} />
          <stop offset=".4" stopColor={SEA} />
        </linearGradient>
        <mask id="offHill">
          <rect fill="#fff" height={SCENE_HEIGHT} width={SCENE_WIDTH} x="0" y="0" />
          <path d={hillPath(stage, 0.5)} fill="#000" />
        </mask>
        <clipPath id="grassClip">
          <path d={hillPath(stage, -0.35)} />
          <path d={islandPath(stage, -0.35)} />
          {stage >= 2 ? <path d={isletPath(stage, -0.3)} /> : null}
        </clipPath>
      </defs>
      <rect fill={SKY} height={HORIZON_Y} width={SCENE_WIDTH} x="0" y="0" />
      <rect fill="url(#seaFade)" height={SCENE_HEIGHT - HORIZON_Y} width={SCENE_WIDTH} x="0" y={HORIZON_Y} />
      {/* Shallows, beach and grass: the hill behind, the round island in front */}
      <g fill={SHALLOW} opacity=".7">
        <path d={hillPath(stage, 1.9)} />
        <path d={islandPath(stage, 1.9)} />
        {stage >= 2 ? <path d={isletPath(stage, 1.4)} /> : null}
      </g>
      <g fill={SAND_WET}>
        <path d={hillPath(stage, 1.0)} />
        <path d={islandPath(stage, 1.0)} />
        {stage >= 2 ? <path d={isletPath(stage, 0.8)} /> : null}
      </g>
      <g fill={SAND}>
        <path d={hillPath(stage, 0.45)} />
        <path d={islandPath(stage, 0.45)} />
        {stage >= 2 ? <path d={isletPath(stage, 0.35)} /> : null}
      </g>
      {/* Grass: the hill first with its shaded rim, then the island over it, then the mottle over both */}
      <path d={hillPath(stage, -0.35)} fill={GRASS} />
      <g clipPath="url(#grassClip)">
        <path d={hillPath(stage, -0.35)} fill="none" filter="url(#softPx)" opacity=".45" stroke={GRASS_AO} strokeWidth="12" />
      </g>
      <path d={islandPath(stage, -0.35)} fill={GRASS} />
      {stage >= 2 ? <path d={isletPath(stage, -0.3)} fill={GRASS} /> : null}
      <g clipPath="url(#grassClip)">
        <path d={islandArcPath(stage, -0.35, coast.from, coast.to)} fill="none" filter="url(#softPx)" opacity=".45" stroke={GRASS_AO} strokeWidth="12" />
        <g fill={GRASS_2} filter="url(#softPx)" opacity=".7">
          {MOTTLE.map(([mx, mz]) => {
            const at = project(mx, mz, stage);
            return <ellipse cx={at.x} cy={at.y} key={`${mx},${mz}`} rx={r2(1.1 * at.s)} ry={r2(0.55 * at.s)} />;
          })}
        </g>
      </g>
      {/* Rock where the wider islands' rims turn to cliffs: a raised ledge, a face of rock, and the sea straight below */}
      <g mask="url(#offHill)">
        {cliffs.map((range) => (
          <g key={range.from}>
            <path d={rimBandPath(stage, range.from, range.to, -0.1, 2.4)} fill={SEA} filter="url(#softPx)" />
            <path d={coastBandPath(stage, range.from, range.to, { offset: -0.9, y: 0 }, { offset: -0.02, y: 0.42 })} fill={lighten(GRASS, 0.12)} />
            <path d={coastBandPath(stage, range.from, range.to, { offset: -0.02, y: 0.42 }, { offset: 0.38, y: -0.75 })} fill={ROCK} />
            <path d={coastArcPath(stage, range.from, range.to, { offset: 0.1, y: 0.08 })} fill="none" opacity=".5" stroke={ROCK_D} strokeWidth="2.5" />
            <path d={coastArcPath(stage, range.from, range.to, { offset: 0.24, y: -0.34 })} fill="none" opacity=".5" stroke={ROCK_D} strokeWidth="2.5" />
            <path d={coastArcPath(stage, range.from, range.to, { offset: 0.36, y: -0.7 })} fill="none" opacity=".8" stroke={ROCK_D} strokeWidth="4" />
          </g>
        ))}
      </g>
      {items.map((item) => item.node)}
    </svg>
  );
}

/** The wooden pier, as IslandProps._b_pier, laid along the worker app's PIER_DIR so obake can come ashore. */
function Pier({ stage, radius, boat }: { stage: number; radius: number; boat: boolean }) {
  const dir = PIER_DIRECTION;
  const across = { x: -dir.z, z: dir.x };
  const centre = { x: dir.x * (radius + 0.2), z: dir.z * (radius + 0.2) };
  const at = (along: number, side: number, y = 0): Projected =>
    project(centre.x + dir.x * along + across.x * side, centre.z + dir.z * along + across.z * side, stage, y);
  const quad = (points: Projected[]) => `M${points.map((p) => `${p.x} ${p.y}`).join(" L")} Z`;
  const planks = Array.from({ length: 10 }, (_, index) => -1.0 + index * 0.22);
  const end = at(1.0, 0.38, 0.15);
  const ring = at(0.9, -0.44, 0.35);
  const hull = at(1.25, -1.05, 0);
  return (
    <g>
      {[-1.0, 0, 1.0].flatMap((along) =>
        [-0.38, 0.38].map((side) => {
          const foot = at(along, side, -0.45);
          const head = at(along, side, 0.2);
          return <line key={`${along},${side}`} stroke={WOOD_D} strokeLinecap="round" strokeWidth={r2(0.1 * head.s)} x1={foot.x} x2={head.x} y1={foot.y} y2={head.y} />;
        }),
      )}
      {planks.map((along, index) => (
        <path
          d={quad([at(along - 0.1, -0.4, 0.14), at(along - 0.1, 0.4, 0.14), at(along + 0.1, 0.4, 0.14), at(along + 0.1, -0.4, 0.14)])}
          fill={index % 2 ? WOOD : WOOD_L}
          key={along}
        />
      ))}
      <line stroke={WOOD_D} strokeLinecap="round" strokeWidth={r2(0.12 * end.s)} x1={end.x} x2={end.x} y1={end.y} y2={r2(end.y - 0.3 * 0.76 * end.s)} />
      <circle cx={ring.x} cy={ring.y} fill="none" r={r2(0.12 * ring.s)} stroke={RED} strokeWidth={r2(0.06 * ring.s)} />
      <circle cx={ring.x} cy={ring.y} fill="none" r={r2(0.12 * ring.s)} stroke={CREAM} strokeDasharray={`${r2(0.09 * ring.s)} ${r2(0.09 * ring.s)}`} strokeWidth={r2(0.06 * ring.s)} />
      {boat ? (
        <g>
          <ellipse cx={hull.x} cy={hull.y} fill={WOOD_D} rx={r2(0.62 * hull.s)} ry={r2(0.3 * hull.s)} />
          <ellipse cx={hull.x} cy={r2(hull.y - 0.05 * hull.s)} fill={WOOD_L} rx={r2(0.5 * hull.s)} ry={r2(0.2 * hull.s)} />
          <rect fill={WOOD} height={r2(0.06 * hull.s)} width={r2(0.9 * hull.s)} x={r2(hull.x - 0.45 * hull.s)} y={r2(hull.y - 0.08 * hull.s)} />
        </g>
      ) : null}
    </g>
  );
}
