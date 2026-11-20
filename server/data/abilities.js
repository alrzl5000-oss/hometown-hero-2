// ============================================================================
// 게임 2.0 — 어빌리티(계정 레벨 연동 영구 버프) 시스템
// ============================================================================
// 기존 게임(`alrzl5000-oss/minsu100`)의 server/lib/abilities.js(어빌리티 핵심 로직) +
// server/routes/abilities.js(API 형태)를 민수님이 지적한 대로 포팅한다: "계정 레벨에 따라
// [어빌리티 등급] 확률 오르는 것"과 "어빌리티 자체"가 2.0엔 통째로 빠져 있었다.
//
// 메이플스토리의 "어빌리티"를 참고한 설계 — 슬롯(줄)이 최대 3개, 계정 레벨이 오르면서
// 순서대로 개방된다. "재설정"을 누르면 골드를 내고 열려있는 슬롯 전체가 한 번에 다시
// 굴러간다(타입 하나씩 개별로 뽑는 방식이 아니라 메이플처럼 줄 전체를 한 번에 리롤). 각
// 줄은 무작위 효과 + 무작위 등급(레어/에픽/유니크/레전드리)이 함께 나오고, 등급이 높을수록
// 수치 범위도 좋아진다. 등급 확률은 계정 레벨에 따라 서서히 오른다(아래 참고). 줄 하나를
// "고정"해 두면, 재설정할 때 그 줄은 그대로 두고 나머지만 다시 굴린다.
//
// [이번에 일부러 범위에서 뺀 것 — 다음 단계]
// - 메이플 방식 3프리셋 전환 + 콘텐츠별 자동 프리셋 전환(층보스/일일보스 등) — 어빌리티의
//   "핵심 재미"(등급/수치 뽑기 + 고정 재설정)와는 무관한 UI 편의 기능이라 1차 구현에서는
//   뺐다. 필요해지면 old game의 switchAbilityPreset 패턴을 그대로 가져오면 된다.
// - EX 승급 이후 "버려진 조각" 환산 같은 조각 상한/오버플로 처리 — 어빌리티와 무관.
import { equippedOdysseyBonusSums } from "./odyssey.js";
import { levelAtkBonusMult } from "./accountLevel.js";

export const ABILITY_SLOT_COUNT = 3;
export const ABILITY_SLOT_UNLOCK_LEVEL = [10, 20, 30]; // 1/2/3번째 줄이 개방되는 계정 레벨 — 그대로 이식

// [1차 추정치, 실측 필요] 골드 비용은 2.0 경제 스케일에 맞춰 재산정 대상인데, 2.0은 아직
// 스테이지 클리어 보상 자체가 없어서(claude/game2-stage-system.md 8번) 실제 골드 수입을
// 가늠할 기준이 없다. 당장은 promotion.js의 가장 낮은 승급 비용(PROMOTE_GOLD_COST.N=2500)
// 보다 한 단계 위, 자주 반복할 행동이라는 점을 고려해 20배 수준으로 잡아둔다.
export const ABILITY_REROLL_COST = 50_000;
export const ABILITY_LOCK_REROLL_SURCHARGE_MULT = 1.6; // 고정된 줄 1개당 곱해지는 배율 — 비율값 그대로 이식

// lockedIndices 중 고정된 개수만큼 복리로 비용이 붙는다. 열려있는 슬롯을 전부 고정했으면
// 재설정할 대상이 없으므로 null(불가)을 반환 — 그대로 이식.
export function rerollCostFor(lockedIndices, slots) {
  const count = Array.isArray(lockedIndices) ? lockedIndices.length : 0;
  if (typeof slots === "number" && count >= slots && slots > 0) return null;
  if (count <= 0) return ABILITY_REROLL_COST;
  return Math.round(ABILITY_REROLL_COST * Math.pow(ABILITY_LOCK_REROLL_SURCHARGE_MULT, count));
}

export const ABILITY_GRADES = ["rare", "epic", "unique", "legendary"];
export const ABILITY_GRADE_LABEL = { rare: "레어", epic: "에픽", unique: "유니크", legendary: "레전드리" };
export const ABILITY_GRADE_COLOR = { rare: "#4c8bf5", epic: "#a855f7", unique: "#f5b301", legendary: "#ff4d6d" };

