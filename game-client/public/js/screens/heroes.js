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
export function lineText(l) {
  if (!l) return "";
  if (l.isDud) return `${esc(l.icon || "")} ${esc(l.label || "")} +${l.value}% <span class="t3">(효과 없음)</span>`;
  const p = S.meta.odysseyStatPool[l.statKey] || { label: l.statKey, unit: "" };
  return `${esc(p.icon || "")} ${esc(p.label)} +${l.value}${p.unit}`;
}
export function itemCard(it, { sel = false } = {}) {
  const meta = S.meta.odysseyItems[it.key] || {};
  const g = it.grade;
  return `<div class="well" data-item="${it.id || ""}" style="padding:10px;cursor:pointer;display:flex;flex-direction:column;gap:5px;${sel ? "outline:1px solid rgba(163,230,53,.7);" : ""}border-color:${GC()[g]}55;">
    <div class="sec"><span class="badge" style="--c:${GC()[g]};color:#fff;">${esc(S.meta.odysseyGradeLabel[g])}${it.enhance ? ` +${it.enhance}` : ""}</span>${it.equipped ? `<span class="chip pos" style="height:20px;font-size:10px;">장착</span>` : ""}</div>
    <div class="row2"><span style="font-size:22px;">${esc(meta.icon || "")}</span><b class="small">${esc(meta.label || it.key)}</b></div>
    <div class="t3 xs" style="line-height:1.5;">${(it.lines || []).map(lineText).join("<br>")}</div></div>`;
}

