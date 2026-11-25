// ============================================================================
// 게임 2.0 — 일일보스 포팅
// ============================================================================
// 기존 라이브 게임(`alrzl5000-oss/minsu100`, server/routes/boss.js) 실제 코드를 확인한
// 결과: README에는 "주간보스/매주 초기화"로 적혀 있었지만, 실제 코드는 `boss_day`
// 컬럼과 `todayKey()`로 **매일** 초기화하고 있었다(README가 구버전 설명을 못 따라간
// 케이스 — 코드가 진짜 기획이라 코드를 기준으로 포팅했다). 핵심 기획 의도:
//
// 1. 승/패 판정이 아니라 "제한시간 동안 보스에게 얼마나 데미지를 넣었는가"로 보상이
//    즉시 비례 지급된다 — 꺾을 필요가 없는 "DPS 레이스"형 콘텐츠.
// 2. 하루 제한 도전 횟수(BOSS_MAX_ATTEMPTS), 매일 자정(UTC) 초기화.
// 3. 보스는 유저의 메인 스테이지 진행도(max_stage_reached)에 맞춰 스케일된다 — 즉 내
//    실력에 맞게 보스도 같이 강해지는 "항상 도전할 맛이 있는" 콘텐츠.
//
// [2.0에서 새로 더한 것] 기존 게임은 dayIndex()를 받아서 넘겼지만 실제로 보스 스탯에
// 어떻게 반영했는지는 combat.js(가져오지 못함) 안에 있었다. 2.0에서는 "요일마다 보스의
// 성격(2차 스킬)이 바뀐다"는 자연스러운 해석으로 되살렸다 — stages.js의 보스 스킬 풀과
// 같은 패턴(결정론적 선택)을 요일 인덱스로 적용했다.
//
// [1차 추정치, 실측 필요] BOSS_MAX_ATTEMPTS/BOSS_FIGHT_SECONDS는 기존 게임 README에
// 적혀 있던 "주 3회 · 제한시간 20초"를 가장 가까운 근거로 삼아 그대로 가져왔다(실제
// 코드의 정확한 상수는 combat.js 안에 있어 확인 못 함 — 접근 가능해지면 재확인 필요).
import { RARITY_UNIT } from "./characters.js";
import { simulateBattle } from "../lib/combat.js";

export const BOSS_MAX_ATTEMPTS = 3;
export const BOSS_FIGHT_SECONDS = 20;

// 요일별(0~6) 2차 스킬 — stages.js의 BOSS_SKILL_POOL과 같은 개념을 재사용(결정론적
// 선택이 아니라 "오늘이 무슨 요일인가"로 매일 바뀐다는 점만 다르다).
export const DAILY_BOSS_SKILL_POOL = [
  { key: "dboss_stun", name: "포효", kind: "stunAll", stunDuration: 1.2, manaCostBase: 55 },
  { key: "dboss_debuffdef", name: "약점 노출", kind: "debuffDef", reduction: 0.3, buffDuration: 6, manaCostBase: 35 },
  { key: "dboss_debuffspd", name: "속박의 울음", kind: "debuffSpd", spdReduction: 0.25, buffDuration: 6, manaCostBase: 35 },
  { key: "dboss_dispel", name: "기세 억누름", kind: "dispel", manaCostBase: 50 },
  { key: "dboss_shield", name: "비늘 강화", kind: "shieldHits", shieldCharges: 3, manaCostBase: 55 },
  { key: "dboss_manaburn", name: "마나 소각", kind: "manaBurn", burnAmount: 40, manaCostBase: 45 },
  { key: "dboss_taunt", name: "도발의 함성", kind: "tauntOnHit", tauntDuration: 3, manaCostBase: 30 },
];

export function dayIndex(date = new Date()) {
  return date.getUTCDay(); // 0(일)~6(토) — UTC 기준, 기존 게임 todayKey()와 같은 기준
}