// 등급 확률이 계정 레벨에 따라 서서히 오른다 — 가챠 SSR/XR과 같은 패턴(server/data/gacha.js
// weightsForLevel). 레벨 1(실제로는 슬롯이 열리는 10레벨) 기준값은 옛 고정 확률과 동일하게
// 두고, 레벨 100에서 에픽 16% / 유니크 5% / 레전드리 1.8%까지 오른다. rare는 항상 나머지를
// 채운다. 전부 %라 스케일 무관 — 그대로 이식.
const EPIC_BASE_WEIGHT = 10.5;
const EPIC_MAX_WEIGHT = 16;
const EPIC_PER_LEVEL = (EPIC_MAX_WEIGHT - EPIC_BASE_WEIGHT) / 99;
const UNIQUE_BASE_WEIGHT = 2;
const UNIQUE_MAX_WEIGHT = 5;
const UNIQUE_PER_LEVEL = (UNIQUE_MAX_WEIGHT - UNIQUE_BASE_WEIGHT) / 99;
const LEGENDARY_BASE_WEIGHT = 0.5;
const LEGENDARY_MAX_WEIGHT = 1.8;
const LEGENDARY_PER_LEVEL = (LEGENDARY_MAX_WEIGHT - LEGENDARY_BASE_WEIGHT) / 99;

function epicWeightForLevel(level) {
  return Math.min(EPIC_MAX_WEIGHT, EPIC_BASE_WEIGHT + Math.max(0, (level || 1) - 1) * EPIC_PER_LEVEL);
}
function uniqueWeightForLevel(level) {
  return Math.min(UNIQUE_MAX_WEIGHT, UNIQUE_BASE_WEIGHT + Math.max(0, (level || 1) - 1) * UNIQUE_PER_LEVEL);
}
function legendaryWeightForLevel(level) {
  return Math.min(LEGENDARY_MAX_WEIGHT, LEGENDARY_BASE_WEIGHT + Math.max(0, (level || 1) - 1) * LEGENDARY_PER_LEVEL);
}

export function abilityGradeWeightsForLevel(level) {
  const epic = epicWeightForLevel(level);
  const unique = uniqueWeightForLevel(level);
  const legendary = legendaryWeightForLevel(level);
  const rare = Math.max(0, 100 - epic - unique - legendary);
  return { rare, epic, unique, legendary };
}

export function gradeProbabilityTable(level) {
  const weights = abilityGradeWeightsForLevel(level);
  return ABILITY_GRADES.map((grade) => ({ grade, label: ABILITY_GRADE_LABEL[grade], color: ABILITY_GRADE_COLOR[grade], pct: Math.round(weights[grade] * 100) / 100 }));
}

// 효과별 등급별 수치 범위 — 전부 % 또는 %p라 스케일 무관, 그대로 이식(값/주석 모두 옛
// 게임의 최종 재설계 버전).
export const ABILITY_EFFECTS = {
  gold: { label: "황금 손길", icon: "🪙", unit: "%", range: { rare: [8, 12], epic: [13, 18], unique: [22, 28], legendary: [35, 45] }, describe: (v) => `골드 획득량 +${v}%` },
  atk: { label: "맹공의 기운", icon: "⚔️", unit: "%", range: { rare: [6, 9], epic: [10, 14], unique: [16, 20], legendary: [26, 32] }, describe: (v) => `팀 전체 공격력 +${v}%` },
  spd: { label: "신속의 축복", icon: "💨", unit: "%", range: { rare: [4, 6], epic: [7, 9], unique: [11, 13], legendary: [17, 21] }, describe: (v) => `팀 전체 공격속도 +${v}%` },
  vit: { label: "강철 의지", icon: "🛡️", unit: "%", range: { rare: [6, 9], epic: [10, 14], unique: [16, 20], legendary: [26, 32] }, describe: (v) => `팀 전체 체력·방어력 +${v}%` },
  crit: { label: "필살의 감각", icon: "🎯", unit: "%p", range: { rare: [3, 4.5], epic: [5.5, 7.5], unique: [9, 11.5], legendary: [15, 18] }, describe: (v) => `팀 전체 치명타 확률 +${v}%p` },
  luck: { label: "황금손", icon: "🍀", unit: "%", range: { rare: [8, 12], epic: [13, 18], unique: [22, 28], legendary: [35, 45] }, describe: (v) => `다이아 획득량 +${v}%` },
  exp: { label: "지혜의 결정", icon: "📘", unit: "%", range: { rare: [8, 12], epic: [13, 18], unique: [22, 28], legendary: [35, 45] }, describe: (v) => `경험치 획득량 +${v}%` },
  skillDmg: { label: "필살의 파문", icon: "💥", unit: "%", range: { rare: [8, 12], epic: [13, 18], unique: [22, 28], legendary: [35, 45] }, describe: (v) => `필살기(스킬) 데미지 +${v}%` },
  normalDmg: { label: "연격의 리듬", icon: "🗡️", unit: "%", range: { rare: [8, 12], epic: [13, 18], unique: [22, 28], legendary: [35, 45] }, describe: (v) => `평타 데미지 +${v}%` },
};

export function unlockedSlotCount(level) {
  let n = 0;
  for (const lv of ABILITY_SLOT_UNLOCK_LEVEL) if ((level || 1) >= lv) n += 1;
  return n;
}

