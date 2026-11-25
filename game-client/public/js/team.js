// 팀 편성 팝업(공용) — 파밍 / PvP 공격·방어 / 던전 / 오디세이 테마 팀
import { S } from "./api.js";
import { ic, esc, portrait, badge, cls, el, fmt, openModal, RANK, ROW_LABEL, busy } from "./ui.js";

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
  let sel = [...ids].filter((id) => S.heroById.has(id));
  let form = formation || "balanced";
  let clsF = filterClass || "all";
  let sort = "rarity";
  const m = openModal("", { size: "wide" });
  const draw = () => {
    const rows = rowsOf(5, form);
    const slotHtml = ["front", "mid", "back"].map((r) => {
      const idx = rows.map((x, i) => (x === r ? i : -1)).filter((i) => i >= 0);
      const cells = idx.map((i) => {
        const h = S.heroById.get(sel[i]);
        return h ? `<button class="well" data-un="${h.characterId}" style="padding:6px;display:flex;align-items:center;gap:8px;cursor:pointer;border:none;color:inherit;min-width:0;">
          ${portrait(h.characterId, h.originRarity, h.rarity, 36)}<div style="text-align:left;min-width:0;"><div class="ell" style="font-weight:700;font-size:12px;">${esc(h.name)}</div><div class="t3 xs">${cls(h.class, 10)} · Lv.${h.level}</div></div></button>`
          : `<div class="slot">${i + 1}번째 선택</div>`;
      }).join("");
      return `<div class="well pad" style="display:grid;grid-template-columns:64px repeat(${idx.length},minmax(0,1fr));gap:8px;align-items:center;">
        <div><div class="h3">${ROW_LABEL[r]}</div><div class="t3 xs">${r === "front" ? "방어 +20%" : r === "mid" ? "공 +6% · 방 +8%" : "공격 +15%"}</div></div>${cells}</div>`;
    }).join("");
    const syn = synergyOf(sel).filter((s) => s.tier).map((s) => `<span class="chip pos">${esc(s.set.icon || "")} ${esc(s.set.name)} ${s.matched.length}명 · ${deltaText(s.tier.delta)}</span>`).join("");
    let list = S.heroes.filter((h) => clsF === "all" || h.class === clsF);
    list.sort(sort === "level" ? (a, b) => b.level - a.level : sort === "dps" ? (a, b) => b.dps - a.dps : (a, b) => RANK[b.rarity] - RANK[a.rarity] || b.level - a.level);
    const grid = list.map((h) => {
      const k = sel.indexOf(h.characterId);
      const blocked = filterClass && h.class !== filterClass;
      return `<div class="well hcard ${k >= 0 ? "tile-sel" : ""} ${blocked ? "off" : ""}" data-pick="${h.characterId}">
        ${k >= 0 ? `<span class="pick">${k + 1}</span>` : ""}${portrait(h.characterId, h.originRarity, h.rarity, 48)}
        ${badge(h.rarity, h.exStar)}<div class="nm ell">${esc(h.name)}</div><div class="t3 xs">${cls(h.class, 10)} ${el(h.element, 10)} Lv.${h.level}</div></div>`;
    }).join("") || `<div class="t3" style="padding:20px;">${filterClass ? `${esc(S.meta.classes[filterClass].label)} 영웅이 없어요 — 소환에서 모아 보세요.` : "보유한 영웅이 없어요."}</div>`;
    const classes = ["all", ...Object.keys(S.meta.classes)].filter((c) => !filterClass || c === filterClass);
    m.set(`<div><div class="h1">${esc(title)}</div>${sub ? `<div class="tip">${sub}</div>` : ""}</div>${extraTop}
      <div class="seg full">${Object.entries(S.meta.formations).map(([k, f]) => `<button data-form="${k}" class="${k === form ? "on" : ""}">${f.label} ${f.front}-${f.mid}-${f.back}</button>`).join("")}</div>
      <div class="t3 small">${esc(S.meta.formations[form].desc)} · 고른 순서대로 앞열→중열→뒷열에 들어가요.</div>
      <div class="col" style="gap:8px;">${slotHtml}</div>
      ${syn ? `<div class="row2" style="flex-wrap:wrap;">${syn}</div>` : `<div class="notice mint">${ic("layers", 13)} 같은 세트 영웅을 함께 넣으면 배치 시너지가 발동해요.</div>`}
      <div class="sec" style="flex-wrap:wrap;"><div class="row2" style="flex-wrap:wrap;gap:6px;">${classes.map((c) => `<button class="chip ${c === clsF ? "on" : ""}" data-cls="${c}">${c === "all" ? `전체 ${S.heroes.length}` : esc(S.meta.classes[c].label)}</button>`).join("")}</div>
        <div class="seg sm">${Object.entries(SORTS).map(([k, v]) => `<button data-sort="${k}" class="${k === sort ? "on" : ""}">${v}</button>`).join("")}</div></div>
      <div class="heroes-grid" style="max-height:330px;overflow-y:auto;">${grid}</div>
      <div class="row2"><button class="btn ghost" data-clear>비우기</button><button class="btn pri lg grow" data-save ${sel.length === 5 ? "" : "disabled"}>${ic("check", 17)} 저장 (${sel.length}/5)</button></div>`);
  };
  m.body.addEventListener("click", (e) => {
    const t = e.target.closest("[data-form],[data-cls],[data-sort],[data-pick],[data-un],[data-clear],[data-save]");
    if (!t) return;
    if (t.dataset.form) form = t.dataset.form;
    else if (t.dataset.cls) clsF = t.dataset.cls;
    else if (t.dataset.sort) sort = t.dataset.sort;
    else if (t.dataset.un) sel = sel.filter((x) => x !== t.dataset.un);
    else if (t.dataset.pick) {
      const id = t.dataset.pick;
      const h = S.heroById.get(id);
      if (filterClass && h.class !== filterClass) return;
      if (sel.includes(id)) sel = sel.filter((x) => x !== id);
      else if (sel.length < 5) sel.push(id);
    } else if ("clear" in t.dataset) sel = [];
    else if ("save" in t.dataset) {
      busy(t, async () => { await onSave(sel, form); m.close(); });
      return;
    }
    draw();
  });
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