async function renderEquip(page) {
  let inv, selId = null;
  const load = async () => { inv = await get(pp("/items")); };
  await load();
  const slotPos = { cyclops_eye: [50, 12], giant_armor: [50, 44], circe_parrot: [82, 30], siren_necklace: [18, 30], helios_cloak: [18, 66], odysseus_bow: [82, 66] };
  const draw = () => {
    setTitle("영웅 · 장비", `가방 ${inv.count}/${inv.cap} · 오디세이에서 얻은 장비`);
    const eq = inv.items.filter((i) => i.equipped);
    const sel = inv.items.find((i) => i.id === selId) || null;
    const sums = inv.equippedSums;
    const sumTxt = Object.entries(sums).filter(([, v]) => v).map(([k, v]) => `${esc(S.meta.odysseyStatPool[k]?.label || k)} +${Math.round(v * 10) / 10}${S.meta.odysseyStatPool[k]?.unit || ""}`).join(" · ");
    page.innerHTML = `<div class="col" style="gap:14px;">
      <div class="sec" style="flex-wrap:wrap;">
        <div class="seg"><button data-tab="heroes">${ic("users", 13)} 영웅</button><button class="on">${ic("bag", 13)} 장비</button></div>
        <div class="row2" style="flex-wrap:wrap;gap:6px;"><span class="t3 small">가방 ${inv.count}/${inv.cap}</span>
          <select class="inp" id="bulkG" style="height:32px;width:auto;">${inv.grades.map((g) => `<option value="${g}">${esc(S.meta.odysseyGradeLabel[g])} 이하</option>`).join("")}</select><button class="btn sm" data-bulk>${ic("trash", 13)} 일괄판매</button>
          <select class="inp" id="autoG" style="height:32px;width:auto;"><option value="">자동판매 끔</option>${inv.grades.slice(0, 3).map((g) => `<option value="${g}" ${inv.autoSellGrade === g ? "selected" : ""}>자동판매: ${esc(S.meta.odysseyGradeLabel[g])} 이하</option>`).join("")}</select></div></div>
      <div style="display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr) minmax(0,300px);gap:14px;align-items:start;" class="eqgrid">
        <div class="card pad col"><div class="h3">장착 중</div>
          <div style="position:relative;height:250px;" class="well">${Object.entries(slotPos).map(([k, [x, y]]) => {
            const it = eq.find((i) => i.key === k); const mt = S.meta.odysseyItems[k] || {};
            return `<button data-item="${it ? it.id : ""}" title="${esc(mt.label || k)}" style="position:absolute;left:${x}%;top:${y}%;transform:translateX(-50%);width:54px;height:54px;border:1px solid ${it ? GC()[it.grade] : "var(--st2)"};background:${it ? GC()[it.grade] + "22" : "rgba(0,0,0,.25)"};color:inherit;font-size:24px;cursor:pointer;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);${it ? "" : "opacity:.45;"}">${esc(mt.icon || "")}</button>`; }).join("")}</div>
          <div class="seg full sm">${[0, 1, 2].map((i) => `<button data-ep="${i}" class="${i === inv.activePreset ? "on" : ""}">프리셋 ${i + 1}</button>`).join("")}</div>
          <div class="t3 xs">${sumTxt || "장착한 장비가 없어요"} · 장비 효과는 모든 콘텐츠에 적용돼요</div></div>
        <div class="col" style="gap:10px;min-width:0;">${inv.items.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">${inv.items.map((it) => itemCard(it, { sel: it.id === selId })).join("")}</div>`
          : `<div class="card pad" style="text-align:center;"><div class="h3">가방이 비어 있어요</div><div class="t2 small" style="margin:6px 0 12px;">오디세이에서 승리하면 테마 장비가 나와요.</div><a class="btn pri" href="#/odyssey">${ic("map", 15)} 오디세이로</a></div>`}</div>
        <div class="card pad col">${sel ? `<div class="row2"><span style="font-size:30px;">${esc(S.meta.odysseyItems[sel.key]?.icon || "")}</span><div><div class="h3">${esc(S.meta.odysseyItems[sel.key]?.label || sel.key)}</div><span class="badge" style="--c:${GC()[sel.grade]};color:#fff;">${esc(sel.gradeLabel)} +${sel.enhance}</span></div></div>
            <div class="t2 small" style="line-height:1.7;">${sel.lines.map(lineText).join("<br>")}</div>
            ${kv("강화", `+${sel.enhance} / ${S.meta.enhanceMax}`)}
            ${sel.nextEnhance ? kv("다음 강화", `${COIN} ${fmt(sel.nextEnhance.cost.gold)}${sel.nextEnhance.cost.gems ? ` + ${GEM} ${sel.nextEnhance.cost.gems}` : ""} · 성공 ${Math.round(sel.nextEnhance.successRate * 1000) / 10}%`) : ""}
            ${sel.enhance >= 10 ? `<div class="notice bad">+11부터는 실패하면 50% 확률로 1단계 내려가요(+10 아래로는 안 내려가요).</div>` : ""}
            ${kv("판매가", `${COIN} ${fmt(sel.sellValue.gold)}${sel.sellValue.gems ? ` + ${GEM} ${sel.sellValue.gems}` : ""}`)}
            <div class="row2"><button class="btn sm grow" data-eq="${sel.equipped ? "unequip" : "equip"}">${sel.equipped ? "해제" : "장착"}</button><button class="btn sm pri grow" data-eq="enhance" ${sel.nextEnhance ? "" : "disabled"}>${ic("up", 13)} 강화</button></div>
            <button class="btn sm danger" data-eq="sell" ${sel.inAnyPreset ? "disabled" : ""}>${sel.inAnyPreset ? "장착 중 — 판매 불가" : "판매"}</button>`
          : `<div class="t3 small">장비를 눌러서 자세히 보고 장착 · 강화 · 판매할 수 있어요.</div>`}</div>
      </div></div>`;
  };
  draw();
  page.onclick = (e) => {
    const t = e.target.closest("[data-item],[data-tab],[data-ep],[data-eq],[data-bulk]");
    if (!t) return;
    if (t.dataset.tab) return go("heroes");
    if (t.dataset.item !== undefined) { if (t.dataset.item) { selId = t.dataset.item; draw(); } return; }
    if (t.dataset.ep) return busy(t, async () => { inv = await post(pp(`/equip-presets/${t.dataset.ep}/activate`)); draw(); });
    if (t.dataset.bulk !== undefined) {
      const g = page.querySelector("#bulkG").value;
      return confirmBox("일괄판매", `${esc(S.meta.odysseyGradeLabel[g])} 이하 장비 중 어느 프리셋에도 장착하지 않은 장비를 모두 팔아요.`, { ok: "판매", danger: true }).then((ok) => ok && busy(t, async () => {
        const r = await post(pp("/items/sell-bulk"), { maxGrade: g }); await Promise.all([load(), refreshMe()]); selId = null; draw();
        toast(`${r.sold}개 판매 · 골드 +${fmt(r.gold)}${r.gems ? ` · 다이아 +${r.gems}` : ""}`);
      }));
    }
    if (t.dataset.eq) {
      const act = t.dataset.eq;
      if (act === "sell") return confirmBox("판매", "이 장비를 판매할까요?", { ok: "판매", danger: true }).then((ok) => ok && busy(t, async () => { const r = await post(pp(`/items/${selId}/sell`)); await Promise.all([load(), refreshMe()]); selId = null; draw(); toast(`골드 +${fmt(r.gold)}`); }));
      return busy(t, async () => {
        if (act === "enhance") {
          const r = await post(pp(`/items/${selId}/enhance`));
          toast(r.success ? `강화 성공! +${r.enhance}` : r.downgraded ? `강화 실패… +${r.enhance}로 내려갔어요` : "강화 실패 — 단계는 그대로예요", r.success ? "ok" : "err");
          await Promise.all([load(), refreshMe()]);
        } else inv = await post(pp(`/items/${selId}/${act}`));
        draw();
      });
    }
  };
  page.onchange = (e) => {
    if (e.target.id === "autoG") busy(null, async () => { const r = await post(pp("/items/auto-sell"), { grade: e.target.value || null }); inv.autoSellGrade = r.autoSellGrade; toast(r.autoSellGrade ? `${S.meta.odysseyGradeLabel[r.autoSellGrade]} 이하는 바로 판매돼요` : "자동판매를 껐어요"); });
  };
  return () => { page.onclick = null; page.onchange = null; };
}
export { RARC, teamStrip };
