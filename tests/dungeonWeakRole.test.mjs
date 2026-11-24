// 일일던전 "약점 직업" 보스 — DUNGEON_WEAK_ROLE / weakRoleMultFor 검증 (assert 실패 시 즉시 throw)
import assert from "node:assert/strict";
import { DUNGEON_TYPES, DUNGEON_WEAK_ROLE, DUNGEON_WEAK_ROLE_BONUS_MULT, dungeonEnemy, dungeonTip } from "../server/data/dailyDungeon.js";
import { makeFighter, weakRoleMultFor, simulateBattle } from "../server/lib/combat.js";
import { ROSTER } from "../server/data/characters.js";

const CLASSES = new Set(ROSTER.map((c) => c.class));

console.log("=== 1. 던전 3종 모두 서로 다른, 실제 존재하는 직업을 약점으로 가짐 ===");
const roles = DUNGEON_TYPES.map((t) => DUNGEON_WEAK_ROLE[t]);
for (const r of roles) assert.ok(CLASSES.has(r), `약점 직업 ${r}는 로스터에 있는 직업이어야 함`);
assert.equal(new Set(roles).size, roles.length, "던전마다 약점 직업이 달라야 함");
assert.ok(DUNGEON_WEAK_ROLE_BONUS_MULT > 1, "보너스 배율은 1보다 커야 함");

console.log("=== 2. dungeonEnemy가 weakRole/배율을 실어 보내고, 팁에도 안내됨 ===");
for (const t of DUNGEON_TYPES) {
  const e = dungeonEnemy(t, 10);
  assert.equal(e.weakRole, DUNGEON_WEAK_ROLE[t]);
  assert.equal(e.weakRoleBonusMult, DUNGEON_WEAK_ROLE_BONUS_MULT);
  assert.ok(dungeonTip(t).includes(String(DUNGEON_WEAK_ROLE_BONUS_MULT)), `${t} 팁에 배율 안내가 있어야 함`);
}

console.log("=== 3. makeFighter가 weakRole 필드를 보존 ===");
const f = makeFighter(dungeonEnemy("gold", 5));
assert.equal(f.weakRole, "ranged");
assert.equal(weakRoleMultFor({ role: "ranged" }, f), DUNGEON_WEAK_ROLE_BONUS_MULT);
assert.equal(weakRoleMultFor({ role: "tanker" }, f), 1);
assert.equal(weakRoleMultFor({ role: "ranged" }, makeFighter({ characterId: "x", atk: 1, hp: 1, def: 0 })), 1, "약점 없는 대상은 1배");

console.log("=== 4. 실제 전투에서 약점 직업의 평타 피해가 정확히 배율만큼 큼 ===");
const attacker = (role) => ({ characterId: `a-${role}`, role, atk: 1000, hp: 1e9, def: 0, spd: 1, critRate: 0, critDmg: 1, pen: 0, res: 0, skills: [] });
const dummy = (weak) => ({ ...dungeonEnemy("gold", 1), characterId: "dummy", atk: 0, hp: 1e12, critRate: 0, weakRole: weak ? "ranged" : null });
const firstHit = (role, weak) => simulateBattle([attacker(role)], [dummy(weak)], { timeLimitSeconds: 3 }).hits.find((h) => h.actor === `a-${role}` && h.isSkill === false).dmg;
const base = firstHit("ranged", false);
const boosted = firstHit("ranged", true);
const otherRole = firstHit("tanker", true);
assert.ok(Math.abs(boosted / base - DUNGEON_WEAK_ROLE_BONUS_MULT) < 0.01, `약점 직업 피해 비율 ${boosted / base}`);
assert.ok(Math.abs(otherRole / base - 1) < 0.01, "다른 직업은 보너스가 없어야 함");
console.log(`  ranged 평타: 기본 ${base} → 약점 보스 ${boosted} (×${(boosted / base).toFixed(3)}), tanker: ${otherRole}`);

console.log("\n모든 검증 통과.");
