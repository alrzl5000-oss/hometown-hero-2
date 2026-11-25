// ============================================================================
// 게임 2.0 — 장비 개편: 획득처별 세트(8종) × 부위(6칸), 세트 효과, 분해(장비 가루), 제작
// ============================================================================
// 민수님 요청(2026-11-25): "획득처에 따라 장비도 다르고 능력치도 다르게" + 획득처 확대(2),
// 분해/재료(6), 세트 효과(5), 도트 아이콘(7). 능력치 설계는 맡김 → 아래 수치는 전부
// [1차 추정치 — 실측 후 조정].
//
// 설계 원칙
//  · 부위 6칸(무기/머리/갑옷/망토/목걸이/유물), 부위마다 1개만 장착.
//  · 세트 = 획득처. 같은 세트를 2/4/6부위 끼면 세트 효과가 단계별로 추가.
//  · 세트마다 "주력 능력치"가 다르다 — 파밍 세트는 재화, 보스 세트는 화력, 투기장 세트는 생존.
//  · 부위마다 "부위 고유 능력치"가 옵션 풀에 섞이고, 강화하면 그 능력치가 오른다.
//  · 기존 오디세이 장비 6종은 그대로 "영웅의 오디세이" 세트가 된다(옵션 풀·꽝 옵션 유지).
//  · 능력치 단위/범위는 오디세이와 같은 ODYSSEY_STAT_POOL을 공유(팀 전체 버프).
import {
  ODYSSEY_ITEMS, ODYSSEY_STAT_POOL, ODYSSEY_GRADES, ODYSSEY_ITEM_SIGNATURE_STAT,
  odysseyEnhanceSignatureBonus, odysseyEnhanceCost,
} from "./odyssey.js";

export const GRADES = ODYSSEY_GRADES; // rare, epic, unique, legendary

export const SLOTS = [
  { key: "weapon", label: "무기", stat: "atk" },
  { key: "head", label: "머리", stat: "crit" },
  { key: "armor", label: "갑옷", stat: "vit" },
  { key: "cloak", label: "망토", stat: "spd" },
  { key: "necklace", label: "목걸이", stat: "critDmg" },
  { key: "relic", label: "유물", stat: "skillDmg" },
];
export const SLOT_KEYS = SLOTS.map((s) => s.key);
const SLOT_STAT = Object.fromEntries(SLOTS.map((s) => [s.key, s.stat]));

