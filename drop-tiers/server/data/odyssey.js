// ============================================================================
// 게임 2.0 — 오디세이(영웅의 오디세이) 포팅
// ============================================================================
// 기존 라이브 게임(`alrzl5000-oss/minsu100`)의 server/routes/odyssey.js +
// server/data/odyssey.js 실제 코드를 민수님이 직접 붙여넣어줘서 확인하고 포팅했다.
// "민수님이 직접 만든 것"이라고 명시하신 콘텐츠라, 세븐나이츠 키우기 참고 없이 기존
// 코드의 기획 의도를 그대로 가져오는 데 집중했다. 핵심 정체성(그대로 유지):
//
// 1. 5가지 테마가 5스테이지 주기로 순환하고, 테마마다 배치 가능한 직업이 하나로
//    고정된다(장비 획득 전용 콘텐츠 — 통화 대신 장비가 드랍됨).
// 2. 테마별 전투 기믹: 키클롭스(암살자, 평타 무효) / 거인(탱커, 체력→공격력 전환) /
//    키르케(서포터, 치유→피해 전환) / 세이렌(원거리, 체력만 매우 높음) / 헬리오스(딜러,
//    기믹 없는 무난한 마지막 테마).
// 3. "한 바퀴(25스테이지) 안에서는 테마 간 난이도가 동일, 바퀴가 바뀔 때 확 어려워진다"는
//    pseudoStage 설계(로컬 윈도우 1~5 + 바퀴당 큰 점프)를 그대로.
// 4. 장비 등급(레어~레전더리) + 줄(1~3개, 아이템별 확률 풀에서 추첨) + 강화(+1~+15,
//    성공률 체감 곡선, 11강부터 하락 위험) 시스템을 그대로.
// 5. 승급석 0.1% 확률 드랍(최초 클리어 여부 무관, 매 승리 독립 판정), 테마 무관
//    "오디세우스의 활"(10% 확률 추가 드랍) 전부 그대로.
//
// [2.0에서 재해석/변경한 부분 — 명시]
// - 전투 엔진이 완전히 다르다(기존: 기대값 계산 computeTeamBattle / 2.0: 마나-스킬
//   실시간 시뮬레이션 simulateOdysseyFight). "평타 무효"(zeroNormal)는
//   server/lib/combat.js에 immuneNormal 플래그로, "치유→피해"(healAsDamage)는 서포터의
//   실제 heal 스킬(server/data/skills.js)이 발동할 때 그 회복량 그대로(1:1) 보스에게
//   고정 피해로 전환하는 방식으로 combat.js에 그대로 이식했다(다른 콘텐츠에는 영향 없음).
// - "스킬 충전 단축"(기존: 타수 게이지 방식 전용) → 2.0은 마나 게이지라 개념이 안
//   맞는다. 가장 가까운 동등 효과인 "마나 회복 가속"(manaRegen)으로 치환했다(이미
//   combat.js에 있는 manaRegenBuffs 메커니즘을 그대로 재사용).
// - 절대 수치(골드/다이아 비용, flat 스탯 범위)는 기존 게임 경제 스케일(예: 골드
//   수백~수만)과 2.0 경제 스케일(예: EX 프레스티지 골드 5억)이 완전히 달라서 그대로
//   가져올 수 없다 — RARITY_UNIT 기준으로 비례 재산정했고 [1차 추정치, 실측 필요]로
//   표기한다. 확률(등급 가중치, 강화 성공률/하락률, 드랍률)은 스케일과 무관한 값이라
//   전부 원본 그대로 포팅했다.
//
// [아직 안 한 것] 유저별 진행도(스테이지/인벤토리/강화 상태) 저장은 Supabase 스키마가
// 필요하다 — 지금은 stages.js와 동일하게 무상태(stateless) 계산 API다.
import { RARITY_UNIT, CLASSES } from "./characters.js";
import { simulateOdysseyFight } from "../lib/combat.js";

