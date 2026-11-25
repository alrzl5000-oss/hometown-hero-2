// 반려동물 — 60종, 이름 있는 친구들, 가챠(골드, 확정 없음), 성장, 패시브/스킬, 도감, 전투(타겟 불가 보조 전투원)
import assert from "node:assert/strict";
import {
  PETS, PET_BY_ID, PET_GRADES, PET_RATES, PET_BUNDLES, PET_FAMILIES, pullPets, rollPetGrade, planPetPulls, petLevelUpCost, petStarUpCost,
  petPassive, petSkill, petFighter, petCollection, petCombatPackage, petView, PET_LEVEL_CAP,
} from "../server/data/pets.js";
import { simulateBattle } from "../server/lib/combat.js";
import { SKILL_KINDS } from "../server/data/skills.js";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("  ✓", name); };

t("60종 · id 유일 · 계열 7개 · 등급 5단계", () => {
  assert.equal(PETS.length, 60);
  assert.equal(new Set(PETS.map((p) => p.id)).size, 60);
  for (const p of PETS) { assert.ok(PET_FAMILIES[p.family], p.name); assert.ok(PET_GRADES.includes(p.grade), p.name); }
  for (const g of PET_GRADES) assert.ok(PETS.some((p) => p.grade === g), g);
});
t("요청한 이름 있는 친구들", () => {
  const want = { "박구월": ["cat", "cat_gray"], "김마리": ["cat", "cat_brown"], "리젠트 모히칸": ["cat", "cat_mohawk"], "로이": ["dog", "dog_poodle"], "코모도 왕도마뱀": ["reptile", "lizard_komodo"], "공룡": ["reptile", "dino"] };
  for (const [name, [fam, look]] of Object.entries(want)) {
    const p = PETS.find((x) => x.name === name);
    assert.ok(p, name); assert.equal(p.family, fam); assert.equal(p.look, look); assert.equal(p.grade, "UR"); assert.ok(p.special);
  }
});
t("가챠 — 1회 5만 골드, 확률 합 100, 확정 없음", () => {
  assert.equal(PET_BUNDLES[1].cost, 50000); assert.equal(PET_BUNDLES[10].cost, 500000);
  assert.equal(Object.values(PET_RATES).reduce((a, b) => a + b, 0), 100);
  assert.equal(rollPetGrade(() => 0.999), "N"); assert.equal(rollPetGrade(() => 0), "UR");
  assert.equal(pullPets(10).length, 10); assert.throws(() => pullPets(7));
  const plan = planPetPulls([PET_BY_ID.get("p01"), PET_BY_ID.get("p01"), PET_BY_ID.get("p11")], new Map([["p11", {}]]));
  assert.deepEqual(plan.inserts, [{ pet_id: "p01", level: 1, star: 0, shards: 1 }]);
  assert.equal(plan.shardAdds.get("p11"), 1);
});
t("성장 — 레벨업 비용 증가, 별은 조각 1~5개, 최대 ★5", () => {
  assert.ok(petLevelUpCost("UR", 10) > petLevelUpCost("UR", 9));
  assert.ok(petLevelUpCost("UR", 5) > petLevelUpCost("N", 5));
  assert.equal(petStarUpCost(0), 1); assert.equal(petStarUpCost(4), 5); assert.equal(petStarUpCost(5), null);
  assert.equal(PET_LEVEL_CAP.UR, 60);
});
t("패시브 · 스킬 — 계열마다 다르고 등급/별이 높을수록 강함", () => {
  const ur = PET_BY_ID.get("p01"), n2 = PET_BY_ID.get("p11");
  assert.equal(petPassive(ur).key, "critDmg");
  assert.ok(petPassive(ur).value > petPassive(n2).value);
  assert.ok(petPassive(ur, 1, 5).value > petPassive(ur, 1, 0).value);
  for (const p of PETS) assert.ok(SKILL_KINDS[petSkill(p).kind], p.family);
  assert.ok(petSkill(ur).burstMult > petSkill(n2).burstMult);
  const f = petFighter(ur, 30, 2); assert.ok(f.isPet && f.atk > petFighter(ur, 1, 0).atk);
});
t("도감 — 보유 수 · 계열 완성 · 특별한 친구들 완성", () => {
  const none = petCollection([]); assert.equal(none.deltas.atk, 0);
  const cats = PETS.filter((p) => p.family === "cat").map((p) => p.id);
  const c = petCollection(cats);
  assert.ok(c.families.cat.complete && c.deltas.critDmg >= 8);
  const sp = petCollection(PETS.filter((p) => p.special).map((p) => p.id));
  assert.ok(sp.special.complete && sp.deltas.atk > 5);
  assert.equal(petCollection(PETS.map((p) => p.id)).unique, 60);
});
t("장착 패키지 — 최대 2마리, 보유한 것만", () => {
  const rows = [{ pet_id: "p01", level: 10, star: 1 }, { pet_id: "p13", level: 5, star: 0 }, { pet_id: "p25", level: 1, star: 0 }];
  const pack = petCombatPackage(rows, ["p01", "p13", "p25", "p99"]);
  assert.equal(pack.fighters.length, 2);
  assert.ok(pack.bonus.critDmgMult > 1 && pack.bonus.atkMult > 1);
  assert.equal(petView(rows[0]).name, "박구월");
});
t("전투 — 펫은 공격·스킬을 하지만 적이 노리지 못하고, 펫만 남으면 패배", () => {
  const hero = { characterId: "h", atk: 50, hp: 3000, def: 10, spd: 1, critRate: 0, critDmg: 1.5, mana: 100, skills: [] };
  const foe = { characterId: "e", atk: 4000, hp: 1e9, def: 10, spd: 1, critRate: 0, critDmg: 1.5, mana: 100, skills: [] };
  const pet = petFighter(PET_BY_ID.get("p01"), 60, 5);
  const r = simulateBattle([hero, pet], [foe], { timeLimitSeconds: 60 });
  assert.ok(r.hits.some((h) => h.actor === pet.characterId && h.dmg > 0), "펫이 공격함");
  assert.ok(!r.hits.some((h) => h.targetId === pet.characterId), "펫은 맞지 않음");
  assert.equal(r.winner, "B");
  assert.ok(r.sideA.fighters.find((f) => f.isPet).alive);
});
console.log(`pets: ${n} passed`);
