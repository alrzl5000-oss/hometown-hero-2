// ============================================================================
// 게임 2.0 — 필드 파밍(방치) + 층보스 시스템
// ============================================================================
// [배경] 민수님 결정 — "2.0은 새 게임이 아니라 1.0(alrzl5000-oss/minsu100)의 리부트".
// 1.0의 실제 구조(server/lib/combat.js, server/routes/battle.js)를 직접 읽어서 가져온
// 핵심 설계 원칙은 그대로 포팅하고, 그 위에 민수님이 추가로 요청한 두 가지를 얹었다:
//
//   1) 필드(파밍)는 1.0처럼 "스테이지당 몬스터 종 1개"가 아니라, 세븐나이츠 키우기처럼
//      "여러 종이 뒤섞여 등장"한다 — 마릿수/경험치가 누적되는 재미를 위해.
//   2) 층보스도 1.0처럼 "거의 같은 보스 템플릿 + 보조 스킬만 다름"이 아니라, 이름/스탯
//      비율이 다른 보스 "종" 풀에서 뽑힌다.
//
// [1.0에서 그대로 가져온 핵심 원칙 — server/lib/combat.js 주석 그대로]
//   - 보상(골드/경험치/다이아)은 고정 배율이 아니라, 몬스터의 "실제 강함"(toughness =
//     체력 ÷ 방어 감쇄)에 정비례한다. 방어 감쇄 공식이 방어력 300(1.0) 근처에서 급격히
//     꺾이는 비선형 곡선이라, 고정 배율로는 저층/고층 어느 한쪽이 항상 유리해지는 문제를
//     겪었다는 1.0의 실측 교훈 — 그래서 2.0도 처음부터 toughness 비례 방식으로 간다.
//   - 종이 여러 개 섞이면 종마다 toughness가 다르므로, "킬=경험치"(민수님 표현)가 종별로
//     자연히 달라진다 — 별도 종별 보상표를 만들 필요가 없다.
//   - 처치시간에는 최소 하한(MIN_FARM_SECONDS_PER_KILL)을 둔다 — 안 그러면 팀이 셀수록
//     약한 스테이지의 초당 수익이 무한정 커진다.
//   - 오프라인(방치) 보상에는 상한(FARM_OFFLINE_CAP_SECONDS)을 둔다.
//   - 파밍 잡몹은 기믹/속성 없이 순수 체력/방어만 다르다(예측 가능한 보상을 위해) — 기믹
//     + 속성 같은 "전략이 필요한 다양성"은 실제로 이겨야 하는 층보스에만 남긴다.
//
// [범위] 여기는 순수 계산 함수만 둔다. 실제 유저별 farm_stage/farm_max_stage/farm_team/
// farm_last_tick_at/각종 remainder/farm_total_kills는 Supabase players 테이블에 저장되고,
// server/index.js의 /api/players/:playerId/farm/* 라우트가 이 모듈을 호출한다.
import { RARITY_UNIT } from "./characters.js";
import { mitigation } from "./stats.js";
import { expPerKill as baseExpPerKillForStage } from "./accountLevel.js";
import { simulateBattle } from "../lib/combat.js";

// ---------------------------------------------------------------------------
// 1. 챕터/스테이지 번호 체계 (기존 stages.js 그대로 이식)
// ---------------------------------------------------------------------------
export const STAGES_PER_CHAPTER = 10;

export function chapterOf(stageNumber) {
  return Math.floor((stageNumber - 1) / STAGES_PER_CHAPTER) + 1;
}
export function stageLabel(stageNumber) {
  const chapter = chapterOf(stageNumber);
  const inChapter = ((stageNumber - 1) % STAGES_PER_CHAPTER) + 1;
  return `${chapter}-${inChapter}`;
}

