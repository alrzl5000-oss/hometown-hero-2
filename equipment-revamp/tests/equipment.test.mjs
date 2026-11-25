// 장비 개편 — 세트(획득처) × 부위, 세트 효과, 분해/강화/제작, 드랍 수
import assert from "node:assert/strict";
import {
  SLOTS, SETS, SET_KEYS, ITEMS, ODYSSEY_SLOT, keyFor, slotOf, setOf, rollSetItem, craftItem, rollLines, gradeWeights,
  fieldDropCount, FIELD_DROP_CAP, enhanceCost, dismantleValue, DISMANTLE_DUST, equipmentBonusSums, activeSetBonuses, enhanceBonus,
} from "../server/data/equipment.js";
import { equipInPreset, rollEnhance } from "../server/data/inventory.js";
import { abilityBonuses, applyAbilityBonuses } from "../server/data/abilities.js";
import { ODYSSEY_STAT_POOL } from "../server/data/odyssey.js";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("  ✓", name); };
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

t("8세트 × 6부위 = 48종, 세트·부위 조합이 모두 유일", () => {
  assert.equal(SET_KEYS.length, 8);
  assert.equal(Object.keys(ITEMS).length, 48);
  for (const set of SET_KEYS) for (const s of SLOTS) assert.ok(keyFor(set, s.key), `${set}/${s.key}`);
  for (const [k, slot] of Object.entries(ODYSSEY_SLOT)) { assert.equal(slotOf(k), slot); assert.equal(setOf(k), "odyssey"); }
});
t("세트마다 주력 옵션이 다르고, 옵션은 실제 능력치 풀에 있는 것만", () => {
  const pools = SET_KEYS.filter((s) => SETS[s].pool).map((s) => JSON.stringify(Object.keys(SETS[s].pool).sort()));
  assert.equal(new Set(pools).size, pools.length);
  for (const s of SET_KEYS) {
    if (SETS[s].pool) for (const k of Object.keys(SETS[s].pool)) assert.ok(ODYSSEY_STAT_POOL[k], k);
    for (const need of [2, 4, 6]) for (const k of Object.keys(SETS[s].bonus[need])) assert.ok(ODYSSEY_STAT_POOL[k], k);
  }
});
t("등급이 높을수록 옵션 줄이 많고, 같은 옵션이 두 번 안 나온다", () => {
  for (let i = 0; i < 200; i++) {
    const r = rollLines("gold", "weapon", "rare"); assert.equal(r.length, 1);
    const l = rollLines("pvp", "armor", "legendary"); assert.equal(l.length, 3);
    assert.equal(new Set(l.map((x) => x.statKey)).size, 3);
    for (const x of l) { const [lo, hi] = ODYSSEY_STAT_POOL[x.statKey].range.legendary; assert.ok(x.value >= lo - 0.05 && x.value <= hi + 0.05); }
  }
});
t("획득처 장비 굴리기 — 부위 지정/무작위, 오디세이 세트는 거절", () => {
  const it = rollSetItem("floorBoss", { tier: 50, slot: "relic" });
  assert.equal(it.key, "floorBoss_relic");
  assert.ok(["rare", "epic", "unique", "legendary"].includes(it.grade));
  assert.throws(() => rollSetItem("odyssey"));
  assert.throws(() => rollSetItem("gold", { slot: "boots" }));
  assert.equal(craftItem("gem", "head").key, "gem_head");
});
t("높은 단계일수록, 보스 계열일수록 상위 등급 비중이 크다", () => {
  const lo = gradeWeights(1), hi = gradeWeights(250);
  assert.ok(hi.legendary > lo.legendary && hi.rare < lo.rare);
  assert.ok(gradeWeights(100, 1.4).unique > gradeWeights(100, 0.6).unique);
});
t("파밍 드랍 수 — 처치 수 비례, 상한", () => {
  assert.equal(fieldDropCount(0), 0);
  assert.equal(fieldDropCount(1250, () => 0.99), 1);
  assert.equal(fieldDropCount(1e9), FIELD_DROP_CAP);
});
t("강화 비용은 골드 + 장비 가루, 분해는 기본 가루 + 강화 가루 절반 환급", () => {
  const c = enhanceCost("epic", 0); assert.ok(c.gold > 0 && c.dust === 3); assert.equal(c.gems, undefined);
  assert.ok(enhanceCost("legendary", 10).dust > enhanceCost("legendary", 9).dust);
  assert.equal(dismantleValue({ grade: "unique", enhance: 0 }).dust, DISMANTLE_DUST.unique);
  const spent = enhanceCost("unique", 0).dust + enhanceCost("unique", 1).dust;
  assert.equal(dismantleValue({ grade: "unique", enhance: 2 }).dust, DISMANTLE_DUST.unique + Math.floor(spent / 2));
  assert.ok(rollEnhance({ grade: "rare", enhance: 0 }, () => 0).cost.dust >= 1);
});
t("부위가 같으면 교체(세트가 달라도)", () => {
  const byId = new Map([["a", { item_key: "gold_weapon" }], ["b", { item_key: "odysseus_bow" }], ["c", { item_key: "gem_head" }]]);
  let p = equipInPreset([], byId, "a"); p = equipInPreset(p, byId, "c"); p = equipInPreset(p, byId, "b");
  assert.deepEqual(p.sort(), ["b", "c"]);
});
t("세트 효과 — 2/4/6부위 단계별 누적", () => {
  const six = SLOTS.map((s) => ({ key: `gold_${s.key}`, grade: "rare", lines: [], enhance: 0, equipped: true }));
  assert.equal(activeSetBonuses(six.slice(0, 1)).length, 0);
  assert.equal(activeSetBonuses(six.slice(0, 3)).length, 1);
  assert.equal(activeSetBonuses(six).length, 3);
  const s = equipmentBonusSums(six);
  assert.equal(s.gold, 10 + 20); assert.equal(s.atk, 6); assert.equal(s.critDmg, 10);
  const off = equipmentBonusSums(six.map((x) => ({ ...x, equipped: false })));
  assert.equal(off.gold, 0);
});
t("강화하면 부위 고유 능력치가 오른다", () => {
  const b = enhanceBonus("pvp_cloak", "legendary", 5); assert.equal(b.statKey, "spd"); assert.ok(b.value > 0);
  assert.equal(enhanceBonus("cyclops_eye", "legendary", 5).statKey, "defBreak");
});
t("치명타 피해·고정 능력치·적 방어력 감소가 전투 스탯에 반영", () => {
  const items = [{ key: "dailyBoss_weapon", grade: "rare", lines: [{ statKey: "critDmg", value: 10 }, { statKey: "defBreak", value: 10 }, { statKey: "atkFlat", value: 50 }], enhance: 0, equipped: true }];
  const b = abilityBonuses([], 1, items);
  const [h] = applyAbilityBonuses([{ atk: 100, hp: 100, def: 10, spd: 1, critRate: 0.1, critDmg: 1.5, pen: 0, skills: [] }], b);
  assert.equal(h.atk, 150); assert.ok(Math.abs(h.critDmg - 1.65) < 1e-9); assert.ok(Math.abs(h.pen - 0.1) < 1e-9);
});
console.log(`equipment: ${n} passed`);