// ---------------------------------------------------------------------------
// 1. 테마 정의 — 5가지 직업 고정 테마, 5스테이지 주기로 순환.
// ---------------------------------------------------------------------------
export const ODYSSEY_THEMES = [
  {
    key: "cyclops",
    name: "키클롭스의 굴",
    allowedClass: "assassin",
    bossName: "동굴의 키클롭스",
    itemKey: "cyclops_eye",
    zeroNormal: true,
    hpMult: 0.65,
    atkMult: 0.5,
    defMult: 0.55,
    desc: "평타가 전혀 통하지 않는 외눈거인의 소굴. 그림자 속에서 급습하는 암살자만이 뚫을 수 있습니다.",
  },
  {
    key: "giant",
    name: "거인의 발걸음",
    allowedClass: "tanker",
    bossName: "대지를 뒤흔드는 거인",
    itemKey: "giant_armor",
    hpMult: 0.35,
    atkMult: 0.6,
    defMult: 0.5,
    desc: "묵직한 발걸음마다 대지가 흔들립니다. 버티는 자, 오직 탱커만이 나아갈 수 있습니다. (체력의 일부가 추가 공격력으로 전환돼요 — 등급이 높을수록 전환율도 커져요)",
  },
  {
    key: "circe",
    name: "키르케의 저주",
    allowedClass: "support",
    bossName: "저주의 마녀 키르케",
    itemKey: "circe_parrot",
    healAsDamage: true,
    hpMult: 0.55,
    atkMult: 0.45,
    defMult: 0.5,
    desc: "버프의 노래가 저주로 뒤바뀌는 곳. 서포터의 버프 효과가 아군이 아닌 마녀를 향해 꽂힙니다.",
  },
  {
    key: "siren",
    name: "세이렌의 유혹",
    allowedClass: "ranged",
    bossName: "심연의 세이렌",
    itemKey: "siren_necklace",
    hpMult: 1.4,
    atkMult: 0.55,
    defMult: 0.5,
    desc: "유혹의 노래 뒤에 숨은 압도적인 맷집. 원거리 딜러의 꾸준한 화력만이 답입니다.",
  },
  {
    key: "helios",
    name: "헬리오스의 섬",
    allowedClass: "dealer",
    bossName: "태양의 수호자 헬리오스",
    itemKey: "helios_cloak",
    hpMult: 0.9,
    atkMult: 0.55,
    defMult: 0.55,
    desc: "다섯 시련의 마지막, 평범하지만 결코 만만치 않은 태양의 수호자가 기다립니다.",
  },
];

export const ODYSSEY_THEME_MAP = Object.fromEntries(ODYSSEY_THEMES.map((t) => [t.key, t]));

export function themeIndexForStage(stage) {
  return Math.floor((Math.max(1, stage || 1) - 1) / 5) % ODYSSEY_THEMES.length;
}
export function themeForStage(stage) {
  return ODYSSEY_THEMES[themeIndexForStage(stage)];
}

// ---------------------------------------------------------------------------
// 2. 체감 난이도(pseudoStage) — "바퀴 안에서는 테마 간 동일, 바퀴가 바뀔 때 점프".
//    기존 게임의 설계를 그대로(로컬 윈도우 1~5 + 바퀴 인덱스 × CYCLE_STEP).
// ---------------------------------------------------------------------------
export const ODYSSEY_CYCLE_LENGTH = ODYSSEY_THEMES.length * 5; // 25
export const ODYSSEY_CYCLE_STEP = 9; // [1차 추정치] 2.0 전투엔진 기준 재산정 — 실측 후 조정 필요

function localStageWithinWindow(stage) {
  return ((Math.max(1, stage || 1) - 1) % 5) + 1;
}
function cycleIndexForStage(stage) {
  return Math.floor((Math.max(1, stage || 1) - 1) / ODYSSEY_CYCLE_LENGTH);
}
export function odysseyPseudoStage(stage) {
  return localStageWithinWindow(stage) + cycleIndexForStage(stage) * ODYSSEY_CYCLE_STEP;
}

