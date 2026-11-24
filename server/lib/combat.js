// ============================================================================
// 게임 2.0 — 전투 엔진 (마나 자원 기반)
// ============================================================================
// 기존 게임(combat.js)과 다른 점:
//   - 타수누적 게이지(hitsToCharge) 대신 "스킬별 독립 게이지"(progress/manaCost).
//     캐릭터가 스킬을 여러 개 가져도 저마다 자기 게이지를 따로 채우기 때문에, 코스트가
//     낮은 스킬은 자주, 높은 스킬은 가끔 발동하는 리듬이 자연히 생긴다 — 그리고 두 게이지가
//     우연히 같은 타격에서 동시에 다 찼으면 "번갈아 발동" 토글 없이 그냥 둘 다 발동한다.
//     [설계 교훈] 처음엔 "하나의 공유 마나 풀을 여러 스킬이 갉아먹는" 모델로 짜봤는데,
//     싼 스킬이 매번 풀을 임계치 바로 위에서 즉시 털어가서 비싼 스킬이 영원히 그 임계치까지
//     못 올라가는 구조적 기아(starvation) 현상이 있었다(검증 스크립트로 실측: 2000틱 동안
//     비싼 스킬 발동 0회). 공유 풀 + 탐욕적 소비는 수학적으로 항상 이 문제를 겪으므로,
//     "스킬별 독립 게이지 + 공통 재생 속도"로 구조를 바꿨다.
//   - "마나" 스탯(stats.js의 mana)은 이제 공유 자원량이 아니라, 모든 스킬 게이지가 차는
//     속도에 곱해지는 배율(manaFactor)이다 — 마나 스탯이 높을수록 모든 스킬이 전반적으로
//     더 빨리 돈다.
//   - 방어력 공식이 레퍼런스 기반(stats.js)이고, 공격자의 PEN이 상대 방어력을 일부
//     무시한다.
//   - CC/디버프/처형은 전부 대상의 RES를 통과해야 실제로 적용된다(stats.js).
//   - 버프/디버프는 sourceId를 "캐릭터id:스킬슬롯" 형태로 키잉한다 — 기존 게임에서
//     "같은 캐릭터의 다른 두 스킬이 버프를 서로 덮어쓰는" 버그를 겪은 적이 있어서,
//     2.0은 처음부터 스킬 슬롯까지 구분한다.
import { mitigation, applyResistance, manaRegenPerHit, DEFAULT_STATS } from "../data/stats.js";

// ---------------------------------------------------------------------------
// 원소 상성 — 1.0의 "불>바람>물>불" 순환 상성(기존 게임 lib/combat.js의
// elementalMultiplier)을 2.0에도 그대로 이식. 두 쪽 다 원소가 있고 서로 다를 때만
// 적용되며, 상성자가 유리하면 1.25배, 불리하면 0.85배, 같은 원소거나 원소가 없는
// 쪽(필드 파밍 몹처럼 "원소 없음"을 쓰는 대상)은 1배(무효과) — 1.0 설계와 동일하게
// "파밍 잡몹은 상성 제외, 보스/PvP는 상성 유지" 구도를 자연히 만든다.
// ---------------------------------------------------------------------------
const ELEMENT_ADVANTAGE = { fire: "wind", wind: "water", water: "fire" };
export const ELEMENT_ADVANTAGE_MULT = 1.25;
export const ELEMENT_DISADVANTAGE_MULT = 0.85;
export function elementalMultiplier(attackerElement, defenderElement) {
  if (!attackerElement || !defenderElement || attackerElement === defenderElement) return 1;
  if (ELEMENT_ADVANTAGE[attackerElement] === defenderElement) return ELEMENT_ADVANTAGE_MULT;
  return ELEMENT_DISADVANTAGE_MULT;
}

