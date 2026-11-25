// ============================================================================
// 게임 2.0 — 반려동물(펫) 시스템 (2026-11-25 민수님 요청)
// ============================================================================
//  · 펫 = 공격도 하고 · 버프도 주고 · 스킬도 쓰는 보조 캐릭터. 최대 2마리 장착.
//  · 전투에서는 "적이 노릴 수 없는 보조 전투원"으로 참가한다(맞지 않고 죽지 않음,
//    승패 판정에도 안 들어감 — server/lib/combat.js의 isPet).
//  · 장착만 해도 상시 패시브 버프(종류별로 다름) + 전투 중 자기 스킬 사용.
//  · 골드 가챠(1회 50,000골드) — 골드 소모처. 확정 없음(순수 확률).
//  · 중복은 조각 → 별(★1~5) 강화, 레벨업은 골드(골드 소모처).
//  · 도감 버프: 보유 종류 수 + 계열(고양이/강아지/...) 완성 + 특별한 친구들 6종 완성.
// 수치는 전부 [1차 추정치 — 실측 후 조정].
import { RARITY_UNIT } from "./characters.js";

export const PET_GRADES = ["N", "R", "SR", "SSR", "UR"];
export const PET_GRADE_LABEL = { N: "일반", R: "희귀", SR: "영웅", SSR: "전설", UR: "신화" };
export const PET_GRADE_COLOR = { N: "#9AA3B8", R: "#4F8FF7", SR: "#A66CF2", SSR: "#F5B83D", UR: "#FF5A8A" };
export const PET_RATES = { N: 52, R: 30, SR: 13, SSR: 4.5, UR: 0.5 }; // %
export const PET_PULL_COST = 50000; // 골드
export const PET_BUNDLES = { 1: { count: 1, cost: 50000 }, 10: { count: 10, cost: 500000 }, 100: { count: 100, cost: 5000000 } };
export const PET_SLOTS = 2;
export const PET_LEVEL_CAP = { N: 30, R: 40, SR: 50, SSR: 55, UR: 60 };
export const PET_STAR_MAX = 5;
export const PET_STAR_COST = [1, 2, 3, 4, 5]; // ★1~★5 에 필요한 중복 조각
const GRADE_UNIT = { N: "N", R: "R", SR: "SR", SSR: "SSR", UR: "XR" }; // 전투 스탯 기준 단위(영웅 등급)
const GRADE_MULT = { N: 1, R: 1.5, SR: 2.5, SSR: 4, UR: 6 };

// 계열 — 패시브 버프 종류 · 전투 역할 · 스킬 · 도감 완성 보너스가 계열마다 다르다.
// passive 단위: 퍼센트. stat 키는 applyAbilityBonuses 모양으로 변환된다(petBonusMult).
export const PET_FAMILIES = {
  cat: { label: "고양이", role: "공격형", passive: "critDmg", skill: { kind: "burst", name: "냥냥 펀치", base: 2.2, step: 0.45, manaCost: 55 }, complete: { critDmg: 8 } },
  dog: { label: "강아지", role: "버프형", passive: "atk", skill: { kind: "buffAtk", name: "응원 멍멍", base: 0.06, step: 0.03, duration: 6, manaCost: 70 }, complete: { atk: 5 } },
  bird: { label: "새", role: "속도형", passive: "spd", skill: { kind: "buffSpd", name: "순풍의 날갯짓", base: 0.05, step: 0.025, duration: 6, manaCost: 70 }, complete: { spd: 4 } },
  reptile: { label: "파충류", role: "관통형", passive: "defBreak", skill: { kind: "debuffDef", name: "꼬리 후려치기", base: 0.08, step: 0.03, duration: 6, manaCost: 65 }, complete: { defBreak: 4 } },
  rabbit: { label: "토끼", role: "회복형", passive: "vit", skill: { kind: "heal", name: "당근 나눠주기", base: 1.2, step: 0.35, manaCost: 60 }, complete: { vit: 6 } },
  rodent: { label: "설치류", role: "마나형", passive: "manaRegen", skill: { kind: "cooldownReduce", name: "볼주머니 간식", base: 0.15, step: 0.07, duration: 6, manaCost: 75 }, complete: { manaRegen: 10 } },
  turtle: { label: "거북이", role: "수비형", passive: "def", skill: { kind: "buffDef", name: "등껍질 방패", base: 0.08, step: 0.03, duration: 6, manaCost: 70 }, complete: { def: 8 } },
};
export const PET_PASSIVE_LABEL = { critDmg: "치명타 피해", atk: "공격력", spd: "공격속도", defBreak: "적 방어력 감소", vit: "체력·방어력", manaRegen: "마나 회복", def: "방어력", hp: "체력", crit: "치명타 확률" };
const PASSIVE_BASE = { N: 2, R: 3.5, SR: 5, SSR: 7, UR: 10 }; // %
const PASSIVE_KEY_MULT = { critDmg: 1.4, atk: 1, spd: 0.7, defBreak: 0.7, vit: 1, manaRegen: 2, def: 1.2 };

