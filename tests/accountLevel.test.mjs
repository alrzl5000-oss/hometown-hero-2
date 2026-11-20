import {
  expPerKill, expToNextLevel, applyExp, levelAtkBonusMult,
  LEVEL_UP_GEM_REWARD, LEVEL_ATK_BONUS_CAP,
} from "../server/data/accountLevel.js";

console.log("=== 1. 처치당 경험치 — 스테이지가 오를수록 커지고, 최소 1 ===");
console.log({ exp1: expPerKill(1), exp25: expPerKill(25), exp100: expPerKill(100) });
console.assert(expPerKill(1) >= 1, "최소 경험치는 1 이상이어야 함");
console.assert(expPerKill(100) > expPerKill(25) && expPerKill(25) > expPerKill(1), "스테이지가 오를수록 처치 경험치도 늘어야 함");

console.log("\n=== 2. 레벨업 요구 경험치 — 레벨이 오를수록 커지는지 ===");
console.log({ lv1: expToNextLevel(1), lv10: expToNextLevel(10), lv25: expToNextLevel(25), lv40: expToNextLevel(40) });
console.assert(expToNextLevel(40) > expToNextLevel(25) && expToNextLevel(25) > expToNextLevel(10) && expToNextLevel(10) > expToNextLevel(1), "레벨이 오를수록 다음 레벨업 요구치도 늘어야 함");

console.log("\n=== 3. applyExp — 경험치를 누적해 한 번에 여러 레벨 업까지 처리하는지 ===");
const r1 = applyExp(1, 0, 10);
console.log({ r1 });
console.assert(r1.level >= 1 && r1.exp >= 0, "레벨/exp는 음수가 될 수 없음");

const needed = expToNextLevel(1) + expToNextLevel(2) + 5; // 2레벨을 올리고 5 남기기
const r2 = applyExp(1, 0, needed);
console.log({ r2 });
console.assert(r2.level === 3 && r2.levelsGained === 2, "요구치를 정확히 맞춰 넣으면 2레벨이 올라야 함");
console.assert(r2.exp === 5, "레벨업 후 남은 exp가 정확히 남아야 함");
console.assert(r2.gemsGained === 2 * LEVEL_UP_GEM_REWARD, `레벨업 2회분 다이아(${2 * LEVEL_UP_GEM_REWARD})가 지급되어야 함`);

const r3 = applyExp(5, 0, 1);
console.assert(r3.level === 5 && r3.levelsGained === 0 && r3.gemsGained === 0, "레벨업이 없으면 다이아 지급도 없어야 함");

console.log("\n=== 4. 계정 레벨 공격력 보너스 — 레벨에 비례해 오르고 상한에서 멈추는지 ===");
console.log({ atLv1: levelAtkBonusMult(1), atLv50: levelAtkBonusMult(50), atLv100: levelAtkBonusMult(100), atLv101: levelAtkBonusMult(101), atLv200: levelAtkBonusMult(200) });
console.assert(levelAtkBonusMult(1) === 1, "레벨 1에서는 보너스가 없어야 함(배율 1)");
console.assert(levelAtkBonusMult(100) > levelAtkBonusMult(50) && levelAtkBonusMult(50) > levelAtkBonusMult(1), "레벨이 오를수록 공격력 배율도 올라야 함");
// 레벨당 +0.6%p이므로 상한(+60%)에 정확히 도달하는 건 (lvl-1)*0.006 >= 0.6 -> lvl>=101.
console.assert(Math.abs(levelAtkBonusMult(100) - 1.594) < 0.001, "레벨 100(상한 도달 직전)에서는 약 +59.4%여야 함");
console.assert(Math.abs(levelAtkBonusMult(101) - (1 + LEVEL_ATK_BONUS_CAP)) < 0.001, "레벨 101부터 상한(+60%)에 도달해야 함");
console.assert(levelAtkBonusMult(200) === levelAtkBonusMult(101), "상한 이후(레벨 200)에는 더 오르지 않고 고정되어야 함");

console.log("\n모든 검증 통과(assert 실패가 위에 없으면 OK).");