// ---------------------------------------------------------------------------
// 버프/디버프 리스트 — {sourceId, value, until} 목록. sourceId는 호출부가
// `${characterId}:${skillSlot}` 형태로 넘긴다(기존 게임의 sourceId 버그 교훈).
// ---------------------------------------------------------------------------
function upsertBuff(list, sourceId, value, until) {
  const idx = list.findIndex((b) => b.sourceId === sourceId);
  if (idx >= 0) list[idx] = { sourceId, value, until };
  else list.push({ sourceId, value, until });
}
function activeBuffValues(list, t) {
  return list.filter((b) => t < b.until).map((b) => b.value);
}
function stackMultiplicative(list, t, sign = 1) {
  let mult = 1;
  for (const v of activeBuffValues(list, t)) mult *= sign > 0 ? 1 + v : 1 - v;
  return mult;
}
function stackAdditive(list, t) {
  return activeBuffValues(list, t).reduce((s, v) => s + v, 0);
}
function additiveMult(list, t) {
  return 1 + stackAdditive(list, t);
}

// ---------------------------------------------------------------------------
// Fighter / Side 팩토리
// ---------------------------------------------------------------------------
export function makeFighter(hero) {
  const stats = { ...DEFAULT_STATS, ...hero };
  // "마나" 스탯은 공유 자원량이 아니라 모든 스킬 게이지의 충전 속도 배율이다.
  // 100을 기준치로 두고 제곱근으로 완만하게 — 마나 스탯을 아무리 올려도 무한정
  // 빨라지지 않게.
  const manaFactor = Math.sqrt(Math.max(1, stats.mana || 100) / 100);
  return {
    characterId: hero.characterId,
    name: hero.name,
    role: hero.role || hero.class, // typeBonusDmg가 비교하는 역할
    element: hero.element || null, // 원소 상성(fire>wind>water) — 없으면 상성 계산에서 항상 1배
    // [일일던전 직업 상성 보스] 이 대상이 특정 직업(role)의 공격에 약하면 그 직업 공격자의
    // 피해에 weakRoleBonusMult를 곱한다(대상 쪽 특성 — 공격자 쪽 typeBonusDmg 패시브와 별개).
    weakRole: hero.weakRole || null,
    weakRoleBonusMult: hero.weakRoleBonusMult || 1,
    atk: stats.atk,
    hp: stats.hp,
    hpMax: stats.hp,
    def: stats.def,
    spd: stats.spd,
    critRate: stats.critRate,
    critDmg: stats.critDmg,
    pen: stats.pen,
    res: stats.res,
    manaFactor,
    skills: (hero.skills || []).map((s, i) => ({ ...s, slot: i, progress: 0 })),
    alive: true,
    nextAt: 0,
    interval: 1 / Math.max(0.05, stats.spd),
    // 상태 트래커
    shieldCharges: 0,
    tempImmortalUntil: 0,
    ccImmuneUntil: 0,
    manaLockedUntil: 0,
    forceTargetId: null,
    forceTargetUntil: 0,
    // [오디세이 "키클롭스" 테마용] 이 대상에게는 평타(비스킬 공격)가 전혀 통하지 않는다 —
    // 기존 게임의 zeroNormal 기믹을 그대로 이식(server/data/odyssey.js의 ODYSSEY_THEMES 참고).
    immuneNormal: !!hero.immuneNormal,
    // [어빌리티 "연격의 리듬" 전용] 평타(비스킬) 피해에만 곱해지는 배율 — 스킬 피해에는
    // 영향 없음(스킬 쪽은 applyAbilityBonuses가 burstMult에 직접 곱해서 반영한다).
    // server/data/abilities.js 참고.
    normalDmgMult: hero.normalDmgMult || 1,
  };
}

export function makeSide(heroes) {
  return {
    fighters: heroes.map(makeFighter),
    atkBuffs: [],
    defBuffs: [],
    spdBuffs: [],
    critBuffs: [],
    critDmgBuffs: [],
    normalAtkBuffs: [],
    manaRegenBuffs: [],
    defDebuffs: [],
    reviveCharged: false,
    reviveUsed: false,
    // [오디세이 "키르케" 테마용] 이 사이드에서 heal 스킬이 발동할 때마다, 원래 효과(아군
    // 회복)는 그대로 적용하면서 "실제로 회복된 양만큼" 상대에게 고정 피해도 추가로 들어간다
    // — 기존 게임의 healAsDamage 기믹(서포터의 치유가 피해로 전환)을 그대로 이식.
    healAsDamage: false,
  };
}