// 펫 60종 — id, 이름, 계열, 등급, 도트 팔레트 키(design/art/pets.py), 특별(이름 있는 친구들)
export const PETS = [
  // 고양이 12
  { id: "p01", name: "박구월", family: "cat", grade: "UR", look: "cat_gray", special: true, desc: "회색 고양이. 느긋해 보여도 결정적인 순간엔 누구보다 빠르다." },
  { id: "p02", name: "김마리", family: "cat", grade: "UR", look: "cat_brown", special: true, desc: "갈색 고양이. 우아하게 다가와 한 방에 끝낸다." },
  { id: "p03", name: "리젠트 모히칸", family: "cat", grade: "UR", look: "cat_mohawk", special: true, desc: "노란 고양이. 머리 위 갈기는 절대 흐트러지지 않는다." },
  { id: "p04", name: "샴 고양이", family: "cat", grade: "SSR", look: "cat_siamese" },
  { id: "p05", name: "러시안 블루", family: "cat", grade: "SR", look: "cat_blue" },
  { id: "p06", name: "턱시도", family: "cat", grade: "SR", look: "cat_tuxedo" },
  { id: "p07", name: "삼색이", family: "cat", grade: "SR", look: "cat_calico" },
  { id: "p08", name: "치즈냥", family: "cat", grade: "R", look: "cat_orange" },
  { id: "p09", name: "고등어", family: "cat", grade: "R", look: "cat_tabby" },
  { id: "p10", name: "까망이", family: "cat", grade: "R", look: "cat_black" },
  { id: "p11", name: "하양이", family: "cat", grade: "N", look: "cat_white" },
  { id: "p12", name: "길냥이", family: "cat", grade: "N", look: "cat_stray" },
  // 강아지 12
  { id: "p13", name: "로이", family: "dog", grade: "UR", look: "dog_poodle", special: true, desc: "푸들. 꼬리를 흔드는 것만으로 모두의 사기가 오른다." },
  { id: "p14", name: "허스키", family: "dog", grade: "SSR", look: "dog_husky" },
  { id: "p15", name: "시바견", family: "dog", grade: "SSR", look: "dog_shiba" },
  { id: "p16", name: "골든 리트리버", family: "dog", grade: "SR", look: "dog_golden" },
  { id: "p17", name: "진돗개", family: "dog", grade: "SR", look: "dog_jindo" },
  { id: "p18", name: "웰시코기", family: "dog", grade: "SR", look: "dog_corgi" },
  { id: "p19", name: "비글", family: "dog", grade: "R", look: "dog_beagle" },
  { id: "p20", name: "말티즈", family: "dog", grade: "R", look: "dog_maltese" },
  { id: "p21", name: "포메라니안", family: "dog", grade: "R", look: "dog_pom" },
  { id: "p22", name: "닥스훈트", family: "dog", grade: "N", look: "dog_dachs" },
  { id: "p23", name: "치와와", family: "dog", grade: "N", look: "dog_chihuahua" },
  { id: "p24", name: "동네 똥강아지", family: "dog", grade: "N", look: "dog_mutt" },
  // 새 12
  { id: "p25", name: "독수리", family: "bird", grade: "SSR", look: "bird_eagle" },
  { id: "p26", name: "공작", family: "bird", grade: "SSR", look: "bird_peacock" },
  { id: "p27", name: "부엉이", family: "bird", grade: "SR", look: "bird_owl" },
  { id: "p28", name: "앵무새", family: "bird", grade: "SR", look: "bird_parrot" },
  { id: "p29", name: "펭귄", family: "bird", grade: "R", look: "bird_penguin" },
  { id: "p30", name: "문조", family: "bird", grade: "R", look: "bird_finch" },
  { id: "p31", name: "카나리아", family: "bird", grade: "R", look: "bird_canary" },
  { id: "p32", name: "까치", family: "bird", grade: "N", look: "bird_magpie" },
  { id: "p33", name: "참새", family: "bird", grade: "N", look: "bird_sparrow" },
  { id: "p34", name: "비둘기", family: "bird", grade: "N", look: "bird_pigeon" },
  { id: "p35", name: "오리", family: "bird", grade: "N", look: "bird_duck" },
  { id: "p36", name: "병아리", family: "bird", grade: "N", look: "bird_chick" },
  // 파충류 8
  { id: "p37", name: "코모도 왕도마뱀", family: "reptile", grade: "UR", look: "lizard_komodo", special: true, desc: "거대한 왕도마뱀. 한 번 문 상대의 방어를 무너뜨린다." },
  { id: "p38", name: "공룡", family: "reptile", grade: "UR", look: "dino", special: true, desc: "어디서 왔는지 아무도 모르는 진짜 공룡." },
  { id: "p39", name: "카멜레온", family: "reptile", grade: "SSR", look: "lizard_chameleon" },
  { id: "p40", name: "레오파드 게코", family: "reptile", grade: "SR", look: "lizard_gecko" },
  { id: "p41", name: "턱수염도마뱀", family: "reptile", grade: "SR", look: "lizard_bearded" },
  { id: "p42", name: "이구아나", family: "reptile", grade: "R", look: "lizard_iguana" },
  { id: "p43", name: "우파루파", family: "reptile", grade: "R", look: "lizard_axolotl" },
  { id: "p44", name: "꼬마 도마뱀", family: "reptile", grade: "N", look: "lizard_small" },
  // 토끼 5
  { id: "p45", name: "달토끼", family: "rabbit", grade: "SSR", look: "rabbit_moon" },
  { id: "p46", name: "롭이어 토끼", family: "rabbit", grade: "SR", look: "rabbit_lop" },
  { id: "p47", name: "라이언헤드", family: "rabbit", grade: "R", look: "rabbit_lion" },
  { id: "p48", name: "하얀 토끼", family: "rabbit", grade: "R", look: "rabbit_white" },
  { id: "p49", name: "갈색 토끼", family: "rabbit", grade: "N", look: "rabbit_brown" },
  // 설치류 6
  { id: "p50", name: "하늘다람쥐", family: "rodent", grade: "SSR", look: "rodent_flying" },
  { id: "p51", name: "친칠라", family: "rodent", grade: "SR", look: "rodent_chinchilla" },
  { id: "p52", name: "기니피그", family: "rodent", grade: "R", look: "rodent_guinea" },
  { id: "p53", name: "골든 햄스터", family: "rodent", grade: "R", look: "rodent_golden" },
  { id: "p54", name: "햄스터", family: "rodent", grade: "N", look: "rodent_hamster" },
  { id: "p55", name: "다람쥐", family: "rodent", grade: "N", look: "rodent_squirrel" },
  // 거북이 5
  { id: "p56", name: "바다거북", family: "turtle", grade: "SSR", look: "turtle_sea" },
  { id: "p57", name: "육지거북", family: "turtle", grade: "SR", look: "turtle_land" },
  { id: "p58", name: "붉은귀거북", family: "turtle", grade: "R", look: "turtle_red" },
  { id: "p59", name: "남생이", family: "turtle", grade: "N", look: "turtle_small" },
  { id: "p60", name: "자라", family: "turtle", grade: "N", look: "turtle_softshell" },
];
export const PET_BY_ID = new Map(PETS.map((p) => [p.id, p]));
export const PETS_BY_GRADE = Object.fromEntries(PET_GRADES.map((g) => [g, PETS.filter((p) => p.grade === g)]));
export const SPECIAL_COMPLETE_BONUS = { atk: 5, vit: 5 }; // 특별한 친구들 6종 모두 보유
export const DEX_PER_PET = 0.2; // 보유 종류 1개당 공·체·방 +0.2%