// 세트 = 획득처. pool: 그 세트 장비에 붙을 수 있는 옵션(가중치), bonus: 2/4/6세트 효과.
export const SETS = {
  field: {
    name: "개척자", source: "파밍", sourceDesc: "필드 잡몹 처치 시 낮은 확률로 떨어져요(자리 비움 중에도)", color: "#8fbf4f",
    focus: "골드 · 경험치 · 다이아 획득", pool: { gold: 3, exp: 3, luck: 2, atkFlat: 1, vitFlat: 1 },
    bonus: { 2: { gold: 8 }, 4: { exp: 10, luck: 4 }, 6: { gold: 15, exp: 15, luck: 8 } },
  },
  floorBoss: {
    name: "정복자", source: "층보스", sourceDesc: "층보스를 이길 때마다 1개 확정", color: "#c0c8d8",
    focus: "공격력 · 치명타 피해 · 스킬 피해", pool: { atk: 3, critDmg: 2, skillDmg: 2, defBreak: 1, vit: 1 },
    bonus: { 2: { atk: 5 }, 4: { critDmg: 12 }, 6: { skillDmg: 12, defBreak: 8 } },
  },
  gold: {
    name: "황금", source: "골드 던전", sourceDesc: "골드 던전 승리마다 1개 확정", color: "#f5b33d",
    focus: "골드 획득 · 공격력(고정)", pool: { gold: 4, atkFlat: 2, atk: 1, critDmg: 1 },
    bonus: { 2: { gold: 10 }, 4: { atk: 6 }, 6: { gold: 20, critDmg: 10 } },
  },
  gem: {
    name: "수정", source: "다이아 던전", sourceDesc: "다이아 던전 승리마다 1개 확정", color: "#57c8ff",
    focus: "다이아 획득 · 치명타 · 마나", pool: { luck: 4, crit: 2, spd: 1, manaRegen: 1 },
    bonus: { 2: { luck: 8 }, 4: { crit: 4 }, 6: { luck: 15, manaRegen: 25 } },
  },
  exp: {
    name: "현자", source: "경험치 던전", sourceDesc: "경험치 던전 승리마다 1개 확정", color: "#a996ff",
    focus: "경험치 · 스킬 피해 · 마나", pool: { exp: 4, skillDmg: 2, manaRegen: 1, vit: 1 },
    bonus: { 2: { exp: 10 }, 4: { skillDmg: 10 }, 6: { exp: 18, manaRegen: 20 } },
  },
  dailyBoss: {
    name: "토벌대", source: "일일보스", sourceDesc: "일일보스 도전마다 1개 확정", color: "#e07a5f",
    focus: "치명타 피해 · 적 방어력 감소", pool: { critDmg: 3, defBreak: 2, atk: 2, spd: 1, atkFlat: 1 },
    bonus: { 2: { critDmg: 10 }, 4: { defBreak: 6 }, 6: { atk: 10, spd: 6 } },
  },
  pvp: {
    name: "투기장", source: "PvP 레이팅전", sourceDesc: "레이팅전 승리 시 50% 확률", color: "#ff6b81",
    focus: "체력·방어력 · 공격속도 · 치명타", pool: { vit: 3, vitFlat: 2, spd: 2, crit: 1, atk: 1 },
    bonus: { 2: { vit: 6 }, 4: { spd: 5 }, 6: { vit: 10, crit: 5 } },
  },
  odyssey: {
    name: "영웅의 오디세이", source: "오디세이", sourceDesc: "오디세이 승리 시 그 테마 장비 확정 + 오디세우스의 활 10%", color: "#3fb6a8",
    focus: "테마마다 다른 옵션(꽝 옵션 있음)", pool: null,
    bonus: { 2: { atk: 4 }, 4: { crit: 3, critDmg: 8 }, 6: { skillDmg: 15 } },
  },
};
export const SET_KEYS = Object.keys(SETS);

const NAMES = {
  field: ["개척자의 손도끼", "개척자의 가죽모자", "개척자의 누비옷", "개척자의 여행망토", "개척자의 나침반 목걸이", "개척자의 행운 편자"],
  floorBoss: ["정복자의 대검", "정복자의 투구", "정복자의 판금갑옷", "정복자의 전쟁망토", "정복자의 훈장", "정복자의 전리품 뿔"],
  gold: ["황금 철퇴", "황금 왕관", "황금 흉갑", "황금 망토", "황금 사슬 목걸이", "황금 주머니"],
  gem: ["수정 지팡이", "수정 서클릿", "수정 로브", "수정 날개망토", "수정 펜던트", "수정 구슬"],
  exp: ["현자의 마도서", "현자의 고깔", "현자의 법의", "현자의 별망토", "현자의 부적", "현자의 모래시계"],
  dailyBoss: ["토벌대 장창", "토벌대 철모", "토벌대 사슬갑옷", "토벌대 깃발망토", "토벌 증표", "토벌대 뿔나팔"],
  pvp: ["검투사의 검", "검투사의 투구", "검투사의 흉갑", "검투사의 붉은 망토", "챔피언 메달", "투기장 방패"],
};
// 기존 오디세이 장비 → 부위
export const ODYSSEY_SLOT = { odysseus_bow: "weapon", cyclops_eye: "head", giant_armor: "armor", helios_cloak: "cloak", siren_necklace: "necklace", circe_parrot: "relic" };

// 장비 카탈로그 — key → { set, slot, label, signature }
export const ITEMS = {};
for (const [set, names] of Object.entries(NAMES)) {
  SLOTS.forEach((s, i) => { ITEMS[`${set}_${s.key}`] = { set, slot: s.key, label: names[i], signature: s.stat }; });
}
for (const [key, slot] of Object.entries(ODYSSEY_SLOT)) {
  ITEMS[key] = { set: "odyssey", slot, label: ODYSSEY_ITEMS[key].label, signature: ODYSSEY_ITEM_SIGNATURE_STAT[key] };
}
export const itemDef = (key) => ITEMS[key] || null;
export const slotOf = (key) => ITEMS[key]?.slot || key;
export const setOf = (key) => ITEMS[key]?.set || "odyssey";
export const setItemKeys = (set) => Object.keys(ITEMS).filter((k) => ITEMS[k].set === set);
export const keyFor = (set, slot) => Object.keys(ITEMS).find((k) => ITEMS[k].set === set && ITEMS[k].slot === slot);

