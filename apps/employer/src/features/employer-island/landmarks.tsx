import type { ShopLandmarkId } from "@paw-time/api-contracts";
import { HEIGHT_K, darken, round2 } from "@/lib/shop-island";
import {
  ArrowBoard,
  Bench,
  Box,
  BulletinBoard,
  CREAM,
  CanopyRound,
  Cushion,
  Cyl,
  Disc,
  Flower,
  FlowerPot,
  Fountain,
  GOLD,
  Gable,
  GLOW,
  Hammock,
  INK,
  IRON,
  LEAF,
  LEAF_D,
  Mailbox,
  Node,
  PALE,
  Pad,
  PaperLantern,
  ParasolTable,
  RED,
  ROOF,
  STONE,
  STONE_D,
  Shadow,
  Signpost,
  Sph,
  SteppingStone,
  StreetLamp,
  StringLights,
  TERRACOTTA,
  TreeRound,
  TreeSakura,
  Tube,
  WOOD,
  WOOD_D,
  WOOD_L,
  WATER,
  top,
  useLocal,
} from "./kit";

/**
 * The seven landmarks of a shop island, one per review tag, exactly as
 * apps/worker/scripts/shop_landmarks.gd builds them: same parts, same metres,
 * three levels each, and a sprout while the tag has only a vote or two.
 */
const r2 = round2;

export function Sprout() {
  const L = useLocal();
  const left = L(-0.07, 0.2, 0);
  const right = L(0.07, 0.2, 0);
  return (
    <g>
      <Cyl color="#8a6a4a" h={0.05} rb={0.18} rt={0.16} y={0.025} />
      <Cyl color={LEAF_D} h={0.18} rb={0.014} rt={0.012} y={0.12} />
      <ellipse cx={left.x} cy={left.y} fill={LEAF} rx={r2(0.08 * left.s)} ry={r2(0.03 * left.s)} transform={`rotate(-28 ${left.x} ${left.y})`} />
      <ellipse cx={right.x} cy={right.y} fill={LEAF} rx={r2(0.08 * right.s)} ry={r2(0.03 * right.s)} transform={`rotate(28 ${right.x} ${right.y})`} />
    </g>
  );
}

export function Landmark({ id, level, sprout }: { id: ShopLandmarkId; level: number; sprout: boolean }) {
  if (level <= 0) return sprout ? <Sprout /> : null;
  const lv = Math.min(3, Math.max(1, level));
  switch (id) {
    case "clock_tower":
      return <ClockTower level={lv} />;
    case "rest_grove":
      return <RestGrove level={lv} />;
    case "guide_post":
      return <GuidePost level={lv} />;
    case "payday_bell":
      return <PaydayBell level={lv} />;
    case "lantern_path":
      return <LanternPath level={lv} />;
    case "fair_fountain":
      return <FairFountain level={lv} />;
    case "welcome_arch":
      return <WelcomeArch level={lv} />;
  }
}

// ---- 時間どおりに帰れる：時計台 ------------------------------------------------

function ClockFace({ y, z, r, lit }: { y: number; z: number; r: number; lit: boolean }) {
  const L = useLocal();
  const c = L(0, y, z);
  const rs = r * c.s;
  return (
    <g>
      <Disc color={GOLD} r={r + 0.03} y={y} z={z} />
      <Disc color={lit ? "#fff6dc" : "#fffaf0"} r={r} y={y} z={z} />
      {Array.from({ length: 12 }, (_, index) => {
        const a = (Math.PI * 2 * index) / 12;
        return <circle cx={r2(c.x + Math.cos(a) * rs * 0.8)} cy={r2(c.y - Math.sin(a) * rs * 0.8 * HEIGHT_K)} fill={INK} key={index} r={r2(rs * 0.07)} />;
      })}
      {/* The hands always show home time: six o'clock sharp */}
      <line stroke={INK} strokeLinecap="round" strokeWidth={r2(rs * 0.08)} x1={c.x} x2={c.x} y1={c.y} y2={r2(c.y - rs * 0.7 * HEIGHT_K)} />
      <line stroke={INK} strokeLinecap="round" strokeWidth={r2(rs * 0.1)} x1={c.x} x2={c.x} y1={c.y} y2={r2(c.y + rs * 0.5 * HEIGHT_K)} />
      <circle cx={c.x} cy={c.y} fill={GOLD} r={r2(rs * 0.1)} />
    </g>
  );
}