export function rollAbilityGrade(level) {
  const weights = abilityGradeWeightsForLevel(level);
  let r = Math.random() * 100;
  for (const g of ABILITY_GRADES) {
    r -= weights[g];
    if (r < 0) return g;
  }
  return ABILITY_GRADES[0];
}

export function rollAbilityLine(level) {
  const keys = Object.keys(ABILITY_EFFECTS);
  const key = keys[Math.floor(Math.random() * keys.length)];
  const grade = rollAbilityGrade(level);
  const [min, max] = ABILITY_EFFECTS[key].range[grade];
  const value = Math.round((min + Math.random() * (max - min)) * 10) / 10;
  return { key, grade, value };
}

// slots개만큼 새로 뽑되, lockedIndices에 든 줄은 기존 값을 그대로 유지. 아직 개방되지
// 않은 슬롯은 null — 그대로 이식.
export function rerollAbilityLines(currentLines, slots, lockedIndices, level) {
  const locked = new Set(Array.isArray(lockedIndices) ? lockedIndices : []);
  const current = Array.isArray(currentLines) ? currentLines : [];
  const result = [];
  for (let i = 0; i < ABILITY_SLOT_COUNT; i++) {
    if (i >= slots) {
      result.push(null);
      continue;
    }
    if (locked.has(i) && current[i]) {
      result.push(current[i]);
      continue;
    }
    result.push(rollAbilityLine(level));
  }
  return result;
}

// 전투/보상 계산에 쓰이는 배율/가산치로 변환. odysseyItems를 넘기면(선택) 오디세이 장비
// 보너스도 같은 카테고리에 합산된다(기존 게임과 동일하게 어빌리티 줄과 오디세이 장비가
// 같은 스탯 풀을 공유) — 넘기지 않으면 어빌리티 줄만으로 계산한다.
export function abilityBonuses(lines, level, odysseyItems) {
  const sums = { gold: 0, atk: 0, spd: 0, vit: 0, crit: 0, luck: 0, exp: 0, skillDmg: 0, normalDmg: 0 };
  for (const line of Array.isArray(lines) ? lines : []) {
    if (!line || !line.key || !(line.key in sums)) continue;
    sums[line.key] += Number(line.value) || 0;
  }
  if (odysseyItems) {
    const equipSums = equippedOdysseyBonusSums(odysseyItems);
    for (const key of Object.keys(equipSums)) if (key in sums) sums[key] += equipSums[key];
  }
  const levelMult = levelAtkBonusMult(level);
  return {
    goldMult: 1 + sums.gold / 100,
    atkMult: (1 + sums.atk / 100) * levelMult,
    spdMult: 1 + sums.spd / 100,
    hpMult: 1 + sums.vit / 100,
    defMult: 1 + sums.vit / 100,
    critAdd: sums.crit / 100,
    gemMult: 1 + sums.luck / 100,
    expMult: 1 + sums.exp / 100,
    skillDmgMult: 1 + sums.skillDmg / 100,
    normalDmgMult: 1 + sums.normalDmg / 100,
    levelAtkBonusPct: Math.round((levelMult - 1) * 1000) / 10,
  };
}

// team: buildFormedTeam을 거친 배열(atk/hp/def/spd/critRate/skills 보유) — 오디세이의
// applyOdysseyEquipmentBonuses와 같은 방식으로 "팀 스탯 자체"를 교전 전에 직접 올린다.
// skillDmg는 burst/burstHp의 burstMult/hpDmgMult에 바로 곱해서 반영하고, normalDmg는
// hero.normalDmgMult 필드로 넘겨서 combat.js의 평타 전용 피해 계산에서 곱해지게 한다
// (immuneNormal과 같은 패턴의 작은 엔진 확장 — server/lib/combat.js 참고).
export function applyAbilityBonuses(team, bonuses) {
  if (!bonuses) return team;
  return team.map((h) => {
    const skills = (h.skills || []).map((s) =>
      s.kind === "burst" || s.kind === "burstHp"
        ? { ...s, burstMult: s.burstMult * bonuses.skillDmgMult, hpDmgMult: s.hpDmgMult ? s.hpDmgMult * bonuses.skillDmgMult : s.hpDmgMult }
        : s
    );
    return {
      ...h,
      atk: Math.round(h.atk * bonuses.atkMult),
      hp: Math.round(h.hp * bonuses.hpMult),
      def: Math.round(h.def * bonuses.defMult),
      spd: h.spd * bonuses.spdMult,
      critRate: Math.min(0.95, h.critRate + bonuses.critAdd),
      normalDmgMult: (h.normalDmgMult || 1) * bonuses.normalDmgMult,
      skills,
    };
  });
}