// ---------------------------------------------------------------------------
// 등급 확률 — 획득처마다 기준 단계(tier)와 보정(boost)이 다르다.
// tier 1 → 250으로 갈수록 상위 등급 비중이 커진다(오디세이와 같은 곡선 모양).
// ---------------------------------------------------------------------------
export const SOURCE_BOOST = { field: 0.6, floorBoss: 1.4, gold: 1.1, gem: 1.1, exp: 1.1, dailyBoss: 1.4, pvp: 1.2 };
export function gradeWeights(tier, boost = 1) {
  const t = Math.min(1, Math.max(0, ((tier || 1) - 1) / 249));
  const epic = (4 + 12 * t) * boost;
  const unique = (0.5 + 4.5 * t) * boost;
  const legendary = (0.02 + 1.48 * t) * boost;
  return { rare: Math.max(0, 100 - epic - unique - legendary), epic, unique, legendary };
}
export const CRAFT_WEIGHTS = { rare: 55, epic: 33, unique: 10, legendary: 2 };
function pickGrade(weights, rng) {
  const total = GRADES.reduce((s, g) => s + weights[g], 0);
  let r = rng() * total;
  for (const g of GRADES) { r -= weights[g]; if (r < 0) return g; }
  return GRADES[0];
}

// 옵션 줄 수 — 오디세이 외 세트는 등급이 높을수록 줄이 많다(꽝 옵션 없음).
const LINE_COUNT = { rare: [1, 1], epic: [1, 2], unique: [2, 2], legendary: [3, 3] };
function poolFor(set, slot) {
  const base = { ...SETS[set].pool };
  const st = SLOT_STAT[slot];
  base[st] = (base[st] || 0) + 1.5; // 부위 고유 능력치가 조금 더 잘 나온다
  return Object.entries(base).map(([statKey, weight]) => ({ statKey, weight }));
}
function rollValue(statKey, grade, rng) {
  const [min, max] = ODYSSEY_STAT_POOL[statKey].range[grade];
  return Math.round((min + rng() * (max - min)) * 10) / 10;
}
export function rollLines(set, slot, grade, rng = Math.random) {
  const pool = poolFor(set, slot);
  const [lo, hi] = LINE_COUNT[grade];
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  const used = new Set();
  const lines = [];
  for (let i = 0; i < n; i++) {
    const cand = pool.filter((p) => !used.has(p.statKey));
    if (!cand.length) break;
    let r = rng() * cand.reduce((s, p) => s + p.weight, 0);
    let pick = cand[cand.length - 1];
    for (const c of cand) { r -= c.weight; if (r < 0) { pick = c; break; } }
    used.add(pick.statKey);
    lines.push({ statKey: pick.statKey, value: rollValue(pick.statKey, grade, rng), isDud: false });
  }
  return lines;
}

// 세트 장비 1개 굴리기 — slot 생략 시 6부위 중 무작위.
export function rollSetItem(set, { tier = 1, slot = null, grade = null, rng = Math.random } = {}) {
  if (!SETS[set] || set === "odyssey") throw new Error(`굴릴 수 없는 세트: ${set}`);
  const s = slot || SLOT_KEYS[Math.floor(rng() * SLOT_KEYS.length)];
  if (!SLOT_KEYS.includes(s)) throw new Error(`알 수 없는 부위: ${slot}`);
  const g = grade || pickGrade(gradeWeights(tier, SOURCE_BOOST[set] || 1), rng);
  return { key: keyFor(set, s), grade: g, lines: rollLines(set, s, g, rng) };
}
export function craftItem(set, slot, rng = Math.random) {
  const grade = pickGrade(CRAFT_WEIGHTS, rng);
  return rollSetItem(set, { slot, grade, rng });
}

// 파밍 드랍 — 처치 수에 비례(기대값), 한 번 정산에 최대 FIELD_DROP_CAP개.
export const FIELD_DROP_PER_KILL = 0.0008;
export const FIELD_DROP_CAP = 15;
export function fieldDropCount(kills, rng = Math.random) {
  const exp = Math.max(0, kills) * FIELD_DROP_PER_KILL;
  return Math.min(FIELD_DROP_CAP, Math.floor(exp) + (rng() < exp - Math.floor(exp) ? 1 : 0));
}
export const PVP_DROP_CHANCE = 0.5;