// ---------------------------------------------------------------------------
// 2. 필드 몬스터 — 기준 성장 곡선(기존 stages.js의 monsterUnit과 동일한 베이스/성장률을
//    그대로 이어받는다 — 이미 RARITY_UNIT 스케일로 보정해둔 값이라 새로 역산할 필요 없음).
// ---------------------------------------------------------------------------
export const FIELD_GROWTH_RATE = 1.05;
export const BASE_FIELD_UNIT = RARITY_UNIT.N * 0.12;
const FIELD_BASE_RATIO = { atk: 1.0, hp: 2.0, def: 0.8 };

function fieldUnit(stageNumber) {
  return BASE_FIELD_UNIT * Math.pow(FIELD_GROWTH_RATE, stageNumber - 1);
}

// 필드 몬스터 "종" 풀 — 세븐나이츠 키우기처럼 여러 종이 같은 필드에 뒤섞여 등장한다.
// weight 합은 1.0(등장 비중). ratio가 서로 달라서 종마다 체감 처치속도/보상이 다르다 —
// 예: 박쥐떼는 체력·방어가 낮아 빨리 죽지만 그만큼 보상도 적고, 돌골렘 조각은 방어가
// 높아 오래 버티는 만큼 보상도 크다. 기믹/속성은 일부러 넣지 않는다(위 설계 원칙 참고).
export const FIELD_SPECIES = [
  { key: "mongrel", name: "들개 무리", icon: "🐺", weight: 0.28, ratio: { atk: 1.05, hp: 0.75, def: 0.85 } },
  { key: "shroom", name: "독버섯 괴물", icon: "🍄", weight: 0.24, ratio: { atk: 0.75, hp: 1.35, def: 1.05 } },
  { key: "golem_shard", name: "돌골렘 조각", icon: "🪨", weight: 0.2, ratio: { atk: 0.85, hp: 1.05, def: 1.45 } },
  { key: "bat_swarm", name: "박쥐떼", icon: "🦇", weight: 0.16, ratio: { atk: 1.35, hp: 0.55, def: 0.55 } },
  { key: "forest_spirit", name: "숲의 정령", icon: "🌿", weight: 0.12, ratio: { atk: 1.0, hp: 1.1, def: 1.0 } },
];

export function fieldMonsterStats(stageNumber, species) {
  const unit = fieldUnit(stageNumber);
  return {
    hp: Math.round(unit * FIELD_BASE_RATIO.hp * species.ratio.hp * 8),
    atk: Math.round(unit * FIELD_BASE_RATIO.atk * species.ratio.atk),
    def: Math.round(unit * FIELD_BASE_RATIO.def * species.ratio.def),
  };
}

// "실제 강함"(toughness) = 체력 ÷ 방어 감쇄(=체력×(K+방어력)/K, stats.js의 mitigation과
// 동일한 K를 쓴다). 보상은 전부 이 값에 정비례시킨다.
export function monsterToughness(hp, def) {
  return hp / mitigation(def, 0);
}

export function fieldMonsterToughness(stageNumber, species) {
  const { hp, def } = fieldMonsterStats(stageNumber, species);
  return monsterToughness(hp, def);
}

// 보상 곡선의 기준점 — ratio 1.0짜리 "평균 종" 기준 toughness. 각 종은 자기 toughness와
// 이 기준치의 비율(toughnessRatio)만큼 보상이 비례해서 더/덜 나온다.
export function fieldReferenceToughness(stageNumber) {
  const unit = fieldUnit(stageNumber);
  return monsterToughness(unit * FIELD_BASE_RATIO.hp * 8, unit * FIELD_BASE_RATIO.def);
}

// 스테이지당 완만한 진행 보너스 — 1.0의 FARM_REWARD_STAGE_BONUS(1.02) 그대로.
export const FARM_REWARD_STAGE_BONUS = 1.02;

