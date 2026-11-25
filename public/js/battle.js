// 전투 장면 — 서버가 돌려준 실제 전투 기록(hits)을 시간순으로 재생한다.
// 파밍 화면의 방치 장면(idleFarm)은 연출용(실제 보상은 서버 정산값).
import { art, fmt, esc } from "./ui.js";
import { rosterRarity, S } from "./api.js";

const A = "/assets/";
export const SPRITE = {
  mongrel: A + "mob_mongrel.png", shroom: A + "mob_shroom.png", golem_shard: A + "mob_golem.png", bat_swarm: A + "mob_bat.png", forest_spirit: A + "mob_spirit.png",
  wolf_king: A + "boss_wolfking.png", spider_queen: A + "boss_spider_queen.png", ice_giant: A + "boss_icegiant.png",
  shadow_assassin: A + "boss_shadow_assassin.png", iron_guardian: A + "boss_iron_guardian.png", storm_wyvern: A + "boss_storm_wyvern.png",
  cyclops: A + "boss_cyclops.png", giant: A + "boss_giant.png", circe: A + "boss_circe.png", siren: A + "boss_siren.png", helios: A + "boss_helios.png",
  dungeon_gold: A + "mob_golem.png", dungeon_gem: A + "mob_spirit.png", dungeon_exp: A + "mob_shroom.png", daily: A + "boss_wolfking.png",
};
export const tierBg = (stage) => `${A}bgt${String(Math.min(10, Math.max(1, Math.ceil((stage || 1) / 10)))).padStart(2, "0")}.png`;
export const BG = { gold: A + "bgt01.png", gem: A + "bgt03.png", exp: A + "bgt02.png", daily: A + "bgt08.png", ranking: A + "bgt04.png", pvp: A + "bgt07.png", odyssey: A + "bg_dungeon.png", town: A + "bg_town.png" };

// 아군 배치 좌표(%) — 진형 순서: 앞열이 가운데(적 쪽), 뒷열이 왼쪽 끝
const ROWX = { front: 36, mid: 24, back: 11 };
function heroSlots(n, formation) {
  const f = formation || { front: 2, mid: 2, back: 1 };
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(i < f.front ? "front" : i < f.front + f.mid ? "mid" : "back");
  const count = { front: 0, mid: 0, back: 0 }, idx = { front: 0, mid: 0, back: 0 };
  rows.forEach((r) => count[r]++);
  return rows.map((r) => {
    const k = idx[r]++, c = count[r];
    const y = c === 1 ? 76 : 62 + (k * 30) / Math.max(1, c - 1);
    return { x: ROWX[r] + (k % 2) * 3, y, row: r };
  });
}
function foeSlots(n) {
  if (n === 1) return [{ x: 74, y: 84 }];
  return Array.from({ length: n }, (_, i) => ({ x: 64 + (i % 2) * 12 + (i > 1 ? 8 : 0), y: 60 + (i * 32) / Math.max(1, n - 1) }));
}

export function floatText(scene, x, y, text, cls = "") {
  const d = document.createElement("div");
  d.className = `dmg ${cls}`;
  d.style.left = x + "%"; d.style.top = y + "%";
  d.textContent = text;
  scene.appendChild(d);
  setTimeout(() => d.remove(), 1000);
}

// heroes: [{id, hp, maxHp?}], foes: [{id, hp, sprite, size, name}]
// 펫 도트 — /assets/pets/{look}.png (petId → look은 S.meta.pets에서)
const petLook = (petId) => S.meta?.pets?.pets.find((p) => p.id === petId)?.look;
export const petSprite = (petId) => `/assets/pets/${petLook(petId)}.png`;

