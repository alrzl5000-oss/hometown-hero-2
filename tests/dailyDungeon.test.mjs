import { ROSTER, LEVEL_CAP, characterStatsAt } from "../server/data/characters.js";
import { assignFormation } from "../server/data/formation.js";
import { DUNGEON_TYPES, DUNGEON_MAX_ATTEMPTS, DUNGEON_MAX_STAGE, dungeonEnemy, dungeonReward, resolveDungeonAttempt } from "../server/data/dailyDungeon.js";

function makeTeam(rarity, n = 5) {
  const ids = ROSTER.filter((c) => c.rarity === rarity).slice(0, n).map((c) => c.id);
  while (ids.length < n) ids.push(ids[0]);
  const stats = ids.map((id) => characterStatsAt(id, LEVEL_CAP[rarity], rarity));
  return assignFormation(stats, "balanced");
}

console.log("=== 1. 세 타입 모두 스테이지가 오를수록 몬스터/보상이 커지는지 ===");
for (const type of DUNGEON_TYPES) {
  const e1 = dungeonEnemy(type, 1);
  const e20 = dungeonEnemy(type, 20);
  console.assert(e20.hp > e1.hp && e20.atk > e1.atk, `${type}: 스테이지가 오르면 몬스터가 강해져야 함`);
  const r1 = dungeonReward(type, 1);
  const r20 = dungeonReward(type, 20);
  console.assert(r20 > r1, `${type}: 스테이지가 오르면 보상이 커져야 함`);
}

console.log("\n=== 2. SSR 5인 팀이 저스테이지 골드 던전을 가볍게 이기는지 ===");
const ssrTeam = makeTeam("SSR");
const win1 = resolveDungeonAttempt({ type: "gold", team: ssrTeam, stage: 1, maxStage: 1, attemptsUsed: 0 });
console.assert(win1.win === true, "SSR 5인이 1스테이지 골드 던전은 이겨야 함");
console.assert(win1.isFirstClear === true && win1.attemptsUsed === 0, "최초 클리어는 도전 횟수를 소모하지 않아야 함(리필)");
console.assert(win1.stage === 2, "최초 클리어 시 다음 스테이지로 전진해야 함");

console.log("\n=== 3. 이미 깬 스테이지 재도전은 도전 횟수를 소모(100% 보상)하는지 ===");
const replay = resolveDungeonAttempt({ type: "gold", team: ssrTeam, stage: 1, maxStage: 2, attemptsUsed: 0 });
console.assert(replay.win === true && replay.isFirstClear === false, "이미 깬 스테이지 재도전은 최초 클리어가 아님");
console.assert(replay.attemptsUsed === 1, "재도전은 도전 횟수를 1 소모해야 함");
console.assert(replay.reward === dungeonReward("gold", 1), "재도전도 100% 보상을 받아야 함(REPLAY_REWARD_RATE=1)");
console.assert(replay.stage === 1, "재도전은 스테이지가 그대로여야 함");

console.log("\n=== 4. 도전 횟수를 다 쓰면 거절되는지 ===");
const exhausted = resolveDungeonAttempt({ type: "gold", team: ssrTeam, stage: 1, maxStage: 2, attemptsUsed: DUNGEON_MAX_ATTEMPTS });
console.assert(exhausted.error, "도전 횟수 소진 시 에러를 반환해야 함");

console.log("\n=== 5. N 5인 팀이 DUNGEON_MAX_STAGE 이상에서는 더 못 넘어가는지(상한 검증, 간접) ===");
console.assert(DUNGEON_MAX_STAGE === 45, "스테이지 상한은 45(기존 게임 값)");
const atCap = resolveDungeonAttempt({ type: "exp", team: ssrTeam, stage: DUNGEON_MAX_STAGE, maxStage: DUNGEON_MAX_STAGE, attemptsUsed: 0 });
if (atCap.win) {
  console.assert(atCap.stage === DUNGEON_MAX_STAGE, "상한 스테이지에서는 더 전진하지 않아야 함");
  console.assert(atCap.isFirstClear === false, "상한 스테이지는 이미 최초 클리어된 것으로 취급(반복 재도전)");
}

console.log("\n모든 검증 통과(assert 실패가 위에 없으면 OK).");
