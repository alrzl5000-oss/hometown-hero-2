// 묶음 소환 · 프리셋 · 장비 가방 · 일일 초기화/회복 순수 로직 테스트
import assert from "node:assert/strict";
import { GACHA_BUNDLES, pullBundle, aggregatePulls, planBundleApplication } from "../server/data/gachaBundle.js";
import {
  normalizeAbilityPresets, abilityLinesForContent, abilityPresetIndexForContent, setContentPreset, normalizeTeamPresets,
  validateTeamIds, normalizeThemePresets, ODYSSEY_THEME_KEYS, assertSlot,
} from "../server/data/presets.js";
import {
  shouldAutoSell, sellValue, normalizeEquipPresets, equipInPreset, unequipInPreset, equippedAnywhere, rowToItem, rollEnhance, INVENTORY_CAP,
} from "../server/data/inventory.js";
import { dailyKey, freshDungeonState, freshBossState, regenAttempts } from "../server/data/daily.js";
import { ODYSSEY_SELL_GOLD, ODYSSEY_ENHANCE_MAX_LEVEL } from "../server/data/odyssey.js";

const SRPLUS = new Set(["SR", "SSR", "XR", "HR", "XXR"]);
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ✓", name); };

console.log("gachaBundle");
t("가격은 1회 300 기준 10% 할인", () => {
  assert.equal(GACHA_BUNDLES[1].cost, 300);
  assert.equal(GACHA_BUNDLES[10].cost, 2700);
  assert.equal(GACHA_BUNDLES[100].cost, 27000);
  assert.equal(GACHA_BUNDLES[1000].cost, 270000);
});
t("10연은 항상 SR 이상 1개 이상, 100연은 10개 이상", () => {
  for (let i = 0; i < 200; i++) {
    const r = pullBundle({ level: 1, pity: 0, size: 10 });
    assert.equal(r.pulls.length, 10);
    assert.ok(r.pulls.filter((p) => SRPLUS.has(p.rarity)).length >= 1);
  }
  for (let i = 0; i < 20; i++) {
    const r = pullBundle({ level: 1, pity: 0, size: 100 });
    assert.equal(r.pulls.length, 100);
    assert.ok(r.pulls.filter((p) => SRPLUS.has(p.rarity)).length >= 10);
  }
});
t("1000연은 확정 보정 없음(guaranteed 표시 없음)", () => {
  const r = pullBundle({ level: 1, pity: 0, size: 1000 });
  assert.equal(r.pulls.length, 1000);
  assert.ok(r.pulls.every((p) => !p.guaranteed));
});
t("천장은 뽑은 횟수만큼 이어진다", () => {
  const r = pullBundle({ level: 1, pity: 5, size: 10 });
  assert.ok(Number.isInteger(r.pity) && r.pity >= 0 && r.pity <= 15);
});
t("잘못된 묶음 크기는 거절", () => assert.throws(() => pullBundle({ size: 7 })));
t("집계 + 적용 계획: 신규/조각/EX 버려진 조각", () => {
  const a = { id: "h01" }, b = { id: "h02" }, c = { id: "h03" };
  const agg = aggregatePulls([
    { character: a, rarity: "N" }, { character: a, rarity: "N" }, { character: b, rarity: "N" }, { character: c, rarity: "N" }, { character: c, rarity: "N" },
  ]);
  assert.equal(agg.get("h01").count, 2);
  const existing = new Map([["h02", { current_rarity: "R", origin_rarity: "N" }], ["h03", { current_rarity: "EX", origin_rarity: "N" }]]);
  const plan = planBundleApplication(agg, existing);
  assert.deepEqual(plan.inserts, [{ character_id: "h01", origin_rarity: "N", current_rarity: "N", level: 1, shard_count: 1 }]);
  assert.equal(plan.shardAdds.get("h02"), 1);
  assert.deepEqual(plan.discarded, { N: 2 });
  assert.ok(plan.newIds.has("h01") && !plan.newIds.has("h02"));
});

console.log("presets");
t("프리셋이 없으면 기존 단일 줄을 활성 슬롯으로 승계", () => {
  const { presets, active } = normalizeAbilityPresets({ ability_lines: [{ key: "atk", value: 5 }], ability_locked_indices: [0] });
  assert.equal(active, 0);
  assert.equal(presets.length, 3);
  assert.deepEqual(presets[0].lines, [{ key: "atk", value: 5 }]);
  assert.deepEqual(presets[0].lockedIndices, [0]);
  assert.deepEqual(presets[1].lines, []);
});
t("콘텐츠 매핑: 1~3이면 그 프리셋, 0/없음이면 활성 프리셋", () => {
  const player = {
    ability_presets: [{ lines: ["A"] }, { lines: ["B"] }, { lines: ["C"] }], ability_active_preset: 1,
    ability_content_presets: { pvp: 3, farm: 0 },
  };
  assert.deepEqual(abilityLinesForContent(player, "pvp"), ["C"]);
  assert.deepEqual(abilityLinesForContent(player, "farm"), ["B"]);
  assert.deepEqual(abilityLinesForContent(player, "odyssey"), ["B"]);
  assert.equal(abilityPresetIndexForContent(player, "pvp"), 2);
});
t("콘텐츠 매핑 검증", () => {
  assert.deepEqual(setContentPreset({}, "gold", 2), { gold: 2 });
  assert.throws(() => setContentPreset({}, "nope", 1));
  assert.throws(() => setContentPreset({}, "gold", 4));
});
t("슬롯/팀 검증", () => {
  assert.equal(assertSlot("2"), 2);
  assert.throws(() => assertSlot(3));
  assert.throws(() => validateTeamIds(["a", "b"]));
  assert.throws(() => validateTeamIds(["a", "a", "b", "c", "d"]));
  validateTeamIds(["a", "b", "c", "d", "e"]);
  const tp = normalizeTeamPresets([{ team: ["x"], formation: "offensive" }, { formation: "bogus" }]);
  assert.equal(tp.length, 3);
  assert.equal(tp[0].formation, "offensive");
  assert.equal(tp[1].formation, "balanced");
  const th = normalizeThemePresets({});
  assert.deepEqual(Object.keys(th), ODYSSEY_THEME_KEYS);
});

