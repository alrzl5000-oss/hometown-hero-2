// ============================================================================
// 게임 2.0 — 컬렉션 보너스 + 시너지 세트
// ============================================================================
// [배경] 1.0(alrzl5000-oss/minsu100)의 server/data/synergy.js를 읽고 메커니즘(보유
// 영웅 수에 비례한 "도감 채움" 보너스 + 특정 조합을 팀에 넣으면 발동하는 "시너지 세트")은
// 그대로 가져왔다. 다만 1.0의 39개 세트 각각이 정확히 어떤 hNN 조합이었는지는 원문이
// get_page_text의 50,000자 제한 너머에 있어 실측하지 못했다 — 그래서 세트 "구성"은
// 2.0의 실제 로스터(server/data/characters.js의 ROSTER, 1.0과 ID/이름이 동일)에서
// 자연히 보이는 진짜 클러스터(같은 인물이 등급별로 여러 번 등장하는 "인물 계보" 등)를
// 그대로 추출해 다시 짰다 — [1차 추정치, 실측 필요]이지만 메커니즘 자체는 1.0과 동일하다.
//
// 분류(1.0과 동일한 6개 카테고리 + bonus, 총 39세트):
//   - lineage(인물 계보, 8): 로스터에 등급을 넘나들며 반복 등장하는 같은 이름의 캐릭터들
//   - wordplay(말장난, 8): 이름/설정의 언어유희를 엮은 소규모 조합
//   - theme(테마, 3): 세계관/설정상 한 묶음인 조합
//   - crossover(크로스오버, 5): h86~h94의 타 작품 패러디 캐릭터 조합
//   - nextgen(차세대 계보, 5): XR/HR/XXR 상위 등급 캐릭터 중심 조합
//   - classRework(직업 재편, 5): 같은 직업군을 모으는 조합
//   - bonus(등급/추가, 5): 위 카테고리에 안 들어가는 나머지
//
// [범위] 여기는 순수 계산 함수만 둔다. server/index.js가 player_characters 보유 목록과
// 현재 편성 팀을 넘겨 호출한다(GET /api/players/:playerId/bonuses, 그리고 파밍 설정에서
// buildFormedTeam에 결과를 얹는다).
import { ROSTER } from "./characters.js";

// ---------------------------------------------------------------------------
// 1. 등급 순위 — "이 등급 이상 보유" 누적 집계에 쓴다.
// ---------------------------------------------------------------------------
export const RARITY_RANK = { N: 0, R: 1, SR: 2, SSR: 3, XR: 4, HR: 5, XXR: 6, EX: 7 };
export const TIER_RANK = RARITY_RANK;

// ---------------------------------------------------------------------------
// 2. 컬렉션(도감) 보너스
//    (a) 보유 영웅 1명(중복 캐릭터 무관, 종류 기준)마다 전원에게 소폭 스탯 — "도감을
//        채우는 재미"(1.0 DEX_FILL_BONUS_PER_HERO 그대로).
//    (b) 등급별 "이 등급 이상 보유 수" 누적 마일스톤 — 높은 등급일수록 더 적은 수로도
//        마일스톤이 열리지만 보너스는 더 크다(1.0 GRADE_COUNT_CONFIG 그대로의 설계 원칙).
// ---------------------------------------------------------------------------
export const DEX_FILL_BONUS_PER_HERO = { atk: 0.45, hp: 0.45, def: 0.45 }; // 퍼센트 단위(1=1%)

// [1차 추정치 — 실측 필요] 등급별 "이 등급 이상 보유 수" 마일스톤. count는 그 등급(rank)
// 이상인 캐릭터를 몇 종 보유해야 하는지(로스터 전체 모수에 맞춰 상위 등급일수록 낮게 잡음).
export const GRADE_COUNT_CONFIG = {
  R: { minRank: RARITY_RANK.R, milestones: [10, 20, 30, 40, 50, 60], perMilestone: { atk: 0.8, hp: 0.8, def: 0.8 } },
  SR: { minRank: RARITY_RANK.SR, milestones: [8, 16, 24, 32, 40, 46], perMilestone: { atk: 1.0, hp: 1.0, def: 1.0 } },
  SSR: { minRank: RARITY_RANK.SSR, milestones: [6, 12, 18, 24, 30, 34], perMilestone: { atk: 1.3, hp: 1.3, def: 1.3 } },
  XR: { minRank: RARITY_RANK.XR, milestones: [3, 6, 9, 12, 15, 17], perMilestone: { atk: 1.8, hp: 1.8, def: 1.8 } },
};

