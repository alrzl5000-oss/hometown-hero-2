// ============================================================================
// 게임 2.0 — 스테이지 시스템: "필드 → 보스" 개념 (세븐나이츠 키우기 참고)
// ============================================================================
// 민수님 결정: 스테이지 방식을 세븐나이츠 키우기 참고해서 "필드(잡몹 웨이브, 빠르게
// 처치하고 재화 획득) → 보스(그 스테이지를 실제로 막는 진짜 관문, 스킬 2개 갖춘 진짜
// 전투)" 2단계 구조로 바꾼다. 기존 라이브 게임은 스테이지마다 그냥 "전투 1회"였는데,
// 이번엔 같은 전투(안 쉬고 이어짐 — 필드에서 입은 피해/소모한 버프 지속시간이 보스전까지
// 그대로 이어짐)를 두 단계로 나눠서 "필드는 쉽게 훑고 보스에서 진짜 긴장감"을 만든다.
//
// 구현: server/lib/combat.js의 simulateGauntlet(playerTeam, [필드웨이브, 보스])를 그대로
// 사용 — 새 전투 로직을 따로 만들지 않고 이미 만들어둔 엔진을 재사용한다.
import { RARITY_UNIT } from "./characters.js";

// ---------------------------------------------------------------------------
// 1. 챕터/스테이지 번호 체계
// ---------------------------------------------------------------------------
export const STAGES_PER_CHAPTER = 10;

export function chapterOf(stageNumber) {
  return Math.floor((stageNumber - 1) / STAGES_PER_CHAPTER) + 1;
}
export function stageLabel(stageNumber) {
  const chapter = chapterOf(stageNumber);
  const inChapter = ((stageNumber - 1) % STAGES_PER_CHAPTER) + 1;
  return `${chapter}-${inChapter}`; // 예: 1-1, 1-10, 2-1 ...
}

// ---------------------------------------------------------------------------
// 2. 난이도 곡선 — [1차 추정치, 실측 필요] 스테이지당 +5%(지수 성장).
// ---------------------------------------------------------------------------
// 레퍼런스: 100스테이지를 넘기면 필드 몬스터 파워가 1.05^100≈131배로 커지는데, 이게
// characters.js의 RARITY_UNIT.N(88.6)->RARITY_UNIT.EX(10193.7) 전체 상승폭(약 115배)과
// 거의 맞아떨어진다 — "스테이지 100 정도를 넘기면 로스터 등급 전체 범위를 다 쓴 셈"이라는
// 감각적 기준점으로 잡았다. BASE_FIELD_UNIT은 RARITY_UNIT.N보다 낮게 잡아서(0.3배) 1스테이지는
// 신규 유저가 막 뽑은 N등급 팀으로도 가볍게 넘어가도록 했다.
export const FIELD_GROWTH_RATE = 1.05;
export const BASE_FIELD_UNIT = RARITY_UNIT.N * 0.12;
export const BOSS_POWER_MULT = 4; // 보스 1체 = 그 스테이지 필드 몬스터 1체의 4배 파워
export const FIELD_WAVE_SIZE = 3; // 필드 웨이브당 몬스터 수(고정 — 챕터가 올라가도 수는 안 늘림, 파워만 올라감)

function monsterUnit(stageNumber) {
  return BASE_FIELD_UNIT * Math.pow(FIELD_GROWTH_RATE, stageNumber - 1);
}

// ---------------------------------------------------------------------------
// 3. 필드 몬스터 — 빠르게 치고 지나가는 잡몹. 스킬 없음(또는 아주 가벼운 평타만).
// ---------------------------------------------------------------------------
const FIELD_RATIO = { atk: 1.0, hp: 2.0, def: 0.8 };

export function makeFieldMonster(stageNumber, slot) {
  const unit = monsterUnit(stageNumber);
  return {
    characterId: `field-${stageNumber}-${slot}`,
    name: `필드 몬스터 ${stageLabel(stageNumber)}-${slot + 1}`,
    role: "monster",
    atk: Math.round(unit * FIELD_RATIO.atk),
    hp: Math.round(unit * FIELD_RATIO.hp * 8),
    def: Math.round(unit * FIELD_RATIO.def),
    mana: 100,
    spd: 1.0,
    critRate: 0.05,
    critDmg: 1.4,
    pen: 0,
    res: 0,
    skills: [], // 필드 몹은 스킬 없이 평타만 — 빠르게 처치되는 "통행료" 역할
  };
}