// ---------------------------------------------------------------------------
// 3. 몬스터 — stages.js의 monsterUnit과 같은 패턴(지수 성장)이되, "전투 탭 스테이지보다
//    약하게"라는 기존 설계 의도를 그대로 따라 더 낮은 베이스를 쓴다.
// ---------------------------------------------------------------------------
const ODYSSEY_BASE_UNIT = RARITY_UNIT.N * 0.04;
const ODYSSEY_GROWTH_RATE = 1.05;

export function odysseyEnemy(stage) {
  const theme = themeForStage(stage);
  const pseudoStage = odysseyPseudoStage(stage);
  const unit = ODYSSEY_BASE_UNIT * Math.pow(ODYSSEY_GROWTH_RATE, pseudoStage - 1);
  return {
    characterId: `odyssey-${stage}`,
    name: theme.bossName,
    role: "monster",
    hp: Math.max(1, Math.round(unit * theme.hpMult * 8)),
    atk: Math.max(1, Math.round(unit * theme.atkMult)),
    def: Math.max(0, Math.round(unit * theme.defMult)),
    mana: 100,
    spd: 1.0,
    critRate: 0.08,
    critDmg: 1.4,
    pen: 0,
    res: 0.15,
    skills: [{ key: "odyssey_burst", kind: "burst", burstMult: 2.6, manaCost: 50 }],
    zeroNormal: !!theme.zeroNormal,
    healAsDamage: !!theme.healAsDamage,
    theme: theme.key,
  };
}

// [거인] 체력의 일부를 공격력으로 전환 — 등급이 높을수록 전환율도 커진다(기존 게임
// 설계: "등급 차이를 더 크게"). 2.0 등급 체계(N~XR, HR/XXR)에 맞춰 재산정.
export const GIANT_HP_TO_ATK_COEF_BY_RARITY = {
  N: 0.02, R: 0.03, SR: 0.04, SSR: 0.06, XR: 0.09, HR: 0.12, XXR: 0.12, EX: 0.14,
};
export function applyGiantHpAtkBuff(team, theme) {
  if (!theme || theme.key !== "giant") return team;
  return team.map((h) => {
    const coef = GIANT_HP_TO_ATK_COEF_BY_RARITY[h.rarity] ?? GIANT_HP_TO_ATK_COEF_BY_RARITY.SSR;
    return { ...h, atk: h.atk + Math.round(h.hp * coef) };
  });
}

// ---------------------------------------------------------------------------
// 4. 장비 능력치 라인 시스템 — 아이템당 1~3개 줄(1줄 80%/2줄 19%/3줄 1%), 등급(전체
//    아이템에 하나)에 따라 수치 범위가 갈린다. 확률 구조는 원본 그대로.
// ---------------------------------------------------------------------------
const FLAT_REF = RARITY_UNIT.SR; // 절대수치(flat) 스탯의 기준 단위 — 2.0 스탯 스케일에 비례