function sumDeltas(deltaList) {
  const total = { atk: 0, hp: 0, def: 0, spd: 0, critAdd: 0 };
  for (const d of deltaList) {
    for (const k of Object.keys(total)) total[k] += d[k] || 0;
  }
  return total;
}

// 퍼센트 델타(총합, 예: atk:12.5 = +12.5%)를 실제 배율(mult)로 변환.
export function deltasToMult(deltas) {
  return {
    atkMult: 1 + (deltas.atk || 0) / 100,
    hpMult: 1 + (deltas.hp || 0) / 100,
    defMult: 1 + (deltas.def || 0) / 100,
    spdMult: 1 + (deltas.spd || 0) / 100,
    critAdd: (deltas.critAdd || 0) / 100,
  };
}

// ownedRows: player_characters 행 배열([{character_id, current_rarity, origin_rarity, ...}]).
// rarity 판정은 "현재 등급"(승급 반영) 기준 — 1.0도 승급한 캐릭터는 승급한 등급으로
// 집계했다(승급할 동기를 컬렉션 보너스에도 주기 위함).
export function computeCollectionBonus(ownedRows) {
  const uniqueCount = new Set((ownedRows || []).map((r) => r.character_id)).size;
  const deltaList = [];
  const breakdown = { uniqueHeroes: uniqueCount, gradeCounts: {} };

  if (uniqueCount > 0) {
    deltaList.push({
      atk: DEX_FILL_BONUS_PER_HERO.atk * uniqueCount,
      hp: DEX_FILL_BONUS_PER_HERO.hp * uniqueCount,
      def: DEX_FILL_BONUS_PER_HERO.def * uniqueCount,
    });
  }

  for (const [tierKey, config] of Object.entries(GRADE_COUNT_CONFIG)) {
    const count = (ownedRows || []).filter((r) => (RARITY_RANK[r.current_rarity] ?? -1) >= config.minRank).length;
    const milestonesHit = config.milestones.filter((m) => count >= m).length;
    breakdown.gradeCounts[tierKey] = { count, milestonesHit, maxMilestones: config.milestones.length };
    if (milestonesHit > 0) {
      deltaList.push({
        atk: config.perMilestone.atk * milestonesHit,
        hp: config.perMilestone.hp * milestonesHit,
        def: config.perMilestone.def * milestonesHit,
      });
    }
  }

  const deltas = sumDeltas(deltaList);
  return { deltas, mult: deltasToMult(deltas), breakdown };
}

// ---------------------------------------------------------------------------
// 3. 시너지 세트 — 39종. 각 세트는 memberIds 중 몇 명이 "현재 편성된 팀"(최대 5인)에
//    있는지로 등급(tier)이 결정된다. tiers는 [{need, delta, desc}] 오름차순 — need를
//    만족하는 가장 높은 tier 하나만 적용(누적 아님, 1.0 설계 그대로: tier2/tier4가 각각
//    독립 조건이 아니라 "2명 이상이면 tier2, 4명 이상이면 tier2 대신 tier4").
// ---------------------------------------------------------------------------
function set(id, name, icon, theme, desc, memberIds, tiers) {
  return { id, name, icon, theme, desc, memberIds, tiers };
}

