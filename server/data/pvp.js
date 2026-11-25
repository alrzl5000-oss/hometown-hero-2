// ============================================================================
// 게임 2.0 — PvP(대결) + 랭킹
// ============================================================================
// [배경] 1.0(alrzl5000-oss/minsu100)의 server/lib/pvp.js + server/routes/pvp.js를 읽고
// 그대로 이식한 메커니즘:
//   - Elo 기반 레이팅(expectedScore) + "업셋 보너스"(자신보다 레이팅이 훨�다 높은
//     상대를 이기면 레이팅 변동폭이 최대 2배까지 커짐, 격차 400 이상이면 보너스 최대).
//   - 두 트랙 — "랭크전"(rated, 레이팅 변동 있음, 시도 횟수 제한+시간 회복)과
//     "친선전"(friendly, 레이팅 변동 없음, 2026-08-28 변경으로 1.0에서도 무제한이 됐으므로
//     2.0도 처음부터 무제한으로 설계 — 별도 attempts 컬럼이 필요 없다).
//   - 실제 전투는 1.0처럼 별도 simulatePvpFight를 두지 않고, 2.0이 이미 가진
//     server/lib/combat.js의 simulateBattle(1:1 팀전 real-time 시뮬레이션)을 그대로 재사용
//     한다 — 보스전(resolveBossChallenge)도 같은 함수를 쓰므로 엔진이 하나로 통일된다.
//   - 보상(골드)은 "이길 확률이 낮았을수록"(expectedScore가 낮았을수록) 더 많이 주고
//     (0.3배~2.0배), 다이아는 스테이지/레이팅과 거의 무관한 고정량(1.0 설계 그대로).
//
// [2.0에서 새로 정한 것 — 1.0에 없던 스케일 보정]
//   - 보상 상수는 2026-11-25에 1.0 원본(server/lib/pvp.js)을 직접 확인해 그대로 맞췄다.
//   - 1.0은 공수 팀을 4인으로 제한했지만 2.0은 5인 팀제이므로 그 제한은 없앴다.

// ---------------------------------------------------------------------------
// 1. Elo 레이팅
// ---------------------------------------------------------------------------
export const PVP_RATING_START = 1200;
export const PVP_K_BASE = 24;
export const PVP_UPSET_GAP_FOR_MAX_BONUS = 400; // 이 정도 격차부터 보너스가 최대치(2배)
export const PVP_UPSET_MAX_MULT = 2.0;

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// winnerIsA: 공격자(A)가 이겼는지. 반환: {deltaA, deltaB}(제로섬 — B는 A의 반대).
export function pvpRatingChange(ratingA, ratingB, winnerIsA) {
  const expectedA = expectedScore(ratingA, ratingB);
  const actualA = winnerIsA ? 1 : 0;
  // "업셋"(실력상 불리한 쪽이 이김) 정도 — 유리한 쪽이 이기면 보너스 없음(mult=1).
  const underdogGap = winnerIsA ? ratingB - ratingA : ratingA - ratingB;
  const upsetMult = 1 + Math.min(1, Math.max(0, underdogGap) / PVP_UPSET_GAP_FOR_MAX_BONUS) * (PVP_UPSET_MAX_MULT - 1);
  const deltaA = Math.round(PVP_K_BASE * (actualA - expectedA) * upsetMult);
  return { deltaA, deltaB: -deltaA };
}

// ---------------------------------------------------------------------------
// 2. 보상 — 1.0(minsu100 server/lib/pvp.js) 값 그대로.
// ---------------------------------------------------------------------------
// 1.0 lib/pvp.js 그대로:
//  - 골드: 300 × 1.09^(내 최고 스테이지-1) × 배율(2 − 2×기대승률, 0.3~2.0). 패배는 기본의 20%.
//  - 다이아: 승리 1300 + (0.5 − 기대승률)×40 (1280~1320), 패배 260(1300의 20%).
const PVP_REWARD_RATIO = 1.09;
export const PVP_WIN_DIA_BASE = 1300;
export const PVP_WIN_DIA_JITTER = 20;
const PVP_LOSS_REWARD_RATIO = 0.2;
export const PVP_LOSS_DIA = Math.round(PVP_WIN_DIA_BASE * PVP_LOSS_REWARD_RATIO); // 260
export const pvpBaseGold = (stage) => Math.round(300 * Math.pow(PVP_REWARD_RATIO, Math.max(1, stage || 1) - 1));

