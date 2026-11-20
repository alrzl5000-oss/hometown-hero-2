// ============================================================================
// 게임 2.0 — 스킬 kind 카탈로그 (스킬 다양성)
// ============================================================================
// 세븐나이츠 키우기 리서치(claude/game2-core-stats.md 5번, claude/game2-roster-port.md)를
// 반영해, 기존 게임에서 검증된 kind는 그대로 이식하고 신규 kind를 추가했다. 실제 적용
// 로직은 server/lib/combat.js의 SKILL_HANDLERS에 있고, 이 파일은 "카탈로그"(각 kind가
// 뭘 하는지, 어떤 파라미터를 받는지, 대략 어느 정도 마나 코스트대가 적정한지)만 정의한다 —
// 캐릭터 데이터(characters.js)를 만들 때 이 카탈로그를 참고해 manaCost/수치를 정한다.
//
// category:
//   damage   — 직접 피해
//   buff     — 아군에게 이로운 효과
//   debuff   — 상대에게 해로운 효과(CC 포함)
//   utility  — 피해/버프/디버프가 아닌 그 외(게이지·마나 조작, 디스펠 등)
//
// manaCostHint: [최소, 최대] — 캐릭터별 편차(jitter)를 적용하기 전 권장 범위. 세게
// 자주 쓰면 안 되는 효과는 범위를 높게 잡는다.

export const SKILL_CATEGORY = Object.freeze({
  DAMAGE: "damage",
  BUFF: "buff",
  DEBUFF: "debuff",
  UTILITY: "utility",
});