console.log("inventory");
t("자동판매 기준: 설정 등급 이하", () => {
  assert.equal(shouldAutoSell("rare", "epic"), true);
  assert.equal(shouldAutoSell("epic", "epic"), true);
  assert.equal(shouldAutoSell("unique", "epic"), false);
  assert.equal(shouldAutoSell("rare", null), false);
  assert.equal(sellValue({ grade: "legendary" }).gold, ODYSSEY_SELL_GOLD.legendary);
  assert.equal(INVENTORY_CAP, 100);
});
t("장착: 같은 부위는 교체, 해제, 어느 프리셋이든 장착 여부", () => {
  const byId = new Map([
    ["i1", { id: "i1", item_key: "cyclops_eye" }], ["i2", { id: "i2", item_key: "cyclops_eye" }], ["i3", { id: "i3", item_key: "giant_armor" }],
  ]);
  let p = equipInPreset([], byId, "i1");
  p = equipInPreset(p, byId, "i3");
  p = equipInPreset(p, byId, "i2");
  assert.deepEqual(p.sort(), ["i2", "i3"]);
  assert.deepEqual(unequipInPreset(p, "i3"), ["i2"]);
  assert.throws(() => equipInPreset([], byId, "nope"));
  const presets = normalizeEquipPresets([["i1"], null, ["i3"]]);
  assert.deepEqual(presets, [["i1"], [], ["i3"]]);
  assert.ok(equippedAnywhere(presets).has("i3"));
  const it = rowToItem({ id: "i1", item_key: "cyclops_eye", grade: "epic", lines: [], enhance: 3 }, new Set(["i1"]));
  assert.deepEqual(it, { id: "i1", key: "cyclops_eye", grade: "epic", lines: [], enhance: 3, equipped: true });
});
t("강화: 성공 +1 / +10 이하 실패는 유지 / +11 이상 실패는 하락 가능", () => {
  assert.equal(rollEnhance({ grade: "rare", enhance: 0 }, () => 0).enhance, 1);
  assert.equal(rollEnhance({ grade: "rare", enhance: 4 }, () => 0.99).enhance, 4);
  const down = rollEnhance({ grade: "rare", enhance: 12 }, (() => { const seq = [0.99, 0]; return () => seq.shift(); })());
  assert.equal(down.enhance, 11);
  assert.equal(down.downgraded, true);
  assert.throws(() => rollEnhance({ grade: "rare", enhance: ODYSSEY_ENHANCE_MAX_LEVEL }));
});

console.log("daily");
t("하루 경계는 UTC 자정(= 한국시간 09시)", () => {
  assert.equal(dailyKey(new Date("2026-11-24T23:59:00Z")), "2026-11-24");
  assert.equal(dailyKey(new Date("2026-11-25T00:00:00Z")), "2026-11-25");
});
t("던전: 날이 바뀌면 횟수만 초기화", () => {
  const raw = { day: "2026-11-24", gold: { stage: 5, maxStage: 6, attemptsUsed: 3 } };
  const same = freshDungeonState(raw, new Date("2026-11-24T10:00:00Z"));
  assert.equal(same.gold.attemptsUsed, 3);
  const next = freshDungeonState(raw, new Date("2026-11-25T01:00:00Z"));
  assert.deepEqual(next.gold, { stage: 5, maxStage: 6, attemptsUsed: 0 });
  assert.deepEqual(next.exp, { stage: 1, maxStage: 1, attemptsUsed: 0 });
});
t("일일보스: 날이 바뀌면 오늘 기록 초기화", () => {
  const p = { boss_day: "2026-11-24", boss_attempts_used: 2, boss_damage_today: "1000" };
  assert.deepEqual(freshBossState(p, new Date("2026-11-24T05:00:00Z")), { day: "2026-11-24", attemptsUsed: 2, damageToday: 1000 });
  assert.deepEqual(freshBossState(p, new Date("2026-11-25T05:00:00Z")), { day: "2026-11-25", attemptsUsed: 0, damageToday: 0 });
});
t("시간 회복: 5분당 1회, 최대치 고정", () => {
  const base = new Date("2026-11-24T00:00:00Z");
  const r = regenAttempts({ attempts: 10, lastRegenAt: base.toISOString(), max: 30, regenSeconds: 300, now: new Date(base.getTime() + 11 * 60000) });
  assert.equal(r.attempts, 12);
  assert.equal(r.nextRegenInSeconds, 240);
  const full = regenAttempts({ attempts: 29, lastRegenAt: base.toISOString(), max: 30, regenSeconds: 300, now: new Date(base.getTime() + 3600000) });
  assert.equal(full.attempts, 30);
  assert.equal(full.nextRegenInSeconds, null);
});

console.log(`features: ${passed} passed`);
