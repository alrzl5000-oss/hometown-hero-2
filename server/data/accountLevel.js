// ============================================================================
// 게임 2.0 — 계정 레벨/경험치 시스템
// ============================================================================
// 기존 게임(`alrzl5000-oss/minsu100`)의 server/lib/abilities.js 상단부(계정 레벨/경험치
// 계산)를 그대로 포팅. 민수님이 "계정 레벨에 따라 [가챠] 확률 오르는 것도 멋대로 뺐더라"고
// 지적한 부분 — 가챠 레벨 스케일링(gacha.js)과 어빌리티 시스템(abilities.js) 둘 다 이
// "계정 레벨"이 있어야 작동하는데, 2.0엔 이 축 자체가 아예 없었다. 여기서 먼저 잡는다.
//
// [범위] 지금은 순수 계산 함수만 둔다 — 실제 유저별 level/exp가 어디 저장되는지는
// server/index.js의 players 테이블에 연결(이번에 컬럼 추가)한다.

// 처치(킬)당 지급 경험치 — 스테이지 번호의 제곱에 비례하는 완만한 곡선.
// [히스토리 그대로 이식] 기존 게임은 원래 골드/다이아와 같은 지수곡선을 썼다가, "약한
// 계정은 경험치가 반올림 하한(1)에 눌리고 강한 계정은 폭증한다"는 구조적 문제를 겪고
// 경험치만 따로 분리해 다항(스테이지²) 곡선으로 바꿨다. 2.0은 스테이지 난이도 곡선
// (server/data/stages.js)이 기존 게임과 다르지만, 체감 파밍 구간(N 25층/SSR 92층/XR
// 109층)이 기존 게임이 재조정 당시 실측한 구간(저활등 계정 19층대)과 크게 다르지 않은
// 자릿수라 계수(0.01)를 그대로 가져온다. [1차 추정치 — 실측 필요, 2.0 스테이지 보상
// 자체가 아직 없어 정확한 파밍 구간을 알 수 없음]
export function expPerKill(stage) {
  const s = Math.max(1, stage || 1);
  return Math.max(1, Math.round(0.01 * s * s));
}

// 계정 레벨업에 필요한 경험치("경험치통") — 기존 게임이 "너무 안 오른다"는 피드백으로
// 최종 재조정한 완만한 공식을 그대로 이식(10레벨 798 / 25레벨 2524 / 40레벨 4756).
export function expToNextLevel(level) {
  return Math.round(40 * Math.pow(level, 1.3));
}

// 계정 레벨업 1회당 지급하는 다이아 보상 — 300. 그대로 이식했는데, 공교롭게도 2.0의
// DIA_PER_PULL(가챠 1회 300다이아, server/index.js)과 정확히 일치해서 "레벨업 1회 ≈
// 가챠 1회" 체감이 자연히 유지된다(오디세이 최초클리어 보상 때와 같은 우연한 일치).
export const LEVEL_UP_GEM_REWARD = 300;

// 계정 레벨이 오를 때마다 팀 전체 공격력이 조금씩 늘어나는 영구 성장 보너스.
// 레벨당 +0.6%p, 최대 +60%(약 100레벨 근처부터 상한) — 그대로 이식(%이므로 스케일 무관).
export const LEVEL_ATK_BONUS_PER_LEVEL = 0.006;
export const LEVEL_ATK_BONUS_CAP = 0.6;

export function levelAtkBonusMult(level) {
  const lvl = Math.max(1, level || 1);
  return 1 + Math.min(LEVEL_ATK_BONUS_CAP, (lvl - 1) * LEVEL_ATK_BONUS_PER_LEVEL);
}

// exp를 누적 반영해 레벨업을 계산(한 번에 여러 레벨이 오를 수도 있음) — 그대로 이식.
export function applyExp(level, exp, gainedExp) {
  let lvl = Math.max(1, level || 1);
  let e = Math.max(0, exp || 0) + Math.max(0, gainedExp || 0);
  let levelsGained = 0;
  while (e >= expToNextLevel(lvl)) {
    e -= expToNextLevel(lvl);
    lvl += 1;
    levelsGained += 1;
  }
  return { level: lvl, exp: e, levelsGained, gemsGained: levelsGained * LEVEL_UP_GEM_REWARD };
}
