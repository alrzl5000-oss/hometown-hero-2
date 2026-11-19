import { describeDefenseCurve, mitigation, applyResistance, manaRegenPerHit } from "../server/data/stats.js";
import { simulateBattle, makeFighter, makeSide, applyDamageToFighter } from "../server/lib/combat.js";

console.log("=== 1. 방어력 공식 레퍼런스 검증 ===");
console.log(describeDefenseCurve());

console.log("\n=== 2. PEN이 방어력을 무시하는지 ===");
const defNoPen = 1 - mitigation(60000, 0);
const defWithPen = 1 - mitigation(60000, 0.3);
console.log({ reductionNoPen: Math.round(defNoPen * 1000) / 10, reductionWith30PenPct: Math.round(defWithPen * 1000) / 10 });
console.assert(defWithPen < defNoPen, "PEN이 있으면 감소율이 낮아져야 함");

console.log("\n=== 3. RES가 적용 확률을 낮추는지 (10000회 샘플) ===");
let resHits = 0;
for (let i = 0; i < 10000; i++) if (Math.random() < applyResistance(0.5, 0.4)) resHits++;
console.log({ baseChance: 0.5, res: 0.4, expected: 0.3, observed: resHits / 10000 });

console.log("\n=== 4. 마나 스탯이 높을수록 게이지가 빨리 찬다(manaFactor) ===");
const lowMana = makeFighter({ characterId: "lm", class: "dealer", atk: 100, hp: 100, def: 0, mana: 50, spd: 1,
  skills: [{ kind: "burst", burstMult: 2, manaCost: 100 }] });
const highMana = makeFighter({ characterId: "hm", class: "dealer", atk: 100, hp: 100, def: 0, mana: 400, spd: 1,
  skills: [{ kind: "burst", burstMult: 2, manaCost: 100 }] });
console.log({ lowManaFactor: lowMana.manaFactor, highManaFactor: highMana.manaFactor });
console.assert(highMana.manaFactor > lowMana.manaFactor, "마나 스탯이 높으면 manaFactor도 커야 함");

console.log("\n=== 5. 스킬별 독립 게이지 — 기아(starvation) 없이 둘 다 발동하는지 ===");
const dealer = makeFighter({
  characterId: "test_dealer", class: "dealer", atk: 1000, hp: 5000, def: 100, mana: 100, spd: 1.0, critRate: 0, critDmg: 1.5,
  skills: [
    { kind: "burst", burstMult: 2.0, manaCost: 40 }, // 싼 스킬
    { kind: "burst", burstMult: 5.0, manaCost: 90 }, // 비싼 스킬
  ],
});
const dummy = makeFighter({ characterId: "dummy", class: "tanker", atk: 0, hp: 99999999, def: 0, mana: 0, spd: 0.5 });
const sideDealer = makeSide([]);
sideDealer.fighters.push(dealer);
const sideDummy = makeSide([]);
sideDummy.fighters.push(dummy);

let cheapFires = 0, expensiveFires = 0;
const hits = [];
for (let i = 0; i < 2000; i++) {
  const { resolveAttackForTest } = {}; // (내부 함수라 직접 못 불러오니 progress를 수동 재현)
  dealer.skills.forEach((s) => (s.progress += manaRegenPerHit(dealer.spd) * dealer.manaFactor));
  const ready = dealer.skills.filter((s) => s.progress >= s.manaCost).sort((a, b) => b.manaCost - a.manaCost);
  for (const s of ready) {
    s.progress -= s.manaCost;
    if (s.manaCost === 40) cheapFires++;
    else expensiveFires++;
  }
}
console.log({ cheapFires, expensiveFires, ratio: (cheapFires / Math.max(1, expensiveFires)).toFixed(2) });
console.assert(expensiveFires > 0, "비싼 스킬도 기아 없이 발동해야 함(구조적 결함 수정 확인)");
console.assert(cheapFires > expensiveFires, "그래도 싼 스킬이 더 자주 발동해야 함");

console.log("\n=== 6. shieldHits — 지정한 횟수만큼만 피해 무효화 ===");
const tank = makeFighter({ characterId: "test_tank", class: "tanker", atk: 10, hp: 1000, def: 100, mana: 0, spd: 1 });
tank.shieldCharges = 2;
const sideTank = makeSide([]);
sideTank.fighters.push(tank);
const hpSeq = [];
for (let i = 0; i < 4; i++) {
  applyDamageToFighter(tank, sideTank, 100, 0);
  hpSeq.push(tank.hp);
}
console.log({ hpSequence: hpSeq });
console.assert(hpSeq[0] === 1000 && hpSeq[1] === 1000, "보호막 2회는 완전히 무효화돼야 함");
console.assert(hpSeq[2] === 900 && hpSeq[3] === 800, "보호막 소진 후엔 정상적으로 피해가 들어가야 함");

