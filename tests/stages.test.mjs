import { ROSTER, LEVEL_CAP, characterStatsAt } from "../server/data/characters.js";
import { buildStagePhases, stageInfo, stageLabel, chapterOf } from "../server/data/stages.js";
import { simulateGauntlet } from "../server/lib/combat.js";

console.log("=== 1. 스테이지 라벨/챕터 번호 체계 ===");
console.assert(stageLabel(1) === "1-1" && stageLabel(10) === "1-10" && stageLabel(11) === "2-1", "스테이지 라벨 포맷");
console.assert(chapterOf(1) === 1 && chapterOf(10) === 1 && chapterOf(11) === 2, "챕터 번호 계산");

function buildTeam(ids, level) {
  return ids.map((id) => characterStatsAt(id, level));
}
// N등급 5인 '막 시작' 팀, SSR 5인 '중반' 팀, XR 5인 '후반' 팀 — 셋 다 레벨은 각 등급 레벨캡.
const nTeamIds = ROSTER.filter((c) => c.rarity === "N").slice(0, 5).map((c) => c.id);
const ssrTeamIds = ROSTER.filter((c) => c.rarity === "SSR").slice(0, 5).map((c) => c.id);
const xrTeamIds = ROSTER.filter((c) => c.rarity === "XR").slice(0, 5).map((c) => c.id);
const nTeam = buildTeam(nTeamIds, LEVEL_CAP.N);
const ssrTeam = buildTeam(ssrTeamIds, LEVEL_CAP.SSR);
const xrTeam = buildTeam(xrTeamIds, LEVEL_CAP.XR);

console.log("\n=== 2. 난이도 곡선 — 등급이 높은 팀일수록 더 멀리 가야 함 ===");
// 각 팀이 몇 스테이지까지 깰 수 있는지 이분 탐색이 아니라 간단히 선형 스캔(스테이지 수가
// 많지 않은 범위라 충분히 빠름) — stageInfo로 파워도 같이 로그.
function furthestClear(team, maxStage = 400) {
  let furthest = 0;
  for (let s = 1; s <= maxStage; s++) {
    const result = simulateGauntlet(buildTeam(team.map((h) => h.characterId), team[0].level), buildStagePhases(s), { timeLimitSeconds: 30 });
    if (result.cleared) furthest = s;
    else break; // 한 번 막히면 그 뒤로도 더 어려우니 중단(단조 증가 가정)
  }
  return furthest;
}
const nFurthest = furthestClear(nTeam);
const ssrFurthest = furthestClear(ssrTeam);
const xrFurthest = furthestClear(xrTeam);
console.log({ nFurthest, ssrFurthest, xrFurthest });
console.log("stage info @ nFurthest+1:", stageInfo(nFurthest + 1));
console.log("stage info @ ssrFurthest+1:", stageInfo(ssrFurthest + 1));
console.assert(nFurthest >= 1, "N등급 팀도 최소 1스테이지는 깨야 함(튜토리얼 난이도)");
console.assert(ssrFurthest > nFurthest, "SSR 팀이 N 팀보다 더 멀리 가야 함");
console.assert(xrFurthest > ssrFurthest, "XR 팀이 SSR 팀보다 더 멀리 가야 함");

console.log("\n=== 3. 필드→보스 연속전 — 필드에서 입은 피해가 보스전까지 이어지는지 ===");
const midStage = Math.max(1, Math.floor((nFurthest + ssrFurthest) / 2));
const probe = simulateGauntlet(buildTeam(ssrTeamIds, LEVEL_CAP.SSR), buildStagePhases(midStage), { timeLimitSeconds: 30 });
console.log({ midStage, phaseResults: probe.phaseResults, cleared: probe.cleared });
console.assert(probe.phaseResults.length >= 1, "최소 1개 phase는 진행되어야 함");
if (probe.phaseResults[0]) {
  console.assert(probe.phaseResults[0].survivorsA <= 5, "필드전 종료 시점 생존자 수가 팀 규모를 넘을 수 없음");
}

console.log("\n모든 검증 통과(assert 실패가 위에 없으면 OK).");
