import { nextRarity, promotionCost, exPromotionReady, exPromotionCost, exLevelUpGoldCost, EX_PROMOTE_COST, RARITY_CHAIN } from "../server/data/promotion.js";
import { pickCharacter, gachaRates, CHARS_BY_RARITY, ssrWeightForLevel, xrWeightForLevel, hiddenHeroChanceForLevel, xxrChanceForLevel, XXR_MIN_LEVEL, HARD_PITY } from "../server/data/gacha.js";
import { characterStatsAt, ROSTER } from "../server/data/characters.js";

console.log("=== 1. 승급 체인 — N→R→SR→SSR→XR, XR 이후는 null ===");
console.log(RARITY_CHAIN);
console.assert(nextRarity("N") === "R" && nextRarity("R") === "SR" && nextRarity("SR") === "SSR" && nextRarity("SSR") === "XR", "정상 승급 체인 순서");
console.assert(nextRarity("XR") === null, "XR 다음은 없어야 함(정상 체인 끝)");
console.assert(nextRarity("HR") === null && nextRarity("XXR") === null, "HR/XXR은 체인 밖(승급 불가)");

console.log("\n=== 2. 승급 비용 — 태초 등급별 차등, XR에서는 더 이상 승급 불가 ===");
const costNtoR = promotionCost("N", "N");
const costRtoSR_fromN = promotionCost("N", "R"); // 태초 N이 R까지 승급해 올라온 경우
const costRtoSR_fromR = promotionCost("R", "R"); // 태초 R
console.log({ costNtoR, costRtoSR_fromN, costRtoSR_fromR });
console.assert(costNtoR.shardCost === 2 && costNtoR.nextRarity === "R", "N->R 조각 2개");
console.assert(costRtoSR_fromN.shardCost === 14 && costRtoSR_fromR.shardCost === 14, "R->SR 구간은 태초N/R이 동률(14)");
console.assert(promotionCost("N", "XR") === null, "XR은 더 이상 승급 불가");

console.log("\n=== 3. EX 프레스티지 — XR에서만 승급 가능, 태초 등급별 비용 차등 ===");
console.assert(exPromotionReady("XR") === true, "XR은 EX 승급 가능해야 함");
console.assert(exPromotionReady("SSR") === false, "SSR은 아직 EX 승급 불가(XR까지 먼저 승급해야 함)");
console.log(EX_PROMOTE_COST);
console.assert(exPromotionCost("N").shard === 500 && exPromotionCost("XR").shard === 40, "태초 등급이 낮을수록 EX 승급에 조각이 더 많이 필요");
console.log({ exLevelUpGoldAt60: exLevelUpGoldCost(60) });

console.log("\n=== 4. 가챠 — pickCharacter가 항상 유효한 캐릭터를 반환하는지 ===");
for (let i = 0; i < 200; i++) {
  const { character, rarity } = pickCharacter();
  console.assert(character && character.id, "캐릭터가 반환되어야 함");
  console.assert(character.rarity === rarity, "반환된 등급과 캐릭터의 태초 등급이 일치해야 함");
}
console.log("gacha rates:", gachaRates());

console.log("\n=== 5. 가챠 1만회 샘플 — 등급별 비율이 설계 가중치에 근접하는지 ===");
const sampleCounts = {};
const SAMPLE = 20000;
for (let i = 0; i < SAMPLE; i++) {
  const { rarity } = pickCharacter();
  sampleCounts[rarity] = (sampleCounts[rarity] || 0) + 1;
}
console.log(sampleCounts);
const observedNPct = (sampleCounts.N / SAMPLE) * 100;
const expectedNPct = gachaRates().N;
console.assert(Math.abs(observedNPct - expectedNPct) < 5, `N등급 실측(${observedNPct.toFixed(1)}%)이 설계값(${expectedNPct.toFixed(1)}%)과 비슷해야 함`);