function ClockTower({ level }: { level: number }) {
  if (level === 1) {
    return (
      <g>
        <Shadow rx={0.3} />
        <Cyl color={STONE} h={0.1} rb={0.18} rt={0.14} y={0.05} />
        <Cyl color={IRON} h={1.0} rb={0.05} rt={0.04} y={0.55} />
        <Disc color={IRON} r={0.2} y={1.18} />
        <ClockFace lit={false} r={0.17} y={1.18} z={0.05} />
      </g>
    );
  }
  const h = level === 2 ? 1.5 : 2.2;
  const roofBase = 0.16 + h;
  const flowers = ["#ffd24d", "#ff8fb1", "#fff5f8"];
  return (
    <g>
      <Shadow rx={0.8} rz={0.5} />
      <Box color={STONE_D} d={0.9} h={0.16} w={0.9} y={0.08} />
      <Box bevel={0.04} color={PALE} d={0.66} h={h} w={0.66} y={0.16 + h / 2} />
      {[-0.33, 0.33].map((px) => (
        <Box color={WOOD_D} d={0.1} h={h} key={px} w={0.1} x={px} y={0.16 + h / 2} z={0.33} />
      ))}
      <Box color={WOOD} d={0.04} h={0.4} w={0.24} y={0.36} z={0.34} />
      <ClockFace lit r={0.24} y={roofBase - 0.32} z={0.36} />
      <Box bevel={0.03} color={WOOD_L} d={0.8} h={0.08} w={0.8} y={roofBase + 0.02} />
      <Cyl color={ROOF} h={0.62} rb={0.56} rt={0} y={roofBase + 0.37} />
      {level >= 3 ? (
        <g>
          <Cyl color={ROOF} h={0.4} rb={0.4} rt={0} y={roofBase + 0.64} />
          <Sph color={GOLD} r={0.06} y={roofBase + 0.86} />
          <Cyl color={WOOD_D} h={0.5} rb={0.015} rt={0.015} y={roofBase + 1.1} />
          <Box bevel={0.004} color={RED} d={0.01} h={0.16} w={0.3} x={0.16} y={roofBase + 1.27} />
          {Array.from({ length: 6 }, (_, index) => {
            const a = (Math.PI * 2 * index) / 6 + 0.3;
            return <Flower color={flowers[index % 3] ?? GOLD} h={0.2} key={index} x={r2(Math.cos(a) * 0.62)} z={r2(Math.sin(a) * 0.62)} />;
          })}
        </g>
      ) : (
        <Sph color={GOLD} r={0.06} y={roofBase + 0.72} />
      )}
    </g>
  );
}

// ---- 休憩がとれる：ハンモックとベンチの木立 ------------------------------------

function RestGrove({ level }: { level: number }) {
  return (
    <g>
      {level >= 2 ? (
        <Node scale={0.85} x={0.35} z={-0.55}>
          <Hammock />
        </Node>
      ) : null}
      <Node x={-0.55} z={-0.35}>
        <TreeRound />
      </Node>
      {level >= 3 ? (
        <Node x={1.05} z={-0.1}>
          <TreeSakura scale={0.85} />
        </Node>
      ) : null}
      <Node x={0.25} z={0.3}>
        <Bench />
      </Node>
      {level >= 3 ? (
        <Node scale={0.8} x={-0.95} z={0.5}>
          <ParasolTable />
          <Cyl color={CREAM} h={0.12} rb={0.07} rt={0.06} y={0.58} />
        </Node>
      ) : null}
      {level >= 2 ? (
        <Node scale={0.7} x={-0.2} z={0.55}>
          <Cushion />
        </Node>
      ) : null}
    </g>
  );
}

// ---- 説明がわかりやすい：矢印のはっきりした道しるべ ---------------------------

function GuidePost({ level }: { level: number }) {
  return (
    <g>
      <Shadow rx={0.5} rz={0.3} />
      {level >= 3 ? (
        <Node scale={0.8} x={-0.4} z={-0.45}>
          <StreetLamp />
        </Node>
      ) : null}
      {level >= 3 ? (
        <Node scale={0.9} x={0.7} z={-0.2}>
          <BulletinBoard />
        </Node>
      ) : null}
      <Signpost scale={level === 1 ? 1 : 1.3} />
      {level >= 2 ? (
        <g>
          <Node x={-0.55} z={0.1}>
            <ArrowBoard />
          </Node>
          {[0, 1, 2, 3].map((index) => (
            <SteppingStone color={index % 2 ? darken(STONE, 0.04) : STONE} key={index} scale={0.95} x={-0.1 + index * 0.05} z={0.4 + index * 0.32} />
          ))}
        </g>
      ) : null}
    </g>
  );
}