// ---------------------------------------------------------------------------
// 피해 계산
// ---------------------------------------------------------------------------
function rollCrit(fighter, side, t) {
  const effCritRate = Math.min(0.95, fighter.critRate + stackAdditive(side.critBuffs, t));
  return Math.random() < effCritRate;
}
function critDmgOf(fighter, side, t) {
  return fighter.critDmg + stackAdditive(side.critDmgBuffs, t);
}

// typeBonusDmg 패시브 — 공격자가 가진 패시브 스킬 중 kind==="typeBonusDmg"이고
// target.role === params.targetRole이면 보너스 배율을 곱한다(상시 적용, 게이지 불필요).
function typeBonusMultFor(attacker, target) {
  const passive = (attacker.skills || []).find((s) => s.kind === "typeBonusDmg");
  if (!passive) return 1;
  return target.role === passive.targetRole ? passive.bonusMult : 1;
}

// 대상이 weakRole을 가졌고 공격자의 role이 그 직업이면 보너스 배율(덱빌딩 — "그 던전에 맞는
// 직업을 데려가는" 재미, claude/game2-stage-system.md 1번 리서치 메모를 구현).
export function weakRoleMultFor(attacker, target) {
  if (!target.weakRole || !attacker.role) return 1;
  return attacker.role === target.weakRole ? target.weakRoleBonusMult || 1 : 1;
}

function dealDamage({ attacker, mySide, target, oppSide, baseDmg, isSkill, t }) {
  // [오디세이 "키클롭스" 테마] 평타는 이 대상에게 전혀 통하지 않는다 — mitigation 계산 전에
  // 바로 0으로 끊는다(스킬 피해는 영향 없음).
  if (!isSkill && target.immuneNormal) return applyDamageToFighter(target, oppSide, 0, t);
  let dmg = baseDmg;
  dmg *= additiveMult(mySide.atkBuffs, t);
  if (!isSkill) dmg *= additiveMult(mySide.normalAtkBuffs, t) * attacker.normalDmgMult;
  dmg *= typeBonusMultFor(attacker, target);
  dmg *= weakRoleMultFor(attacker, target);
  dmg *= elementalMultiplier(attacker.element, target.element);
  const defDebuffMult = stackMultiplicative(oppSide.defDebuffs, t, -1); // 방깍이 방어력을 깎음
  const effDef = target.def * defDebuffMult;
  dmg *= mitigation(effDef, attacker.pen);
  return applyDamageToFighter(target, oppSide, dmg, t);
}

// [오디세이 "키르케" 테마 전용] heal 스킬이 실제로 회복시킨 양을 그대로(1:1) 상대에게
// 고정 피해로 전환한다 — 기존 게임의 "치유량만큼 보스에게 피해" 기믹 그대로.

// 피해를 실제로 때려박는 지점 — 횟수제 보호막(shieldHits)과 시한부 불사(tempImmortal)를
// 여기서 함께 처리한다. 반환값: 실제로 들어간 피해량(보호막 무효화면 0).
export function applyDamageToFighter(target, targetSide, dmg, t) {
  if (target.shieldCharges > 0) {
    target.shieldCharges -= 1;
    return 0; // 횟수제 보호막 — 이번 타격 자체를 완전히 무효화
  }
  target.hp -= dmg;
  if (target.hp <= 0) {
    if (t < target.tempImmortalUntil) {
      target.hp = 1; // 시한부 불사 — 죽지 않고 1로 유지(소모형 revive와 달리 매 타격마다 적용)
    } else if (targetSide.reviveCharged) {
      targetSide.reviveCharged = false;
      targetSide.reviveUsed = true;
      target.hp = target.hpMax;
    } else {
      target.hp = 0;
      target.alive = false;
    }
  }
  return dmg;
}

// ---------------------------------------------------------------------------
// 스킬별 독립 게이지 — 매 공격 기회마다 모든(패시브 제외) 스킬의 progress가 함께 오른다.
// ---------------------------------------------------------------------------
function regenSkillProgress(fighter, side, t) {
  if (t < fighter.manaLockedUntil) return; // 마나 락 — 이 캐릭터의 모든 게이지가 멈춤
  const inc = manaRegenPerHit(fighter.spd) * fighter.manaFactor * additiveMult(side.manaRegenBuffs, t);
  for (const s of fighter.skills) {
    if (s.passive) continue;
    s.progress += inc;
  }
}