export const ODYSSEY_STAT_POOL = {
  luck: { label: "다이아 획득량", icon: "💎", unit: "%", range: { rare: [2, 5], epic: [6, 9], unique: [10, 15], legendary: [18, 25] }, describe: (v) => `다이아 획득량 +${v}%` },
  gold: { label: "골드 획득량", icon: "🪙", unit: "%", range: { rare: [2, 5], epic: [6, 9], unique: [10, 15], legendary: [18, 25] }, describe: (v) => `골드 획득량 +${v}%` },
  exp: { label: "경험치 획득량", icon: "📘", unit: "%", range: { rare: [2, 5], epic: [6, 9], unique: [10, 15], legendary: [18, 25] }, describe: (v) => `경험치 획득량 +${v}%` },
  vit: { label: "체력·방어력", icon: "🛡️", unit: "%", range: { rare: [2, 5], epic: [6, 9], unique: [10, 14], legendary: [16, 20] }, describe: (v) => `팀 전체 체력·방어력 +${v}%` },
  spd: { label: "공격속도", icon: "💨", unit: "%", range: { rare: [1.5, 3.5], epic: [4, 5.5], unique: [6.5, 8.5], legendary: [10, 13] }, describe: (v) => `팀 전체 공격속도 +${v}%` },
  crit: { label: "치명타 확률", icon: "🎯", unit: "%p", range: { rare: [1, 2.5], epic: [3, 4.5], unique: [5.5, 7.5], legendary: [9, 12] }, describe: (v) => `팀 전체 치명타 확률 +${v}%p` },
  atk: { label: "공격력", icon: "⚔️", unit: "%", range: { rare: [2, 5], epic: [6, 9], unique: [10, 14], legendary: [16, 20] }, describe: (v) => `팀 전체 공격력 +${v}%` },
  critDmg: { label: "치명타 피해", icon: "💢", unit: "%", range: { rare: [2, 5], epic: [6, 9], unique: [10, 14], legendary: [16, 20] }, describe: (v) => `팀 전체 치명타 피해 +${v}%` },
  atkFlat: { label: "공격력(고정)", icon: "⚔️", unit: "", range: scaledFlatRange(0.17, 0.28, 0.34, 0.51, 0.62, 0.9, 1.1, 1.65), describe: (v) => `팀 전체 공격력 +${v}` },
  vitFlat: { label: "체력·방어력(고정)", icon: "🛡️", unit: "", range: scaledFlatRange(0.06, 0.11, 0.14, 0.2, 0.25, 0.34, 0.43, 0.57), describe: (v) => `팀 전체 방어력 +${v} · 체력 +${Math.round(v * 1.2)}` },
  skillDmg: { label: "스킬 데미지", icon: "💥", unit: "%", range: { rare: [3, 6], epic: [7, 11], unique: [13, 18], legendary: [22, 30] }, describe: (v) => `필살기(스킬) 데미지 +${v}%` },
  // [재해석] 기존 skillChargeReduce(타수 단축) → 2.0 마나 게이지에 맞춰 "마나 회복 가속"으로
  // 치환(이미 combat.js에 있는 manaRegenBuffs 메커니즘을 그대로 재사용).
  manaRegen: { label: "마나 회복 가속", icon: "⚡", unit: "%", range: { rare: [8, 15], epic: [16, 25], unique: [28, 40], legendary: [45, 60] }, describe: (v) => `팀 전체 마나 회복 속도 +${v}%` },
  defBreak: { label: "적 방어력 감소", icon: "🗡️", unit: "%", range: { rare: [2, 5], epic: [6, 9], unique: [10, 14], legendary: [16, 20] }, describe: (v) => `적 방어력 -${v}%` },
};

// flat 스탯 range를 FLAT_REF(=RARITY_UNIT.SR) 비례로 계산 — 인자는 [rareMin,rareMax,epicMin,epicMax,uniqueMin,uniqueMax,legendaryMin,legendaryMax] 순서가 아니라
// rare/epic/unique/legendary 각 등급의 "배율" 2개씩(min,max)을 순서대로 받는다.
function scaledFlatRange(rMin, rMax, eMin, eMax, uMin, uMax, lMin, lMax) {
  const r = (x) => Math.round(FLAT_REF * x * 10) / 10;
  return {
    rare: [r(rMin), r(rMax)],
    epic: [r(eMin), r(eMax)],
    unique: [r(uMin), r(uMax)],
    legendary: [r(lMin), r(lMax)],
  };
}

const DUD_RANGE = { rare: [1, 3], epic: [3, 6], unique: [6, 10], legendary: [10, 15] };
function dudStat(label, icon) {
  return { label, icon, unit: "%", range: DUD_RANGE, isDud: true, describe: (v) => `${label} +${v}% (효과 없음)` };
}

