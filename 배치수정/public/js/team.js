// 팀 편성 팝업(공용) — 파밍 / PvP 공격·방어 / 던전 / 오디세이 테마 팀
import { S } from "./api.js";
import { ic, esc, portrait, badge, cls, el, fmt, openModal, RANK, ROW_LABEL, busy, toast } from "./ui.js";

export function synergyOf(ids) {
  const out = [];
  for (const set of S.meta?.synergySets || []) {
    const matched = set.memberIds.filter((id) => ids.includes(id));
    if (!matched.length) continue;
    const tier = [...set.tiers].reverse().find((t) => matched.length >= t.need);
    out.push({ set, matched, tier, next: set.tiers.find((t) => t.need > matched.length) });
  }
  return out.sort((a, b) => (b.tier ? 1 : 0) - (a.tier ? 1 : 0) || b.matched.length - a.matched.length);
}
export const deltaText = (d) => {
  if (!d) return "";
  const parts = [];
  if (d.atk && d.atk === d.hp && d.hp === d.def) parts.push(`공·체·방 +${d.atk}%`);
  else { if (d.atk) parts.push(`공격력 +${d.atk}%`); if (d.hp) parts.push(`체력 +${d.hp}%`); if (d.def) parts.push(`방어력 +${d.def}%`); }
  if (d.spd) parts.push(`공속 +${d.spd}%`);
  if (d.critAdd || d.crit) parts.push(`치명 +${d.critAdd || d.crit}%p`);
  return parts.join(" · ");
};

export function rowsOf(n, formationKey) {
  const f = S.meta.formations[formationKey] || S.meta.formations.balanced;
  return Array.from({ length: n }, (_, i) => (i < f.front ? "front" : i < f.front + f.mid ? "mid" : "back"));
}

const SORTS = { rarity: "등급순", level: "레벨순", dps: "DPS순" };

