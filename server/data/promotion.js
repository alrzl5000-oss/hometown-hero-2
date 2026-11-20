// ============================================================================
// 게임 2.0 — 등급 승급(조각+골드) / EX 프레스티지 승급 메타 시스템
// ============================================================================
// 민수님 결정: "캐릭터 등급제는 무조건 있어야해" — 기존 라이브 게임의 등급 체계
// (N→R→SR→SSR→XR 정상 승급 체인 + HR/XXR/EX 별도 경로)를 2.0에도 그대로 가져온다.
//
// [중요] 조각 요구량(PROMOTE_SHARD_COST)과 EX 승급 비용(EX_PROMOTE_COST)은 "태초 등급별
// 차등"이 이미 내재된 값이다 — 조각은 캐릭터의 "태초 등급"(server/data/characters.js의
// ROSTER.rarity, 승급해도 절대 안 바뀜) 뽑기 풀에서만 나오기 때문에, 등급 풀마다 캐릭터
// 1명당 뽑힐 확률이 달라서 같은 "구간"이라도 태초 등급에 따라 실제 난이도가 다르다. 기존
// 게임에서 이미 이 불공평을 없애려고 여러 차례 재조정한 값이라, 레벨캡이 바뀐 지금도
// (레벨캡은 승급과 무관한 축이라) 그대로 재사용한다.

export const RARITY_CHAIN = ["N", "R", "SR", "SSR", "XR"]; // 정상 승급 체인(HR/XXR은 별도 경로라 포함 안 함)

export function nextRarity(rarity) {
  const idx = RARITY_CHAIN.indexOf(rarity);
  if (idx === -1 || idx === RARITY_CHAIN.length - 1) return null; // HR/XXR/EX는 이 체인 밖 — 항상 null
  return RARITY_CHAIN[idx + 1];
}

// [태초 등급][목표 등급] 조각 요구량 — 기존 게임에서 "구간을 완료하는 데 걸리는 기대
// 뽑기 횟수가 태초 등급과 무관하게 같아지도록" 역산해 둔 값을 그대로 이식.
export const PROMOTE_SHARD_COST = {
  N: { N: 2 }, // N -> R
  R: { N: 14, R: 14 }, // R -> SR
  SR: { N: 156, R: 155, SR: 69 }, // SR -> SSR
  SSR: { N: 188, R: 186, SR: 83, SSR: 20 }, // SSR -> XR
};
export const PROMOTE_GOLD_COST = { N: 2500, R: 12000, SR: 60000, SSR: 300000 };

// originRarity: 캐릭터의 태초 등급(ROSTER.rarity, 고정). currentRarity: 지금 등급(승급 반영).
// 반환: { shardCost, goldCost, nextRarity } 또는 null(더 이상 승급 불가 — XR 도달, 또는
// HR/XXR처럼 이 체인 밖의 등급).
export function promotionCost(originRarity, currentRarity) {
  const next = nextRarity(currentRarity);
  if (!next) return null;
  const shardTable = PROMOTE_SHARD_COST[currentRarity];
  const shardCost = shardTable ? shardTable[originRarity] : undefined;
  if (shardCost === undefined) return null; // 태초 등급이 이 구간의 조각 풀에 없는 경우(이론상 발생 안 함)
  return { shardCost, goldCost: PROMOTE_GOLD_COST[currentRarity], nextRarity: next };
}

// ---------------------------------------------------------------------------
// EX 프레스티지 승급 — 정상 체인(N~XR) 밖의 별도 경로. XR까지 도달한 캐릭터만 시도 가능.
// ---------------------------------------------------------------------------
export function exPromotionReady(currentRarity) {
  return currentRarity === "XR";
}

// 태초 등급별 EX 승급 비용 — 기존 게임 값을 그대로 이식(조각은 여전히 태초 등급 풀에서만
// 나오므로, 여기서도 똑같이 태초 등급별 차등이 필요).
export const EX_PROMOTE_COST = {
  N: { shard: 500, stone: 1, gold: 500_000_000, dia: 300_000 },
  R: { shard: 480, stone: 1, gold: 500_000_000, dia: 300_000 },
  SR: { shard: 260, stone: 1, gold: 500_000_000, dia: 300_000 },
  SSR: { shard: 100, stone: 1, gold: 500_000_000, dia: 300_000 },
  XR: { shard: 40, stone: 1, gold: 500_000_000, dia: 300_000 },
};

export function exPromotionCost(originRarity) {
  return EX_PROMOTE_COST[originRarity] || null;
}

