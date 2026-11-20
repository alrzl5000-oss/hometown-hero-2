// ============================================================================
// 게임 2.0 — 가챠(뽑기) 메타 시스템
// ============================================================================
// 기존 라이브 게임의 가챠 구조를 이식: 정상 확률 풀(N/R/SR/SSR/XR, 등급별 가중치) + 그와
// 완전히 독립된 두 개의 고정(그러나 레벨에 따라 오르는) 확률 추첨(HR 히든, XXR 초월).
//
// [수정 — 2026-11-20] 민수님 지적: "계정 레벨에 따라 확률 오르는 것도 멋대로 뺐더라" —
// 맞다. 1차 구현 때 "이번 범위에서 뺀다"고 문서(game2-meta-progression.md 4번)에 적어만
// 두고, SSR/XR/HR/XXR을 전부 "레벨 무관 고정 가중치"로 단순화했었다. 그런데 그 고정값이
// 하필 old game의 "레벨 100(최대치)" 기준값과 같거나 더 generous해서(SSR 3% vs old 레벨100
// 상한 1.4%, HR 0.02% vs old 레벨100 상한 0.02%, XXR 0.005%를 레벨 제한 없이), 사실상 모든
// 계정이 "항상 만렙 확률"로 뽑고 있었다 — 이게 "승급이 너무 쉽다"는 지적의 근본 원인이기도
// 하다(승급 조각은 중복 뽑기에서만 나오므로). old game의 실제 weightsForLevel 곡선(레벨 1에서
// 거의 0에 가깝게 시작해서 레벨 100까지 선형으로 오르는)을 그대로 복구한다.
import { ROSTER } from "./characters.js";

// ---------- 레벨 1(최소) 기준 베이스 비율 — SSR/XR을 뺀 나머지(N/R/SR)가 이 비율로 나눠 가짐 ----------
export const BASE_SHARE = { N: 55, R: 32, SR: 10 }; // 합 97 (SSR 3을 제외한 기존 비율 — 그대로 이식)
const BASE_SHARE_TOTAL = BASE_SHARE.N + BASE_SHARE.R + BASE_SHARE.SR;

// SSR/XR 확률이 계정 레벨에 따라 선형으로 오른다 — old game 값 그대로 이식(스테이지 난이도
// 곡선이 완화된 뒤 30% 너프된 "최종" 값). 레벨 1(사실상 계정 생성 시점)엔 거의 0%, 레벨
// 100에서 SSR 1.4% / XR 0.035%까지 오른다.
export const SSR_BASE_WEIGHT = 0.0007; // Lv.1 기준 0.0007%
export const SSR_MAX_WEIGHT = 1.4; // Lv.100 기준 1.4%
const SSR_PER_LEVEL = (SSR_MAX_WEIGHT - SSR_BASE_WEIGHT) / 99;

export const XR_BASE_WEIGHT = 0.00007;
export const XR_MAX_WEIGHT = 0.035;
const XR_PER_LEVEL = (XR_MAX_WEIGHT - XR_BASE_WEIGHT) / 99;

export function ssrWeightForLevel(level) {
  return Math.min(SSR_MAX_WEIGHT, SSR_BASE_WEIGHT + Math.max(0, (level || 1) - 1) * SSR_PER_LEVEL);
}
export function xrWeightForLevel(level) {
  return Math.min(XR_MAX_WEIGHT, XR_BASE_WEIGHT + Math.max(0, (level || 1) - 1) * XR_PER_LEVEL);
}

// 계정 레벨에 따른 메인 풀 실제 확률(%) — 합은 항상 100.
export function weightsForLevel(level) {
  const ssr = ssrWeightForLevel(level);
  const xr = xrWeightForLevel(level);
  const remain = 100 - ssr - xr;
  const scale = remain / BASE_SHARE_TOTAL;
  return { N: BASE_SHARE.N * scale, R: BASE_SHARE.R * scale, SR: BASE_SHARE.SR * scale, SSR: ssr, XR: xr };
}

// 기존 MAIN_POOL_WEIGHTS는 더 이상 쓰지 않지만(완전히 고정이던 옛 값), 레벨 100 도달 시의
// 실제 수치를 그대로 보여주는 참고값으로 남겨둔다.
export const MAIN_POOL_WEIGHTS_AT_LEVEL_100 = weightsForLevel(100);

// ---------- HR(히든)/XXR(초월) — 메인 풀과 완전히 독립된 추첨 ----------
// HR: 레벨 1에서 0.01%로 시작해 레벨 100에서 0.02%까지(그대로 이식).
export const HIDDEN_HERO_BASE_CHANCE = 0.0001;
export const HIDDEN_HERO_MAX_CHANCE = 0.0002;
const HIDDEN_HERO_PER_LEVEL = (HIDDEN_HERO_MAX_CHANCE - HIDDEN_HERO_BASE_CHANCE) / 99;
export function hiddenHeroChanceForLevel(level) {
  return Math.min(HIDDEN_HERO_MAX_CHANCE, HIDDEN_HERO_BASE_CHANCE + Math.max(0, (level || 1) - 1) * HIDDEN_HERO_PER_LEVEL);
}

