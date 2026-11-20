import {
  ABILITY_SLOT_COUNT, ABILITY_SLOT_UNLOCK_LEVEL, ABILITY_GRADES, ABILITY_EFFECTS,
  ABILITY_REROLL_COST, ABILITY_LOCK_REROLL_SURCHARGE_MULT,
  rerollCostFor, unlockedSlotCount, abilityGradeWeightsForLevel, rollAbilityGrade, rollAbilityLine,
  rerollAbilityLines, abilityBonuses, applyAbilityBonuses,
} from "../server/data/abilities.js";

console.log("=== 1. 슬롯 해금 — 계정 레벨 10/20/30에서 순서대로 열리는지 ===");
console.log({ lv1: unlockedSlotCount(1), lv9: unlockedSlotCount(9), lv10: unlockedSlotCount(10), lv20: unlockedSlotCount(20), lv30: unlockedSlotCount(30), lv99: unlockedSlotCount(99) });
console.assert(unlockedSlotCount(1) === 0 && unlockedSlotCount(9) === 0, "레벨 10 미만에서는 슬롯이 하나도 없어야 함");
console.assert(unlockedSlotCount(10) === 1 && unlockedSlotCount(20) === 2 && unlockedSlotCount(30) === 3, "레벨 10/20/30에서 1/2/3번째 슬롯이 순서대로 열려야 함");
console.assert(unlockedSlotCount(99) === ABILITY_SLOT_COUNT, `레벨 30 이상이면 전체 슬롯(${ABILITY_SLOT_COUNT})이 열려야 함`);

console.log("\n=== 2. 재설정 비용 — 고정한 슬롯 수만큼 복리로 비싸지고, 전부 고정하면 불가(null) ===");
console.log({
  base: rerollCostFor([], 3),
  oneLocked: rerollCostFor([0], 3),
  twoLocked: rerollCostFor([0, 1], 3),
  allLocked: rerollCostFor([0, 1, 2], 3),
});
console.assert(rerollCostFor([], 3) === ABILITY_REROLL_COST, "아무것도 고정 안 하면 기본 비용 그대로여야 함");
console.assert(rerollCostFor([0], 3) === Math.round(ABILITY_REROLL_COST * ABILITY_LOCK_REROLL_SURCHARGE_MULT), "1개 고정 시 배율만큼 비싸져야 함");
console.assert(rerollCostFor([0, 1], 3) > rerollCostFor([0], 3), "더 많이 고정할수록 더 비싸야 함");
console.assert(rerollCostFor([0, 1, 2], 3) === null, "열린 슬롯을 전부 고정하면 재설정할 대상이 없어 null이어야 함");

console.log("\n=== 3. 등급 확률 — 계정 레벨에 따라 에픽/유니크/레전드리 비중이 오르는지 ===");
console.log({ atLv1: abilityGradeWeightsForLevel(1), atLv100: abilityGradeWeightsForLevel(100) });
const w1 = abilityGradeWeightsForLevel(1);
const w100 = abilityGradeWeightsForLevel(100);
console.assert(w100.epic > w1.epic && w100.unique > w1.unique && w100.legendary > w1.legendary, "레벨 100에서 상위 등급 확률이 레벨 1보다 높아야 함");
for (const w of [w1, w100]) {
  const sum = w.rare + w.epic + w.unique + w.legendary;
  console.assert(Math.abs(sum - 100) < 0.01, `등급별 확률의 합은 100%여야 함(실측 ${sum})`);
}

console.log("\n=== 4. 등급/줄 뽑기 — 항상 유효한 값을 반환하는지 ===");
for (let i = 0; i < 500; i++) {
  const grade = rollAbilityGrade(50);
  console.assert(ABILITY_GRADES.includes(grade), "뽑힌 등급은 ABILITY_GRADES 안에 있어야 함");
  const line = rollAbilityLine(50);
  console.assert(line.key in ABILITY_EFFECTS, "뽑힌 효과 키는 ABILITY_EFFECTS 안에 있어야 함");
  const [min, max] = ABILITY_EFFECTS[line.key].range[line.grade];
  console.assert(line.value >= min && line.value <= max, `수치(${line.value})는 해당 등급 범위(${min}~${max}) 안이어야 함`);
}

console.log("\n=== 5. rerollAbilityLines — 미해금 슬롯은 null, 고정 슬롯은 유지, 나머지는 새로 굴러가는지 ===");
const lv20Lines = rerollAbilityLines([null, null, null], 2, [], 20);
console.log({ lv20Lines });
console.assert(lv20Lines.length === ABILITY_SLOT_COUNT, "항상 전체 슬롯 길이로 반환되어야 함");
console.assert(lv20Lines[0] && lv20Lines[1], "레벨 20이면 1/2번 슬롯은 값이 있어야 함");
console.assert(lv20Lines[2] === null, "레벨 20이면 3번 슬롯(레벨 30 해금)은 아직 null이어야 함");

const lockedLine = { key: "atk", grade: "legendary", value: 30 };
const rerolled = rerollAbilityLines([lockedLine, null, null], 2, [0], 20);
console.assert(rerolled[0] === lockedLine, "고정(lockedIndices)된 슬롯은 재설정해도 그대로 유지되어야 함");
console.assert(rerolled[1] !== null, "고정 안 된 나머지 슬롯은 새로 뽑혀야 함");

console.log("\n=== 6. abilityBonuses — 어빌리티 줄 + 계정 레벨 보너스가 올바르게 합산되는지 ===");
const lines = [
  { key: "atk", grade: "epic", value: 10 },
  { key: "gold", grade: "rare", value: 8 },
  { key: "crit", grade: "unique", value: 9 },
];
const bonuses = abilityBonuses(lines, 50);
console.log({ bonuses });
console.assert(Math.abs(bonuses.goldMult - 1.08) < 0.001, "gold 줄 +8% -> goldMult 1.08이어야 함");
console.assert(bonuses.atkMult > 1.1, "atk 줄 10% + 레벨 50 계정 보너스가 겹쳐 10%보다 더 올라야 함");
console.assert(Math.abs(bonuses.critAdd - 0.09) < 0.001, "crit 9%p -> critAdd 0.09여야 함");

const emptyBonuses = abilityBonuses([], 1);
console.assert(emptyBonuses.goldMult === 1 && emptyBonuses.atkMult === 1 && emptyBonuses.critAdd === 0, "줄이 없고 레벨 1이면 보너스가 전부 중립(배율 1/가산 0)이어야 함");

console.log("\n=== 7. applyAbilityBonuses — 실제 팀 스탯(atk/hp/def/spd/crit)에 반영되는지 ===");
const fakeTeam = [
  { id: "c0", atk: 1000, hp: 5000, def: 300, spd: 100, critRate: 0.1, skills: [{ kind: "burst", burstMult: 2 }, { kind: "buff" }] },
];
const buffed = applyAbilityBonuses(fakeTeam, bonuses);
console.log({ before: fakeTeam[0], after: buffed[0] });
console.assert(buffed[0].atk > fakeTeam[0].atk, "공격력이 올라야 함");
console.assert(buffed[0].critRate > fakeTeam[0].critRate, "치명타 확률이 올라야 함");
console.assert(fakeTeam[0].atk === 1000, "원본 팀 배열은 변형되지 않아야 함(불변성)");

console.log("\n모든 검증 통과(assert 실패가 위에 없으면 OK).");