// 팀이 아무리 세도 처치당 보상 계산에 쓰는 처치시간에는 최소 하한을 둔다(1.0의
// MIN_FARM_TIME_TO_KILL 원칙 그대로) — 안 그러면 초당 수익이 팀 DPS에 비례해 무한정
// 커질 수 있다.
export const MIN_FARM_SECONDS_PER_KILL = 2; // 1.0 MIN_FARM_TIME_TO_KILL = 2 그대로

// 오프라인(미접속) 보상 최대 상한 — 1.0의 OFFLINE_CAP_SECONDS(8시간) 그대로.
export const FARM_OFFLINE_CAP_SECONDS = 8 * 60 * 60;

function farmRewardCurve(baseAtStage1, stageNumber, toughnessRatio) {
  const ref1 = fieldReferenceToughness(1);
  const refS = fieldReferenceToughness(stageNumber);
  const base = baseAtStage1 / ref1;
  return Math.max(0, base * refS * toughnessRatio * Math.pow(FARM_REWARD_STAGE_BONUS, stageNumber - 1));
}

// [1차 추정치 — 실측 필요] 스테이지 1, 기준 종(ratio=1.0) 기준 처치당 골드.
// 1.0 stageGoldPerKill 그대로: 7.3249906571478105 × FARM_REWARD_NERF_MULT(0.4)
const GOLD_BASE_AT_STAGE1 = 7.3249906571478105 * 0.4;
export function fieldGoldPerKill(stageNumber, toughnessRatio = 1) {
  return Math.max(1, Math.round(farmRewardCurve(GOLD_BASE_AT_STAGE1, stageNumber, toughnessRatio)));
}

// 경험치는 이미 있는 accountLevel.js의 expPerKill(stage)(스테이지 기준 평균치, 기존
// 테스트가 이 값의 단조증가/최소치를 검증 중이라 그대로 유지)를 "기준 종(ratio=1)의
// 평균치"로 재해석하고, 종마다 toughnessRatio를 곱해 실제 지급치를 구한다. 민수님
// 요청("종별로 경험치도 다르게 먹어야") 그대로 — 별도 경험치 공식을 새로 만들지 않고
// 기존 계정 레벨 경험치 곡선 위에 종 비율만 얹는다.
export function fieldExpPerKill(stageNumber, toughnessRatio = 1) {
  return Math.max(1, Math.round(baseExpPerKillForStage(stageNumber) * toughnessRatio));
}

// 다이아 드랍 — 확률은 스테이지/종과 무관하게 고정(1.0과 동일한 설계: "성장은 드랍량이
// 아니라 드랍 '확률'이 아니라 드랍 '양'에서 처리"), 터졌을 때 받는 양만 toughness에 비례.
export const GEM_DROP_CHANCE = 0.2;
// 1.0 stageGemDropUnit 그대로: 0.06849852999579727 × 0.4 (드랍 확률 20%도 1.0 그대로)
const GEM_UNIT_BASE_AT_STAGE1 = 0.06849852999579727 * 0.4;
export function fieldGemDropUnit(stageNumber, toughnessRatio = 1) {
  return Math.max(1, Math.round(farmRewardCurve(GEM_UNIT_BASE_AT_STAGE1, stageNumber, toughnessRatio)));
}

// ---------------------------------------------------------------------------
// 3. 필드 파밍 틱 계산 — 기대값(EV) 기반. 종이 여러 개 섞여 있으므로, 종별로 "이
//    종을 상대할 때의 처치시간"을 구해 종별 초당 킬/골드/경험치/다이아를 각각 계산하고,
//    등장 비중(weight)으로 가중합산한다. 실시간 이벤트 시뮬레이션(simulateBattle)을
//    오프라인 몇 시간치에 그대로 돌리면 느리고 무의미하므로(1.0도 파밍/던전은 EV 계산,
//    실제로 이겨야 하는 보스전만 실시간 시뮬레이션이었다), 여기는 EV로 계산한다.
//
//    team: buildFormedTeam()을 거친 5인 배열({atk, def, spd, critRate, critDmg, pen, ...}).
//    필드 잡몹은 스킬이 없는 "통행료"라 서포터/탱커 역할 구분 없이 전원의 공격력을
//    그대로 합산해도 충분하다(생존 리스크 자체가 없는 설계 — stages.js 기존 주석 참고).
// ---------------------------------------------------------------------------
function teamDpsVs(team, monsterDef) {
  return team.reduce((sum, h) => {
    if (!h) return sum;
    const atk = h.atk || 0;
    const spd = h.spd || 1;
    const critRate = h.critRate || 0;
    const critDmg = h.critDmg || 1;
    const pen = h.pen || 0;
    const critFactor = 1 + critRate * (critDmg - 1);
    return sum + atk * mitigation(monsterDef, pen) * spd * critFactor;
  }, 0);
}