export const ODYSSEY_ITEMS = {
  cyclops_eye: { label: "키클롭스의 눈", icon: "👁️", themeKey: "cyclops", pool: [{ statKey: "defBreak", weight: 1 }, { statKey: "crit", weight: 1 }, { statKey: "dud", weight: 1, dud: dudStat("시력", "👀") }, { statKey: "gold", weight: 1 }] },
  giant_armor: { label: "거인의 갑주", icon: "🛡️", themeKey: "giant", pool: [{ statKey: "vit", weight: 1 }, { statKey: "vitFlat", weight: 1 }, { statKey: "atkFlat", weight: 1 }, { statKey: "atk", weight: 1 }, { statKey: "dud", weight: 1, dud: dudStat("몸무게", "⚖️") }] },
  circe_parrot: { label: "키르케의 앵무새", icon: "🦜", themeKey: "circe", pool: [{ statKey: "spd", weight: 1 }, { statKey: "manaRegen", weight: 0.2 }, { statKey: "crit", weight: 1 }, { statKey: "atkFlat", weight: 1 }, { statKey: "dud", weight: 1, dud: dudStat("애정도", "💕") }] },
  siren_necklace: { label: "세이렌의 목걸이", icon: "📿", themeKey: "siren", pool: [{ statKey: "exp", weight: 1 }, { statKey: "critDmg", weight: 1 }, { statKey: "spd", weight: 1 }, { statKey: "luck", weight: 1 }, { statKey: "dud", weight: 1, dud: dudStat("매력", "✨") }, { statKey: "gold", weight: 1 }] },
  helios_cloak: { label: "헬리오스의 황금양털망토", icon: "🧣", themeKey: "helios", pool: [{ statKey: "atk", weight: 1 }, { statKey: "atkFlat", weight: 1 }, { statKey: "spd", weight: 1 }, { statKey: "exp", weight: 1 }, { statKey: "critDmg", weight: 1 }, { statKey: "dud", weight: 1, dud: dudStat("포만감", "🍗") }] },
  odysseus_bow: { label: "오디세우스의 활", icon: "🏹", themeKey: null, pool: [{ statKey: "critDmg", weight: 1 }, { statKey: "atk", weight: 1 }, { statKey: "spd", weight: 1 }, { statKey: "skillDmg", weight: 1 }, { statKey: "dud", weight: 1, dud: dudStat("전완근력", "💪") }, { statKey: "atkFlat", weight: 1 }] },
};

export const ODYSSEY_ITEM_SIGNATURE_STAT = {
  cyclops_eye: "defBreak", giant_armor: "vit", circe_parrot: "spd", siren_necklace: "crit", helios_cloak: "atk", odysseus_bow: "critDmg",
};

function rollLineCount() {
  let n = 1;
  if (Math.random() < 0.2) {
    n = 2;
    if (Math.random() < 0.05) n = 3;
  }
  return n;
}
function pickPoolEntry(pool, exclude) {
  const candidates = pool.filter((e) => !exclude.has(e.statKey));
  const totalWeight = candidates.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const c of candidates) {
    r -= c.weight;
    if (r < 0) return c;
  }
  return candidates[candidates.length - 1];
}
function rollItemLines(itemKey, grade) {
  const def = ODYSSEY_ITEMS[itemKey];
  const n = rollLineCount();
  const used = new Set();
  const lines = [];
  for (let i = 0; i < n; i++) {
    const entry = pickPoolEntry(def.pool, used);
    if (!entry) break;
    used.add(entry.statKey);
    if (entry.statKey === "dud") {
      const [min, max] = entry.dud.range[grade];
      const value = Math.round((min + Math.random() * (max - min)) * 10) / 10;
      lines.push({ statKey: "dud", value, isDud: true, label: entry.dud.label, icon: entry.dud.icon });
    } else {
      const stat = ODYSSEY_STAT_POOL[entry.statKey];
      const [min, max] = stat.range[grade];
      const value = Math.round((min + Math.random() * (max - min)) * 10) / 10;
      lines.push({ statKey: entry.statKey, value, isDud: false });
    }
  }
  return lines;
}

export const ODYSSEY_UNIVERSAL_ITEM_KEY = "odysseus_bow";
export const ODYSSEY_BOW_DROP_CHANCE = 0.1;
// 테마 장비도 확률 드랍(확정 없음) — 실제 확률은 equipment.js DROP_MAX.odyssey × 스테이지 보정
export const ODYSSEY_THEME_DROP_CHANCE = 0.35;
export const ODYSSEY_GRADES = ["rare", "epic", "unique", "legendary"];
export const ODYSSEY_GRADE_LABEL = { rare: "레어", epic: "에픽", unique: "유니크", legendary: "레전더리" };
export const ODYSSEY_GRADE_COLOR = { rare: "#4c8bf5", epic: "#a855f7", unique: "#f5b301", legendary: "#ff4d6d" };

