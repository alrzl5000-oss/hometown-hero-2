// ============================================================================
// 게임 2.0 — 원소 상성(fire>wind>water) 테스트
// ============================================================================
// 민수님 요청: "원소 상성 배율을 2.0 combat.js에 적용" — 1.0의 순환 상성(불리하면 0.85배,
// 유리하면 1.25배, 같은/없는 원소는 1배)을 combat.js에 실제로 꽂았는지 검증한다.
// 핵심: (1) 파밍 잡몹(원소 없음)은 상성 영향이 전혀 없어야 하고, (2) 층보스/PvP처럼
// 원소가 있는 전투에선 상성이 실제로 승패에 영향을 줘야 한다.
import { elementalMultiplier, makeFighter } from "../server/lib/combat.js";
import { simulateBattle } from "../server/lib/combat.js";
import { BOSS_SPECIES, makeBossMonster } from "../server/data/farming.js";

console.log("=== 1. elementalMultiplier — 순환 상성(불>바람>물>불) ===");
console.assert(elementalMultiplier("fire", "wind") === 1.25, "불은 바람에 유리(1.25배)해야 함");
console.assert(elementalMultiplier("wind", "water") === 1.25, "바람은 물에 유리(1.25배)해야 함");
console.assert(elementalMultiplier("water", "fire") === 1.25, "물은 불에 유리(1.25배)해야 함");
console.assert(elementalMultiplier("wind", "fire") === 0.85, "바람은 불에 불리(0.85배)해야 함");
console.assert(elementalMultiplier("fire", "fire") === 1, "같은 원소는 상성 영향이 없어야 함(1배)");
console.assert(elementalMultiplier(null, "fire") === 1, "원소가 없으면(null) 상성 영향이 없어야 함 — 파밍 잡몹 설계");
console.assert(elementalMultiplier("fire", null) === 1, "상대가 원소가 없으면도 마찬가지");

console.log("\n=== 2. makeFighter — hero.element가 fighter에 그대로 실려야 함 ===");
const f1 = makeFighter({ characterId: "x", atk: 100, hp: 1000, def: 10, skills: [], element: "fire" });
console.assert(f1.element === "fire", "makeFighter가 element를 보존해야 함");
const f2 = makeFighter({ characterId: "y", atk: 100, hp: 1000, def: 10, skills: [] });
console.assert(f2.element === null, "element가 없으면 null로 떨어져야 함(상성 1배 처리와 짝 맞음)");

console.log("\n=== 3. 층보스 종(BOSS_SPECIES)에 원소가 배정되어 있어야 함 ===");
console.assert(BOSS_SPECIES.every((b) => ["fire", "wind", "water"].includes(b.element)), "모든 보스 종은 fire/wind/water 중 하나를 가져야 함");
const boss10 = makeBossMonster(10);
console.assert(["fire", "wind", "water"].includes(boss10.element), "makeBossMonster가 반환하는 보스도 element를 가져야 함");

console.log("\n=== 4. 상성이 실제 전투 결과(총 데미지)에 영향을 줘야 함 ===");
// 공격자 원소가 상대에게 유리한 쪽 vs 불리한 쪽, 그 외 스탯은 완전히 동일한 가상의 1:1 대결.
function makeHero(element) {
  return { characterId: `h-${element || "none"}`, atk: 500, hp: 5000, def: 100, spd: 1, critRate: 0, critDmg: 1.5, pen: 0, res: 0, mana: 100, element, skills: [] };
}
const target = () => [{ characterId: "target", atk: 10, hp: 20000, def: 50, spd: 1, critRate: 0, critDmg: 1, pen: 0, res: 0, mana: 100, element: "wind", skills: [] }];
const advResult = simulateBattle([makeHero("fire")], target(), { timeLimitSeconds: 10 });
const disResult = simulateBattle([makeHero("water")], target(), { timeLimitSeconds: 10 });
const advDmg = advResult.hits.filter((h) => h.actor.startsWith("h-")).reduce((s, h) => s + (h.dmg || 0), 0);
const disDmg = disResult.hits.filter((h) => h.actor.startsWith("h-")).reduce((s, h) => s + (h.dmg || 0), 0);
console.log({ advDmg, disDmg, ratio: Math.round((advDmg / disDmg) * 100) / 100 });
console.assert(advDmg > disDmg, "불(fire)이 바람(wind) 상대로 유리해야 하고, 물(water)은 불리해야 하므로 fire측 누적 데미지가 더 커야 함");
// 이론상 1.25/0.85 ≈ 1.47배 차이가 나야 한다(완전 동일 스탯·시간 구간 가정).
console.assert(Math.abs(advDmg / disDmg - 1.25 / 0.85) < 0.05, "데미지 비율이 이론상 상성 배율 비율(1.25/0.85≈1.47)에 근접해야 함");

console.log("\n모든 검증 통과(assert 실패가 위에 없으면 OK).");