// 이번 공격 기회에 발동할 준비가 된 스킬들 — 비용이 큰 것부터(로그 순서를 의미있게).
// 여러 개가 동시에 찼으면 전부 반환한다(번갈아 발동 토글이 필요 없는 지점).
function collectReadySkills(fighter) {
  return fighter.skills.filter((s) => !s.passive && s.progress >= (s.manaCost || 0)).sort((a, b) => (b.manaCost || 0) - (a.manaCost || 0));
}

function buffSourceId(fighter, skill) {
  return `${fighter.characterId}:${skill.slot}`;
}

// heal의 대상 선택 — 체력 "비율"이 가장 낮은 생존 아군(죽은 아군은 revive가 처리할 몫이라
// 제외한다).
function pickHealTarget(side) {
  const alive = side.fighters.filter((f) => f.alive);
  if (!alive.length) return null;
  return alive.reduce((lowest, f) => (f.hp / f.hpMax < lowest.hp / lowest.hpMax ? f : lowest));
}

function passesRes(target, baseChance) {
  return Math.random() < applyResistance(baseChance, target.res);
}

// ---------------------------------------------------------------------------
// 스킬 kind별 효과 적용(피해형 제외 — burst/burstHp/executeChance는 resolveAttack에서
// 직접 처리) — server/data/skills.js의 카탈로그와 1:1 대응.
// ---------------------------------------------------------------------------
const SKILL_HANDLERS = {
  // 반환값(실제 회복량)은 resolveAttack에서 로그/오디세이 키르케 기믹에 쓴다.
  heal: (ctx) => {
    const healTarget = pickHealTarget(ctx.mySide);
    if (!healTarget) return 0;
    const before = healTarget.hp;
    healTarget.hp = Math.min(healTarget.hpMax, healTarget.hp + ctx.attacker.atk * ctx.skill.healMult);
    return healTarget.hp - before;
  },
  buffAtk: (ctx) => upsertBuff(ctx.mySide.atkBuffs, ctx.sourceId, ctx.skill.buffBonus, ctx.t + ctx.skill.buffDuration),
  buffDef: (ctx) => upsertBuff(ctx.mySide.defBuffs, ctx.sourceId, ctx.skill.buffReduction, ctx.t + ctx.skill.buffDuration),
  buffSpd: (ctx) => upsertBuff(ctx.mySide.spdBuffs, ctx.sourceId, ctx.skill.buffBonus, ctx.t + ctx.skill.buffDuration),
  buffCrit: (ctx) => upsertBuff(ctx.mySide.critBuffs, ctx.sourceId, ctx.skill.buffBonus, ctx.t + ctx.skill.buffDuration),
  buffCritDmg: (ctx) => upsertBuff(ctx.mySide.critDmgBuffs, ctx.sourceId, ctx.skill.buffBonus, ctx.t + ctx.skill.buffDuration),
  buffNormalAtk: (ctx) => upsertBuff(ctx.mySide.normalAtkBuffs, ctx.sourceId, ctx.skill.buffBonus, ctx.t + ctx.skill.buffDuration),
  debuffDef: (ctx) => upsertBuff(ctx.oppSide.defDebuffs, ctx.sourceId, ctx.skill.reduction, ctx.t + ctx.skill.buffDuration),
  debuffSpd: (ctx) => {
    if (!ctx.target || ctx.t < ctx.target.ccImmuneUntil || !passesRes(ctx.target, ctx.skill.chance ?? 1)) return;
    ctx.target.interval /= 1 - ctx.skill.spdReduction;
  },
  stunAll: (ctx) => {
    for (const f of ctx.oppSide.fighters) {
      if (!f.alive || ctx.t < f.ccImmuneUntil) continue;
      if (!passesRes(f, ctx.skill.chance ?? 1)) continue;
      f.nextAt += ctx.skill.stunDuration;
    }
  },
  dispel: (ctx) => {
    for (const k of ["atkBuffs", "defBuffs", "spdBuffs", "critBuffs", "critDmgBuffs", "normalAtkBuffs", "manaRegenBuffs"]) {
      ctx.oppSide[k].length = 0;
    }
  },
  revive: (ctx) => {
    if (!ctx.mySide.reviveUsed) ctx.mySide.reviveCharged = true;
  },
  shieldHits: (ctx) => {
    ctx.attacker.shieldCharges = Math.max(ctx.attacker.shieldCharges, ctx.skill.shieldCharges);
  },
  tempImmortal: (ctx) => {
    ctx.attacker.tempImmortalUntil = Math.max(ctx.attacker.tempImmortalUntil, ctx.t + ctx.skill.duration);
  },
  cooldownReduce: (ctx) =>
    upsertBuff(ctx.mySide.manaRegenBuffs, ctx.sourceId, ctx.skill.manaRegenBonus, ctx.t + ctx.skill.buffDuration),
  ccImmunity: (ctx) => {
    for (const f of ctx.mySide.fighters) f.ccImmuneUntil = Math.max(f.ccImmuneUntil, ctx.t + ctx.skill.duration);
  },
  // 마나 효과는 "상대의 모든 스킬 게이지"에 함께 작용한다(개별 게이지제와 짝이 맞도록).
  manaBurn: (ctx) => {
    if (!ctx.target || !passesRes(ctx.target, 1)) return;
    for (const s of ctx.target.skills) if (!s.passive) s.progress = Math.max(0, s.progress - ctx.skill.burnAmount);
  },
  manaLock: (ctx) => {
    if (!ctx.target || ctx.t < ctx.target.ccImmuneUntil || !passesRes(ctx.target, 1)) return;
    ctx.target.manaLockedUntil = Math.max(ctx.target.manaLockedUntil, ctx.t + ctx.skill.lockDuration);
  },
  manaDrain: (ctx) => {
    if (!ctx.target || !passesRes(ctx.target, 1)) return;
    let totalDrained = 0;
    for (const s of ctx.target.skills) {
      if (s.passive) continue;
      const take = Math.min(s.progress, ctx.skill.drainAmount);
      s.progress -= take;
      totalDrained += take;
    }
    // 빼앗은 만큼 공격자의 "가장 비싼"(=가장 강한) 스킬 게이지로 몰아준다.
    const biggest = ctx.attacker.skills.filter((s) => !s.passive).sort((a, b) => (b.manaCost || 0) - (a.manaCost || 0))[0];
    if (biggest) biggest.progress += totalDrained;
  },
  tauntOnHit: (ctx) => {
    if (!ctx.target || ctx.t < ctx.target.ccImmuneUntil) return;
    ctx.target.forceTargetId = ctx.attacker.characterId;
    ctx.target.forceTargetUntil = ctx.t + ctx.skill.tauntDuration;
  },
};

