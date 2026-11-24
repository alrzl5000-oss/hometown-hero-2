// ============================================================================
// 게임 2.0 — 일일던전(골드/다이아/경험치) 포팅
// ============================================================================
// 기존 라이브 게임(`alrzl5000-oss/minsu100`, server/routes/dungeon.js)의 실제 코드를
// 민수님이 직접 채팅에 붙여넣어줘서 그대로 확인하고 포팅했다 — 세븐나이츠 키우기 참고가
// 아니라 "민수님이 이미 설계한 것"이므로, 숫자 그 자체보다 **기획 의도(메커니즘)**를
// 그대로 가져오는 데 집중했다:
//
// 1. 골드/다이아(gem)/경험치 3종 던전 — 각자 독립된 스테이지 진행도(stage/maxStage)와
//    도전 횟수(attemptsUsed)를 가진다.
// 2. "최초 클리어 시 도전 횟수 가득 리필" — 새 스테이지를 처음 뚫을 때만 공짜(attempts
//    소모 없음)이고, 그 자리에서 다음 번 도전 횟수가 가득 채워진다. 이미 깬 스테이지를
//    다시 파밍하는 재도전만 1회를 정상 소모한다. "실패는 도전 횟수를 전혀 깎지 않는다"는
//    원칙도 그대로(실패해도 보상이 없으니 이중으로 손해보지 않게).
// 3. 재도전(파밍) 보상도 100% 지급(기존 게임이 한때 재도전 15%로 깎았다가, "등급별
//    보상 차등이 이미 지수적으로 있는데 페널티까지 겹칠 필요 없다"는 피드백으로 100%로
//    되돌린 최종 버전을 그대로 가져옴).
// 4. 스테이지 상한(DUNGEON_MAX_STAGE) — "하루 n회, 짧고 굵게" 콘텐츠라 무한 스케일은
//    아니고 상한에서 멈춘다.
//
// [2.0 변경점 — 명시] 기존 게임은 통화만 보상으로 주는 "기대값 계산"(computeTeamBattle,
// 승패를 즉시 판정) 기반이었는데, 2.0은 스킬/마나가 있는 실시간 시뮬레이션 엔진이라
// server/lib/combat.js의 simulateBattle(짧은 단일 전투, 필드 몬스터처럼 스킬 없는 몬스터
// 하나)을 그대로 재사용했다. 몬스터 파워 수치(DUNGEON_BASE_UNIT 등)는 기존 게임
// 수치를 그대로 쓸 수 없어(완전히 다른 스탯 체계) 2.0 RARITY_UNIT 기준으로 새로
// 역산했고, [1차 추정치, 실측 필요]로 표기한다(stages.js와 동일한 방식론).
//
// [아직 안 한 것] 기존 게임처럼 유저별 진행도(stage/maxStage/attemptsUsed)를 서버가
// 기억하려면 Supabase 스키마가 필요하다 — 지금은 stages.js의 /challenge와 동일하게
// "클라이언트가 지금 상태를 함께 보내면 서버가 계산만 해서 돌려주는" 무상태(stateless)
// 방식이다.
import { RARITY_UNIT } from "./characters.js";
import { simulateBattle } from "../lib/combat.js";

export const DUNGEON_TYPES = ["gold", "gem", "exp"];
export const DUNGEON_MAX_ATTEMPTS = 3;
export const DUNGEON_MAX_STAGE = 45;
export const DUNGEON_REWARD_RATIO = 1.11; // 스테이지당 보상 성장률(기존 게임 값 그대로)
export const REPLAY_REWARD_RATE = 1; // 재도전(파밍)도 100% 지급(기존 게임 최종 버전)

// 몬스터 성장 — stages.js의 monsterUnit과 같은 형태(지수 성장)지만, "하루 3회, 짧고
// 굵게" 콘텐츠이자 메인 스테이지와 별개 트랙이라 더 낮은 베이스 + 더 가파른 성장률을
// 썼다(45층이라는 상한 안에서 체감 성장이 나도록). [1차 추정치, 실측 필요]
export const DUNGEON_BASE_UNIT = RARITY_UNIT.N * 0.05;
export const DUNGEON_GROWTH_RATE = 1.09;

function dungeonUnit(stage) {
  return DUNGEON_BASE_UNIT * Math.pow(DUNGEON_GROWTH_RATE, stage - 1);
}

// 타입별 체급 비율 — 기존 게임 플레이버를 그대로 반영: 골드 던전은 무난, 다이아 던전은
// 방어력이 더 높아 관통/치명타가 필요, 경험치 던전은 그 중간.
const DUNGEON_RATIO = {
  gold: { atk: 1.0, hp: 1.6, def: 1.0 },
  gem: { atk: 1.0, hp: 1.4, def: 1.7 },
  exp: { atk: 1.0, hp: 1.5, def: 1.3 },
};