// 경제 스케일 — 2.0은 기존 게임보다 전체 골드/다이아 단위가 훨씬 크다(예: EX 프레스티지
// 골드 5억). 그 경제에 맞춰 비례 재산정([1차 추정치, 실측 필요] — 확률 자체는 변경 없음).
export const ODYSSEY_SELL_GOLD = { rare: 40000, epic: 150000, unique: 600000, legendary: 2500000 };
export const ODYSSEY_SELL_GEMS = { rare: 0, epic: 15, unique: 60, legendary: 250 };

const GRADE_WEIGHT_MAX_STAGE = 250;
function scaledWeight(base, max, pseudoStage) {
  const t = Math.min(1, Math.max(0, (Math.max(1, pseudoStage || 1) - 1) / (GRADE_WEIGHT_MAX_STAGE - 1)));
  return base + (max - base) * t;
}
export function odysseyGradeWeightsForStage(stage) {
  const pseudoStage = odysseyPseudoStage(stage);
  const epic = scaledWeight(3, 14, pseudoStage);
  const unique = scaledWeight(0.3, 4, pseudoStage);
  const legendary = scaledWeight(0.00001, 1.2, pseudoStage);
  const rare = Math.max(0, 100 - epic - unique - legendary);
  return { rare, epic, unique, legendary };
}
export function rollOdysseyGrade(stage) {
  const weights = odysseyGradeWeightsForStage(stage);
  let r = Math.random() * 100;
  for (const g of ODYSSEY_GRADES) {
    r -= weights[g];
    if (r < 0) return g;
  }
  return ODYSSEY_GRADES[0];
}
function rollItemByKey(key, stage) {
  const grade = rollOdysseyGrade(stage);
  const lines = rollItemLines(key, grade);
  return { key, grade, lines };
}
// 등급을 밖에서 정해 굴리기 — 장비 개편 후 드랍 확률·등급은 equipment.js(스테이지 보정)가 정한다.
export function rollOdysseyItemWithGrade(key, grade) {
  return { key, grade, lines: rollItemLines(key, grade) };
}
export function rollOdysseyItem(stage) {
  const theme = themeForStage(stage);
  return rollItemByKey(theme.itemKey, stage);
}
export function rollOdysseusBow(stage) {
  if (Math.random() >= ODYSSEY_BOW_DROP_CHANCE) return null;
  return rollItemByKey(ODYSSEY_UNIVERSAL_ITEM_KEY, stage);
}