// ---------------------------------------------------------------------------
// 대상 선택 — forceTargetId(도발)가 걸려 있으면 그 상대를 우선한다.
// ---------------------------------------------------------------------------
function pickTarget(attacker, oppSide, t) {
  const alive = oppSide.fighters.filter((f) => f.alive);
  if (!alive.length) return null;
  const taunters = alive.filter((f) => f.forceTargetId === attacker.characterId && t < f.forceTargetUntil);
  const pool = taunters.length ? taunters : alive;
  return pool[Math.floor(Math.random() * pool.length)];
}

function castDamageSkill(attacker, mySide, target, oppSide, skill, t, hits) {
  const isCrit = rollCrit(attacker, mySide, t);
  const cd = critDmgOf(attacker, mySide, t);
  const base = skill.kind === "burstHp" ? attacker.hpMax * skill.hpDmgMult : attacker.atk * skill.burstMult;
  const dealt = dealDamage({ attacker, mySide, target, oppSide, baseDmg: base * (isCrit ? cd : 1), isSkill: true, t });
  hits.push({ t, actor: attacker.characterId, targetId: target.characterId, isSkill: true, skillKind: skill.kind, dmg: Math.round(dealt) });
}

function castExecute(attacker, mySide, target, oppSide, skill, t, hits) {
  if (!passesRes(target, skill.executeChance)) return false;
  const guardian = oppSide.fighters.find((f) => f.alive && (f.skills || []).some((s) => s.kind === "executeReflectChance"));
  const reflectSkill = guardian && guardian.skills.find((s) => s.kind === "executeReflectChance");
  if (guardian && reflectSkill && Math.random() < reflectSkill.executeReflectChance) {
    applyDamageToFighter(attacker, mySide, attacker.hp, t); // 공격자가 즉사
    hits.push({ t, actor: guardian.characterId, kind: "executeReflect", targetId: attacker.characterId });
  } else {
    applyDamageToFighter(target, oppSide, target.hp, t);
    hits.push({ t, actor: attacker.characterId, kind: "execute", targetId: target.characterId });
  }
  return true;
}

