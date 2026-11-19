import { ROSTER, CLASSES, characterStatsAt, allCharacterIds, RARITY_UNIT, LEVEL_CAP, baseStatsFor } from "../server/data/characters.js";
import { makeFighter, simulateBattle } from "../server/lib/combat.js";

console.log("=== 1. 로스터 102종 + 직업 재배치 검증 ===");
console.assert(ROSTER.length === 102, "로스터는 102종이어야 함");
const byClass = {};
for (const c of ROSTER) byClass[c.class] = (byClass[c.class] || 0) + 1;
console.log(byClass);
const expectedAfterReassign = { h01: "support", h25: "support", h64: "support", h04: "assassin", h41: "assassin" };
for (const [id, cls] of Object.entries(expectedAfterReassign)) {
  const actual = ROSTER.find((c) => c.id === id).class;
  console.assert(actual === cls, `${id}는 ${cls}로 재배치되어야 하는데 ${actual}`);
}
const counts = Object.values(byClass);
console.assert(Math.max(...counts) - Math.min(...counts) <= 1, "직업 분포 격차가 1명 이하여야 함(21/21/20/20/20)");

console.log("\n=== 2. 방어력 레퍼런스 — EX 탱커 레벨60 def === 60,000 ===");
const exTankerDef = baseStatsFor("EX", "tanker", 60).def;
console.log({ exTankerDef });
console.assert(exTankerDef === 60000, "stats.js의 DEF_REFERENCE.refDef와 정확히 일치해야 함");

console.log("\n=== 3. 전체 102종이 예외 없이 makeFighter를 생성하고, 모두 스킬 2개를 갖는지 ===");
let errCount = 0;
for (const id of allCharacterIds()) {
  const entry = ROSTER.find((c) => c.id === id);
  const stats = characterStatsAt(id, LEVEL_CAP[entry.rarity]);
  try {
    const f = makeFighter(stats);
    if (f.skills.length !== 2) throw new Error(`skills.length=${f.skills.length}`);
    if (!f.atk || !f.hp || !f.def) throw new Error("atk/hp/def 중 0 또는 undefined");
  } catch (e) {
    errCount++;
    console.log("ERROR", id, e.message);
  }
}
console.log({ total: allCharacterIds().length, errors: errCount });
console.assert(errCount === 0, "모든 캐릭터가 예외 없이 전투 fighter로 변환되어야 함");

console.log("\n=== 4. 보조 스킬 kind 다양성 — 직업별로 2종 이상의 kind가 분포해야 함 ===");
const kindByClass = {};
for (const c of ROSTER) {
  const stats = characterStatsAt(c.id, LEVEL_CAP[c.rarity]);
  const secondary = stats.skills[1];
  kindByClass[c.class] = kindByClass[c.class] || new Set();
  kindByClass[c.class].add(secondary.kind);
}
for (const [cls, kinds] of Object.entries(kindByClass)) {
  console.log(cls, [...kinds]);
  console.assert(kinds.size >= 2, `${cls} 직업의 보조 스킬 다양성이 너무 낮음(${kinds.size}종)`);
}

console.log("\n=== 5. 실제 전투에서 다양한 스킬 kind가 실제로 발동하는지 (동급 미러전) ===");
const mirrorIds = ["h10", "h11", "h17", "h18", "h19"]; // SSR 5인
const teamA = mirrorIds.map((id) => characterStatsAt(id, LEVEL_CAP[ROSTER.find((c) => c.id === id).rarity]));
const teamB = mirrorIds.map((id) => characterStatsAt(id, LEVEL_CAP[ROSTER.find((c) => c.id === id).rarity]));
const result = simulateBattle(teamA, teamB, { timeLimitSeconds: 60 });
const skillHits = result.hits.filter((h) => h.isSkill);
const kindsFired = new Set(skillHits.map((h) => h.skillKind));
console.log({ winner: result.winner, t: Math.round(result.t * 100) / 100, totalHits: result.hits.length, skillHits: skillHits.length, kindsFired: [...kindsFired] });
console.assert(skillHits.length > 0, "동급 5v5 60초 전투에서 스킬이 한 번도 발동하지 않으면 이상함");
console.assert(kindsFired.size >= 2, "여러 종류의 스킬 kind가 실제로 발동해야 함");

console.log("\n=== 6. 등급별 유닛/레벨캡 출력(참고용) ===");
console.log(RARITY_UNIT);
console.log(LEVEL_CAP);

console.log("\n모든 검증 통과(assert 실패가 위에 없으면 OK).");
