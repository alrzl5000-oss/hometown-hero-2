// EX 별 전투 스탯 보너스 — applyExStarBonus 검증 (assert 실패 시 즉시 throw)
import assert from "node:assert/strict";
import { applyExStarBonus, EX_STAR_MAX, EX_STAR_STAT_BONUS_PER_STAR } from "../server/data/promotion.js";
import { characterStatsAt, LEVEL_CAP, ROSTER } from "../server/data/characters.js";
import { assignFormation } from "../server/data/formation.js";

const id = ROSTER[0].id;
const base = characterStatsAt(id, LEVEL_CAP[ROSTER[0].rarity]);

console.log("=== 1. 별 0개(또는 없음)는 원본 그대로 ===");
assert.equal(applyExStarBonus(base, 0), base);
assert.equal(applyExStarBonus(base, undefined), base);

console.log("=== 2. 별 N개 = atk/hp/def ×(1 + N×보너스), 나머지 스탯은 그대로 ===");
for (let star = 1; star <= EX_STAR_MAX; star++) {
  const s = applyExStarBonus(base, star);
  const m = 1 + star * EX_STAR_STAT_BONUS_PER_STAR;
  assert.equal(s.atk, Math.round(base.atk * m));
  assert.equal(s.hp, Math.round(base.hp * m));
  assert.equal(s.def, Math.round(base.def * m));
  assert.equal(s.spd, base.spd);
  assert.equal(s.exStar, star);
}

console.log("=== 3. 최대 별을 넘는 값은 최대치로 고정, 음수는 0 ===");
assert.deepEqual(applyExStarBonus(base, EX_STAR_MAX + 7), applyExStarBonus(base, EX_STAR_MAX));
assert.equal(applyExStarBonus(base, -3), base);

console.log("=== 4. 원본 객체를 변형하지 않음(불변) ===");
const before = JSON.stringify(base);
applyExStarBonus(base, 3);
assert.equal(JSON.stringify(base), before);

console.log("=== 5. 포메이션 보너스 위에서도 별 효과가 유지됨 ===");
const plain = assignFormation(Array(5).fill(base), "balanced");
const starred = assignFormation(Array(5).fill(applyExStarBonus(base, 5)), "balanced");
for (let i = 0; i < 5; i++) assert.ok(starred[i].atk > plain[i].atk && starred[i].def > plain[i].def);

console.log("\n모든 검증 통과.");
