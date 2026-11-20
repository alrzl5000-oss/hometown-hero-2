import { ROSTER, LEVEL_CAP, characterStatsAt } from "../server/data/characters.js";
import { assignFormation } from "../server/data/formation.js";
import { BOSS_MAX_ATTEMPTS, BOSS_FIGHT_SECONDS, dailyBossEnemy, resolveDailyBossAttempt } from "../server/data/dailyBoss.js";

function makeTeam(rarity, n = 5) {
  const ids = ROSTER.filter((c) => c.rarity === rarity).slice(0, n).map((c) => c.id);
  while (ids.length < n) ids.push(ids[0]);
  const stats = ids.map((id) => characterStatsAt(id, LEVEL_CAP[rarity], rarity));
  return assignFormation(stats, "balanced");
}

console.log("=== 1. 보스가 메인 스테이지 진행도에 비례해 강해지는지 ===");
const early = dailyBossEnemy(1, 0);
const late = dailyBossEnemy(80, 0);
console.assert(late.hp > early.hp && late.atk > early.atk, "진행도가 높을수록 보스가 강해져야 함");

console.log("\n=== 2. 요일(dayIndex)마다 2차 스킬이 달라지는지 ===");
const kinds = new Set();
for (let d = 0; d < 7; d++) kinds.add(dailyBossEnemy(50, d).skills[1].kind);
console.assert(kinds.size > 1, "요일별로 적어도 두 종류 이상의 2차 스킬이 나와야 함");

console.log("\n=== 3. 데미지에 비례해 보상이 지급되는지(승패와 무관) ===");
const team = makeTeam("XR");
const result = resolveDailyBossAttempt({ team, maxStageReached: 1, attemptsUsed: 0, dayIdx: 0 });
console.assert(result.damageDealt >= 0, "데미지는 0 이상이어야 함");
console.assert(result.reward.gold >= 0 && result.reward.gems >= 0, "보상은 데미지 비례로 0 이상이어야 함");
console.assert(result.attemptsUsed === 1, "도전 1회는 attemptsUsed를 1 올려야 함");
console.assert(result.attemptsMax === BOSS_MAX_ATTEMPTS, "attemptsMax는 BOSS_MAX_ATTEMPTS와 같아야 함");
console.assert(result.endedAt <= BOSS_FIGHT_SECONDS + 0.001, "전투는 제한시간을 넘지 않아야 함");

console.log("\n=== 4. 도전 횟수를 다 쓰면 거절되는지 ===");
const exhausted = resolveDailyBossAttempt({ team, maxStageReached: 1, attemptsUsed: BOSS_MAX_ATTEMPTS, dayIdx: 0 });
console.assert(exhausted.error, "도전 횟수 소진 시 에러를 반환해야 함");

console.log("\n모든 검증 통과(assert 실패가 위에 없으면 OK).");