export const SYNERGY_SETS = [
  // --- 인물 계보(lineage) × 8 — 같은 이름이 등급을 넘나들며 반복 등장하는 클러스터.
  set("lineage_leejaehun", "재훈이의 일생", "📖", "lineage", "등급을 넘나드는 이재훈 한 명의 인생 이야기",
    ["h01", "h22", "h11", "h46", "h76", "h82", "h102"],
    [{ need: 2, delta: { atk: 3, hp: 3, def: 3 } }, { need: 4, delta: { atk: 7, hp: 7, def: 7 } }]),
  set("lineage_johseunghyun", "승현 유니버스", "📱", "lineage", "조승현의 여러 버전을 한 팀에",
    ["h02", "h43", "h13", "h94", "h97"],
    [{ need: 2, delta: { atk: 3, hp: 3, def: 3 } }, { need: 4, delta: { atk: 7, hp: 7, def: 7 } }]),
  set("lineage_parkjuhwan", "주환 패밀리", "🏠", "lineage", "박주환의 여러 인생 버전",
    ["h03", "h24", "h53", "h10", "h54", "h56", "h84", "h95"],
    [{ need: 2, delta: { atk: 3, hp: 3, def: 3 } }, { need: 4, delta: { atk: 7, hp: 7, def: 7 } }]),
  set("lineage_baekminsu", "민수 라인", "⚔️", "lineage", "백민수의 여러 얼굴 — 끝엔 MINSU-DARKMAN까지",
    ["h06", "h21", "h65", "h66", "h68", "h12", "h85", "h101"],
    [{ need: 2, delta: { atk: 3, hp: 3, def: 3 } }, { need: 4, delta: { atk: 7, hp: 7, def: 7 } }]),
  set("lineage_chaemyeongki", "명기 사가", "🏖️", "lineage", "채명기의 각지 원정기",
    ["h08", "h09", "h18", "h57", "h58", "h59", "h96"],
    [{ need: 2, delta: { atk: 3, hp: 3, def: 3 } }, { need: 4, delta: { atk: 7, hp: 7, def: 7 } }]),
  set("lineage_kimyuchang", "유창 군단", "🏊", "lineage", "김유창의 여러 모습 — 순서가 뒤바뀐 버전까지",
    ["h15", "h16", "h17", "h61", "h62", "h63", "h64", "h98"],
    [{ need: 2, delta: { atk: 3, hp: 3, def: 3 } }, { need: 4, delta: { atk: 7, hp: 7, def: 7 } }]),
  set("lineage_jocheongwol", "청월의 다면상", "🌙", "lineage", "조청월의 여러 자아",
    ["h04", "h49", "h50", "h51", "h52", "h23", "h99"],
    [{ need: 2, delta: { atk: 3, hp: 3, def: 3 } }, { need: 4, delta: { atk: 7, hp: 7, def: 7 } }]),
  set("lineage_jinkihan", "기한 일대기", "⏳", "lineage", "진기한의 여러 시절",
    ["h07", "h19", "h69", "h70", "h71", "h72"],
    [{ need: 2, delta: { atk: 3, hp: 3, def: 3 } }, { need: 4, delta: { atk: 7, hp: 7, def: 7 } }]),

  // --- 말장난(wordplay) × 8 — 이름 유희를 엮은 소규모 조합.
  set("wp_cheongwol_selfcritic", "청월 자아비판", "🪞", "wordplay", "그냥 청월 + 싸이코패스 청월 + 먼저 사과하는 청월",
    ["h49", "h51", "h52"],
    [{ need: 2, delta: { atk: 4, hp: 4, def: 4 } }, { need: 3, delta: { atk: 9, hp: 9, def: 9 } }]),
  set("wp_seunghyun_notseunghyun", "승현인데 승현이 아니다", "🌀", "wordplay", "조승현과 조승현아니고이승현의 역설",
    ["h02", "h94"],
    [{ need: 2, delta: { atk: 6, hp: 6, def: 6 } }]),
  set("wp_black_white_minsu", "흑백의 민수", "☯️", "wordplay", "백민수와 MINSU-DARKMAN의 명암 대비",
    ["h06", "h101"],
    [{ need: 2, delta: { atk: 6, hp: 6, def: 6 } }]),
  set("wp_reversed_yuchang", "유창김 역순", "🔁", "wordplay", "김유창과 이름 순서가 뒤바뀐 맛조은유창김",
    ["h15", "h64"],
    [{ need: 2, delta: { atk: 6, hp: 6, def: 6 } }]),
  set("wp_seungtak_tears", "승탁의 눈물", "😢", "wordplay", "박탈감을 느낀 조승탁의 삼대",
    ["h41", "h44", "h81"],
    [{ need: 2, delta: { atk: 4, hp: 4, def: 4 } }, { need: 3, delta: { atk: 9, hp: 9, def: 9 } }]),
  set("wp_local_citizens", "지역 비교 대전", "🗺️", "wordplay", "광주/순천/화순 시민 삼인방",
    ["h77", "h78", "h79", "h80"],
    [{ need: 2, delta: { atk: 4, hp: 4, def: 4 } }, { need: 4, delta: { atk: 9, hp: 9, def: 9 } }]),
  set("wp_kihan_faces", "기한의 여러 얼굴", "🎭", "wordplay", "진기한 + 뜸진기한뜸 + 굵은눈썹의 기한",
    ["h07", "h70", "h72"],
    [{ need: 2, delta: { atk: 4, hp: 4, def: 4 } }, { need: 3, delta: { atk: 9, hp: 9, def: 9 } }]),
  set("wp_myeongki_travel", "명기의 전국일주", "🧳", "wordplay", "서울/부산/화순/양양/보라카이 채명기",
    ["h08", "h09", "h18", "h58", "h59"],
    [{ need: 2, delta: { atk: 3, hp: 3, def: 3 } }, { need: 4, delta: { atk: 8, hp: 8, def: 8 } }]),

  // --- 테마(theme) × 3 — 세계관상 한 묶음.
  set("theme_mercenary_band", "환상의 용병단", "🗡️", "theme", "고든/렌/하이든/묘/릴리 — 이름 없는 필드의 전설들",
    ["h25", "h28", "h31", "h32", "h37"],
    [{ need: 2, delta: { atk: 3, hp: 3, def: 3 } }, { need: 4, delta: { atk: 8, hp: 8, def: 8 } }]),
  set("theme_royal_heirs", "등급의 왕족들", "👑", "theme", "HR/XXR 최상위 등급을 상징하는 조합",
    ["h81", "h85", "h101", "h102"],
    [{ need: 2, delta: { atk: 5, hp: 5, def: 5 } }, { need: 3, delta: { atk: 10, hp: 10, def: 10 } }]),
  set("theme_fantasy_guard", "대지의 수호자들", "🛡️", "theme", "감마르/브루토/강철 수호자 — 수비형 영웅 테마",
    ["h26", "h27"],
    [{ need: 2, delta: { atk: 5, hp: 5, def: 5 } }]),

  // --- 크로스오버(crossover) × 5 — h86~h94 타 작품 패러디.
  set("crossover_shonen_speed", "소년만화 질주 듀오", "💨", "crossover", "나루토 + 이치고",
    ["h88", "h89"],
    [{ need: 2, delta: { atk: 6, hp: 6, def: 6 } }]),
  set("crossover_strongest", "최강자 듀오", "🔱", "crossover", "고죠 사토루 + 성진우",
    ["h87", "h93"],
    [{ need: 2, delta: { atk: 6, hp: 6, def: 6 } }]),
  set("crossover_giant_duo", "괴물 듀오", "🐙", "crossover", "몽키.D.루피 + 히비노 카프카",
    ["h90", "h92"],
    [{ need: 2, delta: { atk: 6, hp: 6, def: 6 } }]),
  set("crossover_retro_duo", "레트로 듀오", "📺", "crossover", "인조인간 18호 + 가정교사 히트맨 리본",
    ["h86", "h91"],
    [{ need: 2, delta: { atk: 6, hp: 6, def: 6 } }]),
  set("crossover_grand_assembly", "크로스오버 총집결", "🌟", "crossover", "타 작품 패러디 영웅 9인 중 다수 편성",
    ["h86", "h87", "h88", "h89", "h90", "h91", "h92", "h93", "h94"],
    [{ need: 2, delta: { atk: 2, hp: 2, def: 2 } }, { need: 3, delta: { atk: 5, hp: 5, def: 5 } }, { need: 4, delta: { atk: 10, hp: 10, def: 10 } }]),

  // --- 차세대 계보(nextgen) × 5 — XR/HR/XXR 상위 등급 중심.
  set("nextgen_first_wave", "신성 4인방", "🆕", "nextgen", "가장 먼저 XR에 도달한 4인",
    ["h73", "h74", "h75", "h76"],
    [{ need: 2, delta: { atk: 4, hp: 4, def: 4 } }, { need: 4, delta: { atk: 10, hp: 10, def: 10 } }]),
  set("nextgen_elite_wave", "정예 승급체 6인", "💎", "nextgen", "두 번째 XR 웨이브 — 기존 라인업의 승급판",
    ["h95", "h96", "h97", "h98", "h99", "h100"],
    [{ need: 2, delta: { atk: 4, hp: 4, def: 4 } }, { need: 4, delta: { atk: 10, hp: 10, def: 10 } }]),
  set("nextgen_hr_assembly", "HR 5인 집결", "🏆", "nextgen", "HR 등급 5인 전원",
    ["h81", "h82", "h83", "h84", "h85"],
    [{ need: 2, delta: { atk: 4, hp: 4, def: 4 } }, { need: 4, delta: { atk: 10, hp: 10, def: 10 } }]),
  set("nextgen_xxr_duo", "XXR 최종 2인", "🏅", "nextgen", "XXR 등급 둘을 동시에",
    ["h101", "h102"],
    [{ need: 2, delta: { atk: 12, hp: 12, def: 12 } }]),
  set("nextgen_transcend_minsu", "민수, 초월하다", "🌑", "nextgen", "N등급 백민수와 그의 최종 초월형 MINSU-DARKMAN",
    ["h06", "h65", "h68", "h101"],
    [{ need: 2, delta: { atk: 5, hp: 5, def: 5 } }, { need: 3, delta: { atk: 10, hp: 10, def: 10 } }]),

  // --- 직업 재편(classRework) × 5 — 같은 직업군을 모으는 조합.
  set("class_tanker_trio", "탱커 삼총사", "🛡️", "classRework", "탱커 직업 3인 이상 편성",
    ROSTER.filter((c) => c.class === "tanker").map((c) => c.id).slice(0, 10),
    [{ need: 2, delta: { def: 10, hp: 6 } }, { need: 4, delta: { def: 20, hp: 12 } }]),
  set("class_dealer_legion", "딜러 군단", "⚔️", "classRework", "딜러 직업 3인 이상 편성",
    ROSTER.filter((c) => c.class === "dealer").map((c) => c.id).slice(0, 10),
    [{ need: 2, delta: { atk: 10 } }, { need: 4, delta: { atk: 20 } }]),
  set("class_ranged_squad", "원거리 사격조", "🏹", "classRework", "원거리 직업 3인 이상 편성",
    ROSTER.filter((c) => c.class === "ranged").map((c) => c.id).slice(0, 10),
    [{ need: 2, delta: { atk: 8, critAdd: 3 } }, { need: 4, delta: { atk: 16, critAdd: 6 } }]),
  set("class_assassin_squad", "암살 결사대", "🗡️", "classRework", "암살자 직업 3인 이상 편성",
    ROSTER.filter((c) => c.class === "assassin").map((c) => c.id).slice(0, 10),
    [{ need: 2, delta: { atk: 6, critAdd: 5 } }, { need: 4, delta: { atk: 14, critAdd: 10 } }]),
  set("class_support_choir", "치유의 빛", "💖", "classRework", "서포터 직업 3인 이상 편성",
    ROSTER.filter((c) => c.class === "support").map((c) => c.id).slice(0, 10),
    [{ need: 2, delta: { hp: 10, def: 5 } }, { need: 4, delta: { hp: 20, def: 10 } }]),

  // --- 등급/추가(bonus) × 5 — 나머지.
  set("bonus_balanced_five", "황금 비율 밸런스팀", "⚖️", "bonus", "탱커·딜러·원거리·암살·서포터를 각 1명씩",
    ROSTER.map((c) => c.id),
    [{ need: 5, delta: { atk: 5, hp: 5, def: 5, spd: 5 } }]),
  set("bonus_ssr_veterans", "SSR 베테랑", "🎖️", "bonus", "원년 SSR 7인(h10~h19) 중 다수 편성",
    ["h10", "h11", "h12", "h13", "h17", "h18", "h19"],
    [{ need: 2, delta: { atk: 4, hp: 4, def: 4 } }, { need: 4, delta: { atk: 9, hp: 9, def: 9 } }]),
  set("bonus_sr_tacticians", "SR 전략가들", "🧠", "bonus", "SR 등급 전술형 영웅 모음",
    ["h27", "h30", "h39", "h40"],
    [{ need: 2, delta: { atk: 4, hp: 4, def: 4 } }, { need: 3, delta: { atk: 9, hp: 9, def: 9 } }]),
  set("bonus_r_knights", "R 기사단", "🛡️", "bonus", "R 등급 전투형 영웅 모음",
    ["h26", "h29", "h33", "h34"],
    [{ need: 2, delta: { atk: 4, hp: 4, def: 4 } }, { need: 3, delta: { atk: 9, hp: 9, def: 9 } }]),
  set("bonus_support_sisters", "축복의 성가대", "🎵", "bonus", "유나/델피네/오르카 — 버프형 서포터 모음",
    ["h38", "h39", "h40"],
    [{ need: 2, delta: { hp: 6, def: 4 } }, { need: 3, delta: { hp: 12, def: 8 } }]),
];