// XXR: 50레벨 미만은 절대 등장하지 않고, 50~100레벨 구간에서 0%→0.005%로 선형(그대로 이식).
export const XXR_MIN_LEVEL = 50;
export const XXR_MAX_CHANCE = 0.005;
export function xxrChanceForLevel(level) {
  const lvl = level || 1;
  if (lvl < XXR_MIN_LEVEL) return 0;
  return Math.min(XXR_MAX_CHANCE, (XXR_MAX_CHANCE * (lvl - XXR_MIN_LEVEL)) / (100 - XXR_MIN_LEVEL));
}

// ---------- 천장(하드 핏티) ----------
// 이 횟수 이상 SSR(또는 그 윗등급)이 안 나오면 강제 확정 — [1차 추정치] old game의 최종값
// (1000)을 그대로 이식했지만, old game은 "다이아 수입 대비 10연차 비용"으로 실측해 맞춘
// 값이라 2.0의 아직 미확정인 경제(스테이지 보상 없음)에서는 체감이 다를 수 있다.
export const HARD_PITY = 1000;

// 승급석 가챠 드랍 — 레벨 100 이상에서만, 매 회차 독립 추첨으로 0.01%(오디세이 쪽
// 0.1%와는 다른 레벨 게이트형 드랍 — 그대로 이식).
export const PROMOTION_STONE_DROP_CHANCE = 0.0001;
export const PROMOTION_STONE_MIN_LEVEL = 100;

function buildPools() {
  const pools = { N: [], R: [], SR: [], SSR: [], XR: [], HR: [], XXR: [] };
  for (const c of ROSTER) (pools[c.rarity] || (pools[c.rarity] = [])).push(c);
  return pools;
}
export const CHARS_BY_RARITY = buildPools();

function pickFrom(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function rollMainRarity(weights) {
  const roll = Math.random() * 100;
  let acc = 0;
  for (const r of ["N", "R", "SR", "SSR", "XR"]) {
    acc += weights[r];
    if (roll < acc) return r;
  }
  return "N";
}

// 뽑기 1회 — level/pity를 명시적으로 받아 순수 함수로 유지한다(2.0의 "클라이언트/DB가
// 현재 상태를 들고 있다가 매 호출에 함께 넘긴다" 스테이스리스 패턴, server/index.js에서
// players.level/pity_count를 읽어 넘긴다).
// 반환: { character, rarity, pool, pity, stoneGain }
//   - pity: 갱신된 천장 카운트(호출부가 그대로 저장해야 함)
//   - stoneGain: 이번 회차에 승급석을 얻었으면 1, 아니면 0
export function pickCharacter({ level = 1, pity = 0 } = {}) {
  let nextPity = pity + 1;
  const canDropStone = (level || 1) >= PROMOTION_STONE_MIN_LEVEL;
  const stoneGain = canDropStone && Math.random() < PROMOTION_STONE_DROP_CHANCE ? 1 : 0;

  if (Math.random() < xxrChanceForLevel(level) / 100 && CHARS_BY_RARITY.XXR.length) {
    return { character: pickFrom(CHARS_BY_RARITY.XXR), rarity: "XXR", pool: "transcendent", pity: 0, stoneGain };
  }
  if (Math.random() < hiddenHeroChanceForLevel(level) && CHARS_BY_RARITY.HR.length) {
    return { character: pickFrom(CHARS_BY_RARITY.HR), rarity: "HR", pool: "hidden", pity: 0, stoneGain };
  }

  let rarity;
  if (nextPity >= HARD_PITY) {
    rarity = "SSR";
    nextPity = 0;
  } else {
    rarity = rollMainRarity(weightsForLevel(level));
    if (rarity === "SSR" || rarity === "XR") nextPity = 0;
  }
  const pool = CHARS_BY_RARITY[rarity];
  return { character: pickFrom(pool.length ? pool : CHARS_BY_RARITY.N), rarity, pool: "main", pity: nextPity, stoneGain };
}

// /rates 응답용 — 특정 레벨 기준 각 등급의 실제 확률(%)을 노출. level 생략 시 레벨 1(최저) 기준.
export function gachaRates(level = 1) {
  const weights = weightsForLevel(level);
  const rates = {};
  for (const r of ["N", "R", "SR", "SSR", "XR"]) rates[r] = Math.round(weights[r] * 10000) / 10000;
  rates.HR = Math.round(hiddenHeroChanceForLevel(level) * 10000) / 10000;
  rates.XXR = Math.round(xxrChanceForLevel(level) * 10000) / 10000;
  return rates;
}