export function openTeamPicker({ title = "팀 편성", sub = "", ids = [], formation = "balanced", filterClass = null, extraTop = "", onSave }) {
  // slots[i] = i번째 자리(앞열→중열→뒷열 순)에 놓인 영웅 id 또는 null
  const slots = Array.from({ length: 5 }, (_, i) => (S.heroById.has(ids[i]) ? ids[i] : null));
  let active = null; // 고른 자리(다음에 누르는 영웅/자리가 여기로)
  let form = formation || "balanced";
  let clsF = filterClass || "all";
  let sort = "rarity";
  const m = openModal("", { size: "wide" });
  const filled = () => slots.filter(Boolean);
  const swap = (a, b) => { [slots[a], slots[b]] = [slots[b], slots[a]]; };
  const placeHero = (id, target) => {
    const from = slots.indexOf(id);
    if (from >= 0) { swap(from, target); return; } // 이미 팀에 있으면 자리 이동(맞바꾸기)
    slots[target] = id; // 빈 자리면 넣고, 차 있으면 교체
  };
  const draw = () => {
    const rows = rowsOf(5, form);
    const slotHtml = ["front", "mid", "back"].map((r) => {
      const idx = rows.map((x, i) => (x === r ? i : -1)).filter((i) => i >= 0);
      const cells = idx.map((i) => {
        const h = S.heroById.get(slots[i]);
        const on = active === i ? "slot-on" : "";
        return h ? `<div class="well tslot ${on}" data-slot="${i}" draggable="true" style="padding:6px;display:flex;align-items:center;gap:8px;cursor:pointer;min-width:0;position:relative;">
          ${portrait(h.characterId, h.originRarity, h.rarity, 36)}<div style="text-align:left;min-width:0;flex:1;"><div class="ell" style="font-weight:700;font-size:12px;">${esc(h.name)}</div><div class="t3 xs">${cls(h.class, 10)} · Lv.${h.level}</div></div>
          <button class="tslot-x" data-un="${i}" aria-label="빼기">${ic("x", 12)}</button></div>`
          : `<div class="slot tslot ${on}" data-slot="${i}" style="cursor:pointer;">${active === i ? "여기에 넣기" : "빈 자리"}</div>`;
      }).join("");
      return `<div class="well pad" style="display:grid;grid-template-columns:64px repeat(${idx.length},minmax(0,1fr));gap:8px;align-items:center;">
        <div><div class="h3">${ROW_LABEL[r]}</div><div class="t3 xs">${r === "front" ? "방어 +20%" : r === "mid" ? "공 +6% · 방 +8%" : "공격 +15%"}</div></div>${cells}</div>`;
    }).join("");
    const sel = filled();
    const syn = synergyOf(sel).filter((s) => s.tier).map((s) => `<span class="chip pos">${esc(s.set.icon || "")} ${esc(s.set.name)} ${s.matched.length}명 · ${deltaText(s.tier.delta)}</span>`).join("");
    let list = S.heroes.filter((h) => clsF === "all" || h.class === clsF);
    list.sort(sort === "level" ? (a, b) => b.level - a.level : sort === "dps" ? (a, b) => b.dps - a.dps : (a, b) => RANK[b.rarity] - RANK[a.rarity] || b.level - a.level);
    const rowShort = { front: "앞", mid: "중", back: "뒤" };
    const grid = list.map((h) => {
      const k = slots.indexOf(h.characterId);
      const blocked = filterClass && h.class !== filterClass;
      return `<div class="well hcard ${k >= 0 ? "tile-sel" : ""} ${blocked ? "off" : ""}" data-pick="${h.characterId}" draggable="${blocked ? "false" : "true"}">
        ${k >= 0 ? `<span class="pick">${rowShort[rows[k]]}</span>` : ""}${portrait(h.characterId, h.originRarity, h.rarity, 48)}
        ${badge(h.rarity, h.exStar)}<div class="nm ell">${esc(h.name)}</div><div class="t3 xs">${cls(h.class, 10)} ${el(h.element, 10)} Lv.${h.level}</div></div>`;
    }).join("") || `<div class="t3" style="padding:20px;">${filterClass ? `${esc(S.meta.classes[filterClass].label)} 영웅이 없어요 — 소환에서 모아 보세요.` : "보유한 영웅이 없어요."}</div>`;
    const classes = ["all", ...Object.keys(S.meta.classes)].filter((c) => !filterClass || c === filterClass);
    const hint = active !== null
      ? `<b class="pos">${ROW_LABEL[rows[active]]} 자리 선택됨</b> — 영웅을 누르면 여기에 들어가고, 다른 자리를 누르면 서로 바뀌어요.`
      : "자리를 먼저 누르고 영웅을 고르면 원하는 칸에 들어가요. 자리 두 개를 차례로 누르면 서로 바뀌고, 끌어다 놓아도 돼요. 1명부터 저장할 수 있고, 빈 자리가 있으면 앞열부터 채워서 저장돼요.";
    m.set(`<div><div class="h1">${esc(title)}</div>${sub ? `<div class="tip">${sub}</div>` : ""}</div>${extraTop}
      <div class="seg full">${Object.entries(S.meta.formations).map(([k, f]) => `<button data-form="${k}" class="${k === form ? "on" : ""}">${f.label} ${f.front}-${f.mid}-${f.back}</button>`).join("")}</div>
      <div class="t3 small">${esc(S.meta.formations[form].desc)}</div>
      <div class="notice mint small">${ic("users", 13)} ${hint}</div>
      <div class="col" style="gap:8px;">${slotHtml}</div>
      ${syn ? `<div class="row2" style="flex-wrap:wrap;">${syn}</div>` : `<div class="notice mint">${ic("layers", 13)} 같은 세트 영웅을 함께 넣으면 배치 시너지가 발동해요.</div>`}
      <div class="sec" style="flex-wrap:wrap;"><div class="row2" style="flex-wrap:wrap;gap:6px;">${classes.map((c) => `<button class="chip ${c === clsF ? "on" : ""}" data-cls="${c}">${c === "all" ? `전체 ${S.heroes.length}` : esc(S.meta.classes[c].label)}</button>`).join("")}</div>
        <div class="seg sm">${Object.entries(SORTS).map(([k, v]) => `<button data-sort="${k}" class="${k === sort ? "on" : ""}">${v}</button>`).join("")}</div></div>
      <div class="heroes-grid" style="max-height:330px;overflow-y:auto;">${grid}</div>
      <div class="row2"><button class="btn ghost" data-clear>비우기</button><button class="btn pri lg grow" data-save ${sel.length >= 1 ? "" : "disabled"}>${ic("check", 17)} 저장 (${sel.length}/5)</button></div>`);
  };
  m.body.addEventListener("click", (e) => {
    const t = e.target.closest("[data-un],[data-form],[data-cls],[data-sort],[data-pick],[data-slot],[data-clear],[data-save]");
    if (!t) return;
    if (t.dataset.un !== undefined) { slots[+t.dataset.un] = null; active = null; }
    else if (t.dataset.form) form = t.dataset.form;
    else if (t.dataset.cls) clsF = t.dataset.cls;
    else if (t.dataset.sort) sort = t.dataset.sort;
    else if (t.dataset.slot !== undefined) {
      const i = +t.dataset.slot;
      if (active === null) active = i;
      else if (active === i) active = null;
      else { swap(active, i); active = null; }
    } else if (t.dataset.pick) {
      const id = t.dataset.pick;
      const h = S.heroById.get(id);
      if (filterClass && h.class !== filterClass) return;
      const at = slots.indexOf(id);
      if (active !== null) { placeHero(id, active); active = null; }
      else if (at >= 0) slots[at] = null; // 다시 누르면 빼기
      else {
        const empty = slots.indexOf(null);
        if (empty < 0) { toast("자리가 꽉 찼어요 — 바꿀 자리를 먼저 누르세요.", "err"); return; }
        slots[empty] = id;
      }
    } else if ("clear" in t.dataset) { slots.fill(null); active = null; }
    else if ("save" in t.dataset) {
      busy(t, async () => { await onSave(filled(), form); m.close(); });
      return;
    }
    draw();
  });
  // 끌어다 놓기(데스크톱): 영웅 카드/자리 → 자리
  let drag = null;
  m.body.addEventListener("dragstart", (e) => {
    const s = e.target.closest("[data-slot]"), p = e.target.closest("[data-pick]");
    if (s) drag = { slot: +s.dataset.slot };
    else if (p && p.getAttribute("draggable") === "true") drag = { id: p.dataset.pick };
    else return;
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", "x"); } catch { /* 무시 */ }
  });
  m.body.addEventListener("dragover", (e) => { if (drag && e.target.closest("[data-slot]")) { e.preventDefault(); e.target.closest("[data-slot]").classList.add("slot-over"); } });
  m.body.addEventListener("dragleave", (e) => { e.target.closest?.("[data-slot]")?.classList.remove("slot-over"); });
  m.body.addEventListener("drop", (e) => {
    const s = e.target.closest("[data-slot]");
    if (!drag || !s) return;
    e.preventDefault();
    const to = +s.dataset.slot;
    if (drag.slot !== undefined) swap(drag.slot, to);
    else placeHero(drag.id, to);
    drag = null; active = null; draw();
  });
  m.body.addEventListener("dragend", () => { drag = null; });
  draw();
  return m;
}

// 팀 미니 표시(아바타 줄)
export function teamStrip(ids, size = 40) {
  return `<div class="row2" style="gap:6px;flex-wrap:wrap;">${(ids || []).map((id) => {
    const h = S.heroById.get(id);
    const r = S.rosterById.get(id);
    return h ? portrait(id, h.originRarity, h.rarity, size) : r ? portrait(id, r.rarity, r.rarity, size) : "";
  }).join("") || `<span class="t3 small">편성된 팀이 없어요</span>`}</div>`;
}
export const teamPower = (ids) => (ids || []).reduce((s, id) => s + (S.heroById.get(id)?.dps || 0), 0);
export { fmt };
