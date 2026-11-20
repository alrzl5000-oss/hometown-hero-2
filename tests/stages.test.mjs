// ============================================================================
// 게임 2.0 — 필드 파밍(방치) + 층보스 시스템 테스트
// ============================================================================
// 구 버전(필드→보스 연속전 단일 챌린지)을 대체한 새 설계(server/data/farming.js) 검증.
// 핵심 불변식: (1) 종마다 "실제 강함"(toughness)이 달라 처치당 보상도 종별로 달라진다,
// (2) 스테이지가 오를수록 보상/난이도가 커진다, (3) 보스전은 승리해야만 stage가 오르고
// 패배는 그대로 유지된다, (4) maxStage 이하로만 후퇴 가능.
import { ROSTER, LEVEL_CAP, characterStatsAt } from "../server/data/characters.js";
import {
  stageLabel, chapterOf, FIELD_SPECIES, fieldMonsterStats, fieldMonsterToughness,
  fieldReferenceToughness, fieldGoldPerKill, fieldExpPerKill, fieldGemDropUnit,
  computeFarmTick, MIN_FARM_SECONDS_PER_KILL, FARM_OFFLINE_CAP_SECONDS,
  BOSS_SPECIES, bossSpeciesForStage, makeBossMonster, resolveBossChallenge, resolveRetreat,
  STAGE_CLEAR_GEM_BONUS, stageInfo,
} from "../server/data/farming.js";

console.log("=== 1. 스테이지 라벨/챕터 번호 체계(기존 그대로 유지) ===");
console.assert(stageLabel(1) === "1-1" && stageLabel(10) === "1-10" && stageLabel(11) === "2-1", "스테이지 라벨 포맷");
console.assert(chapterOf(1) === 1 && chapterOf(10) === 1 && chapterOf(11) === 2, "챕터 번호 계산");

console.log("\n=== 2. 필드 종 풀 — 비중(weight) 합은 1.0, 종마다 toughness가 달라야 함 ===");
const weightSum = FIELD_SPECIES.reduce((s, sp) => s + sp.weight, 0);
console.assert(Math.abs(weightSum - 1) < 0.001, `종별 등장 비중의 합은 1.0이어야 함(실측 ${weightSum})`);
const toughAtStage20 = FIELD_SPECIES.map((sp) => ({ key: sp.key, t: fieldMonsterToughness(20, sp) }));
console.log(toughAtStage20);
const distinctToughness = new Set(toughAtStage20.map((t) => Math.round(t.t)));
console.assert(distinctToughness.size === FIELD_SPECIES.length, "종마다 toughness(실제 강함)가 서로 달라야 함");

console.log("\n=== 3. 보상(골드/경험치/다이아)은 toughness에 정비례해야 함(1.0 설계 원칙) ===");
const refT = fieldReferenceToughness(20);
for (const sp of FIELD_SPECIES) {
  const t = fieldMonsterToughness(20, sp);
  const ratio = t / refT;
  const gold = fieldGoldPerKill(20, ratio);
  const exp = fieldExpPerKill(20, ratio);
  const gem = fieldGemDropUnit(20, ratio);
  console.log({ species: sp.key, toughnessRatio: Math.round(ratio * 100) / 100, gold, exp, gem });
  console.assert(gold >= 1 && exp >= 1 && gem >= 1, "보상은 항상 최소 1 이상이어야 함(0으로 꺾이지 않게)");
}
// toughness가 가장 큰 종이 골드도 가장 많이 줘야 한다(정비례 검증).
const sortedByToughness = [...FIELD_SPECIES].sort((a, b) => fieldMonsterToughness(20, b) - fieldMonsterToughness(20, a));
const strongest = sortedByToughness[0];
const weakest = sortedByToughness[sortedByToughness.length - 1];
const strongestGold = fieldGoldPerKill(20, fieldMonsterToughness(20, strongest) / refT);
const weakestGold = fieldGoldPerKill(20, fieldMonsterToughness(20, weakest) / refT);
console.assert(strongestGold > weakestGold, "가장 강한(toughness 높은) 종이 가장 약한 종보다 처치당 골드가 많아야 함");

console.log("\n=== 4. 스테이지가 오를수록 몬스터도 세지고 보상도 커져야 함 ===");
const hp10 = fieldMonsterStats(10, FIELD_SPECIES[0]).hp;
const hp50 = fieldMonsterStats(50, FIELD_SPECIES[0]).hp;
console.assert(hp50 > hp10, "스테이지가 오를수록 필드 몬스터 체력도 올라야 함");
console.assert(fieldGoldPerKill(50) > fieldGoldPerKill(10), "스테이지가 오를수록 처치당 골드도 올라야 함");
console.assert(fieldExpPerKill(50) > fieldExpPerKill(10), "스테이지가 오를수록 처치당 경험치도 올라야 함");

console.log("\n=== 5. 필드 파밍 틱(EV) — 팀이 강할수록, 시간이 지날수록 더 많이 쌓여야 함 ===");
function buildTeam(ids, level) {
  return ids.map((id) => characterStatsAt(id, level));
}
const nTeamIds = ROSTER.filter((c) => c.rarity === "N").slice(0, 5).map((c) => c.id);
const ssrTeamIds = ROSTER.filter((c) => c.rarity === "SSR").slice(0, 5).map((c) => c.id);
const nTeam = buildTeam(nTeamIds, LEVEL_CAP.N);
const ssrTeam = buildTeam(ssrTeamIds, LEVEL_CAP.SSR);