// ---------------------------------------------------------------------------
// 가챠 — 등급 확률 → 그 등급 안에서 균등. 확정/천장 없음.
// ---------------------------------------------------------------------------
export function rollPetGrade(rng = Math.random) {
  let r = rng() * 100;
  for (const g of [...PET_GRADES].reverse()) { r -= PET_RATES[g]; if (r < 0) return g; }
  return "N";
}
export function pullPets(size = 1, rng = Math.random) {
  const b = PET_BUNDLES[size];
  if (!b) throw new Error(`펫 소환은 ${Object.keys(PET_BUNDLES).join("/")}회만 가능`);
  return Array.from({ length: b.count }, () => {
    const g = rollPetGrade(rng);
    const pool = PETS_BY_GRADE[g];
    return pool[Math.floor(rng() * pool.length)];
  });
}
// 보유 현황에 소환 결과 반영 계획 — 새 펫은 insert, 중복은 조각 +n
export function planPetPulls(pulled, ownedById) {
  const counts = new Map();
  for (const p of pulled) counts.set(p.id, (counts.get(p.id) || 0) + 1);
  const inserts = [], shardAdds = new Map(), newIds = new Set();
  for (const [id, n] of counts) {
    if (ownedById.has(id)) shardAdds.set(id, n);
    else { newIds.add(id); inserts.push({ pet_id: id, level: 1, star: 0, shards: n - 1 }); }
  }
  return { inserts, shardAdds, newIds };
}