export function computeFarmTick(team, stageNumber, elapsedSeconds) {
  const cappedSeconds = Math.max(0, Math.min(elapsedSeconds || 0, FARM_OFFLINE_CAP_SECONDS));
  const refToughness = fieldReferenceToughness(stageNumber);
  const perSpecies = [];
  let killsPerSecond = 0;
  let goldPerSecond = 0;
  let expPerSecond = 0;
  let gemPerSecond = 0;

  for (const species of FIELD_SPECIES) {
    const { hp, def } = fieldMonsterStats(stageNumber, species);
    const dps = teamDpsVs(team, def);
    if (dps <= 0) {
      perSpecies.push({ species: species.key, killsPerSecond: 0 });
      continue;
    }
    const timeToKill = Math.max(MIN_FARM_SECONDS_PER_KILL, hp / dps);
    const kps = species.weight / timeToKill;
    const toughnessRatio = monsterToughness(hp, def) / refToughness;
    const goldEach = fieldGoldPerKill(stageNumber, toughnessRatio);
    const expEach = fieldExpPerKill(stageNumber, toughnessRatio);
    const gemEach = fieldGemDropUnit(stageNumber, toughnessRatio);

    killsPerSecond += kps;
    goldPerSecond += kps * goldEach;
    expPerSecond += kps * expEach;
    gemPerSecond += kps * GEM_DROP_CHANCE * gemEach;
    perSpecies.push({ species: species.key, name: species.name, icon: species.icon, killsPerSecond: kps, goldPerKill: goldEach, expPerKill: expEach, gemDropUnit: gemEach, toughnessRatio });
  }

  return {
    cappedSeconds,
    killsPerSecond,
    goldPerSecond,
    expPerSecond,
    gemPerSecond,
    kills: killsPerSecond * cappedSeconds,
    gold: goldPerSecond * cappedSeconds,
    exp: expPerSecond * cappedSeconds,
    gem: gemPerSecond * cappedSeconds,
    perSpecies,
  };
}

// ---------------------------------------------------------------------------
// 4. 층보스 — 그 스테이지의 "진짜" 관문. 1.0과 동일한 규칙:
//      - stage(현재 파밍 위치)는 보스를 실제로 이겨야만 오른다.
//      - 지면 그 자리 그대로(페널티 없음, 파밍은 계속된다).
//      - maxStage(최고 기록) 이하로는 자유롭게 후퇴(retreat) 가능.
//      - 최초로 새 프론티어를 뚫으면(=maxStage 경신) 다이아 보너스.
//    1.0과 달리(민수님 요청) "거의 같은 보스 + 보조 스킬만 다름"이 아니라, 이름/스탯
//    비율이 다른 보스 "종" 풀에서 스테이지마다 결정적으로(항상 같은 스테이지=같은 보스)
//    고른다 — 보조 스킬은 CC/디버프 풀에서 뽑아 전략 포인트를 유지한다.
// ---------------------------------------------------------------------------
const BOSS_BASE_RATIO = { atk: 1.2, hp: 5.0, def: 1.5 };
export const BOSS_POWER_MULT = 4; // 보스 1체 = 그 스테이지 필드 "기준 종" 1체의 4배 파워

