// ============================================================================
// 게임 2.0 — 가챠(뽑기) 메타 시스템
// ============================================================================
// 기존 라이브 게임의 가챠 구조를 그대로 이식: 정상 확률 풀(N/R/SR/SSR/XR, 등급별 가중치)
// + 그와 완전히 독립된 두 개의 고정 확률 추첨(HR 히든, XXR 초월) — 둘 다 정상 풀에 전혀
// 섞이지 않고, 승급으로도 도달 불가능(server/data/promotion.js의 RARITY_CHAIN 밖).
//
// [단순화 — 다음 단계로 미룬 것] 기존 게임은 플레이어 레벨에 따라 등급별 가중치가 조금씩
// 움직였다(weightsForLevel). 이번 1차 구현은 레벨 무관 고정 가중치로 단순화했다 — 실제
// 서버/DB 연동 단계에서 레벨 스케일링이 필요하면 이 가중치 테이블을 레벨 입력을 받는
// 함수로 확장하면 된다.
import { ROSTER } from "./characters.js";

// 등급별 가중치 — 기존 게임 RARITY_INFO.weight를 그대로 이식(이미 여러 차례 튜닝된 값).
export const MAIN_POOL_WEIGHTS = { N: 55, R: 32, SR: 10, SSR: 3, XR: 0.05 };
const MAIN_POOL_TOTAL = Object.values(MAIN_POOL_WEIGHTS).reduce((a, b) => a + b, 0);

// HR/XXR — 메인 풀과 완전히 독립된 고정 확률(둘 다 동시에 당첨될 수 없고, 메인 풀보다
// 먼저 판정한다). 기존 게임 값 그대로.
export const HIDDEN_RATE = 0.0002; // HR 0.02%
export const TRANSCENDENT_RATE = 0.00005; // XXR 0.005%

function buildPools() {
  const pools = { N: [], R: [], SR: [], SSR: [], XR: [], HR: [], XXR: [] };
  for (const c of ROSTER) (pools[c.rarity] || (pools[c.rarity] = [])).push(c);
  return pools;
}
export const CHARS_BY_RARITY = buildPools();

function pickFrom(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

// 뽑기 1회 — 반환: { character, rarity, pool: "hidden"|"transcendent"|"main" }
export function pickCharacter() {
  const roll = Math.random();
  if (roll < TRANSCENDENT_RATE && CHARS_BY_RARITY.XXR.length) {
    return { character: pickFrom(CHARS_BY_RARITY.XXR), rarity: "XXR", pool: "transcendent" };
  }
  if (roll < TRANSCENDENT_RATE + HIDDEN_RATE && CHARS_BY_RARITY.HR.length) {
    return { character: pickFrom(CHARS_BY_RARITY.HR), rarity: "HR", pool: "hidden" };
  }
  // 메인 풀 — 가중치만큼 구간을 나눠서 그 안에 어디 떨어지는지로 등급을 고른다.
  let r = Math.random() * MAIN_POOL_TOTAL;
  for (const [rarity, weight] of Object.entries(MAIN_POOL_WEIGHTS)) {
    if (r < weight) {
      const pool = CHARS_BY_RARITY[rarity];
      return { character: pickFrom(pool), rarity, pool: "main" };
    }
    r -= weight;
  }
  // 부동소수점 경계값 보호 — 이론상 도달 안 하지만 혹시 몰라 가장 낮은 등급으로.
  return { character: pickFrom(CHARS_BY_RARITY.N), rarity: "N", pool: "main" };
}

// /rates 응답 용 — 각 등급이 실제로 뽑힐 확률(%)을 노출.
export function gachaRates() {
  const rates = {};
  for (const [rarity, weight] of Object.entries(MAIN_POOL_WEIGHTS)) {
    rates[rarity] = Math.round((weight / MAIN_POOL_TOTAL) * 100 * 10000) / 10000;
  }
  rates.HR = HIDDEN_RATE * 100;
  rates.XXR = TRANSCENDENT_RATE * 100;
  return rates;
}
