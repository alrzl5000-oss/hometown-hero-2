// ============================================================================
// 게임 2.0 — 캐릭터 데이터 (102종 포팅)
// ============================================================================
// 기존 라이브 게임(`alrzl5000-oss/minsu100`)의 `characters.js`(102종 로스터)를
// 2.0의 새 스탯(MANA/PEN/RES)·새 전투 엔진(server/lib/combat.js, 스킬별 독립
// 게이지)으로 포팅한 결과. 민수님 결정 사항(claude/game2-roster-port.md):
//   - 로스터(이름/희귀도)는 "그대로" 유지
//   - 직업군 분포만 골고루 되도록 N등급 5명만 재배치
//     (h01/h25/h64 tanker→support, h04/h41 dealer→assassin)
// 레벨/등급 성장 상한은 이번 포팅에서 2.0 기준으로 새로 확정한다(기존 게임은
// 등급별 레벨캡이 15~40이었지만, 2.0은 server/data/stats.js의 방어력 레퍼런스
// (EX 등급, 레벨60 탱커 기준 방어력 60,000)에 맞춰 레벨캡을 재설계했다).
//
// 기존 게임과의 핵심 차이 — "항상 스킬 2개":
// 기존 게임은 EX(프레스티지 승급)에 도달해야만 두 번째 스킬을 얻었고, 그마저도
// 게이지를 공유해 번갈아 발동해야 했다. 2.0 엔진은 스킬별 독립 게이지라 여러 개를
// 동시에 들고 있어도 자원 경합이 없으므로, 이번 포팅에서 **모든 등급의 모든
// 캐릭터**에게 스킬을 2개(직업 공통 "주 스킬" + 캐릭터별 "보조 스킬") 배정한다 —
// 세븐나이츠 키우기 참고 스킬 다양성 요구사항을 등급 상한 없이 로스터 전체에
// 적용한 것이다.

import { DEF_REFERENCE } from "./stats.js";

// ---------------------------------------------------------------------------
// 1. 직업(class) 정의 — 기존 게임의 ratio/spd/crit은 "그대로" 유지하고,
//    신규 스탯(mana/pen/res) 기본값만 새로 설계한다.
// ---------------------------------------------------------------------------
export const CLASSES = {
  tanker: {
    label: "탱커",
    ratio: { atk: 0.4, hp: 2.8, def: 2.7 },
    spd: 0.75,
    critRate: 0.05,
    critDmg: 1.4,
    mana: 100,
    pen: 0.05,
    res: 0.35, // 체급형 — CC에도 어느 정도 버틴다
    primaryKind: "buffDef",
  },
  dealer: {
    label: "딜러",
    ratio: { atk: 1.3, hp: 1.4, def: 1.0 },
    spd: 1.5,
    critRate: 0.1,
    critDmg: 1.6,
    mana: 100,
    pen: 0.1,
    res: 0.15,
    primaryKind: "burst",
  },
  ranged: {
    label: "원거리 딜러",
    ratio: { atk: 1.65, hp: 0.55, def: 0.5 },
    spd: 1.15,
    critRate: 0.15,
    critDmg: 1.7,
    mana: 95,
    pen: 0.2, // 관통 특화 — "방어 무시" 아키타입
    res: 0.1,
    primaryKind: "burst",
  },
  assassin: {
    label: "암살자",
    ratio: { atk: 0.45, hp: 0.45, def: 0.35 },
    spd: 1.0,
    critRate: 0.3,
    critDmg: 2.2,
    mana: 110, // 게이지가 가장 빨리 돈다 — 글래스 캐논 플레이감
    pen: 0.25,
    res: 0.05,
    primaryKind: "burst",
  },
  support: {
    label: "서포터",
    ratio: { atk: 0.45, hp: 0.65, def: 0.55 },
    spd: 0.85,
    critRate: 0.05,
    critDmg: 1.4,
    mana: 120, // 버프/디버프를 자주 걸 수 있도록 가장 빠름
    pen: 0,
    res: 0.3,
    primaryKind: "heal", // 서포터 = 힐러. buffAtk는 보조 스킬 풀로 내려서 다양성으로 유지.
  },
};