const tick1h = computeFarmTick(nTeam, 5, 3600);
const tick2h = computeFarmTick(nTeam, 5, 7200);
console.log({ kills1h: Math.round(tick1h.kills), kills2h: Math.round(tick2h.kills) });
console.assert(tick2h.kills > tick1h.kills, "시간이 2배면 누적 킬도 더 많아야 함");
console.assert(Math.abs(tick2h.kills - tick1h.kills * 2) < 0.01, "틱은 선형누적이어야 함(시간×초당값)");

// stage 5처럼 아주 쉬운 스테이지에서는 두 팀 다 MIN_FARM_SECONDS_PER_KILL 하한에 걸려
// 처치속도가 똑같아진다(의도된 동작 — 1.0의 "처치시간 하한" 원칙 그대로, 팀이 세져도
// 초당 수익이 무한정 커지지 않게 막는 장치). 하한에 걸리지 않는 고층에서 비교해야
// "더 강한 팀이 더 빠르다"가 실제로 드러난다.
const highStage = 150;
const nTickHigh = computeFarmTick(nTeam, highStage, 3600);
const ssrTickHigh = computeFarmTick(ssrTeam, highStage, 3600);
console.log({ nKillsPerSec: nTickHigh.killsPerSecond, ssrKillsPerSec: ssrTickHigh.killsPerSecond });
console.assert(ssrTickHigh.killsPerSecond > nTickHigh.killsPerSecond, "더 강한 팀이 같은(어려운) 스테이지에서 더 빠르게 처치해야 함");

// 반대로 stage 5(둘 다 하한에 걸리는 구간)에서는 처치속도가 동일해야 한다 — 하한 장치가
// 실제로 작동 중인지 확인.
const nTick = computeFarmTick(nTeam, 5, 3600);
const ssrTick = computeFarmTick(ssrTeam, 5, 3600);
console.assert(Math.abs(nTick.killsPerSecond - ssrTick.killsPerSecond) < 0.0001, "처치시간 하한에 걸리는 구간에서는 팀 세기와 무관하게 처치속도가 같아야 함");

const offlineTick = computeFarmTick(ssrTeam, 5, FARM_OFFLINE_CAP_SECONDS * 10);
console.assert(offlineTick.cappedSeconds === FARM_OFFLINE_CAP_SECONDS, "오프라인 적립은 상한(8시간)에서 멈춰야 함");

console.log("\n=== 6. 층보스 — 종마다 다른 정체성을 가져야 함(이름/스탯이 전부 같으면 안 됨) ===");
const bossNames = new Set(BOSS_SPECIES.map((b) => b.name));
console.assert(bossNames.size === BOSS_SPECIES.length, "보스 종 이름은 서로 달라야 함");
const boss10 = makeBossMonster(10);
const boss11 = makeBossMonster(11);
console.log({ boss10: boss10.name, boss11: boss11.name });
console.assert(boss10.speciesKey === bossSpeciesForStage(10).key, "같은 스테이지는 항상 같은 보스를 줘야 함(결정론적)");

console.log("\n=== 7. 보스전 승패 — 승리해야만 stage가 오르고, 패배는 그대로여야 함 ===");
// 아주 약한 팀(N등급 레벨1) vs 아주 먼 스테이지 보스 — 100% 패배 가정.
const weakTeam = buildTeam(nTeamIds, 1);
const loseResult = resolveBossChallenge({ team: weakTeam, stage: 300, maxStage: 300 });
console.assert(loseResult.win === false, "약한 팀은 아주 높은 스테이지 보스를 이길 수 없어야 함");
console.assert(loseResult.stage === 300 && loseResult.maxStage === 300, "패배 시 stage/maxStage가 그대로 유지되어야 함");

// 아주 강한 팀(SSR 만렙) vs 저층 보스 — 100% 승리 가정.
const strongTeam = buildTeam(ssrTeamIds, LEVEL_CAP.SSR);
const winResult = resolveBossChallenge({ team: strongTeam, stage: 1, maxStage: 1 });
console.assert(winResult.win === true, "강한 팀은 저층 보스를 이겨야 함");
console.assert(winResult.stage === 2 && winResult.maxStage === 2, "승리 시 stage/maxStage가 모두 1 올라야 함");
console.assert(winResult.isFirstClear === true && winResult.diaBonus >= STAGE_CLEAR_GEM_BONUS, "최초 클리어는 다이아 보너스를 받아야 함");

// 이미 깬 스테이지(현재 stage < maxStage)를 다시 깨는 경우 — 최초 클리어가 아니므로 보너스 없음.
const replayResult = resolveBossChallenge({ team: strongTeam, stage: 1, maxStage: 5 });
console.assert(replayResult.win === true && replayResult.isFirstClear === false, "이미 뚫은 프론티어 재도전은 최초 클리어가 아니어야 함");
console.assert(replayResult.diaBonus === 0, "재도전은 다이아 보너스가 없어야 함");

console.log("\n=== 8. 자유 후퇴 — maxStage 이하로만 가능 ===");
console.assert(resolveRetreat(3, 10) === 3, "maxStage 이하 스테이지로는 후퇴 가능해야 함");
let threw = false;
try { resolveRetreat(11, 10); } catch (e) { threw = true; }
console.assert(threw, "maxStage보다 먼 스테이지로는 후퇴할 수 없어야 함(에러를 던져야 함)");

console.log("\n=== 9. stageInfo — 전투 없이 미리보기 정보를 반환해야 함 ===");
const info = stageInfo(15);
console.assert(info.fieldSpecies.length === FIELD_SPECIES.length, "미리보기에 모든 필드 종이 나와야 함");
console.assert(!!info.boss.name, "미리보기에 보스 이름이 있어야 함");

console.log("\n모든 검증 통과(assert 실패가 위에 없으면 OK).");