export function parseOdysseyItems(raw) {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
export function effectiveItemLines(item) {
  return item && Array.isArray(item.lines) ? item.lines : [];
}

// ---------------------------------------------------------------------------
// 5. 강화 — 뽑힌 줄과 완전히 분리된 "아이템 종류별 고유 능력치"를 강화 레벨에 비례해
//    얹는다. 성공률/하락 위험 곡선은 확률값이라 원본 그대로 포팅.
// ---------------------------------------------------------------------------
export const ODYSSEY_ENHANCE_MAX_LEVEL = 15;
const ODYSSEY_ENHANCE_GRADE_RATIO = { rare: 0.1875, epic: 0.375, unique: 0.625, legendary: 1 };
const ODYSSEY_ENHANCE_LEGENDARY_PER_LEVEL_BY_STAT = { atk: 3.8667, vit: 3.8667, spd: 2.5333, crit: 2.2, critDmg: 3.8667, defBreak: 2.4473 };

function odysseyEnhancePerLevel(statKey, grade) {
  const legendaryPerLevel = ODYSSEY_ENHANCE_LEGENDARY_PER_LEVEL_BY_STAT[statKey] ?? 8.7;
  const ratio = ODYSSEY_ENHANCE_GRADE_RATIO[grade] ?? ODYSSEY_ENHANCE_GRADE_RATIO.rare;
  return legendaryPerLevel * ratio;
}
export function odysseyEnhanceSignatureBonus(itemKey, grade, enhanceLevel) {
  const statKey = ODYSSEY_ITEM_SIGNATURE_STAT[itemKey];
  if (!statKey) return null;
  const perLevel = odysseyEnhancePerLevel(statKey, grade);
  const value = Math.round(perLevel * (enhanceLevel || 0) * 10) / 10;
  return { statKey, value };
}

const ODYSSEY_ENHANCE_BASE_GOLD = { rare: 25000, epic: 110000, unique: 450000, legendary: 1600000 };
const ODYSSEY_ENHANCE_BASE_GEMS = { rare: 15, epic: 45, unique: 150, legendary: 450 };
const ODYSSEY_ENHANCE_GEM_START_LEVEL = 8;

export function odysseyEnhanceCost(grade, currentLevel) {
  const nextLevel = currentLevel + 1;
  const goldBase = ODYSSEY_ENHANCE_BASE_GOLD[grade] ?? ODYSSEY_ENHANCE_BASE_GOLD.rare;
  const gold = Math.round(goldBase * Math.pow(1.35, currentLevel));
  let gems = 0;
  if (nextLevel >= ODYSSEY_ENHANCE_GEM_START_LEVEL) {
    const gemBase = ODYSSEY_ENHANCE_BASE_GEMS[grade] ?? ODYSSEY_ENHANCE_BASE_GEMS.rare;
    gems = Math.round(gemBase * Math.pow(1.4, nextLevel - ODYSSEY_ENHANCE_GEM_START_LEVEL));
  }
  return { gold, gems };
}
export function odysseyEnhanceSuccessRate(nextLevel) {
  if (nextLevel <= 5) return 0.5;
  if (nextLevel <= 10) return 0.45 - (nextLevel - 6) * 0.05;
  if (nextLevel <= ODYSSEY_ENHANCE_MAX_LEVEL) return 0.2 - (nextLevel - 11) * 0.0375;
  return 0;
}
export function odysseyEnhanceDowngradeFloor() {
  return 10;
}
export function odysseyEnhanceDowngradeChanceOnFail(nextLevel) {
  return nextLevel > 10 ? 0.5 : 0;
}

// ---------------------------------------------------------------------------
// 6. 장착 장비 보너스 합산 + 팀 스탯에 실제로 적용.
// ---------------------------------------------------------------------------
export function equippedOdysseyBonusSums(items) {
  const sums = { atk: 0, spd: 0, vit: 0, crit: 0, luck: 0, critDmg: 0, gold: 0, exp: 0, skillDmg: 0, manaRegen: 0, atkFlat: 0, vitFlat: 0, defBreak: 0 };
  for (const item of items) {
    if (!item || !item.equipped) continue;
    for (const line of effectiveItemLines(item)) {
      if (!line || line.isDud || !line.statKey) continue;
      const v = Number(line.value) || 0;
      if (line.statKey in sums) sums[line.statKey] += v;
    }
    const sig = odysseyEnhanceSignatureBonus(item.key, item.grade, item.enhance || 0);
    if (sig && sig.value && sig.statKey in sums) sums[sig.statKey] += sig.value;
  }
  return sums;
}

// team: buildFormedTeam을 거친 배열(atk/hp/def/spd/critRate/critDmg/skills 보유).
// 스킬 데미지(skillDmg)는 burst/burstHp kind의 burstMult에, 마나 회복 가속(manaRegen)은
// combat.js가 실제로 소비하는 manaFactor에는 손대지 않고 전투 시작 시 manaRegenBuffs에
// 상시 버프로 얹는 방식 대신, 여기서는 "팀 스탯 자체"를 직접 올려주는 단순한 방식을
// 썼다(장비 보너스는 교전 전에 이미 확정된 값이라 상시 버프 리스트를 쓸 필요가 없음).
export function applyOdysseyEquipmentBonuses(team, sums) {
  return team.map((h) => {
    const skills = (h.skills || []).map((s) => (s.kind === "burst" || s.kind === "burstHp" ? { ...s, burstMult: s.burstMult * (1 + sums.skillDmg / 100) } : s));
    return {
      ...h,
      atk: Math.round(h.atk * (1 + sums.atk / 100) + sums.atkFlat),
      hp: Math.round(h.hp * (1 + sums.vit / 100) + sums.vitFlat * 1.2),
      def: Math.round(h.def * (1 + sums.vit / 100) + sums.vitFlat),
      spd: h.spd * (1 + (sums.spd + sums.manaRegen) / 100),
      critRate: Math.min(0.95, h.critRate + sums.crit / 100),
      critDmg: h.critDmg * (1 + sums.critDmg / 100),
      skills,
    };
  });
}
export function applyEnemyDefBreak(enemy, defBreakPct) {
  if (!enemy || !defBreakPct) return enemy;
  const mult = Math.max(0, 1 - defBreakPct / 100);
  return { ...enemy, def: Math.round(enemy.def * mult) };
}

// ---------------------------------------------------------------------------
// 7. 보상 — 최초 클리어 전용 골드/다이아(바퀴마다 증가), 승급석 매 승리 0.1% 독립 판정.
//    다이아 기준값 300은 2.0의 DIA_PER_PULL(가챠 1회 300다이아)과 우연히도 맞아떨어져
//    "오디세이 최초 클리어 1회 ≈ 가챠 1회" 체감이 유지된다.
// ---------------------------------------------------------------------------
export const ODYSSEY_FIRST_CLEAR_GEM_BASE = 300;
export const ODYSSEY_FIRST_CLEAR_GEM_STEP = 100;
export const ODYSSEY_FIRST_CLEAR_GOLD_BASE = 60000; // [1차 추정치] 2.0 경제 스케일 반영
export const ODYSSEY_FIRST_CLEAR_GOLD_STEP = 20000;

export function odysseyFirstClearReward(stage) {
  const cycle = cycleIndexForStage(stage);
  return {
    gold: ODYSSEY_FIRST_CLEAR_GOLD_BASE + cycle * ODYSSEY_FIRST_CLEAR_GOLD_STEP,
    gems: ODYSSEY_FIRST_CLEAR_GEM_BASE + cycle * ODYSSEY_FIRST_CLEAR_GEM_STEP,
  };
}

export const ODYSSEY_STONE_DROP_CHANCE = 0.001; // 0.1% — 가챠 쪽(HR/XXR)과 같은 독립 추첨 방식
export function rollOdysseyPromotionStone() {
  return Math.random() < ODYSSEY_STONE_DROP_CHANCE ? 1 : 0;
}

export const ODYSSEY_MAX_ATTEMPTS = 30;
export const ODYSSEY_REGEN_SECONDS = 60 * 5; // 5분마다 1회 자동 충전(기존 게임 최종 버전)

// ---------------------------------------------------------------------------
// 8. 한 판 해결 — 무상태(stateless). team은 이미 테마 직업 고정 검증 + 포메이션 +
//    장비 보너스까지 적용된 배열이어야 한다(server/index.js 라우트에서 조립).
// ---------------------------------------------------------------------------
export function resolveOdysseyFight({ team, stage }) {
  const theme = themeForStage(stage);
  const invalid = team.some((h) => h.class !== theme.allowedClass);
  if (invalid) throw new Error(`${theme.name}에는 ${CLASSES[theme.allowedClass].label}만 배치할 수 있습니다.`);

  const buffedTeam = applyGiantHpAtkBuff(team, theme);
  const enemy = odysseyEnemy(stage);
  const result = simulateOdysseyFight(buffedTeam, enemy, { timeLimitSeconds: 30 });

  if (!result.win) {
    return { win: false, timedOut: result.timedOut, theme: theme.key, enemy, hits: result.hits, endedAt: result.t };
  }

  const stoneGain = rollOdysseyPromotionStone();
  // 장비 드랍은 equipment.js의 rollOdysseyDrops(스테이지 보정 확률·등급)가 담당 — 여기선 안 굴린다.
  const rolled = [];
  return {
    win: true,
    theme: theme.key,
    enemy,
    hits: result.hits,
    endedAt: result.t,
    droppedItems: rolled,
    stoneGain,
  };
}