export function mountBattle(scene, { heroes: all, foes, formation, heroSize = 64, foeSize = 150, mirrorFoes = false, pets: extraPets = [] }) {
  scene.querySelectorAll(".unit").forEach((n) => n.remove());
  const units = new Map();
  const heroes = (all || []).filter((h) => !h.isPet);
  // 펫(보조 전투원) — 팀 맨 뒤, 맞지 않으니 체력바 없음
  const pets = [...(all || []).filter((h) => h.isPet), ...extraPets];
  pets.forEach((p, i) => {
    const u = document.createElement("div");
    u.className = "unit bob pet";
    const x = 4 + i * 2, y = 70 + i * 16;
    u.style.left = x + "%"; u.style.top = y + "%";
    u.style.animationDelay = `${i * 0.3}s`;
    const sz = Math.round(heroSize * 0.8);
    u.innerHTML = `<img src="${petSprite(p.petId)}" alt="" style="width:${sz}px;height:${sz}px;">`;
    scene.appendChild(u);
    units.set(p.id || `pet-${p.petId}`, { el: u, side: "A", hp: 1, max: 1, x: x + 4, y, dealt: 0, isPet: true });
  });
  const hs = heroSlots(heroes.length, formation);
  heroes.forEach((h, i) => {
    const u = document.createElement("div");
    u.className = "unit bob";
    u.style.left = hs[i].x + "%"; u.style.top = hs[i].y + "%";
    u.style.animationDelay = `${i * 0.2}s`;
    u.innerHTML = `<img src="${art(h.id, rosterRarity(h.id))}" alt="" style="width:${heroSize}px;height:${heroSize}px;"><div class="ub"><div class="bar"><i class="hp" style="width:100%"></i></div></div>`;
    scene.appendChild(u);
    units.set(h.id, { el: u, side: "A", hp: h.hp, max: h.maxHp || h.hp, x: hs[i].x, y: hs[i].y, dealt: 0 });
  });
  const fs = foeSlots(foes.length);
  foes.forEach((f, i) => {
    const u = document.createElement("div");
    u.className = "unit foe";
    u.style.left = fs[i].x + "%"; u.style.top = fs[i].y + "%";
    const img = f.sprite
      ? `<img src="${f.sprite}" alt="" style="width:${f.size || foeSize}px;${mirrorFoes ? "" : ""}">`
      : `<img src="${art(f.id, rosterRarity(f.id))}" alt="" style="width:${heroSize}px;height:${heroSize}px;transform:scaleX(-1);">`;
    u.innerHTML = `${img}<div class="ub"><div class="bar"><i class="ehp" style="width:100%"></i></div></div>`;
    scene.appendChild(u);
    units.set(f.id, { el: u, side: "B", hp: f.hp, max: f.maxHp || f.hp, x: fs[i].x, y: fs[i].y, dealt: 0 });
  });
  return units;
}

function setHp(u) {
  if (u.isPet) return;
  const p = Math.max(0, (u.hp / u.max) * 100);
  u.el.querySelector(".ub i").style.width = p + "%";
  if (u.hp <= 0) u.el.classList.add("dead");
}

// 전투 재생. 반환: { stop(), skip(), done: Promise }
export function playHits(scene, units, hits, { speed = 1, endedAt, onTick, crit = true } = {}) {
  const list = (hits || []).slice().sort((a, b) => a.t - b.t);
  const total = endedAt || (list.length ? list[list.length - 1].t : 0);
  let i = 0, t = 0, last = performance.now(), stopped = false, raf, resolveDone;
  const done = new Promise((r) => (resolveDone = r));
  const state = { speed };

  function apply(h, visual) {
    const actor = units.get(h.actor);
    let target = h.targetId ? units.get(h.targetId) : null;
    if (!target && h.dmg && actor) {
      const opp = [...units.values()].filter((u) => u.side !== actor.side && u.hp > 0 && !u.isPet);
      if (opp.length) {
        const each = h.dmg / opp.length;
        opp.forEach((o) => { o.hp -= each; setHp(o); if (visual) floatText(scene, o.x, o.y - 30, fmt(each), "skill"); });
        actor.dealt += h.dmg;
        if (visual) { actor.el.classList.remove("atk"); void actor.el.offsetWidth; actor.el.classList.add("atk"); }
      }
    }
    if (target && h.dmg) {
      target.hp -= h.dmg;
      if (actor) actor.dealt += h.dmg;
      setHp(target);
      if (visual) {
        const cls = target.side === "A" ? "foe" : h.isSkill ? "skill" : (crit && h.dmg > (actor?.lastDmg || 0) * 1.6 ? "crit" : "");
        floatText(scene, target.x + (Math.random() * 6 - 3), target.y - 28, (h.isSkill ? "" : "-") + fmt(h.dmg) + (h.isSkill ? "!" : ""), cls);
        target.el.classList.remove("hit"); void target.el.offsetWidth; target.el.classList.add("hit");
        if (actor) { actor.el.classList.remove("atk"); void actor.el.offsetWidth; actor.el.classList.add("atk"); actor.lastDmg = h.dmg; }
      }
    }
    if (h.kind === "execute" && target) { target.hp = 0; setHp(target); if (visual) floatText(scene, target.x, target.y - 30, "처형!", "crit"); }
    if (h.heal && actor && visual) floatText(scene, actor.x, actor.y - 30, "+" + fmt(h.heal), "heal");
  }
  function frame(now) {
    if (stopped) return;
    t += ((now - last) / 1000) * state.speed;
    last = now;
    let n = 0;
    while (i < list.length && list[i].t <= t) { apply(list[i], n < 6); i++; n++; }
    onTick && onTick(Math.min(t, total), total);
    if (i >= list.length && t >= total) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }
  function finish() { stopped = true; cancelAnimationFrame(raf); onTick && onTick(total, total); resolveDone(units); }
  raf = requestAnimationFrame((n) => { last = n; frame(n); });
  return {
    done,
    setSpeed: (s) => { state.speed = s; },
    skip: () => { if (stopped) return; while (i < list.length) apply(list[i++], false); finish(); },
    stop: () => { stopped = true; cancelAnimationFrame(raf); },
  };
}

