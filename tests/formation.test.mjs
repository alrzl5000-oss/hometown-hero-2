import { assignFormation, FORMATIONS, TEAM_SIZE, FRONT_DEF_BONUS, BACK_ATK_BONUS, MID_DEF_BONUS, MID_ATK_BONUS } from "../server/data/formation.js";

console.log("=== 1. 포메이션이 전부 5인 합을 이루는지 ===");
for (const [key, f] of Object.entries(FORMATIONS)) {
  const sum = (f.front || 0) + (f.mid || 0) + (f.back || 0);
  console.log(key, f, "sum=", sum);
  console.assert(sum === TEAM_SIZE, `${key} 포메이션의 front+mid+back 합이 ${TEAM_SIZE}여야 함`);
}

console.log("\n=== 2. 균형진(front2/mid2/back1) — 행(row) 배정과 보너스 적용 확인 ===");
const team = Array.from({ length: 5 }, (_, i) => ({ characterId: `c${i}`, atk: 1000, def: 1000 }));
const formed = assignFormation(team, "balanced");
console.log(formed.map((h) => ({ id: h.characterId, row: h.row, atk: h.atk, def: h.def })));
console.assert(formed[0].row === "front" && formed[1].row === "front", "앞열 2명");
console.assert(formed[2].row === "mid" && formed[3].row === "mid", "중열 2명");
console.assert(formed[4].row === "back", "뒷열 1명");
console.assert(formed[0].def === Math.round(1000 * (1 + FRONT_DEF_BONUS)), "앞열 방어력 보너스");
console.assert(formed[0].atk === 1000, "앞열은 공격력 보너스 없음");
console.assert(formed[2].atk === Math.round(1000 * (1 + MID_ATK_BONUS)) && formed[2].def === Math.round(1000 * (1 + MID_DEF_BONUS)), "중열은 공/방 둘 다 소폭");
console.assert(formed[4].atk === Math.round(1000 * (1 + BACK_ATK_BONUS)), "뒷열 공격력 보너스");
console.assert(formed[4].def === 1000, "뒷열은 방어력 보너스 없음");

console.log("\n=== 3. 원본 객체는 변형되지 않는지(불변성) ===");
console.assert(team[0].atk === 1000 && team[0].def === 1000, "원본 team 배열의 객체는 그대로여야 함");

console.log("\n모든 검증 통과(assert 실패가 위에 없으면 OK).");