console.log("\n=== 6. 계정 레벨에 따라 가챠 확률이 오르는지(민수님 지적 — 복구 확인) ===");
console.log({
  ssrAtLv1: ssrWeightForLevel(1), ssrAtLv100: ssrWeightForLevel(100),
  xrAtLv1: xrWeightForLevel(1), xrAtLv100: xrWeightForLevel(100),
  hrAtLv1: hiddenHeroChanceForLevel(1), hrAtLv100: hiddenHeroChanceForLevel(100),
  xxrAtLv49: xxrChanceForLevel(49), xxrAtLv50: xxrChanceForLevel(50), xxrAtLv100: xxrChanceForLevel(100),
});
console.assert(ssrWeightForLevel(1) < 0.001 && ssrWeightForLevel(100) > 1, "SSR 확률은 레벨 1에서 거의 0, 레벨 100에서 1%대까지 올라야 함");
console.assert(ssrWeightForLevel(100) > ssrWeightForLevel(50) && ssrWeightForLevel(50) > ssrWeightForLevel(1), "SSR 확률은 레벨에 비례해 단조증가해야 함");
console.assert(xrWeightForLevel(1) < xrWeightForLevel(100), "XR 확률도 레벨에 비례해 올라야 함");
console.assert(hiddenHeroChanceForLevel(1) < hiddenHeroChanceForLevel(100), "HR 확률도 레벨에 비례해 올라야 함");
console.assert(xxrChanceForLevel(XXR_MIN_LEVEL - 1) === 0, `XXR은 ${XXR_MIN_LEVEL}레벨 미만에서는 절대 등장하지 않아야 함`);
console.assert(xxrChanceForLevel(XXR_MIN_LEVEL) === 0 && xxrChanceForLevel(100) > 0, "XXR은 50레벨에서 0으로 시작해 100레벨까지 서서히 오름");

console.log("\n=== 7. 가챠 천장(하드 핏티) — HARD_PITY회 안에 SSR이 강제 확정되는지 ===");
let pity = 0;
let gotSsrOrAbove = false;
for (let i = 0; i < HARD_PITY; i++) {
  const r = pickCharacter({ level: 1, pity });
  pity = r.pity;
  if (["SSR", "XR", "HR", "XXR"].includes(r.rarity)) { gotSsrOrAbove = true; break; }
}
console.assert(gotSsrOrAbove, `레벨 1이어도 ${HARD_PITY}회 안에는 반드시 SSR 이상이 나와야 함(천장)`);

console.log("\n=== 8. 승급석은 레벨 100 미만에서는 가챠로 드랍되지 않는지 ===");
let stoneGainedBelow100 = 0;
for (let i = 0; i < 5000; i++) stoneGainedBelow100 += pickCharacter({ level: 50, pity: 0 }).stoneGain;
console.assert(stoneGainedBelow100 === 0, "레벨 100 미만에서는 가챠 승급석 드랍이 전혀 없어야 함");

console.log("\n=== 9. 승급이 실제 전투 스탯에 반영되는지 (N 캐릭터를 SSR로 승급시켰다고 가정) ===");
const sample = ROSTER.find((c) => c.rarity === "N");
const atOrigin = characterStatsAt(sample.id, 15); // currentRarity 생략 -> 태초 등급(N) 그대로
const atPromoted = characterStatsAt(sample.id, 15, "SSR"); // 승급 후(현재 등급 SSR로 덮어씀)
console.log({ id: sample.id, originAtk: atOrigin.atk, promotedAtk: atPromoted.atk, originBurst: atOrigin.skills[0], promotedBurst: atPromoted.skills[0] });
console.assert(atPromoted.atk > atOrigin.atk, "승급하면 atk가 올라가야 함");
console.assert(atPromoted.originRarity === "N" && atPromoted.rarity === "SSR", "태초 등급은 유지되고 현재 등급만 바뀌어야 함(조각 풀 계산에 쓰임)");

console.log("\n모든 검증 통과(assert 실패가 위에 없으면 OK).");