// ---- 給料が遅れない：時間どおりに鳴る金の鐘 -------------------------------------

function PaydayBell({ level }: { level: number }) {
  if (level === 1) {
    return (
      <g>
        <Shadow rx={0.3} />
        <Cyl color={WOOD_D} h={0.9} rb={0.04} rt={0.03} y={0.45} />
        <Box color={WOOD_D} d={0.04} h={0.04} w={0.4} x={0.12} y={0.9} />
        <Cyl color={GOLD} h={0.16} rb={0.11} rt={0.04} x={0.24} y={0.78} />
        <Sph color={GOLD} r={0.03} x={0.24} y={0.69} />
      </g>
    );
  }
  const w = level === 2 ? 0.9 : 1.2;
  return (
    <g>
      <Shadow rx={0.9} rz={0.45} />
      {level >= 3 ? (
        <Node x={w / 2 + 0.4} z={0.25}>
          <Mailbox />
        </Node>
      ) : null}
      {level >= 3
        ? [0, 1, 2].map((index) => (
            <Pad color={CREAM} key={index} rx={0.1} rz={0.07} x={-w / 2 - 0.35 + index * 0.03} y={0.02 + index * 0.025} z={0.3 - index * 0.02} />
          ))
        : null}
      {[-w / 2, w / 2].map((px) => (
        <g key={px}>
          <Cyl color={STONE} h={0.1} rb={0.08} rt={0.08} x={px} y={0.05} />
          <Cyl color={RED} h={1.2} rb={0.06} rt={0.05} x={px} y={0.6} />
        </g>
      ))}
      <Box color={RED} d={0.12} h={0.08} w={w + 0.1} y={1.18} />
      <Cyl color={GOLD} h={0.3} rb={0.2} rt={0.07} y={0.96} />
      <BellRim />
      <Sph color={GOLD} r={0.04} y={0.78} />
      <Tube color="#e8575b" points={[[0.05, 0.8, 0], [0.1, 0.55, 0.02], [0.08, 0.3, 0.04]]} width={0.024} />
      <Gable color={ROOF} d={0.5} h={0.28} w={w + 0.35} y={1.24} />
      {level >= 3
        ? [-1, 1].map((side) => <Sph color="#ffd98a" key={side} r={0.1} syk={1.25} x={side * (w / 2 + 0.02)} y={1.02} z={0.1} />)
        : null}
    </g>
  );
}

function BellRim() {
  const L = useLocal();
  const c = L(0, 0.82, 0);
  return <ellipse cx={c.x} cy={c.y} fill={darken(GOLD, 0.12)} rx={r2(0.21 * c.s)} ry={r2(0.105 * c.s)} />;
}

// ---- 人がやさしい：灯りの小道 ----------------------------------------------------

function LanternPath({ level }: { level: number }) {
  const count = [2, 4, 6][level - 1] ?? 2;
  const lanterns = Array.from({ length: count }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const z = 0.9 - Math.floor(index / 2) * 0.7;
    return { side, z, key: index };
  }).sort((a, b) => a.z - b.z);
  return (
    <g>
      {level >= 3 ? (
        <Node z={-1.3}>
          <g transform="scale(0.85 1.1)">
            <StringLights />
          </g>
        </Node>
      ) : null}
      {Array.from({ length: count + 1 }, (_, index) => (
        <SteppingStone key={index} x={r2(Math.sin(index * 1.3) * 0.08)} z={r2(1.0 - index * 0.36)} />
      ))}
      {lanterns.map((lantern) => (
        <Node key={lantern.key} mirror={lantern.side > 0} x={lantern.side * 0.55} z={lantern.z}>
          <PaperLantern />
        </Node>
      ))}
    </g>
  );
}

// ---- 忙しいけど公平：ふたつの受け皿がつりあう噴水 --------------------------------