// ---------------------------------------------------------------------------
// 성장 — 레벨(골드) · 별(중복 조각)
// ---------------------------------------------------------------------------
export function petLevelUpCost(grade, level) {
  return Math.round(3000 * GRADE_MULT[grade] * Math.pow(1.15, level - 1));
}
export function petStarUpCost(star) {
  return star >= PET_STAR_MAX ? null : PET_STAR_COST[star];
}
const levelMult = (level) => 1 + (level - 1) * 0.03; // 영웅보다 완만하게 — 펫은 보조(같은 급 영웅의 약 30~40%)
const starMult = (star) => 1 + 0.1 * (star || 0);

// 펫 1마리의 상시 패시브(%) — 등급 · 별 · 레벨에 비례
export function petPassive(def, level = 1, star = 0) {
  const key = PET_FAMILIES[def.family].passive;
  const v = PASSIVE_BASE[def.grade] * (PASSIVE_KEY_MULT[key] || 1) * (1 + (level - 1) / 100) * starMult(star);
  return { key, value: Math.round(v * 10) / 10 };
}
// 펫 1마리의 전투 스킬(엔진 kind 그대로) — 등급이 높을수록 강해진다
export function petSkill(def, star = 0) {
  const f = PET_FAMILIES[def.family];
  const gi = PET_GRADES.indexOf(def.grade);
  const v = (f.skill.base + f.skill.step * gi) * starMult(star);
  const s = { key: `pet_${f.skill.kind}`, skillName: def.special ? `${f.skill.name}·${def.name}` : f.skill.name, kind: f.skill.kind, manaCost: f.skill.manaCost, passive: false };
  if (f.skill.kind === "burst") s.burstMult = v;
  else if (f.skill.kind === "heal") s.healMult = v;
  else if (f.skill.kind === "buffDef") { s.buffReduction = Math.min(0.5, v); s.buffDuration = f.skill.duration; }
  else if (f.skill.kind === "debuffDef") { s.reduction = Math.min(0.6, v); s.buffDuration = f.skill.duration; }
  else if (f.skill.kind === "cooldownReduce") { s.manaRegenBonus = v; s.buffDuration = f.skill.duration; }
  else { s.buffBonus = v; s.buffDuration = f.skill.duration; }
  return s;
}
// 펫 1마리의 전투원 모양(combat.js makeFighter가 먹는 형태). isPet → 적이 노릴 수 없음.
export function petFighter(def, level = 1, star = 0) {
  const unit = RARITY_UNIT[GRADE_UNIT[def.grade]];
  const atk = Math.round(unit * 0.4 * levelMult(level) * starMult(star));
  return {
    characterId: `pet-${def.id}`, petId: def.id, name: def.name, role: "pet", class: "pet", isPet: true, element: null,
    atk, hp: 1, def: 0, mana: 100, spd: def.family === "bird" ? 1.15 : def.family === "turtle" ? 0.75 : 0.95,
    critRate: def.family === "cat" ? 0.2 : 0.1, critDmg: 1.6, pen: def.family === "reptile" ? 0.2 : 0.05, res: 0,
    skills: [petSkill(def, star)],
  };
}