// 직업 공통 "주 스킬" 틀 — manaCost는 개별 캐릭터의 costJitter로 흔들린다.
const PRIMARY_SKILL_BASE = {
  tanker: { kind: "buffDef", buffReduction: 0.3, buffDuration: 4, manaCostBase: 45 },
  dealer: { kind: "burst", burstMult: 2.4, manaCostBase: 45 },
  ranged: { kind: "burst", burstMult: 3.0, manaCostBase: 45 },
  assassin: { kind: "burst", burstMult: 9.0, manaCostBase: 55 },
  support: { kind: "heal", healMult: 1.3, manaCostBase: 40 },
};

// ---------------------------------------------------------------------------
// 2. 희귀도(rarity) — 등급 체계는 기존 게임을 그대로 유지(N/R/SR/SSR/XR/XXR/HR/EX).
//    레벨캡/파워유닛은 2.0 기준으로 새로 확정.
// ---------------------------------------------------------------------------
export const RARITIES = ["N", "R", "SR", "SSR", "XR"]; // 정상 승급 체인(기존과 동일)

// 레벨캡 — EX를 2.0의 "최종 레퍼런스"(레벨 60)로 두고, 나머지는 기존 게임과 같은
// 상대적 서열(HR·XXR이 XR과 비슷하거나 살짝 위, EX는 별도 프레스티지)을 유지한다.
export const LEVEL_CAP = { N: 15, R: 25, SR: 35, SSR: 45, XR: 55, HR: 55, XXR: 58, EX: 60 };

// 등급별 스킬 위력 배율 — 기존 게임 값을 그대로 이식(이미 검증된 체감 곡선).
export const RARITY_SKILL_MULT = { N: 1.0, R: 1.1, SR: 1.25, SSR: 1.45, HR: 1.9, XR: 1.7, XXR: 2.0, EX: 2.3 };

// 등급별 파워 유닛 — 기존 게임과 같은 상대 비율(한 단계당 약 2.2배)을 유지하되,
// 전체 스케일(GLOBAL_UNIT_SCALE)은 아래에서 stats.js의 방어력 레퍼런스에 맞춰 역산한다.
const RARITY_UNIT_SHAPE = { N: 20, R: 45, SR: 100, SSR: 220, HR: 1000, XR: 480, XXR: 1050, EX: 2300 };

// 레벨당 성장률 — 완만한 선형 성장(레벨당 +2%). 성장 상한에서 등급 차이가 압도적으로
// 벌어지지 않도록 지수형이 아니라 선형으로 잡았다.
const LEVEL_GROWTH_PER_LEVEL = 0.02;
function levelMult(level) {
  return 1 + LEVEL_GROWTH_PER_LEVEL * (Math.max(1, level) - 1);
}

// [레퍼런스 역산] EX 등급·레벨 60·탱커 class의 def가 정확히 stats.js의
// DEF_REFERENCE.refDef(60,000)가 되도록 GLOBAL_UNIT_SCALE을 고정한다 — "반응적으로
// K를 낮추는" 옛 방식과 반대로, 레퍼런스를 먼저 고정하고 나머지를 거기 맞춘다.
const REF_LEVEL = 60;
const GLOBAL_UNIT_SCALE =
  DEF_REFERENCE.refDef / (RARITY_UNIT_SHAPE.EX * CLASSES.tanker.ratio.def * levelMult(REF_LEVEL));

export const RARITY_UNIT = Object.fromEntries(
  Object.entries(RARITY_UNIT_SHAPE).map(([k, v]) => [k, v * GLOBAL_UNIT_SCALE])
);

export function baseStatsFor(rarity, cls, level) {
  const unit = RARITY_UNIT[rarity];
  const r = CLASSES[cls].ratio;
  const m = levelMult(level);
  return {
    atk: Math.round(unit * r.atk * m),
    hp: Math.round(unit * r.hp * m * 8), // hp는 체감상 atk/def보다 훨씬 커야 자연스러움(기존 게임과 동일한 ×8 보정)
    def: Math.round(unit * r.def * m),
  };
}