export function pvpGoldReward(attackerMaxStage, win, expectedScoreForAttacker = 0.5) {
  const base = pvpBaseGold(attackerMaxStage);
  if (!win) return Math.round(base * PVP_LOSS_REWARD_RATIO);
  const mult = Math.max(0.3, Math.min(2.0, 2 - 2 * expectedScoreForAttacker));
  return Math.round(base * mult);
}

export function pvpDiaReward(win, expectedScoreForAttacker = 0.5) {
  if (!win) return PVP_LOSS_DIA;
  return PVP_WIN_DIA_BASE + Math.round((0.5 - expectedScoreForAttacker) * 2 * PVP_WIN_DIA_JITTER);
}

// ---------------------------------------------------------------------------
// 3. 팀 전투력 표시용 추정치(실제 전투 공식과 100% 동일하지 않아도 되는 "대략적인 강함"
//    지표 — 상대 목록 UI에서만 쓰인다).
// ---------------------------------------------------------------------------
export function estimateTeamPower(team) {
  return Math.round(
    (team || []).reduce((sum, h) => {
      if (!h) return sum;
      const critFactor = 1 + (h.critRate || 0) * ((h.critDmg || 1) - 1);
      return sum + (h.atk || 0) * critFactor * 2 + (h.hp || 0) * 0.3 + (h.def || 0) * 3;
    }, 0)
  );
}

// ---------------------------------------------------------------------------
// 4. 랭크전 시도 횟수 — 시간 기반 느린 회복(친선전은 무제한이라 이 로직이 필요 없음).
// ---------------------------------------------------------------------------
export const PVP_MAX_ATTEMPTS = 10;
export const PVP_ATTEMPT_REGEN_SECONDS = 10 * 60; // 10분당 1회

export function regenPvpAttempts({ attempts, lastRegenAt, now, maxAttempts = PVP_MAX_ATTEMPTS, regenIntervalSeconds = PVP_ATTEMPT_REGEN_SECONDS }) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now || Date.now()).getTime();
  const lastMs = new Date(lastRegenAt || nowMs).getTime();
  if (attempts >= maxAttempts) return { attempts: maxAttempts, lastRegenAt: new Date(nowMs).toISOString() };
  const elapsedSeconds = Math.max(0, (nowMs - lastMs) / 1000);
  const regenCount = Math.floor(elapsedSeconds / regenIntervalSeconds);
  if (regenCount <= 0) return { attempts, lastRegenAt: new Date(lastMs).toISOString() };
  const newAttempts = Math.min(maxAttempts, attempts + regenCount);
  const consumedSeconds = regenCount * regenIntervalSeconds;
  return { attempts: newAttempts, lastRegenAt: new Date(lastMs + consumedSeconds * 1000).toISOString() };
}

// ---------------------------------------------------------------------------
// 5. 상대 뽑기 — 레이팅이 가장 가까운 후보 풀(기본 8명)에서 무작위로 하나.
// ---------------------------------------------------------------------------
export function pickRandomOpponent(candidates, myRating, poolSize = 8) {
  if (!candidates || !candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => Math.abs((a.pvp_rating ?? PVP_RATING_START) - myRating) - Math.abs((b.pvp_rating ?? PVP_RATING_START) - myRating));
  const pool = sorted.slice(0, poolSize);
  return pool[Math.floor(Math.random() * pool.length)] || null;
}