export function makeFieldWave(stageNumber) {
  return Array.from({ length: FIELD_WAVE_SIZE }, (_, slot) => makeFieldMonster(stageNumber, slot));
}

// ---------------------------------------------------------------------------
// 4. 보스 — 그 스테이지의 "진짜" 관문. 필드 몬스터보다 BOSS_POWER_MULT배 강하고, 스킬을
//    2개(필살기 + 상태이상류 1개) 갖춰서 플레이어가 전략을 써야 하는 전투를 만든다.
//    세븐나이츠 키우기의 "기절/감전 등 상태이상으로 보스를 막아야 한다"는 공략 포인트를
//    참고해, 보스의 두 번째 스킬은 CC/디버프 위주 풀에서 뽑는다.
// ---------------------------------------------------------------------------
const BOSS_RATIO = { atk: 1.2, hp: 5.0, def: 1.5 }; // 몸집이 크고 오래 버티는 쪽으로

const BOSS_SKILL_POOL = [
  { key: "boss_stun", name: "포효", kind: "stunAll", stunDuration: 1.0, manaCostBase: 60 },
  { key: "boss_debuffdef", name: "약점 노출", kind: "debuffDef", reduction: 0.25, buffDuration: 5, manaCostBase: 35 },
  { key: "boss_debuffspd", name: "속박의 울음", kind: "debuffSpd", spdReduction: 0.2, buffDuration: 5, manaCostBase: 35 },
  { key: "boss_dispel", name: "기세 억누름", kind: "dispel", manaCostBase: 55 },
  { key: "boss_shield", name: "비늘 강화", kind: "shieldHits", shieldCharges: 2, manaCostBase: 60 },
];

function hashIndex(id, len) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % len;
}

export function makeBossMonster(stageNumber) {
  const unit = monsterUnit(stageNumber) * BOSS_POWER_MULT;
  const secondary = BOSS_SKILL_POOL[hashIndex(`boss:${stageNumber}`, BOSS_SKILL_POOL.length)];
  const secondarySkill = { key: secondary.key, kind: secondary.kind, manaCost: secondary.manaCostBase, passive: false };
  for (const field of ["stunDuration", "reduction", "buffDuration", "spdReduction", "shieldCharges"]) {
    if (secondary[field] !== undefined) secondarySkill[field] = secondary[field];
  }
  return {
    characterId: `boss-${stageNumber}`,
    name: `${stageLabel(stageNumber)} 보스 — ${secondary.name}`,
    role: "monster",
    atk: Math.round(unit * BOSS_RATIO.atk),
    hp: Math.round(unit * BOSS_RATIO.hp * 8),
    def: Math.round(unit * BOSS_RATIO.def),
    mana: 100,
    spd: 0.9,
    critRate: 0.1,
    critDmg: 1.5,
    pen: 0.1,
    res: 0.2, // 보스는 플레이어 쪽 CC에 어느 정도 저항
    skills: [
      { key: "boss_burst", kind: "burst", burstMult: 3.0, manaCost: 45 },
      secondarySkill,
    ],
  };
}

// ---------------------------------------------------------------------------
// 5. 스테이지 전체 구성 — simulateGauntlet(playerTeam, phases)에 바로 넘길 수 있는
//    phases 배열([필드 웨이브, 보스])을 만든다.
// ---------------------------------------------------------------------------
export function buildStagePhases(stageNumber) {
  return [makeFieldWave(stageNumber), [makeBossMonster(stageNumber)]];
}

export function stageInfo(stageNumber) {
  return {
    stageNumber,
    label: stageLabel(stageNumber),
    chapter: chapterOf(stageNumber),
    fieldMonsterPower: Math.round(monsterUnit(stageNumber)),
    bossPower: Math.round(monsterUnit(stageNumber) * BOSS_POWER_MULT),
  };
}
