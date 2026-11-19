// ============================================================================
// 게임 2.0 — 코어 스탯 정의
// ============================================================================
// 설계 배경은 claude.ai 프로젝트 "수집형알피지"의 claude/game2-core-stats.md 참고.
// 기존(라이브) 게임의 반복된 문제:
//   1) 방어력 곡선이 포화되어 K값을 사후에 계속 낮춰야 했음(6000→1000→500)
//   2) 즉사(처형) 메타가 사실상 유일한 해법처럼 보임
//   3) 타수누적 게이지 공유형 EX 듀얼스킬 — "번갈아 발동" 같은 인위적 토글이 필요했음
// 2.0은 이 셋을 구조로 해결한다: 레퍼런스 기반 방어력 공식 + 관통(PEN)/저항(RES) 스탯,
// 타수 게이지 대신 마나(MANA) 자원 — 아래에서 각각 구현.

// ---------------------------------------------------------------------------
// 1. 코어 스탯 목록
// ---------------------------------------------------------------------------
// atk/hp/def/spd/critRate/critDmg는 기존과 같은 개념. mana/pen/res가 신규.
export const CORE_STATS = ["atk", "hp", "def", "mana", "spd", "critRate", "critDmg", "pen", "res"];

export const DEFAULT_STATS = {
  atk: 0,
  hp: 0,
  def: 0,
  mana: 0, // 최대 마나(manaMax) — 전투 시작 시 0부터 채워짐(즉시 풀마나 시작이 아님)
  spd: 1.0, // 행동 간격 + 마나 회복 속도에 공통으로 곱해짐
  critRate: 0.05,
  critDmg: 1.4,
  pen: 0, // 0~0.9 범위. 상대 방어력을 이 비율만큼 무시
  res: 0, // 0~0.9 범위. 상대가 거는 CC/디버프/처형 적용 확률을 이 비율만큼 낮춤
};

// ---------------------------------------------------------------------------
// 2. 방어력 공식 — "레퍼런스부터 고정, K는 역산" (반응적 재조정 금지)
// ---------------------------------------------------------------------------
// 기존 방식: mitigation = K/(K+DEF) 곡선의 K를 실측 피해감소율 보고 사후에 낮춤.
// 2.0 방식: 레퍼런스 방어력(refDef)과 그 지점에서의 목표 피해감소율(targetReduction)을
// 먼저 정하고 K를 역산한다. mitigation(def) = "피해가 그대로 통과하는 비율"이므로,
// 목표 감소율 Y에서 mitigation = 1-Y가 되어야 한다:
//   (1-Y) = K/(K+refDef)  =>  K = refDef * (1-Y) / Y
// 레퍼런스: "EX+10, 레벨60" 탱커 기준 방어력 60,000, 목표 피해감소율 55%
// (claude/game2-core-stats.md 4번 참고 — 구버전 실측 최대치 약 44,000보다 여유를 둬서
// PEN 스탯이 작동할 공간을 미리 확보).
export const DEF_REFERENCE = { refDef: 60000, targetReduction: 0.55 };

export const DEF_MITIGATION_K = Math.round(
  (DEF_REFERENCE.refDef * (1 - DEF_REFERENCE.targetReduction)) / DEF_REFERENCE.targetReduction
); // ≈ 49091

// 공격자의 관통(PEN)은 상대 방어력을 이 비율만큼 무시한 뒤 곡선에 넣는다 — "방어 투자 vs
// 관통 투자"를 상시 작동하는 양방향 다이얼로 만들어, 즉사 같은 단일 해법에 의존하지 않고도
// 방어 무력화 문제에 대응할 수 있게 한다.
export function effectiveDef(def, attackerPen = 0) {
  const pen = Math.min(0.9, Math.max(0, attackerPen));
  return Math.max(0, def * (1 - pen));
}

// mitigation(): 방어력을 통과한 뒤 "그대로 맞는" 피해 비율(0~1). 1-mitigation()이 감소율.
export function mitigation(def, attackerPen = 0) {
  const eDef = effectiveDef(def, attackerPen);
  return DEF_MITIGATION_K / (DEF_MITIGATION_K + eDef);
}

// 레퍼런스 지점 검증용 — 설계 의도대로 K가 산출됐는지 즉시 확인할 수 있게 노출.
export function describeDefenseCurve() {
  const atRef = 1 - mitigation(DEF_REFERENCE.refDef, 0);
  return {
    K: DEF_MITIGATION_K,
    refDef: DEF_REFERENCE.refDef,
    targetReduction: DEF_REFERENCE.targetReduction,
    actualReductionAtRef: Math.round(atRef * 10000) / 100, // %
  };
}

// ---------------------------------------------------------------------------
// 3. 저항력(RES) — CC/디버프/처형 적용률 저하
// ---------------------------------------------------------------------------
// 즉사(처형)·기절·실명 등 "맞으면 그대로 발동"하는 효과들은 전부 이 함수를 통과시킨다.
// RES가 높을수록 저런 효과가 실제로 적용될 확률이 낮아진다 — 방어력으로 막을 수 없는
// 효과들에 대한 유일한 카운터플레이 축.
export function applyResistance(baseChance, targetRes = 0) {
  const res = Math.min(0.9, Math.max(0, targetRes));
  return Math.max(0, baseChance * (1 - res));
}

// ---------------------------------------------------------------------------
// 4. 마나(MANA) — 타수누적 게이지를 대체하는 신규 자원
// ---------------------------------------------------------------------------
// 기존: gaugeHits가 hitsToCharge에 도달하면 발동(캐릭터당 스킬 하나, EX는 둘을 토글).
// 2.0: 평타 명중마다 마나를 회복(spd에 비례해 회복량 조정)하고, 캐릭터가 가진 스킬들은
// 저마다 다른 마나 코스트를 가진다. 코스트가 다르면 "싼 스킬 자주, 비싼 스킬 가끔" 리듬이
// 자연히 생겨서, 기존처럼 두 스킬을 "번갈아 발동"시키는 인위적 토글이 필요 없어진다.
export const MANA_PER_HIT_BASE = 10; // spd=1.0 기준 평타 1회당 회복량
export const MANA_REGEN_SPD_EXPONENT = 0.6; // spd가 회복 속도에 과하게 선형으로 꽂히지 않도록 완만하게

export function manaRegenPerHit(spd = 1.0) {
  return MANA_PER_HIT_BASE * Math.pow(Math.max(0.1, spd), MANA_REGEN_SPD_EXPONENT);
}

// 마나를 직접 노리는 신규 CC류(server/data/skills.js의 manaBurn/manaLock/manaDrain)가
// 공유하는 보조 함수 — RES로 저항 가능.
export function tryApplyManaEffect(targetRes, baseChance) {
  return Math.random() < applyResistance(baseChance, targetRes);
}