// 던전별 "약점 직업" — 그 직업 영웅의 공격은 DUNGEON_WEAK_ROLE_BONUS_MULT배 피해(세븐나이츠
// 키우기 일일던전의 역할 특화 보스 참고, claude/game2-stage-system.md 1번). 역할 키는
// characters.js의 class 값과 같다.
export const DUNGEON_WEAK_ROLE = { gold: "ranged", gem: "assassin", exp: "support" };
export const DUNGEON_WEAK_ROLE_BONUS_MULT = 1.3; // [1차 추정치, 실측 필요]
const WEAK_ROLE_LABEL = { ranged: "원거리 딜러", assassin: "암살자", support: "서포터" };

const DUNGEON_TIPS = {
  gold: `💡 골드 던전 보스는 ${WEAK_ROLE_LABEL.ranged}에게 약해요(피해 ×${DUNGEON_WEAK_ROLE_BONUS_MULT}). 스테이지가 오를수록 보상이 기하급수적으로 커지니, 탱커로 앞열을 지키고 원거리 딜러로 밀어붙이세요.`,
  gem: `💡 다이아 던전 보스는 ${WEAK_ROLE_LABEL.assassin}에게 약해요(피해 ×${DUNGEON_WEAK_ROLE_BONUS_MULT}). 방어력이 높은 편이라 관통(PEN)이 높은 암살자 조합이 특히 잘 뚫어요.`,
  exp: `💡 경험치 던전 보스는 ${WEAK_ROLE_LABEL.support}에게 약해요(피해 ×${DUNGEON_WEAK_ROLE_BONUS_MULT}). 레벨업이 더디게 느껴질 때 서포터를 섞어 밀어붙여 보세요.`,
};

const BASE_REWARD = { gold: 80, gem: 8, exp: 60 };

export function dungeonEnemy(type, stage) {
  const unit = dungeonUnit(stage);
  const ratio = DUNGEON_RATIO[type];
  return {
    characterId: `dungeon-${type}-${stage}`,
    name: `${type === "gold" ? "골드" : type === "gem" ? "다이아" : "경험치"} 던전 몬스터 ${stage}층`,
    role: "monster",
    atk: Math.round(unit * ratio.atk),
    hp: Math.round(unit * ratio.hp * 8),
    def: Math.round(unit * ratio.def),
    mana: 100,
    spd: 1.0,
    critRate: 0.05,
    critDmg: 1.4,
    pen: 0,
    res: 0,
    skills: [],
    weakRole: DUNGEON_WEAK_ROLE[type],
    weakRoleBonusMult: DUNGEON_WEAK_ROLE_BONUS_MULT,
  };
}

export function dungeonReward(type, stage) {
  return Math.round(BASE_REWARD[type] * Math.pow(DUNGEON_REWARD_RATIO, stage - 1));
}

export function dungeonTip(type) {
  return DUNGEON_TIPS[type];
}

// 클라이언트가 지금 상태(stage/maxStage/attemptsUsed)를 그대로 보내주면, 전투를
// 시뮬레이션하고 "다음 상태"를 계산해서 돌려준다(무상태 — stages.js /challenge와 동일한
// 패턴). team은 이미 5인 배치(buildFormedTeam)를 마친 배열이어야 한다.
export function resolveDungeonAttempt({ type, team, stage, maxStage, attemptsUsed, timeLimitSeconds }) {
  if (!DUNGEON_TYPES.includes(type)) throw new Error(`알 수 없는 던전 타입: ${type}`);
  if (attemptsUsed >= DUNGEON_MAX_ATTEMPTS) {
    return { error: "오늘 도전 횟수를 모두 사용했어요. 새 스테이지를 최초 클리어하면 횟수가 다시 채워져요." };
  }

  const enemy = dungeonEnemy(type, stage);
  const result = simulateBattle(team, [enemy], { timeLimitSeconds: timeLimitSeconds || 20 });
  const win = result.winner === "A";

  if (!win) {
    // 실패는 도전 횟수를 전혀 소모하지 않는다(기존 게임 최종 버전 원칙).
    return { win: false, stage, maxStage, attemptsUsed, attemptsMax: DUNGEON_MAX_ATTEMPTS, hits: result.hits, endedAt: result.t, enemy };
  }

  const isFirstClear = stage >= maxStage && stage < DUNGEON_MAX_STAGE;
  const reward = Math.round(dungeonReward(type, stage) * (isFirstClear ? 1 : REPLAY_REWARD_RATE));
  const nextStage = isFirstClear ? Math.min(DUNGEON_MAX_STAGE, stage + 1) : stage;
  const nextMaxStage = Math.max(maxStage, nextStage);
  const nextAttemptsUsed = isFirstClear ? 0 : Math.min(DUNGEON_MAX_ATTEMPTS, attemptsUsed + 1);

  return {
    win: true,
    reward,
    isFirstClear,
    advanced: isFirstClear,
    stage: nextStage,
    maxStage: nextMaxStage,
    attemptsUsed: nextAttemptsUsed,
    attemptsMax: DUNGEON_MAX_ATTEMPTS,
    attemptsRefilled: isFirstClear,
    hits: result.hits,
    endedAt: result.t,
    enemy,
  };
}