// ---------------------------------------------------------------------------
// 한 캐릭터의 한 공격 기회 처리 — 게이지를 먼저 채우고, 이번에 다 찬 스킬이 있으면
// (여러 개여도) 전부 발동, 없으면 평타 한 번.
// ---------------------------------------------------------------------------
function resolveAttack(attacker, mySide, oppSide, t, hits) {
  regenSkillProgress(attacker, mySide, t);
  const ready = collectReadySkills(attacker);

  if (!ready.length) {
    const target = pickTarget(attacker, oppSide, t);
    if (!target) return;
    const isCrit = rollCrit(attacker, mySide, t);
    const cd = critDmgOf(attacker, mySide, t);
    const dealt = dealDamage({ attacker, mySide, target, oppSide, baseDmg: attacker.atk * (isCrit ? cd : 1), isSkill: false, t });
    hits.push({ t, actor: attacker.characterId, targetId: target.characterId, isSkill: false, dmg: Math.round(dealt) });
    return;
  }

  for (const skill of ready) {
    skill.progress -= skill.manaCost; // 필요한 만큼만 소모, 초과분은 다음 발동으로 이어서 누적
    const target = pickTarget(attacker, oppSide, t);
    if (!target && skill.kind !== "ccImmunity" && skill.kind !== "cooldownReduce") continue;
    const sourceId = buffSourceId(attacker, skill);
    const ctx = { attacker, mySide, oppSide, target, skill, sourceId, t };

    if (skill.kind === "executeChance") {
      castExecute(attacker, mySide, target, oppSide, skill, t, hits);
    } else if (skill.kind === "burst" || skill.kind === "burstHp") {
      castDamageSkill(attacker, mySide, target, oppSide, skill, t, hits);
    } else {
      const handler = SKILL_HANDLERS[skill.kind];
      const handlerResult = handler ? handler(ctx) : undefined;
      let convertedDmg = 0;
      // [오디세이 "키르케" 테마] 이 사이드가 healAsDamage 상태면, 방금 heal로 실제 회복된
      // 양만큼(1:1) 지금 target(없으면 oppSide 아무나)에게 고정 피해를 추가로 꽂는다.
      if (skill.kind === "heal" && mySide.healAsDamage && handlerResult > 0) {
        const dmgTarget = target || pickTarget(attacker, oppSide, t);
        if (dmgTarget) {
          convertedDmg = dealDamage({ attacker, mySide, target: dmgTarget, oppSide, baseDmg: handlerResult, isSkill: true, t });
        }
      }
      const healed = skill.kind === "heal" ? Math.round(handlerResult || 0) : undefined;
      hits.push({ t, actor: attacker.characterId, isSkill: true, skillKind: skill.kind, dmg: Math.round(convertedDmg), ...(healed !== undefined ? { heal: healed } : {}) });
    }
    if (!oppSide.fighters.some((f) => f.alive)) break; // 상대가 전멸했으면 나머지 스킬은 의미 없음
  }
}

// ---------------------------------------------------------------------------
// 전투 루프 — 양 팀이 소진될 때까지(또는 시간 제한까지) 가장 빠른 nextAt 순서로 진행.
// simulateBattle(1:1 팀전, PvP 등)과 simulateGauntlet(필드→보스 연속전, 스테이지)이
// 공통으로 쓰는 핵심 루프라 runBattleLoop로 뽑아놨다 — side 객체(및 그 안의 fighter의
// nextAt/hp)를 그 자리에서 계속 변형하고, 시작 시각 t를 받아 끝난 시각을 반환한다.
// ---------------------------------------------------------------------------
function runBattleLoop(sideA, sideB, startT, timeLimitSeconds, hits) {
  let t = startT;
  while (t <= timeLimitSeconds) {
    const aliveA = sideA.fighters.filter((f) => f.alive);
    const aliveB = sideB.fighters.filter((f) => f.alive);
    if (!aliveA.length || !aliveB.length) break;

    let next = null;
    let nextSide = null;
    for (const f of aliveA) if (!next || f.nextAt < next.nextAt) (next = f), (nextSide = "A");
    for (const f of aliveB) if (!next || f.nextAt < next.nextAt) (next = f), (nextSide = "B");

    t = next.nextAt;
    if (t > timeLimitSeconds) break;
    if (nextSide === "A") resolveAttack(next, sideA, sideB, t, hits);
    else resolveAttack(next, sideB, sideA, t, hits);
    next.nextAt += next.interval;
  }
  return t;
}