// ---------------------------------------------------------------------------
// 분해 · 강화 · 제작 — 재료는 "장비 가루" 한 가지.
// ---------------------------------------------------------------------------
export const DISMANTLE_DUST = { rare: 2, epic: 6, unique: 20, legendary: 70 };
const ENHANCE_DUST_BASE = { rare: 1, epic: 3, unique: 8, legendary: 20 };
// 강화 비용: 골드(기존 곡선 그대로) + 장비 가루(다이아 대신 — 다이아는 소환에 쓰도록)
export function enhanceCost(grade, level) {
  return { gold: odysseyEnhanceCost(grade, level).gold, dust: Math.ceil((ENHANCE_DUST_BASE[grade] || 1) * Math.pow(1.25, level)) };
}
// 분해 보상 = 등급 기본 가루 + 강화에 쓴 가루의 절반 환급
export function dismantleValue(item) {
  let spent = 0;
  for (let l = 0; l < (item.enhance || 0); l++) spent += enhanceCost(item.grade, l).dust;
  return { dust: (DISMANTLE_DUST[item.grade] || 0) + Math.floor(spent / 2) };
}
export const CRAFT_COST = { gold: 200000, dust: 60 };

// ---------------------------------------------------------------------------
// 장착 효과 합산 — 옵션 줄 + 강화(부위 고유 능력치) + 세트 효과
// ---------------------------------------------------------------------------
const SUM_KEYS = ["atk", "spd", "vit", "crit", "luck", "critDmg", "gold", "exp", "skillDmg", "manaRegen", "atkFlat", "vitFlat", "defBreak"];
export function enhanceBonus(key, grade, level) {
  if (ODYSSEY_SLOT[key]) return odysseyEnhanceSignatureBonus(key, grade, level);
  const def = ITEMS[key];
  if (!def) return null;
  // 오디세이 강화 곡선을 그대로 쓰되, 능력치 종류만 부위 고유 능력치로
  const ref = { atk: "helios_cloak", crit: "siren_necklace", vit: "giant_armor", spd: "circe_parrot", critDmg: "odysseus_bow", skillDmg: "odysseus_bow" }[def.signature];
  const b = odysseyEnhanceSignatureBonus(ref, grade, level);
  return b ? { statKey: def.signature, value: b.value } : null;
}
export function setCounts(items) {
  const c = {};
  for (const it of items) if (it && it.equipped) { const s = setOf(it.key); c[s] = (c[s] || 0) + 1; }
  return c;
}
export function activeSetBonuses(items) {
  const out = [];
  for (const [set, n] of Object.entries(setCounts(items))) {
    for (const need of [2, 4, 6]) if (n >= need && SETS[set]?.bonus[need]) out.push({ set, need, delta: SETS[set].bonus[need] });
  }
  return out;
}
export function equipmentBonusSums(items) {
  const sums = Object.fromEntries(SUM_KEYS.map((k) => [k, 0]));
  for (const item of items || []) {
    if (!item || !item.equipped) continue;
    for (const line of item.lines || []) {
      if (!line || line.isDud || !(line.statKey in sums)) continue;
      sums[line.statKey] += Number(line.value) || 0;
    }
    const sig = enhanceBonus(item.key, item.grade, item.enhance || 0);
    if (sig && sig.value && sig.statKey in sums) sums[sig.statKey] += sig.value;
  }
  for (const b of activeSetBonuses(items)) for (const [k, v] of Object.entries(b.delta)) if (k in sums) sums[k] += v;
  for (const k of SUM_KEYS) sums[k] = Math.round(sums[k] * 10) / 10;
  return sums;
}

// 화면용 메타(함수 없는 순수 데이터)
export const EQUIPMENT_META = {
  slots: SLOTS, sets: SETS, setKeys: SET_KEYS, items: ITEMS, dismantleDust: DISMANTLE_DUST, craftCost: CRAFT_COST,
  craftWeights: CRAFT_WEIGHTS, fieldDropPerKill: FIELD_DROP_PER_KILL, pvpDropChance: PVP_DROP_CHANCE,
};
