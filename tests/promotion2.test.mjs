// ============================================================================
// 게임 2.0 — 캐릭터 골드 레벨업 + EX 스타(5성 합성) + 승급석 제작 테스트
// ============================================================================
import {
  baseLevelUpGoldCost, LEVEL_UP_GOLD_BASE,
  EX_STAR_MAX, EX_STAR_STAT_BONUS_PER_STAR, exStarUpCost,
  PROMOTION_STONE_CRAFT_RECIPE, promotionStoneCraftCost,
} from "../server/data/promotion.js";

console.log("=== 1. 골드 레벨업 비용 — 레벨이 오를수록, 등급이 높을수록 비싸져야 함 ===");
console.log({ n1: baseLevelUpGoldCost("N", 1), n10: baseLevelUpGoldCost("N", 10), ssr1: baseLevelUpGoldCost("SSR", 1) });
console.assert(baseLevelUpGoldCost("N", 10) > baseLevelUpGoldCost("N", 1), "레벨이 오를수록 비용도 올라야 함");
console.assert(baseLevelUpGoldCost("SSR", 1) > baseLevelUpGoldCost("N", 1), "등급이 높을수록 같은 레벨에서도 더 비싸야 함");
console.assert(baseLevelUpGoldCost("N", 1) >= 1, "비용은 항상 1 이상이어야 함");

console.log("\n=== 2. EX 스타 — 별이 오를수록 조각/승급석 요구량이 늘어야 하고, 최대 5성 ===");
const star1 = exStarUpCost(1, "N");
const star5 = exStarUpCost(5, "N");
console.log({ star1, star5 });
console.assert(star5.shard > star1.shard, "별이 오를수록 조각 요구량이 늘어야 함");
console.assert(star5.stone > star1.stone, "별이 오를수록 승급석 요구량이 늘어야 함");
console.assert(exStarUpCost(EX_STAR_MAX + 1, "N") === null, `최대 별(${EX_STAR_MAX}성)을 넘기면 null을 반환해야 함`);
console.assert(exStarUpCost(0, "N") === null, "0성(아직 승급 전) 요청은 null을 반환해야 함");
// 태초 등급이 낮을수록(버려진 조각 수급이 쉬움) 같은 별에서 조각 요구량이 더 많아야 한다.
const starN = exStarUpCost(1, "N");
const starXR = exStarUpCost(1, "XR");
console.assert(starN.shard > starXR.shard, "태초 등급이 낮을수록(N) 같은 별에서 조각 요구량이 더 많아야 함");

console.log("\n=== 3. 승급석 제작 — 태초 등급이 높을수록 적은 조각/높은 성공률이어야 함 ===");
const recipeN = promotionStoneCraftCost("N");
const recipeXR = promotionStoneCraftCost("XR");
console.log({ recipeN, recipeXR });
console.assert(recipeN.shard > recipeXR.shard, "N등급 조각이 더 흔하므로 더 많이 요구해야 함");
console.assert(recipeXR.successRate > recipeN.successRate, "XR등급(희귀)일수록 제작 성공률이 더 높아야 함");
console.assert(promotionStoneCraftCost("UNKNOWN") === null, "알 수 없는 등급은 null을 반환해야 함");

console.log("\n모든 검증 통과(assert 실패가 위에 없으면 OK).");