export function simulateBattle(teamA, teamB, { timeLimitSeconds = 60 } = {}) {
  const sideA = makeSide(teamA);
  const sideB = makeSide(teamB);
  const hits = [];
  const t = runBattleLoop(sideA, sideB, 0, timeLimitSeconds, hits);

  const aAlive = sideA.fighters.some((f) => f.alive);
  const bAlive = sideB.fighters.some((f) => f.alive);
  return { winner: aAlive && !bAlive ? "A" : bAlive && !aAlive ? "B" : "draw", hits, t, sideA, sideB };
}

// ---------------------------------------------------------------------------
// 연속전(gauntlet) — 플레이어 팀 하나가 "phases"(필드 웨이브 → 보스처럼 순서가 있는 적
// 그룹들)를 하나씩 차례로 상대한다. 이전 판의 체력/버프/게이지가 다음 판으로 그대로
// 이어진다(=풀피 리셋 없음) — 스테이지의 "필드몹을 치느라 입은 피해가 보스전에도 영향"
// 느낌을 그대로 살리기 위함. 어느 한 phase에서 플레이어 팀이 전멸하면 그 즉시 중단.
// ---------------------------------------------------------------------------
export function simulateGauntlet(playerTeam, enemyPhases, { timeLimitSeconds = 120 } = {}) {
  const sideA = makeSide(playerTeam);
  const hits = [];
  const phaseResults = [];
  let t = 0;

  for (const phaseHeroes of enemyPhases) {
    const sideB = makeSide(phaseHeroes);
    t = runBattleLoop(sideA, sideB, t, timeLimitSeconds, hits);
    const aAlive = sideA.fighters.some((f) => f.alive);
    const bAlive = sideB.fighters.some((f) => f.alive);
    phaseResults.push({ cleared: aAlive && !bAlive, t, survivorsA: sideA.fighters.filter((f) => f.alive).length });
    if (!aAlive || t > timeLimitSeconds) break; // 플레이어 전멸 또는 시간 초과 — 다음 phase 진행 안 함
  }

  const allCleared = phaseResults.length === enemyPhases.length && phaseResults.every((p) => p.cleared);
  return { cleared: allCleared, phaseResults, hits, t, sideA };
}

// ---------------------------------------------------------------------------
// 오디세이 전용 1:1 전투 — simulateBattle과 거의 같지만, 적(enemy) 객체에 실어둔
// zeroNormal/healAsDamage 플래그를 각각 target.immuneNormal / sideA.healAsDamage로
// 연결해준다(server/data/odyssey.js의 ODYSSEY_THEMES 기믹). 그 외 승패 판정/시간 제한
// 로직은 simulateBattle과 동일하다.
export function simulateOdysseyFight(team, enemy, { timeLimitSeconds = 30 } = {}) {
  const sideA = makeSide(team);
  sideA.healAsDamage = !!enemy.healAsDamage;
  const sideB = makeSide([{ ...enemy, immuneNormal: !!enemy.zeroNormal }]);
  const hits = [];
  const t = runBattleLoop(sideA, sideB, 0, timeLimitSeconds, hits);
  const aAlive = sideA.fighters.some((f) => f.alive);
  const bAlive = sideB.fighters.some((f) => f.alive);
  const timedOut = t >= timeLimitSeconds && bAlive;
  return { winner: aAlive && !bAlive ? "A" : bAlive && !aAlive ? "B" : "draw", win: aAlive && !bAlive, timedOut, hits, t, sideA, sideB };
}

export { upsertBuff, stackMultiplicative, stackAdditive, additiveMult };