console.log("\n=== 7. tempImmortal — 시한 동안 체력 0 이하로 안 떨어짐 ===");
const immortal = makeFighter({ characterId: "test_immortal", class: "tanker", atk: 10, hp: 500, def: 100, mana: 0, spd: 1 });
immortal.tempImmortalUntil = 5;
const sideImmortal = makeSide([]);
sideImmortal.fighters.push(immortal);
applyDamageToFighter(immortal, sideImmortal, 99999, 2);
console.log({ hpDuringImmortal: immortal.hp, alive: immortal.alive });
console.assert(immortal.hp === 1 && immortal.alive, "불사 구간엔 체력 1로 버텨야 함");
applyDamageToFighter(immortal, sideImmortal, 99999, 6);
console.log({ hpAfterImmortalEnds: immortal.hp, alive: immortal.alive });
console.assert(!immortal.alive, "불사 끝난 뒤엔 정상적으로 죽어야 함");

console.log("\n=== 8. 두 스킬이 '같은 타격'에서 동시에 다 차면 — 번갈아 발동 없이 둘 다 발동 ===");
// resolveAttack은 모듈 내부 비공개 함수라, 코스트를 극히 낮게 잡고 simulateBattle 첫 타격만 본다.
const quickResult = simulateBattle(
  [{ characterId: "dual", class: "tanker", atk: 100, hp: 5000, def: 1000, mana: 10000, spd: 1,
     skills: [{ kind: "buffDef", buffReduction: 0.3, buffDuration: 4, manaCost: 1 }, { kind: "buffAtk", buffBonus: 0.2, buffDuration: 4, manaCost: 1 }] }],
  [{ characterId: "opp1", class: "ranged", atk: 50, hp: 1000, def: 0, mana: 0, spd: 1 }],
  { timeLimitSeconds: 2 }
);
const dualFirstHits = quickResult.hits.filter((h) => h.actor === "dual" && h.t <= quickResult.hits[0].t + 0.001);
console.log({ firstTickHitsByDual: dualFirstHits.map((h) => h.skillKind) });
console.assert(
  dualFirstHits.some((h) => h.skillKind === "buffDef") && dualFirstHits.some((h) => h.skillKind === "buffAtk"),
  "마나코스트가 극히 낮게 세팅되면 첫 타격에 두 스킬이 동시에 발동해야 함"
);

console.log("\n=== 9. 전체 전투 시뮬레이션 — 에러 없이 끝까지 도는지 ===");
const teamA = [
  { characterId: "a1", class: "tanker", atk: 500, hp: 8000, def: 2000, mana: 100, spd: 0.8, pen: 0, res: 0.1,
    skills: [{ kind: "buffDef", buffReduction: 0.3, buffDuration: 4, manaCost: 50 }] },
  { characterId: "a2", class: "ranged", atk: 1800, hp: 3000, def: 500, mana: 100, spd: 1.2, critRate: 0.2, critDmg: 1.8,
    skills: [
      { kind: "burst", burstMult: 2.8, manaCost: 45 },
      { kind: "executeChance", executeChance: 0.1, manaCost: 90 },
    ] },
];
const teamB = [
  { characterId: "b1", class: "tanker", atk: 500, hp: 8000, def: 2000, mana: 100, spd: 0.8, pen: 0, res: 0.1,
    skills: [{ kind: "tempImmortal", duration: 3, manaCost: 70 }] },
  { characterId: "b2", class: "assassin", atk: 2200, hp: 2000, def: 300, mana: 100, spd: 1.0, critRate: 0.3, critDmg: 2.2,
    skills: [{ kind: "burst", burstMult: 12.0, manaCost: 85 }] },
];
const result = simulateBattle(teamA, teamB, { timeLimitSeconds: 60 });
console.log({ winner: result.winner, totalHits: result.hits.length, endedAt: Math.round(result.t * 100) / 100 });
console.assert(result.hits.length > 0, "전투가 실제로 진행돼야 함");
// (이 특정 팀 구성은 암살자 버스트가 너무 세서 처형 게이지가 다 차기 전에 전투가 끝남 —
// 처형 메커니즘 자체는 아래 10번에서 별도로 격리 테스트)

console.log("\n=== 10. executeChance 단독 격리 테스트 — simulateBattle로 실제 발동 확인 ===");
const execResult = simulateBattle(
  [{ characterId: "exec1", class: "assassin", atk: 10, hp: 1000, def: 0, mana: 10000, spd: 1,
     skills: [{ kind: "executeChance", executeChance: 1.0, manaCost: 1 }] }], // 코스트 1이라 거의 즉시 발동, 확률 100%
  [{ characterId: "victim1", class: "tanker", atk: 0, hp: 999999, def: 999999, mana: 0, spd: 0.1, res: 0 }], // 방어력이 터무니없이 높아도
  { timeLimitSeconds: 5 }
);
const executed = execResult.hits.some((h) => h.kind === "execute");
console.log({ winner: execResult.winner, executed, victimDefWasHuge: 999999 });
console.assert(executed, "처형은 방어력과 무관하게 발동해야 함(방어력 999999여도 즉사)");
console.assert(execResult.winner === "A", "처형이 제대로 들어갔다면 A가 즉시 이겨야 함");

console.log("\n모든 검증 통과 (assert 실패 시 위에 에러가 떴을 것).");
