// ============================================================================
// 게임 2.0 — PvP(대결) + 랭킹 순수 로직 테스트
// ============================================================================
// DB(players/pvp_matches)가 필요한 라우트(실제 매칭/레이팅 반영)는 여기서 테스트하지
// 않고, server/data/pvp.js의 순수 계산 함수(Elo/보상/회복/상대뽑기)만 검증한다.
import {
  expectedScore, pvpRatingChange, pvpGoldReward, pvpDiaReward, estimateTeamPower,
  regenPvpAttempts, pickRandomOpponent, PVP_MAX_ATTEMPTS, PVP_ATTEMPT_REGEN_SECONDS, PVP_RATING_START,
} from "../server/data/pvp.js";

console.log("=== 1. expectedScore — 동률이면 0.5, 레이팅이 높을수록 기대승률도 높아야 함 ===");
console.assert(Math.abs(expectedScore(1200, 1200) - 0.5) < 1e-9, "동일 레이팅은 기대승률 0.5여야 함");
console.assert(expectedScore(1600, 1200) > 0.5, "레이팅이 높으면 기대승률도 0.5보다 커야 함");
console.assert(expectedScore(1200, 1600) < 0.5, "레이팅이 낮으면 기대승률도 0.5보다 작아야 함");

console.log("\n=== 2. pvpRatingChange — 이기면 오르고 지면 내려가며, 제로섬이어야 함 ===");
const even = pvpRatingChange(1200, 1200, true);
console.log({ even });
console.assert(even.deltaA > 0, "이기면 레이팅이 올라야 함");
console.assert(even.deltaA === -even.deltaB, "제로섬(A가 얻은 만큼 B가 잃어야 함)이어야 함");
const lose = pvpRatingChange(1200, 1200, false);
console.assert(lose.deltaA < 0, "지면 레이팅이 내려가야 함");

console.log("\n=== 3. 업셋 보너스 — 낮은 레이팅이 높은 레이팅을 이기면 변동폭이 더 커야 함 ===");
const upsetWin = pvpRatingChange(1000, 1600, true); // 격차 600(최대 보너스 구간 초과) — 낮은 쪽이 이김
const normalWin = pvpRatingChange(1200, 1200, true); // 격차 0
console.log({ upsetWin, normalWin });
console.assert(upsetWin.deltaA > normalWin.deltaA, "업셋(불리한 쪽이 이김)이면 일반 승리보다 변동폭이 커야 함");
const favoredWin = pvpRatingChange(1600, 1000, true); // 유리한 쪽이 이김 — 보너스 없음
console.assert(favoredWin.deltaA < upsetWin.deltaA, "유리한 쪽이 이기면 업셋 보너스가 없어야 함(변동폭이 더 작음)");

console.log("\n=== 4. 보상 — 이길 확률이 낮았을수록(expectedScore가 낮을수록) 골드 보상이 커야 함 ===");
const goldUnderdog = pvpGoldReward(50, true, 0.1); // 10% 확률로 이김(언더독)
const goldFavored = pvpGoldReward(50, true, 0.9); // 90% 확률로 이김(압도적 우세)
console.log({ goldUnderdog, goldFavored });
console.assert(goldUnderdog > goldFavored, "이길 확률이 낮았던 승리가 더 큰 골드 보상을 줘야 함");
console.assert(pvpGoldReward(50, false, 0.5) < pvpGoldReward(50, true, 0.5), "패배 보상은 승리 보상보다 작아야 함");
console.assert(pvpGoldReward(200, true, 0.5) > pvpGoldReward(10, true, 0.5), "파밍 진행도(maxStage)가 높을수록 PvP 골드 보상도 커야 함");
console.assert(pvpDiaReward(true) > pvpDiaReward(false), "승리 다이아 보상이 패배보다 커야 함");

console.log("\n=== 5. estimateTeamPower — 팀이 강할수록(더 높은 atk/hp/def) 전투력도 커야 함 ===");
const weakTeam = [{ atk: 100, hp: 1000, def: 50, critRate: 0, critDmg: 1 }];
const strongTeam = [{ atk: 1000, hp: 10000, def: 500, critRate: 0.3, critDmg: 2 }];
console.assert(estimateTeamPower(strongTeam) > estimateTeamPower(weakTeam), "스탯이 더 좋은 팀이 전투력도 더 높아야 함");
console.assert(estimateTeamPower([]) === 0, "빈 팀의 전투력은 0이어야 함");

console.log("\n=== 6. regenPvpAttempts — 시간이 지나면 횟수가 회복되고, 최대치를 넘지 않아야 함 ===");
const now = Date.now();
const past = new Date(now - PVP_ATTEMPT_REGEN_SECONDS * 3 * 1000).toISOString();
const regen3 = regenPvpAttempts({ attempts: 0, lastRegenAt: past, now: new Date(now) });
console.log({ regen3 });
console.assert(regen3.attempts === 3, "3회 회복 구간이 지났으면 정확히 3회 회복되어야 함");
const regenCap = regenPvpAttempts({ attempts: PVP_MAX_ATTEMPTS - 1, lastRegenAt: past, now: new Date(now), maxAttempts: PVP_MAX_ATTEMPTS });
console.assert(regenCap.attempts === PVP_MAX_ATTEMPTS, "최대치를 넘어 회복되지 않아야 함");
const noElapsed = regenPvpAttempts({ attempts: 2, lastRegenAt: new Date(now).toISOString(), now: new Date(now) });
console.assert(noElapsed.attempts === 2, "시간이 지나지 않았으면 회복되지 않아야 함");

console.log("\n=== 7. pickRandomOpponent — 레이팅이 가까운 후보 풀에서만 뽑아야 함 ===");
const candidates = [
  { id: "a", pvp_rating: 1200 }, { id: "b", pvp_rating: 1210 }, { id: "c", pvp_rating: 3000 },
];
for (let i = 0; i < 20; i++) {
  const picked = pickRandomOpponent(candidates, 1200, 2);
  console.assert(picked.id === "a" || picked.id === "b", "레이팅이 가까운 2명(a,b) 안에서만 뽑혀야 함(격차가 큰 c는 제외)");
}
console.assert(pickRandomOpponent([], 1200) === null, "후보가 없으면 null을 반환해야 함");

console.log("\n모든 검증 통과(assert 실패가 위에 없으면 OK).");