// ---------------------------------------------------------------------------
// 3. 결정론적 해시 — 캐릭터 id 기반으로 매번 같은 값을 재현(기존 게임의
//    hashIndex/jitterFor와 동일한 패턴).
// ---------------------------------------------------------------------------
function hashIndex(id, len) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % len;
}
// ±8% 결정론적 편차 — 같은 직업/등급이어도 캐릭터마다 수치가 살짝 다르게.
function jitterFor(seed) {
  return 1 + (hashIndex(seed + ":jitter", 21) - 10) / 10 * 0.08;
}
// 주 스킬의 manaCost 편차(-20%~+20%) — "저비용 속사형 vs 고비용 한방형" 트레이드오프.
// 코스트가 높을수록 POWER_SCALE_PASSTHROUGH 비율로 위력도 함께 커진다(그냥 손해만 보지 않도록).
const POWER_SCALE_PASSTHROUGH = 0.85;
function costRatioFor(seed) {
  const bucket = hashIndex(seed + ":cost", 21) - 10; // -10..+10
  return 1 + (bucket / 10) * 0.2; // 0.8 ~ 1.2
}

// ---------------------------------------------------------------------------
// 4. 보조 스킬 풀 — 직업별로 다른 스킬 kind를 모아둔 풀에서 캐릭터마다 결정론적으로
//    하나씩 배정한다. 기존 게임의 EX_SKILL_TEMPLATES(EX 승급 전용)를 "모든 등급"으로
//    확장한 것 — 세븐나이츠 키우기 리서치 기반 신규 kind를 적극 활용한다.
// ---------------------------------------------------------------------------
export const SECONDARY_SKILL_TEMPLATES = {
  tanker: [
    { key: "tanker_shield", skillName: "철벽 보호막", skill: { kind: "shieldHits", shieldCharges: 2, manaCostBase: 60 } },
    { key: "tanker_immortal", skillName: "불굴의 의지", skill: { kind: "tempImmortal", duration: 3, manaCostBase: 85 } },
    { key: "tanker_taunt", skillName: "도발의 함성", skill: { kind: "tauntOnHit", tauntDuration: 4, manaCostBase: 40 } },
    { key: "tanker_stun", skillName: "대지 진동", skill: { kind: "stunAll", stunDuration: 1.2, manaCostBase: 70 } },
    { key: "tanker_ccimmune", skillName: "철벽 사기", skill: { kind: "ccImmunity", duration: 4, manaCostBase: 55 } },
    { key: "tanker_debuffdef", skillName: "약점 파악", skill: { kind: "debuffDef", reduction: 0.2, buffDuration: 5, manaCostBase: 35 } },
  ],
  dealer: [
    { key: "dealer_execute", skillName: "결정타", skill: { kind: "executeChance", executeChance: 0.06, manaCostBase: 80 } },
    { key: "dealer_critdmg", skillName: "전열 집중", skill: { kind: "buffCritDmg", buffBonus: 0.3, buffDuration: 5, manaCostBase: 30 } },
    { key: "dealer_dispel", skillName: "기세 제압", skill: { kind: "dispel", manaCostBase: 55 } },
    { key: "dealer_debuffdef", skillName: "틈새 공략", skill: { kind: "debuffDef", reduction: 0.18, buffDuration: 5, manaCostBase: 35 } },
    { key: "dealer_typebonus", skillName: "거구 사냥꾼", skill: { kind: "typeBonusDmg", targetRole: "tanker", bonusMult: 1.3, passive: true } },
    { key: "dealer_manaburn", skillName: "기력 소모", skill: { kind: "manaBurn", burnAmount: 25, manaCostBase: 30 } },
  ],
  ranged: [
    { key: "ranged_execute", skillName: "심장 관통", skill: { kind: "executeChance", executeChance: 0.07, manaCostBase: 85 } },
    { key: "ranged_manadrain", skillName: "기력 흡수탄", skill: { kind: "manaDrain", drainAmount: 20, manaCostBase: 35 } },
    { key: "ranged_debuffspd", skillName: "다리 저격", skill: { kind: "debuffSpd", spdReduction: 0.2, buffDuration: 5, manaCostBase: 30 } },
    { key: "ranged_buffcrit", skillName: "조준 보정", skill: { kind: "buffCrit", buffBonus: 0.25, buffDuration: 5, manaCostBase: 25 } },
    { key: "ranged_typebonus", skillName: "중갑 저격수", skill: { kind: "typeBonusDmg", targetRole: "tanker", bonusMult: 1.35, passive: true } },
    { key: "ranged_reflect", skillName: "매의 눈", skill: { kind: "executeReflectChance", executeReflectChance: 0.35, passive: true } },
  ],
  assassin: [
    { key: "assassin_execute", skillName: "필멸의 급소", skill: { kind: "executeChance", executeChance: 0.09, manaCostBase: 70 } },
    { key: "assassin_manadrain", skillName: "생기 흡수", skill: { kind: "manaDrain", drainAmount: 25, manaCostBase: 30 } },
    { key: "assassin_debuffspd", skillName: "발목 절단", skill: { kind: "debuffSpd", spdReduction: 0.18, buffDuration: 5, manaCostBase: 30 } },
    { key: "assassin_critdmg", skillName: "약점 간파", skill: { kind: "buffCritDmg", buffBonus: 0.35, buffDuration: 5, manaCostBase: 30 } },
    { key: "assassin_immortal", skillName: "그림자 은신", skill: { kind: "tempImmortal", duration: 1.0, manaCostBase: 60 } },
    { key: "assassin_manaburn", skillName: "숨통 조르기", skill: { kind: "manaBurn", burnAmount: 30, manaCostBase: 25 } },
  ],
  support: [
    { key: "support_buffatk", skillName: "사기 고양", skill: { kind: "buffAtk", buffBonus: 0.4, buffDuration: 5, manaCostBase: 40 } },
    { key: "support_buffcrit", skillName: "통찰의 기도", skill: { kind: "buffCrit", buffBonus: 0.25, buffDuration: 5, manaCostBase: 25 } },
    { key: "support_cooldown", skillName: "가속의 축복", skill: { kind: "cooldownReduce", manaRegenBonus: 0.3, buffDuration: 5, manaCostBase: 35 } },
    { key: "support_dispel", skillName: "정화의 빛", skill: { kind: "dispel", manaCostBase: 50 } },
    { key: "support_debuffspd", skillName: "속박의 사슬", skill: { kind: "debuffSpd", spdReduction: 0.18, buffDuration: 5, manaCostBase: 30 } },
    { key: "support_manalock", skillName: "침묵의 굴레", skill: { kind: "manaLock", lockDuration: 3, manaCostBase: 40 } },
    { key: "support_revive", skillName: "생명의 기도", skill: { kind: "revive", manaCostBase: 90 } },
    { key: "support_ccimmune", skillName: "수호의 결계", skill: { kind: "ccImmunity", duration: 4, manaCostBase: 50 } },
  ],
};