// EX 등급 자체 레벨업 비용(레벨캡이 characters.js에서 60으로 상향됐지만, 공식은 기존 게임과
// 동일하게 재사용 — 레벨이 높아진 만큼 자연히 더 비싸진다. level^1.8 formula).
export function exLevelUpGoldCost(level) {
  return Math.floor(120 * 512 * Math.pow(level, 1.8));
}
export function exLevelUpDiaCost(level) {
  return Math.floor(40 * Math.pow(level, 1.8));
}

// ---------------------------------------------------------------------------
// 비-EX(N~XR) 골드 레벨업 — 1.0의 "골드만으로 레벨업" 메커니즘을 그대로 이식.
// [1차 추정치 — 실측 필요] exLevelUpGoldCost의 level^1.8 곡선과 같은 모양이지만,
// 지수를 살짝 낮춰(1.6) "EX보다는 싸게" 설계했다 — EX 프레스티지가 메타 최종
// 목표인데 그 이전 단계(정상 승급 체인) 레벨업이 더 비싸면 진행 순서가 뒤집히므로,
// 반드시 EX_LEVEL_UP 곡선보다 낮게 유지해야 한다.
// ---------------------------------------------------------------------------
export const LEVEL_UP_GOLD_BASE = { N: 40, R: 90, SR: 220, SSR: 600, XR: 1600, HR: 1600, XXR: 1600, EX: 1600 };
export const LEVEL_UP_GOLD_EXPONENT = 1.6;
export function baseLevelUpGoldCost(rarity, level) {
  const base = LEVEL_UP_GOLD_BASE[rarity] ?? LEVEL_UP_GOLD_BASE.N;
  return Math.max(1, Math.floor(base * Math.pow(Math.max(1, level), LEVEL_UP_GOLD_EXPONENT)));
}

// ---------------------------------------------------------------------------
// EX 스타(5성 합성) — EX 프레스티지 승급 이후의 "진짜 최종 성장" 단계. 1.0은 EX
// 승급 때 넘치는 조각을 계정 공용 "버려진 조각"(discarded_shards)으로 전환해뒀다가,
// 승급석과 함께 소모해 캐릭터별로 별 1~5성을 올린다(EX_STAR_MAX). 정확한 비용표는
// 1.0의 characters.js에서 get_page_text 50,000자 제한에 걸려 원문을 못 읽었으므로
// [1차 추정치 — 실측 필요], EX_PROMOTE_COST(태초 등급별 차등)와 같은 비례를 유지해
// 새로 설계했다 — 태초 등급이 낮을수록(=버려진 조각 수급이 더 쉬운) 별 1개당 더 많은
// 조각을, 승급석은 별이 오를수록 더 많이 요구한다.
// ---------------------------------------------------------------------------
export const EX_STAR_MAX = 5;
export const EX_STAR_STAT_BONUS_PER_STAR = 0.05; // 별 1개당 전투 스탯(atk/hp/def) +5%

const EX_STAR_SHARD_BASE = { N: 60, R: 55, SR: 45, SSR: 30, XR: 15 };
export function exStarUpCost(star, originRarity) {
  if (star < 1 || star > EX_STAR_MAX) return null;
  const shardBase = EX_STAR_SHARD_BASE[originRarity] ?? EX_STAR_SHARD_BASE.N;
  return {
    star,
    shard: Math.round(shardBase * Math.pow(1.6, star - 1)),
    stone: star, // 1성→1개, 5성→5개
    originRarity,
  };
}

// ---------------------------------------------------------------------------
// 승급석 제작 — "버려진 조각"을 모아 승급석으로 바꾼다(1.0의 craft-promotion-stone).
// 재료는 항상 소모(실패해도 조각/골드는 사라짐 — 1.0 설계 그대로), 성공해야 승급석 +1.
// 태초 등급이 높을수록(조각 자체가 희귀) 적은 조각/높은 성공률로 보정했다.
// [1차 추정치 — 실측 필요]
// ---------------------------------------------------------------------------
export const PROMOTION_STONE_CRAFT_RECIPE = {
  N: { shard: 30, gold: 50_000, successRate: 0.15 },
  R: { shard: 25, gold: 100_000, successRate: 0.3 },
  SR: { shard: 20, gold: 200_000, successRate: 0.5 },
  SSR: { shard: 15, gold: 400_000, successRate: 0.7 },
  XR: { shard: 10, gold: 800_000, successRate: 0.9 },
};
export function promotionStoneCraftCost(rarity) {
  return PROMOTION_STONE_CRAFT_RECIPE[rarity] || null;
}