// 파밍 방치 장면 — 몹이 오른쪽에서 걸어오고, 팀이 때려서 쓰러뜨리는 연출(연출용 숫자).
export function idleFarm(scene, { heroes, formation, species, dps, onKill, pets = [] }) {
  const units = mountBattle(scene, { heroes: heroes.map((h) => ({ id: h.id, hp: 1 })), foes: [], formation, heroSize: 60, pets: pets.map((id) => ({ petId: id })) });
  const mobs = [];
  let alive = true, tick = 0;
  const pickSpecies = () => {
    let r = Math.random(), acc = 0;
    for (const s of species) { acc += s.weight; if (r <= acc) return s; }
    return species[0];
  };
  function spawn() {
    if (!alive || mobs.length >= 4) return;
    const sp = pickSpecies();
    const m = document.createElement("div");
    m.className = "mob";
    const y = 64 + Math.random() * 28;
    m.style.left = "104%"; m.style.top = y + "%";
    const w = sp.key === "bat_swarm" ? 70 : sp.key === "forest_spirit" ? 56 : 84;
    m.innerHTML = `<img src="${SPRITE[sp.key]}" alt="" style="width:${w}px">`;
    scene.appendChild(m);
    const mob = { el: m, x: 104, y, hp: 1 + Math.random() * 2, sp };
    mobs.push(mob);
    requestAnimationFrame(() => { mob.x = 56 + Math.random() * 30; m.style.left = mob.x + "%"; });
  }
  const heroList = [...units.values()];
  const iv = setInterval(() => {
    if (!alive) return;
    tick++;
    if (tick % 3 === 0) spawn();
    const target = mobs.find((m) => m.x < 95);
    if (!target) return;
    const h = heroList[Math.floor(Math.random() * heroList.length)];
    if (h) { h.el.classList.remove("atk"); void h.el.offsetWidth; h.el.classList.add("atk"); }
    const isSkill = Math.random() < 0.15;
    const dmg = Math.max(1, Math.round((dps || 100) * (0.6 + Math.random() * 0.8) * (isSkill ? 3 : 1)));
    floatText(scene, target.x, target.y - 18, isSkill ? `-${fmt(dmg)}!` : `-${fmt(dmg)}`, isSkill ? "skill" : Math.random() < 0.2 ? "crit" : "");
    target.hp -= isSkill ? 1.5 : 0.6;
    if (target.hp <= 0) {
      target.el.classList.add("die");
      mobs.splice(mobs.indexOf(target), 1);
      setTimeout(() => target.el.remove(), 400);
      onKill && onKill(target);
    }
  }, 420);
  for (let k = 0; k < 2; k++) setTimeout(spawn, k * 500);
  return { stop: () => { alive = false; clearInterval(iv); }, units };
}

// 전투 결과용 — 영웅별 넣은 피해 랭킹
export function damageTable(units, nameOf) {
  return [...units.entries()].filter(([, u]) => u.side === "A").sort((a, b) => b[1].dealt - a[1].dealt)
    .map(([id, u]) => ({ id, name: u.isPet ? `${S.meta?.pets?.pets.find((p) => `pet-${p.id}` === id)?.name || "펫"} (펫)` : nameOf(id), dealt: Math.round(u.dealt) }));
}
export const escName = esc;