// 퍼센트형(비율 감소) 필드 — 과도하게 커지지 않도록 수렴 곡선으로 상한을 둔다
// (기존 게임의 characterSkillFor와 동일한 방식).
const CAP_FIELD_BY_KIND = { buffDef: { field: "buffReduction", cap: 0.6 }, debuffDef: { field: "reduction", cap: 0.35 } };
const SCALE_FIELD_BY_KIND = {
  burst: "burstMult",
  heal: "healMult",
  buffAtk: "buffBonus",
  buffCrit: "buffBonus",
  buffCritDmg: "buffBonus",
  buffSpd: "buffBonus",
  buffNormalAtk: "buffBonus",
  debuffSpd: "spdReduction",
  shieldHits: "shieldCharges",
  tempImmortal: "duration",
  tauntOnHit: "tauntDuration",
  stunAll: "stunDuration",
  cooldownReduce: "manaRegenBonus",
  ccImmunity: "duration",
  manaBurn: "burnAmount",
  manaLock: "lockDuration",
  manaDrain: "drainAmount",
};

function fieldForKind(kind) {
  const capInfo = CAP_FIELD_BY_KIND[kind];
  return capInfo ? capInfo.field : SCALE_FIELD_BY_KIND[kind];
}

function scaleMagnitude(kind, baseValue, rarityMult, powerRatio, jitter) {
  const capInfo = CAP_FIELD_BY_KIND[kind];
  if (capInfo) {
    const exponent = rarityMult * powerRatio * jitter;
    const value = capInfo.cap * (1 - Math.pow(1 - baseValue / capInfo.cap, exponent));
    return Math.round(value * 1000) / 1000;
  }
  const scaled = baseValue * rarityMult * powerRatio * jitter;
  // shieldCharges는 "횟수"라서 소수점이 나오면 의미가 없다 — 정수로 고정(최소 1).
  if (kind === "shieldHits") return Math.max(1, Math.round(scaled));
  return Math.round(scaled * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// 5. 캐릭터별 스킬 2개(주 스킬 + 보조 스킬) 생성
// ---------------------------------------------------------------------------
export function skillsForCharacter(characterId, cls, rarity) {
  const rarityMult = RARITY_SKILL_MULT[rarity];

  // 5-1. 주 스킬 — 직업 공통 kind, manaCost/위력만 캐릭터별로 흔든다.
  const primaryBase = PRIMARY_SKILL_BASE[cls];
  const costRatio = costRatioFor(characterId); // 0.8~1.2
  const powerRatio = 1 + (costRatio - 1) * POWER_SCALE_PASSTHROUGH; // 비싼 만큼 세진다
  const jitter1 = jitterFor(`${characterId}:p1`);
  const primaryField = SCALE_FIELD_BY_KIND[primaryBase.kind];
  const primarySkill = {
    key: "primary",
    kind: primaryBase.kind,
    manaCost: Math.round(primaryBase.manaCostBase * costRatio),
    passive: false,
  };
  if (primaryBase.kind === "burst") primarySkill.burstMult = scaleMagnitude("burst", primaryBase.burstMult, rarityMult, powerRatio, jitter1);
  if (primaryBase.kind === "buffDef") {
    primarySkill.buffReduction = scaleMagnitude("buffDef", primaryBase.buffReduction, rarityMult, powerRatio, jitter1);
    primarySkill.buffDuration = primaryBase.buffDuration;
  }
  if (primaryBase.kind === "buffAtk") {
    primarySkill.buffBonus = scaleMagnitude("buffAtk", primaryBase.buffBonus, rarityMult, powerRatio, jitter1);
    primarySkill.buffDuration = primaryBase.buffDuration;
  }
  if (primaryBase.kind === "heal") {
    primarySkill.healMult = scaleMagnitude("heal", primaryBase.healMult, rarityMult, powerRatio, jitter1);
  }

  // 5-2. 보조 스킬 — characterId 해시로 풀에서 하나 결정론적으로 선택.
  const pool = SECONDARY_SKILL_TEMPLATES[cls];
  const template = pool[hashIndex(`${characterId}:secondary`, pool.length)];
  const jitter2 = jitterFor(`${characterId}:p2`);
  const secondaryBase = template.skill;
  const secondarySkill = { key: template.key, skillName: template.skillName, kind: secondaryBase.kind, passive: !!secondaryBase.passive };
  if (!secondarySkill.passive) {
    const costRatio2 = costRatioFor(`${characterId}:secondary-cost`);
    secondarySkill.manaCost = Math.round(secondaryBase.manaCostBase * rarityMult * 0.7 * costRatio2); // 등급이 높을수록 코스트도 소폭 증가(위력에 맞춰)
  }
  const secondaryField = fieldForKind(secondarySkill.kind);
  if (secondaryField && secondaryBase[secondaryField] !== undefined) {
    secondarySkill[secondaryField] = scaleMagnitude(secondarySkill.kind, secondaryBase[secondaryField], rarityMult, 1, jitter2);
  }
  // buffDuration/until 계산에 쓰이는 지속시간 — 템플릿에 있으면 그대로 옮긴다(등급/편차로
  // 흔들지 않음 — 수치는 위에서 이미 흔들렸고 지속시간까지 흔들면 밸런스 예측이 너무 어려워짐).
  if (secondaryBase.buffDuration !== undefined) secondarySkill.buffDuration = secondaryBase.buffDuration;
  if (secondarySkill.kind === "typeBonusDmg") {
    secondarySkill.targetRole = secondaryBase.targetRole;
    secondarySkill.bonusMult = secondaryBase.bonusMult; // 패시브 고정 배율(등급 스케일 없음 — 상시 발동이라 너무 세지면 위험)
  }
  if (secondarySkill.kind === "executeReflectChance") {
    secondarySkill.executeReflectChance = secondaryBase.executeReflectChance; // 고정값(기존 게임 "매의 눈"과 동일한 설계 원칙)
  }

  return [primarySkill, secondarySkill];
}

// ---------------------------------------------------------------------------
// 6. 로스터 — 기존 102종(id/name/rarity 그대로), class는 재배치 반영
//    (h01/h25/h64 tanker→support, h04/h41 dealer→assassin).
// ---------------------------------------------------------------------------
const ELEMENTS = ["fire", "wind", "water"];

const ROSTER_RAW = [
  { id: "h01", name: "이재훈", class: "support", rarity: "N" }, // 재배치: tanker→support
  { id: "h02", name: "조승현", class: "ranged", rarity: "N" },
  { id: "h03", name: "박주환", class: "tanker", rarity: "N" },
  { id: "h04", name: "20대조청월", class: "assassin", rarity: "N" }, // 재배치: dealer→assassin
  { id: "h05", name: "30대조청월", class: "tanker", rarity: "R" },
  { id: "h06", name: "백민수", class: "assassin", rarity: "N" },
  { id: "h07", name: "진기한", class: "support", rarity: "N" },
  { id: "h08", name: "서울채명기", class: "support", rarity: "N" },
  { id: "h09", name: "부산채명기", class: "assassin", rarity: "R" },
  { id: "h10", name: "유부남박주환", class: "tanker", rarity: "SSR" },
  { id: "h11", name: "헝그리이재훈", class: "tanker", rarity: "SSR" },
  { id: "h12", name: "마이크를든백민수", class: "ranged", rarity: "SSR" },
  { id: "h13", name: "프로샌딩맨조승현", class: "assassin", rarity: "SSR" },
  { id: "h14", name: "한찬영", class: "support", rarity: "N" },
  { id: "h15", name: "김유창", class: "dealer", rarity: "N" },
  { id: "h16", name: "분노한김유창", class: "dealer", rarity: "SR" },
  { id: "h17", name: "아주분노한김유창", class: "dealer", rarity: "SSR" },
  { id: "h18", name: "화순채명기", class: "ranged", rarity: "SSR" },
  { id: "h19", name: "왕산진기한", class: "support", rarity: "SSR" },
  { id: "h20", name: "매산고조승현", class: "dealer", rarity: "R" },
  { id: "h21", name: "칼잡이백민수", class: "dealer", rarity: "R" },
  { id: "h22", name: "홈리스이재훈", class: "ranged", rarity: "R" },
  { id: "h23", name: "상근조청월", class: "ranged", rarity: "SR" },
  { id: "h24", name: "노래방박주환", class: "tanker", rarity: "R" },
  { id: "h25", name: "방패병 고든", class: "support", rarity: "N" }, // 재배치: tanker→support
  { id: "h26", name: "철벽용사 브루토", class: "tanker", rarity: "R" },
  { id: "h27", name: "대지의수호자 감마르", class: "tanker", rarity: "SR" },
  { id: "h28", name: "견습궁수 렌", class: "ranged", rarity: "N" },
  { id: "h29", name: "매의눈 시라", class: "ranged", rarity: "R" },
  { id: "h30", name: "폭풍저격수 볼칸", class: "ranged", rarity: "SR" },
  { id: "h31", name: "떠돌이검사 하이든", class: "dealer", rarity: "N" },
  { id: "h32", name: "그림자수련생 묘", class: "assassin", rarity: "N" },
  { id: "h33", name: "야반검객 사슬", class: "assassin", rarity: "R" },
  { id: "h34", name: "독아 리키", class: "assassin", rarity: "R" },
  { id: "h35", name: "어둠의칼날 자하르", class: "assassin", rarity: "SR" },
  { id: "h36", name: "침묵의사신 노아", class: "assassin", rarity: "SR" },
  { id: "h37", name: "견습사제 릴리", class: "support", rarity: "N" },
  { id: "h38", name: "축복의성가대 유나", class: "support", rarity: "R" },
  { id: "h39", name: "운명의점술사 델피네", class: "support", rarity: "SR" },
  { id: "h40", name: "시간의마도사 오르카", class: "support", rarity: "SR" },
  { id: "h41", name: "조승탁탁", class: "assassin", rarity: "N" }, // 재배치: dealer→assassin
  { id: "h42", name: "조봉박", class: "tanker", rarity: "R" },
  { id: "h43", name: "왕십리조승현", class: "ranged", rarity: "N" },
  { id: "h44", name: "거성오피스텔승탁", class: "tanker", rarity: "SR" },
  { id: "h45", name: "리쟈오밍", class: "assassin", rarity: "R" },
  { id: "h46", name: "베스트테스터이재훈", class: "dealer", rarity: "SSR" },
  { id: "h47", name: "줴훈줴훈", class: "support", rarity: "N" },
  { id: "h48", name: "만학도이재훈", class: "tanker", rarity: "N" },
  { id: "h49", name: "그냥청월", class: "dealer", rarity: "N" },
  { id: "h50", name: "돋보기안경청월", class: "support", rarity: "R" },
  { id: "h51", name: "싸이코패스청월", class: "dealer", rarity: "SR" },
  { id: "h52", name: "먼저사과하는조청월", class: "tanker", rarity: "N" },
  { id: "h53", name: "팔씨름박주환", class: "tanker", rarity: "R" },
  { id: "h54", name: "소설왕박주환", class: "support", rarity: "N" },
  { id: "h55", name: "장거리운전한박주환", class: "ranged", rarity: "R" },
  { id: "h56", name: "당진당신박주환", class: "dealer", rarity: "N" },
  { id: "h57", name: "댄싱머신채명기", class: "tanker", rarity: "SR" },
  { id: "h58", name: "양양앞바다채명기", class: "tanker", rarity: "N" },
  { id: "h59", name: "보라카이!채명기", class: "dealer", rarity: "R" },
  { id: "h60", name: "명기이즈그루브맨", class: "support", rarity: "N" },
  { id: "h61", name: "볼링덕후김유창", class: "dealer", rarity: "R" },
  { id: "h62", name: "마린보이김유창", class: "ranged", rarity: "N" },
  { id: "h63", name: "집사김유창", class: "dealer", rarity: "SR" },
  { id: "h64", name: "맛조은유창김", class: "support", rarity: "N" }, // 재배치: tanker→support
  { id: "h65", name: "노예14년백민수", class: "tanker", rarity: "N" },
  { id: "h66", name: "검은자객백민수", class: "assassin", rarity: "SR" },
  { id: "h67", name: "아임낫필리피노", class: "ranged", rarity: "R" },
  { id: "h68", name: "아유하프?백민수", class: "support", rarity: "N" },
  { id: "h69", name: "진기한변호사", class: "support", rarity: "R" },
  { id: "h70", name: "뜸진기한뜸", class: "tanker", rarity: "N" },
  { id: "h71", name: "번개맨진기한", class: "ranged", rarity: "SR" },
  { id: "h72", name: "기한:굵은눈썹의사나이", class: "dealer", rarity: "N" },
  { id: "h73", name: "백인백민수", class: "assassin", rarity: "XR" },
  { id: "h74", name: "리센느", class: "dealer", rarity: "XR" },
  { id: "h75", name: "호프-나홍진", class: "ranged", rarity: "XR" },
  { id: "h76", name: "야무치이재훈-양양의전설", class: "tanker", rarity: "XR" },
  { id: "h77", name: "조선대학교학생", class: "ranged", rarity: "N" },
  { id: "h78", name: "광주시민", class: "assassin", rarity: "N" },
  { id: "h79", name: "순천시민", class: "ranged", rarity: "N" },
  { id: "h80", name: "화순시민", class: "assassin", rarity: "N" },
  { id: "h81", name: "박탈감을느낀조승탁", class: "tanker", rarity: "HR" },
  { id: "h82", name: "재수옴붙은이재훈", class: "assassin", rarity: "HR" },
  { id: "h83", name: "찡얼거리는조찡얼", class: "ranged", rarity: "HR" },
  { id: "h84", name: "머리숱고트박주환", class: "dealer", rarity: "HR" },
  { id: "h85", name: "다크사이트백민수", class: "support", rarity: "HR" },
  { id: "h86", name: "인조인간 18호", class: "assassin", rarity: "SSR" },
  { id: "h87", name: "고죠사토루", class: "ranged", rarity: "SSR" },
  { id: "h88", name: "나루토", class: "dealer", rarity: "SSR" },
  { id: "h89", name: "이치고", class: "dealer", rarity: "SSR" },
  { id: "h90", name: "몽키.D.루피", class: "tanker", rarity: "SSR" },
  { id: "h91", name: "가정교사히트맨리본", class: "ranged", rarity: "SSR" },
  { id: "h92", name: "히비노카프카", class: "tanker", rarity: "SSR" },
  { id: "h93", name: "성진우", class: "assassin", rarity: "SSR" },
  { id: "h94", name: "조승현아니고이승현", class: "support", rarity: "SSR" },
  { id: "h95", name: "재훈이를민박주환(XR)", class: "tanker", rarity: "XR" },
  { id: "h96", name: "비선실세채명기(XR)", class: "dealer", rarity: "XR" },
  { id: "h97", name: "조승현의아이폰6X(XR)", class: "ranged", rarity: "XR" },
  { id: "h98", name: "유창이의고양이마리(XR)", class: "assassin", rarity: "XR" },
  { id: "h99", name: "조청월:내가미안해..(XR)", class: "support", rarity: "XR" },
  { id: "h100", name: "데구치나츠키(XR)", class: "dealer", rarity: "XR" },
  { id: "h101", name: "MINSU-DARKMAN", class: "assassin", rarity: "XXR" },
  { id: "h102", name: "시즌2 우승자-이재훈", class: "dealer", rarity: "XXR" },
];

export const ROSTER = ROSTER_RAW.map((c, idx) => ({ ...c, element: ELEMENTS[idx % ELEMENTS.length] }));

// ---------------------------------------------------------------------------
// 7. 완전한 전투 스탯 — 레벨을 받아 server/lib/combat.js의 makeFighter()가 바로
//    쓸 수 있는 hero 객체를 만든다.
//
// [등급(rarity) — 태초 등급과 현재 등급 구분] `entry.rarity`(ROSTER)는 그 캐릭터가
// 처음 뽑힌 "태초 등급"으로 절대 바뀌지 않는다(조각 뽑기 풀을 결정 — server/data/gacha.js
// CHARS_BY_RARITY, server/data/promotion.js의 조각 요구량이 태초 등급 기준인 이유).
// 반면 유저가 조각+골드로 승급시키면 "현재 등급"이 올라가고, 전투 스탯/스킬 위력은
// 전부 현재 등급 기준으로 계산되어야 한다 — 그래서 `currentRarity`를 별도 인자로 받고,
// 생략하면(아직 한 번도 승급 안 한 경우) 태초 등급을 그대로 쓴다.
export function characterStatsAt(characterId, level, currentRarity) {
  const entry = ROSTER.find((c) => c.id === characterId);
  if (!entry) throw new Error(`unknown characterId: ${characterId}`);
  const rarity = currentRarity || entry.rarity;
  const cls = CLASSES[entry.class];
  const base = baseStatsFor(rarity, entry.class, level);
  const jitterStat = jitterFor(`${characterId}:stat`); // atk/hp/def에 공통으로 걸리는 작은 편차
  return {
    characterId,
    name: entry.name,
    class: entry.class,
    role: entry.class,
    rarity,
    originRarity: entry.rarity,
    element: entry.element,
    level,
    atk: Math.round(base.atk * jitterStat),
    hp: Math.round(base.hp * jitterStat),
    def: Math.round(base.def * jitterStat),
    mana: Math.round(cls.mana * jitterFor(`${characterId}:mana`)),
    spd: cls.spd,
    critRate: cls.critRate,
    critDmg: cls.critDmg,
    pen: Math.round(cls.pen * jitterFor(`${characterId}:pen`) * 1000) / 1000,
    res: Math.round(cls.res * jitterFor(`${characterId}:res`) * 1000) / 1000,
    skills: skillsForCharacter(characterId, entry.class, rarity),
  };
}

export function allCharacterIds() {
  return ROSTER.map((c) => c.id);
}