const BOSS_SKILL_POOL = [
  { key: "boss_stun", name: "포효", kind: "stunAll", stunDuration: 1.0, manaCostBase: 60 },
  { key: "boss_debuffdef", name: "약점 노출", kind: "debuffDef", reduction: 0.25, buffDuration: 5, manaCostBase: 35 },
  { key: "boss_debuffspd", name: "속박의 울음", kind: "debuffSpd", spdReduction: 0.2, buffDuration: 5, manaCostBase: 35 },
  { key: "boss_dispel", name: "기세 억누름", kind: "dispel", manaCostBase: 55 },
  { key: "boss_shield", name: "비늘 강화", kind: "shieldHits", shieldCharges: 2, manaCostBase: 60 },
];

// 보스 "종" 풀 — 이름/스탯 비율이 서로 달라 보스마다 실제로 다른 전투처럼 느껴지게 한다.
// (secondarySkillHint는 보조 스킬 풀 중 "이 보스 플레이버에 어울리는" 쪽으로 가중치를
// 주되, 최종 배정은 아래 makeBossMonster의 해시로 결정 — 완전 고정하면 민수님이 이미
// 싫어했던 "맨날 똑같은 조합"이 재발하므로 스테이지별로 조금씩 흔든다.)
// element — 1.0처럼(STAGE_VARIETY_START_STAGE 이후 stageEnemyElement 순환) 층보스는
// 원소 상성(fire>wind>water, combat.js의 elementalMultiplier)이 걸린다. 파밍 잡몹(FIELD_SPECIES)은
// 의도적으로 원소를 안 둬서(위 설계 원칙) "진짜로 이겨야 하는" 보스전에만 상성 전략이 들어간다.
export const BOSS_SPECIES = [
  { key: "wolf_king", name: "포효하는 늑대왕", icon: "🐺👑", ratio: { atk: 1.3, hp: 4.0, def: 1.2 }, element: "fire" },
  { key: "spider_queen", name: "독의 여왕 거미", icon: "🕷️👑", ratio: { atk: 1.0, hp: 4.5, def: 1.6 }, element: "wind" },
  { key: "ice_giant", name: "얼음 거인", icon: "🧊", ratio: { atk: 1.1, hp: 6.0, def: 2.0 }, element: "water" },
  { key: "shadow_assassin", name: "어둠의 암살자", icon: "🗡️", ratio: { atk: 1.8, hp: 3.0, def: 0.8 }, element: "fire" },
  { key: "iron_guardian", name: "강철 수호자", icon: "🛡️", ratio: { atk: 0.9, hp: 5.5, def: 2.5 }, element: "wind" },
  { key: "storm_wyvern", name: "폭풍의 와이번", icon: "🐲", ratio: { atk: 1.5, hp: 3.5, def: 1.0 }, element: "water" },
];

function hashIndex(id, len) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % len;
}

export function bossSpeciesForStage(stageNumber) {
  return BOSS_SPECIES[hashIndex(`boss-species:${stageNumber}`, BOSS_SPECIES.length)];
}

export function makeBossMonster(stageNumber) {
  const species = bossSpeciesForStage(stageNumber);
  const unit = fieldUnit(stageNumber) * BOSS_POWER_MULT;
  const secondary = BOSS_SKILL_POOL[hashIndex(`boss-skill:${stageNumber}`, BOSS_SKILL_POOL.length)];
  const secondarySkill = { key: secondary.key, kind: secondary.kind, manaCost: secondary.manaCostBase, passive: false };
  for (const field of ["stunDuration", "reduction", "buffDuration", "spdReduction", "shieldCharges"]) {
    if (secondary[field] !== undefined) secondarySkill[field] = secondary[field];
  }
  return {
    characterId: `boss-${stageNumber}`,
    name: `${stageLabel(stageNumber)} 층보스 — ${species.name}`,
    icon: species.icon,
    speciesKey: species.key,
    role: "monster",
    element: species.element,
    atk: Math.round(unit * BOSS_BASE_RATIO.atk * species.ratio.atk),
    hp: Math.round(unit * BOSS_BASE_RATIO.hp * species.ratio.hp * 8),
    def: Math.round(unit * BOSS_BASE_RATIO.def * species.ratio.def),
    mana: 100,
    spd: 0.9,
    critRate: 0.1,
    critDmg: 1.5,
    pen: 0.1,
    res: 0.2,
    skills: [
      { key: "boss_burst", kind: "burst", burstMult: 3.0, manaCost: 45 },
      secondarySkill,
    ],
  };
}