function FairFountain({ level }: { level: number }) {
  if (level === 1) {
    return (
      <g>
        <Shadow rx={0.35} />
        <Cyl color={STONE} h={0.5} rb={0.1} rt={0.07} y={0.25} />
        <Cyl color={STONE} h={0.1} rb={0.1} rt={0.28} y={0.55} />
        <Pad color={WATER} rx={0.24} y={0.6} />
      </g>
    );
  }
  const y = level === 2 ? 1.0 : 1.2;
  const flowers = ["#b89bff", "#ffd24d"];
  return (
    <g>
      <Shadow rx={0.7} />
      {level >= 3
        ? Array.from({ length: 8 }, (_, index) => {
            const a = (Math.PI * 2 * index) / 8;
            return <Flower color={flowers[index % 2] ?? GOLD} h={0.22} key={index} x={r2(Math.cos(a) * 0.75)} z={r2(Math.sin(a) * 0.75)} />;
          })
        : null}
      <g transform={`scale(${level === 2 ? 0.9 : 1.1})`}>
        <Fountain />
      </g>
      {/* Two bowls at the very same height */}
      <Tube color={STONE_D} points={[[-0.45, y, 0], [0.45, y, 0]]} width={0.06} />
      {[-0.45, 0.45].map((px) => (
        <g key={px}>
          <Cyl color={STONE} h={0.08} rb={0.08} rt={0.16} x={px} y={y - 0.06} />
          <Pad color={WATER} rx={0.13} x={px} y={y - 0.02} />
        </g>
      ))}
      <Sph color={GOLD} r={0.05} y={y + 0.05} />
    </g>
  );
}

// ---- また働きたい：おかえりのアーチ ------------------------------------------------

function WelcomeArch({ level }: { level: number }) {
  const colors = ["#ff8fb1", "#ffd24d", "#fff5f8", "#b89bff"];
  const arch: [number, number, number][] = Array.from({ length: 17 }, (_, index) => {
    const t = index / 16;
    return [r2(-0.7 + t * 1.4), r2(Math.sin(t * Math.PI) * 1.35), 0];
  });
  const balls = level >= 2 ? (level === 2 ? 9 : 15) : 0;
  return (
    <g>
      {level >= 3
        ? [-1.2, 1.2].map((px) => (
            <Node key={px} mirror={px > 0} x={px} z={0.1}>
              <PaperLantern />
            </Node>
          ))
        : null}
      {level >= 2 ? (
        <g>
          <Shadow rx={0.9} rz={0.3} />
          <Tube color="#fdf1dc" points={arch} width={0.09} />
          {Array.from({ length: balls }, (_, index) => {
            const t = (index + 0.5) / balls;
            const x = r2(-0.7 + t * 1.4);
            const y = r2(Math.sin(t * Math.PI) * 1.35);
            return (
              <g key={index}>
                <Sph color={LEAF} highlight={false} r={0.06} sx={1.3} syk={0.5} x={r2(x + 0.04)} y={y - 0.05} z={-0.04} />
                <Sph color={colors[index % 4] ?? GOLD} r={0.07} syk={0.8} x={x} y={y} z={0.03} />
              </g>
            );
          })}
          {level >= 3 ? <Bunting colors={colors} /> : null}
          {[0, 1, 2].map((index) => (
            <SteppingStone key={index} x={r2(Math.sin(index * 1.7) * 0.06)} z={r2(0.25 - index * 0.34)} />
          ))}
        </g>
      ) : null}
      {[-0.75, 0.75].map((px) => (
        <Node key={px} x={px} z={0.15}>
          <FlowerPot />
        </Node>
      ))}
    </g>
  );
}

function Bunting({ colors }: { colors: string[] }) {
  const L = useLocal();
  return (
    <g>
      {Array.from({ length: 7 }, (_, index) => {
        const t = (index + 1) / 8;
        const x = r2(-0.7 + t * 1.4);
        const y = r2(1.02 - Math.sin(t * Math.PI) * 0.18);
        const a = L(x - 0.07, y + 0.07, 0.08);
        const b = L(x + 0.07, y + 0.07, 0.08);
        const tip = L(x, y - 0.07, 0.08);
        return <path d={`M${a.x} ${a.y} L${b.x} ${b.y} L${tip.x} ${tip.y} Z`} fill={colors[index % 4] ?? GOLD} key={index} />;
      })}
    </g>
  );
}

// ---- お店そのもの（うしろの丘に建つ） ---------------------------------------------