export const SKILL_KINDS = {
  // ---- 기존 게임에서 이식 (burst 계열 피해) ----
  burst: {
    category: SKILL_CATEGORY.DAMAGE,
    label: "필살 강타",
    desc: "발동 시 그 한 방이 burstMult배로 터진다.",
    params: ["burstMult"],
    manaCostHint: [30, 60],
  },
  burstHp: {
    category: SKILL_CATEGORY.DAMAGE,
    label: "체력비례 강타",
    desc: "공격력이 아니라 자신의 최대 체력에 비례한 피해로 대체한다.",
    params: ["hpDmgMult"],
    manaCostHint: [35, 65],
  },
  executeChance: {
    category: SKILL_CATEGORY.DEBUFF,
    label: "처형",
    desc: "확률적으로 대상을 즉사시킨다. RES로 저항 가능.",
    params: ["executeChance"],
    manaCostHint: [60, 100],
  },

  // ---- 기존 게임에서 이식 (버프/디버프) ----
  heal: {
    category: SKILL_CATEGORY.BUFF,
    label: "치유",
    desc: "아군 중 체력 비율이 가장 낮은 대상을 공격력 비례로 회복시킨다(초과분은 버림).",
    params: ["healMult"],
    manaCostHint: [30, 55],
  },
  buffAtk: { category: SKILL_CATEGORY.BUFF, label: "공격력 버프", params: ["buffBonus", "buffDuration"], manaCostHint: [25, 45] },
  buffDef: { category: SKILL_CATEGORY.BUFF, label: "방어 버프", params: ["buffReduction", "buffDuration"], manaCostHint: [25, 45] },
  buffSpd: { category: SKILL_CATEGORY.BUFF, label: "공속 버프", params: ["buffBonus", "buffDuration"], manaCostHint: [25, 45] },
  buffCrit: { category: SKILL_CATEGORY.BUFF, label: "치명타율 버프", params: ["buffBonus", "buffDuration"], manaCostHint: [20, 40] },
  buffCritDmg: { category: SKILL_CATEGORY.BUFF, label: "치명타피해 버프", params: ["buffBonus", "buffDuration"], manaCostHint: [20, 40] },
  buffNormalAtk: { category: SKILL_CATEGORY.BUFF, label: "평타위력 버프", params: ["buffBonus", "buffDuration"], manaCostHint: [20, 40] },
  debuffDef: { category: SKILL_CATEGORY.DEBUFF, label: "방어 디버프", params: ["reduction", "buffDuration"], manaCostHint: [25, 45] },
  debuffSpd: { category: SKILL_CATEGORY.DEBUFF, label: "공속 디버프", params: ["spdReduction", "buffDuration"], manaCostHint: [25, 45] },
  stunAll: { category: SKILL_CATEGORY.DEBUFF, label: "전체 기절", desc: "RES로 저항 가능.", params: ["stunDuration"], manaCostHint: [55, 90] },
  dispel: { category: SKILL_CATEGORY.UTILITY, label: "버프 해제", desc: "상대 팀의 이로운 버프를 전부 지운다.", params: [], manaCostHint: [40, 70] },
  revive: { category: SKILL_CATEGORY.UTILITY, label: "부활 장전", desc: "전투당 1회, 쓰러지면 즉시 부활.", params: [], manaCostHint: [70, 110] },
  executeReflectChance: {
    category: SKILL_CATEGORY.BUFF,
    label: "처형 반사",
    desc: "아군 전체 중 누군가 처형 판정을 받으면 확률적으로 반사해 공격자를 처치(패시브 — 마나 소모 없음).",
    params: ["executeReflectChance"],
    passive: true,
  },

  // ---- 신규: 세븐나이츠 키우기 리서치 기반 ----
  shieldHits: {
    category: SKILL_CATEGORY.BUFF,
    label: "횟수제 보호막",
    desc: "시간이 아니라 '피해 n회'를 무효화하는 보호막(쿠르레치아 참고) — defBuffs(시간제)와 별도 트랙으로 관리.",
    params: ["shieldCharges"],
    manaCostHint: [45, 75],
  },
  tempImmortal: {
    category: SKILL_CATEGORY.BUFF,
    label: "시한부 불사",
    desc: "일정 시간 체력이 0 이하로 떨어지지 않는다(와이저 참고). 소모형 revive와 달리 시간이 지나면 그냥 끝난다.",
    params: ["duration"],
    manaCostHint: [70, 100],
  },
  tauntOnHit: {
    category: SKILL_CATEGORY.DEBUFF,
    label: "도발 부여",
    desc: "명중 시 대상에게 도발을 걸어 자신을 우선 공격하게 만든다(미라쥬 참고).",
    params: ["tauntDuration"],
    manaCostHint: [30, 55],
  },
  typeBonusDmg: {
    category: SKILL_CATEGORY.DAMAGE,
    label: "상성 특화 피해",
    desc: "특정 역할(예: 탱커) 상대로 최종 피해가 늘어난다(발리스타 참고) — 평타/스킬 양쪽에 상시 적용되는 패시브.",
    params: ["targetRole", "bonusMult"],
    passive: true,
  },
  cooldownReduce: {
    category: SKILL_CATEGORY.BUFF,
    label: "마나 회복 가속",
    desc: "아군 전체의 평타당 마나 회복량을 잠시 늘린다(클레미스의 쿨타임 감소 참고) — 마나 자원제에서는 '회복 가속'으로 치환.",
    params: ["manaRegenBonus", "buffDuration"],
    manaCostHint: [30, 55],
  },
  ccImmunity: {
    category: SKILL_CATEGORY.BUFF,
    label: "CC 면역",
    desc: "일정 시간 기절/도발/마나락 등 모든 강제 효과에 면역(루디 참고).",
    params: ["duration"],
    manaCostHint: [40, 70],
  },

  // ---- 신규: 마나 자원과 직접 연동되는 CC ----
  manaBurn: {
    category: SKILL_CATEGORY.DEBUFF,
    label: "마나 번",
    desc: "상대 마나를 즉시 소각한다. RES로 저항 가능.",
    params: ["burnAmount"],
    manaCostHint: [25, 45],
  },
  manaLock: {
    category: SKILL_CATEGORY.DEBUFF,
    label: "마나 락",
    desc: "일정 시간 상대의 마나 회복을 차단한다. RES로 저항 가능.",
    params: ["lockDuration"],
    manaCostHint: [35, 60],
  },
  manaDrain: {
    category: SKILL_CATEGORY.DEBUFF,
    label: "마나 리치",
    desc: "상대 마나를 흡수해 자신(또는 아군 전체)의 마나로 만든다. RES로 저항 가능.",
    params: ["drainAmount"],
    manaCostHint: [30, 55],
  },
};

export function skillKindInfo(kind) {
  return SKILL_KINDS[kind] || null;
}

export function listSkillKindsByCategory(category) {
  return Object.entries(SKILL_KINDS)
    .filter(([, v]) => v.category === category)
    .map(([k]) => k);
}