// 새 프론티어(최초 클리어) 보너스 — [1차 추정치, 실측 필요] 2.0 경제 스케일(기본 다이아
// 500, 가챠 1회 300) 기준으로 모자라지도 과하지도 않게 잡은 값.
export const STAGE_CLEAR_GEM_BONUS = 300; // 1.0 battle.js 그대로
export const STAGE_MILESTONE_GEM_BONUS = 200; // 10의 배수 층은 추가(합 500) — 1.0 그대로

export function resolveBossChallenge({ team, stage, maxStage, timeLimitSeconds }) {
  const boss = makeBossMonster(stage);
  const result = simulateBattle(team, [boss], { timeLimitSeconds: timeLimitSeconds || 30 });
  const win = result.winner === "A";

  if (!win) {
    // 패배는 페널티 없음 — stage 그대로, 파밍은 계속된다(1.0 원칙 그대로).
    return { win: false, stage, maxStage, boss, hits: result.hits, endedAt: result.t };
  }

  const isFirstClear = stage >= maxStage;
  const nextStage = stage + 1;
  const nextMaxStage = Math.max(maxStage, nextStage);
  let diaBonus = 0;
  if (isFirstClear) {
    diaBonus = STAGE_CLEAR_GEM_BONUS;
    if (nextStage % 10 === 0) diaBonus += STAGE_MILESTONE_GEM_BONUS;
  }
  return { win: true, stage: nextStage, maxStage: nextMaxStage, isFirstClear, diaBonus, boss, hits: result.hits, endedAt: result.t };
}

// 자유 후퇴 — maxStage 이하 어디로든 이동 가능(1.0 원칙 그대로, 거리 제한 없음 — toughness
// 비례 보상이라 특정 스테이지가 유리해지는 구조가 아니라서 1.0도 예전 거리제한을 없앴음).
export function resolveRetreat(targetStage, maxStage) {
  const t = Math.max(1, Math.floor(targetStage || 1));
  if (t > maxStage) throw new Error(`아직 도달하지 못한 스테이지(최고 기록 ${maxStage})로는 후퇴할 수 없음`);
  return t;
}

// 스테이지 미리보기(전투 없이) — 클라이언트 UI용.
export function stageInfo(stageNumber) {
  const boss = makeBossMonster(stageNumber);
  const refToughness = fieldReferenceToughness(stageNumber);
  return {
    stageNumber,
    label: stageLabel(stageNumber),
    chapter: chapterOf(stageNumber),
    fieldSpecies: FIELD_SPECIES.map((species) => {
      const { hp, atk, def } = fieldMonsterStats(stageNumber, species);
      const toughnessRatio = monsterToughness(hp, def) / refToughness;
      return {
        key: species.key,
        name: species.name,
        icon: species.icon,
        weight: species.weight,
        hp,
        atk,
        def,
        goldPerKill: fieldGoldPerKill(stageNumber, toughnessRatio),
        expPerKill: fieldExpPerKill(stageNumber, toughnessRatio),
      };
    }),
    boss: {
      name: boss.name,
      icon: boss.icon,
      speciesKey: boss.speciesKey,
      hp: boss.hp,
      atk: boss.atk,
      def: boss.def,
      skills: boss.skills.map((s) => s.key),
    },
  };
}