// ---------------------------------------------------------------------------
// 4. 현재 편성된 팀(최대 5인)의 시너지 발동 상태를 계산.
//    teamCharacterIds: 편성 슬롯의 characterId 배열(빈 슬롯은 null/undefined 섞여도 됨).
// ---------------------------------------------------------------------------
export function computeSynergyState(teamCharacterIds) {
  const idSet = new Set((teamCharacterIds || []).filter(Boolean));
  const active = [];
  const deltaList = [];

  for (const synergy of SYNERGY_SETS) {
    const matched = synergy.memberIds.filter((id) => idSet.has(id));
    if (!matched.length) continue;
    let activeTier = null;
    for (const tier of synergy.tiers) {
      if (matched.length >= tier.need) activeTier = tier;
    }
    active.push({
      id: synergy.id,
      name: synergy.name,
      icon: synergy.icon,
      theme: synergy.theme,
      desc: synergy.desc,
      matchedCount: matched.length,
      matchedIds: matched,
      activeTierNeed: activeTier ? activeTier.need : null,
      delta: activeTier ? activeTier.delta : null,
    });
    if (activeTier) deltaList.push(activeTier.delta);
  }

  const deltas = sumDeltas(deltaList);
  return { active, deltas, mult: deltasToMult(deltas) };
}
