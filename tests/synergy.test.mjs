// ============================================================================
// 게임 2.0 — 컬렉션(도감) 보너스 + 시너지 세트 테스트
// ============================================================================
import { SYNERGY_SETS, GRADE_COUNT_CONFIG, computeCollectionBonus, computeSynergyState, deltasToMult } from "../server/data/synergy.js";
import { ROSTER } from "../server/data/characters.js";

console.log("=== 1. 세트 개수/구조 — 39개, 각 세트는 2명 이상 memberIds와 tiers를 가져야 함 ===");
console.assert(SYNERGY_SETS.length === 39, `시너지 세트는 정확히 39개여야 함(실측 ${SYNERGY_SETS.length})`);
for (const s of SYNERGY_SETS) {
  console.assert(Array.isArray(s.memberIds) && s.memberIds.length >= 2, `${s.id}: memberIds는 2명 이상이어야 함`);
  console.assert(Array.isArray(s.tiers) && s.tiers.length >= 1, `${s.id}: tiers는 최소 1개 이상이어야 함`);
  for (const id of s.memberIds) {
    console.assert(ROSTER.some((c) => c.id === id), `${s.id}: memberId ${id}가 실제 로스터에 존재해야 함`);
  }
}

console.log("\n=== 2. 컬렉션 보너스 — 보유 영웅이 많을수록(종류 기준) 보너스가 커져야 함 ===");
const few = ROSTER.slice(0, 5).map((c) => ({ character_id: c.id, current_rarity: c.rarity }));
const many = ROSTER.slice(0, 50).map((c) => ({ character_id: c.id, current_rarity: c.rarity }));
const bonusFew = computeCollectionBonus(few);
const bonusMany = computeCollectionBonus(many);
console.log({ fewAtk: bonusFew.mult.atkMult, manyAtk: bonusMany.mult.atkMult });
console.assert(bonusMany.mult.atkMult > bonusFew.mult.atkMult, "보유 영웅 수가 많을수록 atkMult도 커져야 함");
console.assert(computeCollectionBonus([]).mult.atkMult === 1, "하나도 보유 안 했으면 보너스가 없어야 함(배율 1)");

console.log("\n=== 3. 등급 마일스톤 — 특정 등급 이상 보유 수가 늘수록 마일스톤이 더 열려야 함 ===");
const xrHeavy = ROSTER.filter((c) => ["XR", "HR", "XXR"].includes(c.rarity)).map((c) => ({ character_id: c.id, current_rarity: c.rarity }));
const xrBonus = computeCollectionBonus(xrHeavy);
console.log({ xrGradeCounts: xrBonus.breakdown.gradeCounts.XR });
console.assert(xrBonus.breakdown.gradeCounts.XR.milestonesHit > 0, "XR 이상을 충분히 보유하면 XR 마일스톤이 열려야 함");
console.assert(xrBonus.breakdown.gradeCounts.SSR.count >= xrBonus.breakdown.gradeCounts.XR.count, "SSR 이상 집계(SSR+XR+HR+XXR)는 XR 이상 집계보다 항상 같거나 커야 함(누적 집계 구조)");

console.log("\n=== 4. 시너지 — 팀에 세트 멤버가 몇 명 있는지에 따라 tier가 결정되어야 함 ===");
const lineage = SYNERGY_SETS.find((s) => s.id === "lineage_baekminsu");
console.log({ lineageMembers: lineage.memberIds });
const teamWithNone = ["h25", "h28", "h31", "h32", "h37"]; // 환상의 용병단 멤버들(민수 라인 아님)
const teamWithTwo = [lineage.memberIds[0], lineage.memberIds[1], "h25", "h28", "h31"];
const stateNone = computeSynergyState(teamWithNone);
const stateTwo = computeSynergyState(teamWithTwo);
const activeNone = stateNone.active.find((a) => a.id === "lineage_baekminsu");
const activeTwo = stateTwo.active.find((a) => a.id === "lineage_baekminsu");
console.assert(!activeNone, "민수 라인 멤버가 0명이면 해당 세트가 active 목록에 없어야 함");
console.assert(activeTwo && activeTwo.activeTierNeed === 2, "민수 라인 멤버가 2명이면 need:2 tier가 발동해야 함");

console.log("\n=== 5. 세트 멤버가 더 많이 모이면 더 높은 tier(더 큰 delta)로 바뀌어야 함 ===");
if (lineage.memberIds.length >= 4) {
  const teamWithFour = [...lineage.memberIds.slice(0, 4), "h25"];
  const stateFour = computeSynergyState(teamWithFour);
  const activeFour = stateFour.active.find((a) => a.id === "lineage_baekminsu");
  console.assert(activeFour.activeTierNeed === 4, "4명이 모이면 need:4(더 높은) tier로 전환되어야 함");
  console.assert(activeFour.delta.atk > activeTwo.delta.atk, "더 높은 tier의 delta가 더 커야 함");
}

console.log("\n=== 6. deltasToMult — 퍼센트 델타를 배율로 올바르게 변환해야 함 ===");
console.assert(Math.abs(deltasToMult({ atk: 10 }).atkMult - 1.1) < 1e-9, "atk:10 => atkMult 1.1이어야 함");
console.assert(deltasToMult({}).atkMult === 1, "델타가 없으면 배율은 1이어야 함");

console.log("\n모든 검증 통과(assert 실패가 위에 없으면 OK).");