/** The shop, as ShopLandmarks.build_shop: cream walls, striped awning and roof in the shop's colours, the logo on the board above. */
export function Shop({ sign, accent, logoUrl, name }: { sign: string; accent: string; logoUrl: string | null; name: string }) {
  const L = useLocal();
  const board = L(0, 1.98, 0.26);
  const boardW = 1.66 * board.s;
  const boardH = 0.3 * board.s;
  return (
    <g>
      <Shadow opacity={0.22} rx={1.6} rz={0.9} x={0.2} />
      <Box color={STONE} d={1.6} h={0.14} w={2.6} y={0.07} />
      <Box color="#fff6ea" d={1.3} h={1.1} w={2.4} y={0.69} z={-0.05} />
      <Gable color={darken(sign, 0.25)} d={1.5} h={0.5} w={2.8} y={1.24} z={-0.05} />
      {/* The signboard above the roof carries the company logo */}
      {[-0.7, 0.7].map((px) => (
        <Cyl color={WOOD_D} h={0.3} key={px} rb={0.03} rt={0.03} x={px} y={1.7} z={0.18} />
      ))}
      <Box bevel={0.03} color={sign} d={0.08} h={0.46} w={1.9} y={1.98} z={0.2} />
      <Box bevel={0.01} color={accent} d={0.02} h={0.36} w={1.78} y={1.98} z={0.25} />
      {logoUrl ? (
        // Drawn at 100× and scaled back down: browsers rasterise an SVG logo at the attribute size, so a metre-sized image would come out blank.
        <g transform={`translate(${r2(board.x - boardW / 2)} ${r2(board.y - boardH / 2)}) scale(0.01)`}>
          <image height={r2(boardH * 100)} href={logoUrl} preserveAspectRatio="xMidYMid meet" width={r2(boardW * 100)} x="0" y="0" />
        </g>
      ) : (
        <text fill={darken(sign, 0.45)} fontSize={r2(0.2 * board.s)} fontWeight="900" textAnchor="middle" x={board.x} y={r2(board.y + 0.07 * board.s)}>
          {name.length > 12 ? `${name.slice(0, 11)}…` : name}
        </text>
      )}
      {/* A wide window and the open door */}
      <Box color="#ffe9b8" d={0.04} h={0.5} w={0.9} x={-0.55} y={0.75} z={0.62} />
      <Box color={WOOD_L} d={0.08} h={0.06} w={0.98} x={-0.55} y={0.47} z={0.64} />
      <Box color={WOOD} d={0.05} h={0.74} w={0.44} x={0.62} y={0.51} z={0.62} />
      <Sph color={GOLD} r={0.03} x={0.76} y={0.51} z={0.66} />
      {/* The striped awning in the shop's colours: tilted boards with a scalloped edge */}
      {Array.from({ length: 8 }, (_, index) => {
        const x = -1.12 + index * 0.32;
        const color = index % 2 === 0 ? sign : accent;
        const a = L(x - 0.16, 1.31, 0.56);
        const b = L(x + 0.16, 1.31, 0.56);
        const c = L(x + 0.16, 1.09, 1.16);
        const d = L(x - 0.16, 1.09, 1.16);
        return (
          <g key={index}>
            <path d={`M${a.x} ${a.y} L${b.x} ${b.y} L${c.x} ${c.y} L${d.x} ${d.y} Z`} fill={top(color)} />
            <Disc color={color} r={0.16} x={x} y={1.08} z={1.13} />
          </g>
        );
      })}
      {/* Planters and the chalkboard */}
      {[-1.25, 1.25].map((px) => (
        <g key={px}>
          <Cyl color={TERRACOTTA} h={0.24} rb={0.11} rt={0.15} x={px} y={0.12} z={0.95} />
          <CanopyRound color={LEAF} scale={0.3} x={px} y={0.42} z={0.95} />
        </g>
      ))}
      <Node x={1.0} z={1.35}>
        {[-0.2, 0.2].map((px) => (
          <Box color={WOOD_D} d={0.04} h={0.6} key={px} w={0.04} x={px} y={0.3} z={0.06} />
        ))}
        <Box color="#3a4a44" d={0.03} h={0.44} w={0.44} y={0.36} z={0.1} />
        <ChalkLines accent={accent} />
      </Node>
      <Sph color={GLOW} highlight={false} r={0.02} x={-0.55} y={0.8} z={1.0} />
    </g>
  );
}

function ChalkLines({ accent }: { accent: string }) {
  const L = useLocal();
  const a = L(0, 0.44, 0.13);
  const b = L(0, 0.36, 0.14);
  return (
    <g>
      <rect fill={accent} height={r2(0.03 * a.s)} width={r2(0.3 * a.s)} x={r2(a.x - 0.15 * a.s)} y={r2(a.y - 0.015 * a.s)} />
      <rect fill={accent} height={r2(0.03 * b.s)} width={r2(0.22 * b.s)} x={r2(b.x - 0.11 * b.s)} y={r2(b.y - 0.015 * b.s)} />
    </g>
  );
}