// ---------------------------------------------------------------------------
// 도감 — 보유 종류 수 + 계열 완성 + 특별한 친구들 완성
// ---------------------------------------------------------------------------
export function petCollection(ownedIds) {
  const owned = new Set(ownedIds);
  const deltas = { atk: 0, vit: 0, def: 0, spd: 0, critDmg: 0, defBreak: 0, manaRegen: 0 };
  const per = owned.size * DEX_PER_PET;
  deltas.atk += per; deltas.vit += per;
  const families = {};
  for (const [fk, f] of Object.entries(PET_FAMILIES)) {
    const members = PETS.filter((p) => p.family === fk);
    const have = members.filter((p) => owned.has(p.id)).length;
    const done = have === members.length;
    families[fk] = { have, total: members.length, complete: done };
    if (done) for (const [k, v] of Object.entries(f.complete)) deltas[k] = (deltas[k] || 0) + v;
  }
  const specials = PETS.filter((p) => p.special);
  const specialHave = specials.filter((p) => owned.has(p.id)).length;
  const specialDone = specialHave === specials.length;
  if (specialDone) for (const [k, v] of Object.entries(SPECIAL_COMPLETE_BONUS)) deltas[k] += v;
  for (const k of Object.keys(deltas)) deltas[k] = Math.round(deltas[k] * 100) / 100;
  return { unique: owned.size, total: PETS.length, deltas, families, special: { have: specialHave, total: specials.length, complete: specialDone } };
}

// 패시브/도감 % 합 → applyAbilityBonuses가 먹는 배율 객체
export function petBonusMult(sums) {
  const s = { atk: 0, vit: 0, def: 0, spd: 0, critDmg: 0, defBreak: 0, manaRegen: 0, ...sums };
  return {
    atkMult: 1 + s.atk / 100, hpMult: 1 + s.vit / 100, defMult: (1 + s.vit / 100) * (1 + s.def / 100),
    spdMult: 1 + (s.spd + s.manaRegen) / 100, critAdd: 0, critDmgMult: 1 + s.critDmg / 100, penAdd: s.defBreak / 100,
    normalDmgMult: 1, skillDmgMult: 1,
  };
}

// 장착 펫 + 보유 목록 → 전투 패키지 { fighters, bonus(배율), sums(%), equipped, collection }
export function petCombatPackage(ownedRows, slotIds) {
  const byId = new Map((ownedRows || []).map((r) => [r.pet_id, r]));
  const sums = {};
  const fighters = [];
  const equipped = [];
  for (const id of (slotIds || []).slice(0, PET_SLOTS)) {
    const row = byId.get(id), def = PET_BY_ID.get(id);
    if (!row || !def) continue;
    const p = petPassive(def, row.level, row.star);
    sums[p.key] = (sums[p.key] || 0) + p.value;
    fighters.push(petFighter(def, row.level, row.star));
    equipped.push({ id, passive: p });
  }
  const collection = petCollection([...byId.keys()]);
  for (const [k, v] of Object.entries(collection.deltas)) sums[k] = (sums[k] || 0) + v;
  return { fighters, sums, bonus: petBonusMult(sums), equipped, collection };
}

// 화면용 1마리 정보
export function petView(row) {
  const def = PET_BY_ID.get(row.pet_id);
  if (!def) return null;
  const cap = PET_LEVEL_CAP[def.grade];
  const f = petFighter(def, row.level, row.star);
  const starCost = petStarUpCost(row.star);
  return {
    ...def, familyLabel: PET_FAMILIES[def.family].label, role: PET_FAMILIES[def.family].role,
    level: row.level, levelCap: cap, star: row.star || 0, shards: row.shards || 0,
    atk: f.atk, spd: f.spd, critRate: f.critRate, passive: petPassive(def, row.level, row.star), skill: f.skills[0],
    levelUpCost: row.level >= cap ? null : petLevelUpCost(def.grade, row.level),
    starUpCost: starCost, starMax: PET_STAR_MAX,
  };
}

export const PET_META = {
  grades: PET_GRADES, gradeLabel: PET_GRADE_LABEL, gradeColor: PET_GRADE_COLOR, rates: PET_RATES, bundles: PET_BUNDLES,
  slots: PET_SLOTS, levelCap: PET_LEVEL_CAP, starMax: PET_STAR_MAX, starCost: PET_STAR_COST,
  families: PET_FAMILIES, passiveLabel: PET_PASSIVE_LABEL, pets: PETS, dexPerPet: DEX_PER_PET, specialBonus: SPECIAL_COMPLETE_BONUS,
};