// 보스 파워 — 유저의 메인 스테이지 최고 기록(maxStageReached)에 맞춰 스케일된다. "항상
// 도전할 맛이 있는" 콘텐츠이므로 메인 스테이지 필드 몬스터보다 훨씬 강하게(DAILY_BOSS_MULT)
// 잡아서 "제한시간 안에 못 끝내는 게 정상"인 DPS 레이스 밸런스를 만든다.
const DAILY_BOSS_BASE_UNIT = RARITY_UNIT.N * 0.12; // stages.js의 BASE_FIELD_UNIT과 동일 기준
const DAILY_BOSS_GROWTH_RATE = 1.05; // stages.js의 FIELD_GROWTH_RATE와 동일
const DAILY_BOSS_MULT = 20; // 필드 몬스터의 20배 체급 — 제한시간 안에 전멸시키기 어려운 보스

export function dailyBossEnemy(maxStageReached, dayIdx = dayIndex()) {
  const stage = Math.max(1, maxStageReached || 1);
  const unit = DAILY_BOSS_BASE_UNIT * Math.pow(DAILY_BOSS_GROWTH_RATE, stage - 1) * DAILY_BOSS_MULT;
  const secondary = DAILY_BOSS_SKILL_POOL[dayIdx % DAILY_BOSS_SKILL_POOL.length];
  const secondarySkill = { key: secondary.key, kind: secondary.kind, manaCost: secondary.manaCostBase, passive: false };
  for (const field of ["stunDuration", "reduction", "buffDuration", "spdReduction", "shieldCharges", "burnAmount", "tauntDuration"]) {
    if (secondary[field] !== undefined) secondarySkill[field] = secondary[field];
  }
  return {
    characterId: `daily-boss-${dayIdx}`,
    name: `오늘의 보스 — ${secondary.name}`,
    role: "monster",
    atk: Math.round(unit * 1.1),
    hp: Math.round(unit * 9 * 8), // 제한시간 안에 다 못 깎는 게 정상인 큰 체력
    def: Math.round(unit * 1.6),
    mana: 100,
    spd: 1.0,
    critRate: 0.1,
    critDmg: 1.5,
    pen: 0.1,
    res: 0.25,
    skills: [{ key: "dboss_burst", kind: "burst", burstMult: 3.2, manaCost: 50 }, secondarySkill],
  };
}

// 데미지 비례 보상 — [1차 추정치, 실측 필요] 선형 비례(기존 게임 README의 "데미지에
// 비례해 즉시 보상"을 그대로 따름). 다이아는 골드보다 1/10 스케일.
const GOLD_PER_DAMAGE = 0.02;
const GEM_PER_DAMAGE = 0.002;

export function bossAttemptReward(damageDealt) {
  return {
    gold: Math.round(damageDealt * GOLD_PER_DAMAGE),
    gems: Math.round(damageDealt * GEM_PER_DAMAGE),
  };
}

// team: buildFormedTeam을 거친 5인 배열. maxStageReached: 메인 스테이지 최고 기록(없으면 1).
export function resolveDailyBossAttempt({ team, maxStageReached, attemptsUsed, dayIdx }) {
  if (attemptsUsed >= BOSS_MAX_ATTEMPTS) {
    return { error: "오늘 도전 횟수를 모두 사용했어요. 내일 다시 도전해주세요." };
  }
  const idx = dayIdx ?? dayIndex();
  const enemy = dailyBossEnemy(maxStageReached, idx);
  const result = simulateBattle(team, [enemy], { timeLimitSeconds: BOSS_FIGHT_SECONDS });

  const bossFighter = result.sideB.fighters[0];
  const damageDealt = Math.max(0, Math.round(enemy.hp - bossFighter.hp));
  const reward = bossAttemptReward(damageDealt);

  return {
    damageDealt,
    reward,
    attemptsUsed: Math.min(BOSS_MAX_ATTEMPTS, attemptsUsed + 1),
    attemptsMax: BOSS_MAX_ATTEMPTS,
    defeated: result.winner === "A",
    enemy,
    hits: result.hits,
    endedAt: result.t,
  };
}
