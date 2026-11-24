// ============================================================================
// 게임 2.0 — 묶음 소환(1/10/100/1000연) + SR 이상 확정 보장
// ============================================================================
// 1.0 구조 그대로: 10연은 SR 이상 1개 확정, 100연은 SR 이상 10개 확정, 1000연은 확정 없이
// 순수 확률(2026-08-30 패치노트 "1000연차는 처음부터 순수 확률"). 가격은 1.0과 같은 10% 할인
// 비율(1.0: 1회 150 / 10회 1350)을 2.0의 1회 300다이아에 적용. [1차 추정치 — 경제 실측 후 조정]
//
// 천장(pity)·승급석 드랍은 pickCharacter를 한 번씩 순서대로 호출해서 그대로 이어간다(묶음이라도
// 1회씩 뽑은 것과 똑같이 천장이 쌓이고 초기화된다).
import { pickCharacter, CHARS_BY_RARITY } from "./gacha.js";

export const GACHA_BUNDLES = {
  1: { count: 1, cost: 300, guaranteeSrPlus: 0 },
  10: { count: 10, cost: 2700, guaranteeSrPlus: 1 },
  100: { count: 100, cost: 27000, guaranteeSrPlus: 10 },
  1000: { count: 1000, cost: 270000, guaranteeSrPlus: 0 },
};
export const GACHA_BUNDLE_SIZES = Object.keys(GACHA_BUNDLES).map(Number);

const RANK = { N: 0, R: 1, SR: 2, SSR: 3, XR: 4, HR: 5, XXR: 6 };
const SR_RANK = RANK.SR;

function pickFrom(pool, rng) {
  return pool[Math.floor(rng() * pool.length)];
}

// 반환: { pulls: [{character, rarity, pool, guaranteed?}], pity, stoneGain, cost, count }
export function pullBundle({ level = 1, pity = 0, size = 1, rng = Math.random } = {}) {
  const bundle = GACHA_BUNDLES[size];
  if (!bundle) throw new Error(`묶음 크기는 ${GACHA_BUNDLE_SIZES.join("/")} 중 하나여야 함 (받은 값: ${size})`);
  let p = pity;
  let stoneGain = 0;
  const pulls = [];
  for (let i = 0; i < bundle.count; i++) {
    const r = pickCharacter({ level, pity: p });
    p = r.pity;
    stoneGain += r.stoneGain;
    pulls.push({ character: r.character, rarity: r.rarity, pool: r.pool });
  }
  // SR 이상 확정 — 부족한 만큼 뒤쪽의 N/R 결과를 SR로 바꿔준다(1.0의 "마지막 칸 확정" 연출과 같은 방향).
  let have = pulls.filter((x) => (RANK[x.rarity] ?? 0) >= SR_RANK).length;
  for (let i = pulls.length - 1; i >= 0 && have < bundle.guaranteeSrPlus; i--) {
    if ((RANK[pulls[i].rarity] ?? 0) < SR_RANK) {
      pulls[i] = { character: pickFrom(CHARS_BY_RARITY.SR, rng), rarity: "SR", pool: "guarantee", guaranteed: true };
      have++;
    }
  }
  return { pulls, pity: p, stoneGain, cost: bundle.cost, count: bundle.count };
}

// 같은 캐릭터가 여러 번 나오면 하나로 묶는다 — DB에 캐릭터당 한 번만 쓰기 위해.
// 반환: Map(characterId → { character, rarity, count })
export function aggregatePulls(pulls) {
  const map = new Map();
  for (const p of pulls) {
    const cur = map.get(p.character.id);
    if (cur) cur.count += 1;
    else map.set(p.character.id, { character: p.character, rarity: p.rarity, count: 1 });
  }
  return map;
}

// 보유 현황(existingById: Map(characterId → player_characters 행))에 묶음 결과를 적용했을 때 생기는 변화.
// 반환: { inserts: [행], shardAdds: Map(id → +n), discarded: {originRarity: +n}, newIds: Set }
export function planBundleApplication(aggregate, existingById) {
  const inserts = [];
  const shardAdds = new Map();
  const discarded = {};
  const newIds = new Set();
  for (const [id, { rarity, count }] of aggregate) {
    const row = existingById.get(id);
    if (!row) {
      newIds.add(id);
      inserts.push({ character_id: id, origin_rarity: rarity, current_rarity: rarity, level: 1, shard_count: count - 1 });
    } else if (row.current_rarity === "EX") {
      discarded[row.origin_rarity] = (discarded[row.origin_rarity] || 0) + count;
    } else {
      shardAdds.set(id, count);
    }
  }
  return { inserts, shardAdds, discarded, newIds };
}
