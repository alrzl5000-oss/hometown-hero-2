// 영웅(보유/도감) · 영웅 상세(성장) · 성장 보너스(컬렉션/시너지) · 장비 가방
import { S, get, post, pp, refreshMe, refreshHeroes } from "../api.js";
import { ic, COIN, GEM, STONE, fmt, comma, esc, el, cls, badge, portrait, bar, kv, openModal, toast, busy, confirmBox, RANK, RARC } from "../ui.js";
import { setTitle, go } from "../main.js";
import { synergyOf, deltaText, teamStrip } from "../team.js";

const SORTS = { rarity: "등급순", level: "레벨순", dps: "DPS순" };
let view = { tab: "heroes", cls: "all", sort: "rarity", dex: false };

export async function render(page, { key }) {
  view.tab = key === "equipment" ? "equip" : "heroes";
  if (view.tab === "equip") return renderEquip(page);
  const bonuses = await get(pp("/bonuses")).catch(() => null);
  const draw = () => {
    setTitle("영웅", `보유 ${S.heroes.length}명 · 도감 ${S.me.ownedCount}/${S.me.rosterCount}`);
    let list;
    if (view.dex) {
      list = S.meta.roster.map((c) => S.heroById.get(c.id) || { characterId: c.id, name: c.name, class: c.class, element: c.element, originRarity: c.rarity, rarity: c.rarity, level: 0, dps: 0, missing: true });
    } else list = [...S.heroes];
    if (view.cls !== "all") list = list.filter((h) => h.class === view.cls);
    list.sort(view.sort === "level" ? (a, b) => b.level - a.level : view.sort === "dps" ? (a, b) => b.dps - a.dps : (a, b) => RANK[b.rarity] - RANK[a.rarity] || b.level - a.level);
    const cnt = (c) => S.heroes.filter((h) => h.class === c).length;
    const col = bonuses?.collection;
    const synActive = (bonuses?.synergy?.active || []).filter((s) => s.delta);
    page.innerHTML = `<div class="col" style="gap:14px;">
      <button class="card" data-growth style="padding:14px 18px;display:flex;align-items:center;gap:14px;border:none;color:inherit;cursor:pointer;text-align:left;background:linear-gradient(120deg,rgba(34,197,94,.18),transparent 60%),linear-gradient(160deg,#122a23,#0b1915);">
        <div class="well" style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;color:var(--mint);">${ic("chart", 20)}</div>
        <div class="grow"><div class="h3">성장 보너스 몰아보기</div><div class="t2 small">도감 ${S.me.ownedCount}/${S.me.rosterCount} · 공·체·방 <span class="mint">+${col ? Math.round(col.deltas.atk * 10) / 10 : 0}%</span> · 시너지 ${synActive.length ? `<span class="mint">${synActive.map((s) => esc(s.name)).join(", ")}</span>` : "없음"}</div></div>${ic("chev", 18)}</button>
      <div class="sec" style="flex-wrap:wrap;">
        <div class="seg"><button class="on">${ic("users", 13)} 영웅</button><button data-tab="equip">${ic("bag", 13)} 장비</button></div>
        <div class="row2" style="flex-wrap:wrap;gap:6px;">
          <button class="chip ${view.cls === "all" ? "on" : ""}" data-cls="all">전체 ${S.heroes.length}</button>
          ${Object.entries(S.meta.classes).map(([k, v]) => `<button class="chip ${view.cls === k ? "on" : ""}" data-cls="${k}">${esc(v.label)} ${cnt(k)}</button>`).join("")}
          <button class="chip ${view.dex ? "on" : ""}" data-dex>${ic("eye", 12)} 미보유 포함</button>
          <select class="inp" data-sort style="height:30px;width:auto;padding:0 10px;">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${k === view.sort ? "selected" : ""}>${v}</option>`).join("")}</select></div></div>
      ${list.length ? `<div class="heroes-grid">${list.map((h) => `<div class="card hcard ${h.missing ? "off" : ""}" data-hero="${h.characterId}" style="--cut:12px;">
          ${portrait(h.characterId, h.originRarity, h.rarity, 64)}${badge(h.rarity, h.exStar)}<div class="nm ell">${esc(h.name)}</div>
          <div class="t3 xs">${cls(h.class, 10)} ${el(h.element, 10, true)}</div>
          <div class="xs">${h.missing ? `<span class="t3">미보유</span>` : `<span class="t3">Lv.${h.level}</span> <b class="gold">${fmt(h.dps)}</b>`}</div></div>`).join("")}</div>`
        : `<div class="card pad" style="text-align:center;"><div class="h3">아직 영웅이 없어요</div><div class="t2 small" style="margin:6px 0 12px;">소환에서 첫 영웅을 만나 보세요.</div><a class="btn pri" href="#/gacha">${ic("spark", 15)} 소환하러 가기</a></div>`}
    </div>`;
  };
  draw();
  page.onclick = (e) => {
    const t = e.target.closest("[data-cls],[data-dex],[data-hero],[data-growth],[data-tab]");
    if (!t) return;
    if (t.dataset.cls) view.cls = t.dataset.cls;
    else if (t.dataset.dex !== undefined) view.dex = !view.dex;
    else if (t.dataset.tab) return go("equipment");
    else if (t.dataset.growth !== undefined) return openGrowth(S.me.farm.team);
    else if (t.dataset.hero) { if (S.heroById.has(t.dataset.hero)) openHeroDetail(t.dataset.hero, draw); else toast("아직 보유하지 않은 영웅이에요 — 소환에서 만날 수 있어요.", "err"); return; }
    draw();
  };
  page.onchange = (e) => { if (e.target.dataset.sort !== undefined) { view.sort = e.target.value; draw(); } };
  return () => { page.onclick = null; page.onchange = null; };
}

// ---------------------------------------------------------------- 영웅 상세
const STAT_ROWS = [["atk", "공격력", fmt], ["hp", "체력", fmt], ["def", "방어력", fmt], ["mana", "마나", comma], ["spd", "공격속도", (v) => `초당 ${Math.round(v * 100) / 100}회`],
  ["critRate", "치명타 확률", (v) => `${Math.round(v * 1000) / 10}%`], ["critDmg", "치명타 피해", (v) => `×${Math.round(v * 100) / 100}`], ["pen", "관통", (v) => `${Math.round(v * 1000) / 10}%`], ["res", "저항", (v) => `${Math.round(v * 1000) / 10}%`]];

export function openHeroDetail(id, onChange) {
  const m = openModal("", { size: "wide" });
  const draw = () => {
    const h = S.heroById.get(id);
    if (!h) return m.close();
    const g = h.growth, c = S.me.currency;
    const disc = (c.discardedShards || {})[h.originRarity] || 0;
    const sets = (S.meta.synergySets || []).filter((s) => s.memberIds.includes(id));
    const kinds = S.meta.skillKinds || {};
    m.set(`<div class="row2" style="gap:14px;align-items:flex-start;">${portrait(id, h.originRarity, h.rarity, 84)}
        <div class="grow"><div class="row2" style="flex-wrap:wrap;gap:6px;">${badge(h.rarity, h.exStar)}<span class="chip" style="height:22px;font-size:11px;">태초 ${h.originRarity}</span></div>
          <div class="h1" style="margin-top:4px;">${esc(h.name)}</div><div class="t2 small">${cls(h.class, 12)} · ${el(h.element, 12, true)} · Lv.${h.level}/${h.levelCap}</div>
          <div class="gold small" style="font-weight:700;margin-top:2px;">예상 DPS ${comma(h.dps)}</div></div></div>
      <div class="split">
        <div class="col" style="gap:10px;"><div class="h3">능력치</div>
          <div class="g2" style="gap:6px;">${STAT_ROWS.map(([k, l, f]) => `<div class="well" style="padding:8px 10px;"><div class="t3 xs">${l}</div><div style="font-weight:700;">${f(h.stats[k])}</div></div>`).join("")}</div>
          <div class="h3">스킬</div>
          ${h.skills.map((s) => `<div class="well" style="padding:10px;display:flex;gap:10px;align-items:center;"><div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:var(--p-soft);color:var(--mint);flex:0 0 auto;">${ic(s.passive ? "shield" : "spark", 16)}</div>
            <div class="grow"><div style="font-weight:700;font-size:12.5px;">${esc(s.name || kinds[s.kind]?.label || s.kind)}</div><div class="t3 xs">${/[A-Za-z]{4,}/.test(kinds[s.kind]?.desc || "") ? (s.passive ? "패시브" : "마나가 차면 발동") : esc(kinds[s.kind]?.desc || "")}</div></div>${s.manaCost ? `<span class="chip" style="height:22px;font-size:10.5px;">마나 ${s.manaCost}</span>` : ""}</div>`).join("")}
        </div>
        <div class="col" style="gap:10px;"><div class="h3">성장</div>
          <div class="well pad col" style="gap:8px;"><div class="sec"><b>레벨업</b><span class="t3 xs">Lv.${h.level} / ${h.levelCap}</span></div>${bar((h.level / h.levelCap) * 100, "xp", 5)}
            ${g.levelUp ? `<div class="t2 xs">다음 레벨 ${COIN} ${fmt(g.levelUp.gold)}${g.levelUp.dia ? ` + ${GEM} ${comma(g.levelUp.dia)}` : ""}</div>
              <div class="row2"><button class="btn sm grow" data-act="level-up">1레벨</button><button class="btn sm pri grow" data-act="level-up-max">가능한 만큼</button></div>` : `<div class="t3 xs">${h.rarity === "EX" ? "EX 최대 레벨" : "이 등급의 최대 레벨 — 승급하면 더 올릴 수 있어요"}</div>`}</div>
          ${g.promote ? `<div class="well pad col" style="gap:8px;"><div class="sec"><b>등급 승급</b><span class="t3 xs">${h.rarity} → ${g.promote.next}</span></div>
            <div class="t2 xs">조각 ${h.shards}/${g.promote.shard} · ${COIN} ${fmt(g.promote.gold)}</div>${bar((h.shards / g.promote.shard) * 100, "hp", 5)}
            <button class="btn sm pri" data-act="promote" ${h.shards < g.promote.shard ? "disabled" : ""}>${ic("up", 13)} 승급</button></div>` : ""}
          ${g.exPromote ? `<div class="well pad col" style="gap:8px;"><div class="sec"><b>EX 승급</b><span class="chip warn" style="height:22px;">XR → EX</span></div>
            <div class="t2 xs">조각 ${h.shards}/${g.exPromote.shard} · ${STONE} ${g.exPromote.stone} · ${COIN} ${fmt(g.exPromote.gold)} · ${GEM} ${comma(g.exPromote.dia)}</div>
            <button class="btn sm gold" data-act="ex-promote">${ic("star", 13)} EX 승급</button></div>` : ""}
          ${h.rarity === "EX" ? `<div class="well pad col" style="gap:8px;"><div class="sec"><b>별 강화</b><span class="t3 xs">★${h.exStar} / ${g.starMax} · 스탯 +${g.starBonusPct}%</span></div>
            ${g.starUp ? `<div class="t2 xs">버려진 조각(${h.originRarity}) ${disc}/${g.starUp.shard} · ${STONE} ${g.starUp.stone}</div><button class="btn sm pri" data-act="star-up">${ic("star", 13)} ★${g.starUp.star} 강화 · 별당 공·체·방 +5%</button>` : `<div class="t3 xs">최대 별이에요</div>`}</div>` : ""}
          ${sets.length ? sets.map((s) => `<div class="notice mint">${ic("layers", 12)} 시너지 「${esc(s.name)}」 — ${esc(s.desc)} (${s.tiers.map((t) => `${t.need}명 ${deltaText(t.delta)}`).join(" / ")})</div>`).join("") : ""}
        </div></div>`);
  };
  m.body.onclick = (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    busy(b, async () => {
      const exPre = S.heroById.get(id)?.rarity === "EX" && b.dataset.act.startsWith("level") ? "ex-" : "";
      const r = await post(pp(`/characters/${id}/${exPre}${b.dataset.act}`));
      await Promise.all([refreshHeroes(), refreshMe()]);
      toast(b.dataset.act.startsWith("level") ? `Lv.${r.level} 달성!` : b.dataset.act === "star-up" ? `★${r.star} 강화 완료!` : `${r.newRarity} 승급 완료!`);
      draw(); onChange && onChange();
    });
  };
  draw();
  return m;
}

// ---------------------------------------------------------------- 성장 보너스(컬렉션 / 배치 시너지)
export async function openGrowth(teamIds = []) {
  const m = openModal(`<div class="spin"></div>`, { size: "wide" });
  let tab = "col";
  const b = await get(pp(`/bonuses${teamIds?.length ? `?teamIds=${teamIds.join(",")}` : ""}`));
  const draw = () => {
    const col = b.collection, gc = S.meta.gradeCountConfig;
    const colHtml = `<div class="well pad col" style="gap:8px;"><div class="sec"><b>도감 보유 영웅</b><b>${col.breakdown.uniqueHeroes} / ${S.meta.roster.length}</b></div>${bar((col.breakdown.uniqueHeroes / S.meta.roster.length) * 100, "xp", 7)}
        <div class="t3 xs">1명당 공·체·방 +${S.meta.dexFillBonusPerHero.atk}% · 합계 <span class="mint">공 +${Math.round(col.deltas.atk * 100) / 100}% · 체 +${Math.round(col.deltas.hp * 100) / 100}% · 방 +${Math.round(col.deltas.def * 100) / 100}%</span></div></div>
      <div class="h3">등급 보유수 보너스</div><div class="t3 xs">그 등급 '이상'에 도달한 영웅 수 기준이에요. 여러 영웅을 골고루 승급시킬수록 이득이에요.</div>
      ${Object.entries(gc).map(([r, cfg]) => { const bd = col.breakdown.gradeCounts[r] || { count: 0, milestonesHit: 0 }; return `<div class="well pad col" style="gap:8px;"><div class="sec"><span>${badge(r)} <b>이상 ${bd.count}명</b></span><span class="${bd.milestonesHit >= cfg.milestones.length ? "mint" : "t3"} xs">${bd.milestonesHit >= cfg.milestones.length ? "모든 단계 달성" : `${bd.milestonesHit}/${cfg.milestones.length}단계`}</span></div>
        <div class="row2" style="gap:6px;flex-wrap:wrap;">${cfg.milestones.map((n, i) => `<span class="chip ${i < bd.milestonesHit ? "pos" : ""}" style="height:24px;min-width:34px;justify-content:center;">${n}</span>`).join("")}</div>
        <div class="t3 xs">단계마다 공·체·방 +${cfg.perMilestone.atk}%</div></div>`; }).join("")}`;
    const active = synergyOf(b.teamIds || []);
    const synHtml = `<div class="t3 small">지금 파밍 팀 기준 — 같은 세트 영웅을 함께 배치하면 팀 전체 능력치가 올라요.</div>
      ${active.filter((s) => s.tier).map((s) => `<div class="notice mint">${ic("layers", 12)} 발동 중: ${esc(s.set.name)} ${s.matched.length}명 · ${deltaText(s.tier.delta)}</div>`).join("") || `<div class="notice">지금 팀에서 발동 중인 시너지가 없어요.</div>`}
      ${(S.meta.synergySets || []).map((s) => { const own = s.memberIds.filter((id) => S.heroById.has(id)).length; const inTeam = s.memberIds.filter((id) => (b.teamIds || []).includes(id)).length;
        return `<div class="well pad col" style="gap:8px;"><div class="sec"><b>${esc(s.icon || "")} ${esc(s.name)}</b><span class="${inTeam >= s.tiers[0].need ? "mint" : "t3"} xs">팀 ${inTeam}명 · 보유 ${own}/${s.memberIds.length}</span></div>
        <div class="t3 xs">${esc(s.desc)}</div>
        <div class="row2" style="gap:4px;flex-wrap:wrap;">${s.memberIds.map((id) => { const r = S.rosterById.get(id); const h = S.heroById.get(id); return r ? `<div style="${h ? "" : "opacity:.3;filter:grayscale(1);"}" title="${esc(r.name)}">${portrait(id, r.rarity, h?.rarity || r.rarity, 30)}</div>` : ""; }).join("")}</div>
        <div class="row2" style="gap:6px;flex-wrap:wrap;">${s.tiers.map((t) => `<span class="chip ${inTeam >= t.need ? "pos" : ""}" style="height:22px;font-size:10.5px;">${t.need}명 · ${deltaText(t.delta)}</span>`).join("")}</div></div>`; }).join("")}`;
    m.set(`<div class="h1">성장 보너스</div><div class="seg full"><button data-t="col" class="${tab === "col" ? "on" : ""}">${ic("doc", 13)} 컬렉션</button><button data-t="syn" class="${tab === "syn" ? "on" : ""}">${ic("layers", 13)} 배치 시너지</button></div>
      <div class="col" style="gap:10px;max-height:60vh;overflow-y:auto;">${tab === "col" ? colHtml : synHtml}</div>`);
  };
  m.body.onclick = (e) => { const t = e.target.closest("[data-t]"); if (t) { tab = t.dataset.t; draw(); } };
  draw();
}

// ---------------------------------------------------------------- 장비
const GC = () => S.meta.odysseyGradeColor;
const EQ = () => S.meta.equipment;
// 서버 equipment.js와 같은 공식 — 스테이지(tier)가 높을수록 드랍 확률·등급이 오른다
const tNorm = (t) => Math.min(1, Math.max(0, ((t || 1) - 1) / ((EQ().tierMax || 250) - 1)));
export const stageFactor = (t) => 0.05 + 0.95 * Math.pow(tNorm(t), 1.5);
export const dropAt = (source, tier) => (EQ().dropMax[source] || 0) * stageFactor(tier);
// 오디세이: 층 번호가 아니라 테마 5층 단위 구조(난이도와 같은 값) / PvP: 레이팅 기준
export const odysseyTier = (stage) => { const s = Math.max(1, stage || 1); return ((s - 1) % 5) + 1 + Math.floor((s - 1) / EQ().odysseyCycleLength) * EQ().odysseyCycleStep; };
export const pvpTier = (rating) => { const E = EQ(); return Math.min(E.tierMax, Math.max(1, 1 + ((Number(rating) || 0) - E.pvpRatingFloor) * (E.tierMax - 1) / (E.pvpRatingCeil - E.pvpRatingFloor))); };
export function gradeAt(tier, boost = 1) {
  const t = Math.pow(tNorm(tier), 1.2);
  const epic = (2 + 28 * t) * boost, unique = (0.1 + 11.9 * t) * boost, legendary = 4 * t * boost;
  return { rare: Math.max(0, 100 - epic - unique - legendary), epic, unique, legendary };
}
export const pctTxt = (p) => { const v = p * 100; return v >= 10 ? `${Math.round(v)}%` : v >= 1 ? `${Math.round(v * 10) / 10}%` : v >= 0.1 ? `${Math.round(v * 100) / 100}%` : `${Math.round(v * 1000) / 1000}%`; };
const DUST = `<img class="sp" src="/assets/items/dust.png" alt="" style="width:16px;height:16px;display:inline-block;vertical-align:-3px;">`;
export const itemIcon = (key, s = 32) => `<img class="sp" src="/assets/items/${key}.png" alt="" style="width:${s}px;height:${s}px;">`;
const statTxt = (k, v) => { const p = S.meta.odysseyStatPool[k] || { label: k, unit: "" }; return `${esc(p.label)} +${Math.round(v * 10) / 10}${p.unit}`; };
const deltaTxt = (d) => Object.entries(d).map(([k, v]) => statTxt(k, v)).join(" · ");
const setChip = (set) => { const st = EQ().sets[set]; return st ? `<span class="chip" style="height:20px;font-size:10px;color:${st.color};border-color:${st.color}66;">${esc(st.name)}</span>` : ""; };
const slotLabel = (slot) => EQ().slots.find((s) => s.key === slot)?.label || slot;
export function lineText(l) {
  if (!l) return "";
  if (l.isDud) return `${esc(l.icon || "")} ${esc(l.label || "")} +${l.value}% <span class="t3">(효과 없음)</span>`;
  const p = S.meta.odysseyStatPool[l.statKey] || { label: l.statKey, unit: "" };
  return `${esc(p.icon || "")} ${esc(p.label)} +${l.value}${p.unit}`;
}
const itemName = (key) => EQ().items[key]?.label || S.meta.odysseyItems[key]?.label || key;
const setOfKey = (key) => EQ().items[key]?.set || "odyssey";
const slotOfKey = (key) => EQ().items[key]?.slot || "";
export function itemCard(it, { sel = false } = {}) {
  const g = it.grade;
  const set = it.set || setOfKey(it.key), slot = it.slot || slotOfKey(it.key);
  return `<div class="well" data-item="${it.id || ""}" style="padding:10px;cursor:pointer;display:flex;flex-direction:column;gap:6px;${sel ? "outline:1px solid rgba(163,230,53,.7);" : ""}border-color:${GC()[g]}55;">
    <div class="sec"><span class="badge" style="--c:${GC()[g]};color:#fff;">${esc(S.meta.odysseyGradeLabel[g])}${it.enhance ? ` +${it.enhance}` : ""}</span>${it.equipped ? `<span class="chip pos" style="height:20px;font-size:10px;">장착</span>` : `<span class="t3 xs">${esc(slotLabel(slot))}</span>`}</div>
    <div class="row2" style="gap:8px;"><div style="flex:0 0 auto;background:${GC()[g]}1f;padding:3px;">${itemIcon(it.key, 34)}</div><div style="min-width:0;"><b class="small ell" style="display:block;">${esc(itemName(it.key))}</b>${setChip(set)}</div></div>
    <div class="t3 xs" style="line-height:1.5;">${(it.lines || []).map(lineText).join("<br>")}</div></div>`;
}
// 콘텐츠 결과/파밍 정산에서 받은 장비 알림
export function dropToast(drop) {
  if (!drop) return;
  for (const it of (drop.items || []).slice(0, 3)) toast(`${itemIcon(it.key, 18)} 장비 획득 · <b style="color:${GC()[it.grade]}">${esc(S.meta.odysseyGradeLabel[it.grade])}</b> ${esc(itemName(it.key))}`);
  if ((drop.items || []).length > 3) toast(`장비 ${drop.items.length - 3}개 더 획득`);
  const a = drop.autoSold?.length || drop.autoHandled || 0;
  if (a) toast(`장비 ${a}개 자동 ${drop.autoSold?.[0]?.mode === "dismantle" ? "분해" : "처리"}`);
}
export function dropNotice(drop) {
  if (!drop || (!drop.items?.length && !drop.autoSold?.length)) return "";
  return `<div class="well" style="padding:10px;display:flex;flex-direction:column;gap:6px;"><b class="small">${ic("gift", 13)} 장비 획득</b>
    ${(drop.items || []).map((it) => `<div class="row2" style="gap:8px;">${itemIcon(it.key, 26)}<span class="small"><b style="color:${GC()[it.grade]}">${esc(S.meta.odysseyGradeLabel[it.grade])}</b> ${esc(itemName(it.key))}</span></div>`).join("")}
    ${drop.autoSold?.length ? `<div class="t3 xs">${drop.autoSold.length}개는 ${drop.autoSold[0].reason}로 바로 처리했어요</div>` : ""}</div>`;
}

let eqView = { tab: "bag", set: "all", sort: "grade", craftSet: "field", craftSlot: "weapon" };
async function renderEquip(page) {
  let inv, selId = null, lastCraft = null;
  const load = async () => { inv = await get(pp("/items")); };
  await load();
  const GI = (g) => S.meta.odysseyGrades.indexOf(g);
  const draw = () => {
    const E = EQ();
    setTitle("영웅 · 장비", `가방 ${inv.count}/${inv.cap} · 장비 가루 ${comma(inv.dust)}`);
    const eq = inv.items.filter((i) => i.equipped);
    const sel = inv.items.find((i) => i.id === selId) || null;
    const sumTxt = Object.entries(inv.equippedSums).filter(([, v]) => v).map(([k, v]) => statTxt(k, v)).join(" · ");
    const head = `<div class="sec" style="flex-wrap:wrap;">
        <div class="row2" style="flex-wrap:wrap;"><div class="seg"><button data-tab="heroes">${ic("users", 13)} 영웅</button><button class="on">${ic("bag", 13)} 장비</button></div>
          <div class="seg">${[["bag", "가방"], ["sets", "세트 도감"], ["craft", "제작"]].map(([k, l]) => `<button data-sub="${k}" class="${eqView.tab === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
        <div class="row2" style="flex-wrap:wrap;gap:6px;"><span class="chip">${DUST} 장비 가루 ${comma(inv.dust)}</span><span class="t3 small">가방 ${inv.count}/${inv.cap}</span></div></div>`;

    if (eqView.tab === "sets") {
      const owned = new Set(inv.items.map((i) => i.key));
      const cnt = inv.setCounts || {};
      page.innerHTML = `<div class="col" style="gap:14px;">${head}
        <div class="notice mint">${ic("layers", 13)} 장비는 얻은 곳마다 세트가 달라요. 같은 세트를 2·4·6부위 끼면 세트 효과가 단계별로 더해져요. 장비 효과는 팀 전체 · 모든 콘텐츠에 적용돼요.</div>
        ${(() => {
          const my = inv.maxStage;
          const tbl = (title, note, cols, colLabel, mine, rows) => `<div class="col" style="gap:6px;"><div class="sec"><b class="small">${title}</b><span class="t3 xs">${note}</span></div>
            <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr><th></th>${cols.map((c) => `<th style="padding:6px 8px;text-align:right;${mine(c) ? "color:var(--mint);" : "color:var(--t3);"}">${colLabel(c)}</th>`).join("")}</tr></thead><tbody>
            ${rows.map(([label, f]) => `<tr><td class="t2" style="padding:6px 8px;white-space:nowrap;">${label}</td>${cols.map((c) => `<td style="padding:6px 8px;text-align:right;">${f(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
          const legend = (tier, boost) => pctTxt(gradeAt(tier, boost).legendary / 100);
          const epicUp = (tier, boost) => { const w = gradeAt(tier, boost); return pctTxt((w.epic + w.unique + w.legendary) / 100); };
          const B = EQ().sourceBoost;
          return `<div class="card pad col" style="gap:14px;"><div class="sec"><span class="h3">드랍 확률</span><span class="t3 xs">높을수록 더 자주 · 더 좋게, 낮으면 거의 안 나와요</span></div>
          ${tbl("스테이지 기준", `층보스 · 일일보스 · 파밍 · 제작 · 내 최고 ${my}층`, [1, 30, 60, 100, 150, 250], (s) => `${s}층`, (s) => my >= s, [
            ["층보스 (처음 깨는 층)", (s) => pctTxt(dropAt("floorBoss", s))],
            ["일일보스 · 도전당", (s) => pctTxt(dropAt("dailyBoss", s))],
            ["파밍 8시간 (약)", (s) => `${Math.round(dropAt("field", s) * 40 * 480 * 10) / 10}개`],
            ["에픽 이상 (보스)", (s) => epicUp(s, B.floorBoss)],
            ["레전더리 (보스)", (s) => legend(s, B.floorBoss)],
          ])}
          ${tbl("던전 층 기준", "골드 · 다이아 · 경험치 던전 승리당", [1, 10, 20, 30, 45], (f) => `${f}층`, () => false, [
            ["드랍", (f) => pctTxt(dropAt("gold", f * 5))],
            ["레전더리", (f) => legend(f * 5, B.gold)],
          ])}
          ${tbl("오디세이 층 기준", "테마 5층 단위 — 테마 안에서 1→5층으로 오르고, 25층(한 바퀴)마다 크게 올라요", [5, 25, 50, 100, 150, 250], (f) => `${f}층`, () => false, [
            ["테마 장비", (f) => pctTxt(dropAt("odyssey", odysseyTier(f)))],
            ["오디세우스의 활", (f) => pctTxt(dropAt("odysseyBow", odysseyTier(f)))],
            ["레전더리", (f) => legend(odysseyTier(f), B.odyssey)],
          ])}
          ${tbl("PvP 레이팅 기준", "레이팅전 승리당", [1000, 1200, 1500, 2000, 2500], (r) => `${r}`, () => false, [
            ["드랍", (r) => pctTxt(dropAt("pvp", pvpTier(r)))],
            ["레전더리", (r) => legend(pvpTier(r), B.pvp)],
          ])}</div>`;
        })()}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px;">${E.setKeys.map((sk) => {
          const st = E.sets[sk], n = cnt[sk] || 0;
          const keys = Object.keys(E.items).filter((k) => E.items[k].set === sk);
          return `<div class="card pad col" style="gap:10px;background:linear-gradient(140deg,${st.color}26,transparent 55%),linear-gradient(160deg,#122a23,#0b1915);">
            <div class="sec"><div><div class="h3" style="color:${st.color};">${esc(st.name)} 세트</div><div class="t3 xs">${esc(st.source)} · ${esc(st.sourceDesc)}</div></div><span class="chip ${n >= 2 ? "pos" : ""}" style="height:22px;">장착 ${n}/6</span></div>
            <div class="row2" style="gap:6px;">${keys.map((k) => `<div title="${esc(E.items[k].label)}" style="background:rgba(0,0,0,.25);padding:3px;${owned.has(k) ? "" : "opacity:.3;filter:grayscale(1);"}">${itemIcon(k, 30)}</div>`).join("")}</div>
            <div class="t2 xs">주력 능력치 · ${esc(st.focus)}</div>
            ${[2, 4, 6].map((need) => `<div class="row2 xs" style="gap:8px;${n >= need ? "color:var(--mint);" : "color:var(--t3);"}"><span class="badge" style="--c:${n >= need ? "#a3e635" : "#1e3d34"};color:${n >= need ? "#052e16" : "var(--t2)"};">${need}세트</span>${deltaTxt(st.bonus[need])}</div>`).join("")}
          </div>`;
        }).join("")}</div></div>`;
      return;
    }

    if (eqView.tab === "craft") {
      const sets = E.setKeys.filter((k) => k !== "odyssey");
      const cs = eqView.craftSet, sl = eqView.craftSlot;
      const key = Object.keys(E.items).find((k) => E.items[k].set === cs && E.items[k].slot === sl);
      const cost = E.craftCost;
      const canGold = S.me.currency.gold >= cost.gold, canDust = inv.dust >= cost.dust;
      page.innerHTML = `<div class="col" style="gap:14px;">${head}
        <div class="split">
          <div class="card pad col"><div class="h3">어떤 세트를 만들까요?</div>
            <div class="row2" style="flex-wrap:wrap;gap:6px;">${sets.map((k) => `<button class="chip ${k === cs ? "on" : ""}" data-cset="${k}" style="${k === cs ? "" : `color:${E.sets[k].color};`}">${esc(E.sets[k].name)}</button>`).join("")}</div>
            <div class="t3 xs">${esc(E.sets[cs].source)}에서 나오는 세트 · 주력 ${esc(E.sets[cs].focus)}</div>
            <div class="h3">부위</div>
            <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;">${E.slots.map((s) => { const k = Object.keys(E.items).find((x) => E.items[x].set === cs && E.items[x].slot === s.key); return `<button class="well" data-cslot="${s.key}" style="border:none;color:inherit;cursor:pointer;padding:8px 2px;display:flex;flex-direction:column;align-items:center;gap:4px;${s.key === sl ? "outline:1px solid rgba(163,230,53,.7);background:rgba(163,230,53,.08);" : ""}">${itemIcon(k, 30)}<span class="xs">${s.label}</span></button>`; }).join("")}</div>
          </div>
          <div class="card pad col"><div class="row2" style="gap:12px;"><div style="background:rgba(0,0,0,.25);padding:6px;">${itemIcon(key, 56)}</div><div><div class="h2">${esc(E.items[key].label)}</div>${setChip(cs)} <span class="t3 xs">${esc(slotLabel(sl))} · 강화하면 ${esc(S.meta.odysseyStatPool[E.items[key].signature]?.label || "")} 상승</span></div></div>
            <div class="sec"><span class="h3">나올 등급 확률</span><span class="t3 xs">내 최고 ${inv.maxStage}층 기준 · 높을수록 좋아져요</span></div>
            <div class="g2" style="grid-template-columns:repeat(4,1fr);gap:6px;">${S.meta.odysseyGrades.map((g) => `<div class="well" style="padding:8px 4px;text-align:center;"><div class="xs" style="color:${GC()[g]};font-weight:700;">${esc(S.meta.odysseyGradeLabel[g])}</div><div style="font-weight:700;margin-top:2px;">${Math.round(inv.craftWeights[g] * 10) / 10}%</div></div>`).join("")}</div>
            ${kv("제작 비용", `<span class="${canGold ? "" : "red"}">${COIN} ${fmt(cost.gold)}</span> + <span class="${canDust ? "" : "red"}">${DUST} ${cost.dust}</span>`)}
            <button class="btn pri lg block" data-craft ${canGold && canDust && inv.count < inv.cap ? "" : "disabled"}>${ic("spark", 16)} 제작하기</button>
            <div class="t3 xs">장비 가루는 안 쓰는 장비를 분해하면 얻어요 (레어 ${E.dismantleDust.rare} · 에픽 ${E.dismantleDust.epic} · 유니크 ${E.dismantleDust.unique} · 레전더리 ${E.dismantleDust.legendary}, 강화에 쓴 가루는 절반 돌려받아요)</div>
            ${lastCraft ? `<div class="h3">방금 만든 장비</div>${itemCard(lastCraft)}` : ""}</div>
        </div></div>`;
      return;
    }

    // 가방
    let list = inv.items.filter((i) => eqView.set === "all" || i.set === eqView.set);
    list.sort(eqView.sort === "grade" ? (a, b) => GI(b.grade) - GI(a.grade) || b.enhance - a.enhance : () => 0);
    if (eqView.sort === "new") list.reverse();
    const setCnt = (k) => inv.items.filter((i) => i.set === k).length;
    const selSet = sel ? E.sets[sel.set] : null, selN = sel ? (inv.setCounts[sel.set] || 0) : 0;
    page.innerHTML = `<div class="col" style="gap:14px;">${head}
      <div class="row2" style="flex-wrap:wrap;gap:6px;">
        <select class="inp" id="bulkG" style="height:32px;width:auto;">${inv.grades.map((g) => `<option value="${g}">${esc(S.meta.odysseyGradeLabel[g])} 이하</option>`).join("")}</select>
        <button class="btn sm" data-bulk="sell">${COIN} 일괄판매</button><button class="btn sm" data-bulk="dismantle">${DUST} 일괄분해</button>
        <select class="inp" id="autoG" style="height:32px;width:auto;"><option value="">자동처리 끔</option>${["sell", "dismantle"].flatMap((m) => inv.grades.slice(0, 3).map((g) => `<option value="${m}:${g}" ${inv.autoSellGrade === g && inv.autoMode === m ? "selected" : ""}>자동${m === "sell" ? "판매" : "분해"}: ${esc(S.meta.odysseyGradeLabel[g])} 이하</option>`)).join("")}</select></div>
      <div style="display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr) minmax(0,310px);gap:14px;align-items:start;" class="eqgrid">
        <div class="card pad col"><div class="h3">장착 중</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">${E.slots.map((s) => {
            const it = eq.find((i) => i.slot === s.key);
            return `<button data-item="${it ? it.id : ""}" data-slotf="${s.key}" class="well" style="border:none;color:inherit;cursor:pointer;padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;${it ? `background:${GC()[it.grade]}1f;outline:1px solid ${GC()[it.grade]}88;` : ""}">
              ${it ? itemIcon(it.key, 36) : `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;opacity:.35;">${ic("plus", 18)}</div>`}<span class="xs ${it ? "" : "t3"}">${s.label}${it?.enhance ? ` +${it.enhance}` : ""}</span></button>`; }).join("")}</div>
          <div class="seg full sm">${[0, 1, 2].map((i) => `<button data-ep="${i}" class="${i === inv.activePreset ? "on" : ""}">프리셋 ${i + 1}</button>`).join("")}</div>
          ${inv.activeSets.length ? inv.activeSets.map((b) => `<div class="notice mint" style="padding:6px 10px;">${esc(E.sets[b.set].name)} ${b.need}세트 · ${deltaTxt(b.delta)}</div>`).join("") : `<div class="t3 xs">같은 세트를 2부위 이상 끼면 세트 효과가 생겨요</div>`}
          <div class="t3 xs" style="line-height:1.6;">${sumTxt ? `합계 · ${sumTxt}` : "장착한 장비가 없어요"}</div></div>
        <div class="col" style="gap:10px;min-width:0;">
          <div class="sec" style="flex-wrap:wrap;"><div class="row2" style="flex-wrap:wrap;gap:6px;"><button class="chip ${eqView.set === "all" ? "on" : ""}" data-setf="all">전체 ${inv.count}</button>${E.setKeys.filter((k) => setCnt(k)).map((k) => `<button class="chip ${eqView.set === k ? "on" : ""}" data-setf="${k}">${esc(E.sets[k].name)} ${setCnt(k)}</button>`).join("")}</div>
            <div class="seg sm"><button data-sort="grade" class="${eqView.sort === "grade" ? "on" : ""}">등급순</button><button data-sort="new" class="${eqView.sort === "new" ? "on" : ""}">최신순</button></div></div>
          ${list.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;">${list.map((it) => itemCard(it, { sel: it.id === selId })).join("")}</div>`
            : `<div class="card pad" style="text-align:center;"><div class="h3">가방이 비어 있어요</div><div class="t2 small" style="margin:6px 0 12px;">파밍 · 층보스 · 던전 · 일일보스 · PvP · 오디세이에서 각자 다른 세트 장비가 나와요.</div><button class="btn pri" data-sub="sets">${ic("layers", 15)} 세트 도감 보기</button></div>`}</div>
        <div class="card pad col" id="eqdetail">${sel ? `<div class="row2" style="gap:10px;"><div style="background:${GC()[sel.grade]}26;padding:5px;">${itemIcon(sel.key, 50)}</div><div style="min-width:0;"><div class="h3">${esc(itemName(sel.key))}</div><span class="badge" style="--c:${GC()[sel.grade]};color:#fff;">${esc(sel.gradeLabel)} +${sel.enhance}</span> ${setChip(sel.set)} <span class="t3 xs">${esc(slotLabel(sel.slot))}</span></div></div>
            <div class="t2 small" style="line-height:1.7;">${sel.lines.map(lineText).join("<br>") || `<span class="t3">옵션 없음</span>`}</div>
            ${kv("강화", `+${sel.enhance} / ${S.meta.enhanceMax} · ${esc(S.meta.odysseyStatPool[E.items[sel.key]?.signature]?.label || "")} 상승`)}
            ${sel.nextEnhance ? kv("다음 강화", `${COIN} ${fmt(sel.nextEnhance.cost.gold)} + ${DUST} ${sel.nextEnhance.cost.dust} · 성공 ${Math.round(sel.nextEnhance.successRate * 1000) / 10}%`) : ""}
            ${sel.enhance >= 10 ? `<div class="notice bad">+11부터는 실패하면 50% 확률로 1단계 내려가요(+10 아래로는 안 내려가요).</div>` : ""}
            ${selSet ? `<div class="well pad col" style="gap:4px;"><b class="small" style="color:${selSet.color};">${esc(selSet.name)} 세트 · 장착 ${selN}/6</b>${[2, 4, 6].map((need) => `<div class="xs" style="color:${selN >= need ? "var(--mint)" : "var(--t3)"};">${need}세트 · ${deltaTxt(selSet.bonus[need])}</div>`).join("")}<div class="t3 xs">얻는 곳 · ${esc(selSet.sourceDesc)}</div></div>` : ""}
            ${kv("판매 / 분해", `${COIN} ${fmt(sel.sellValue.gold)}${sel.sellValue.gems ? ` + ${GEM} ${sel.sellValue.gems}` : ""} / ${DUST} ${sel.dismantleValue.dust}`)}
            <div class="row2"><button class="btn sm grow" data-eq="${sel.equipped ? "unequip" : "equip"}">${sel.equipped ? "해제" : "장착"}</button><button class="btn sm pri grow" data-eq="enhance" ${sel.nextEnhance ? "" : "disabled"}>${ic("up", 13)} 강화</button></div>
            <div class="row2"><button class="btn sm danger grow" data-eq="sell" ${sel.inAnyPreset ? "disabled" : ""}>판매</button><button class="btn sm grow" data-eq="dismantle" ${sel.inAnyPreset ? "disabled" : ""}>${DUST} 분해</button></div>
            ${sel.inAnyPreset ? `<div class="t3 xs">장착 중인 장비는 판매 · 분해할 수 없어요(다른 프리셋 포함)</div>` : ""}`
          : `<div class="t3 small">장비를 눌러서 자세히 보고 장착 · 강화 · 판매 · 분해할 수 있어요.</div>`}</div>
      </div></div>`;
  };
  draw();
  const after = async () => { await Promise.all([load(), refreshMe()]); draw(); };
  page.onclick = (e) => {
    const t = e.target.closest("[data-item],[data-tab],[data-sub],[data-ep],[data-eq],[data-bulk],[data-setf],[data-sort],[data-cset],[data-cslot],[data-craft]");
    if (!t) return;
    if (t.dataset.tab) return go("heroes");
    if (t.dataset.sub) { eqView.tab = t.dataset.sub; return draw(); }
    if (t.dataset.setf) { eqView.set = t.dataset.setf; return draw(); }
    if (t.dataset.sort) { eqView.sort = t.dataset.sort; return draw(); }
    if (t.dataset.cset) { eqView.craftSet = t.dataset.cset; return draw(); }
    if (t.dataset.cslot) { eqView.craftSlot = t.dataset.cslot; return draw(); }
    if (t.dataset.craft !== undefined) return busy(t, async () => { const r = await post(pp("/items/craft"), { set: eqView.craftSet, slot: eqView.craftSlot }); lastCraft = r.item; await after(); toast(`${itemIcon(r.item.key, 18)} 제작 완료 · <b style="color:${GC()[r.item.grade]}">${esc(S.meta.odysseyGradeLabel[r.item.grade])}</b>`); });
    if (t.dataset.item !== undefined) {
      if (t.dataset.item) {
        selId = t.dataset.item; draw();
        // 모바일은 상세가 목록 아래에 있어서, 누르면 상세로 스크롤
        if (matchMedia("(max-width:860px)").matches) page.querySelector("#eqdetail")?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (t.dataset.slotf) { eqView.set = "all"; draw(); }
      return;
    }
    if (t.dataset.ep) return busy(t, async () => { inv = await post(pp(`/equip-presets/${t.dataset.ep}/activate`)); draw(); });
    if (t.dataset.bulk) {
      const g = page.querySelector("#bulkG").value, m = t.dataset.bulk, word = m === "sell" ? "판매" : "분해";
      return confirmBox(`일괄${word}`, `${esc(S.meta.odysseyGradeLabel[g])} 이하 장비 중 어느 프리셋에도 장착하지 않은 장비를 모두 ${word}해요.`, { ok: word, danger: true }).then((ok) => ok && busy(t, async () => {
        const r = await post(pp(`/items/${m}-bulk`), { maxGrade: g }); selId = null; await after();
        toast(`${r.count}개 ${word}${r.gold ? ` · 골드 +${fmt(r.gold)}` : ""}${r.gems ? ` · 다이아 +${r.gems}` : ""}${r.dust ? ` · 가루 +${r.dust}` : ""}`);
      }));
    }
    if (t.dataset.eq) {
      const act = t.dataset.eq;
      if (act === "sell" || act === "dismantle") {
        const word = act === "sell" ? "판매" : "분해";
        return confirmBox(word, `이 장비를 ${word}할까요?`, { ok: word, danger: act === "sell" }).then((ok) => ok && busy(t, async () => {
          const r = await post(pp(`/items/${selId}/${act}`)); selId = null; await after(); toast(act === "sell" ? `골드 +${fmt(r.gold)}` : `장비 가루 +${r.dust}`);
        }));
      }
      return busy(t, async () => {
        if (act === "enhance") {
          const r = await post(pp(`/items/${selId}/enhance`));
          toast(r.success ? `강화 성공! +${r.enhance}` : r.downgraded ? `강화 실패… +${r.enhance}로 내려갔어요` : "강화 실패 — 단계는 그대로예요", r.success ? "ok" : "err");
          await after();
        } else { inv = await post(pp(`/items/${selId}/${act}`)); draw(); }
      });
    }
  };
  page.onchange = (e) => {
    if (e.target.id !== "autoG") return;
    const [mode, grade] = e.target.value ? e.target.value.split(":") : [null, null];
    busy(null, async () => {
      const r = await post(pp("/items/auto-sell"), { grade, mode: mode || undefined });
      inv.autoSellGrade = r.autoSellGrade; inv.autoMode = r.autoMode;
      toast(r.autoSellGrade ? `${S.meta.odysseyGradeLabel[r.autoSellGrade]} 이하는 얻자마자 ${r.autoMode === "dismantle" ? "분해" : "판매"}돼요` : "자동처리를 껐어요");
    });
  };
  return () => { page.onclick = null; page.onchange = null; };
}
export { RARC, teamStrip };
