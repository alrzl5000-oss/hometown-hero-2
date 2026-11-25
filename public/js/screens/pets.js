// 반려동물 — 내 펫(장착 2칸·성장) · 펫 소환(골드) · 펫 도감(도감 버프)
import { S, get, post, pp, refreshMe } from "../api.js";
import { ic, COIN, fmt, comma, esc, bar, kv, openModal, toast, busy, sleep } from "../ui.js";
import { setTitle } from "../main.js";

const PM = () => S.meta.pets;
const PGC = (g) => PM().gradeColor[g];
export const petImg = (look, s = 48) => `<img class="sp" src="/assets/pets/${look}.png" alt="" style="width:${s}px;height:${s}px;">`;
export const petDef = (id) => PM().pets.find((p) => p.id === id);
const gradeBadge = (g) => `<span class="badge" style="--c:${PGC(g)};color:#fff;">${esc(PM().gradeLabel[g])}</span>`;
const stars = (n, max = 5) => n ? `<span style="color:#facc15;letter-spacing:-1px;">${"★".repeat(n)}</span><span style="color:rgba(255,255,255,.15);letter-spacing:-1px;">${"★".repeat(max - n)}</span>` : "";
const pctS = (v) => `${Math.round(v * 1000) / 10}%`;
export function skillText(s) {
  if (!s) return "";
  switch (s.kind) {
    case "burst": return `적 하나에게 공격력 ×${(Math.round(s.burstMult * 100) / 100)} 강타`;
    case "buffAtk": return `아군 전체 공격력 +${pctS(s.buffBonus)} (${s.buffDuration}초)`;
    case "buffSpd": return `아군 전체 공격속도 +${pctS(s.buffBonus)} (${s.buffDuration}초)`;
    case "debuffDef": return `적 방어력 -${pctS(s.reduction)} (${s.buffDuration}초)`;
    case "heal": return `체력이 가장 낮은 아군 회복 (공격력 ×${Math.round(s.healMult * 100) / 100})`;
    case "cooldownReduce": return `아군 스킬 마나 회복 +${pctS(s.manaRegenBonus)} (${s.buffDuration}초)`;
    case "buffDef": return `아군 받는 피해 -${pctS(s.buffReduction)} (${s.buffDuration}초)`;
    default: return s.kind;
  }
}
export const passiveText = (p) => p ? `${esc(PM().passiveLabel[p.key] || p.key)} +${p.value}%` : "";
const sumText = (sums) => Object.entries(sums || {}).filter(([, v]) => v).map(([k, v]) => `${esc(PM().passiveLabel[k] || k)} +${Math.round(v * 10) / 10}%`).join(" · ");

let view = { tab: "mine", fam: "all", sort: "grade", sel: null };
const GI = (g) => PM().grades.indexOf(g);

export async function render(page) {
  let d;
  const load = async () => { d = await get(pp("/pets")); };
  await load();
  const draw = () => {
    const owned = new Map(d.pets.map((p) => [p.id, p]));
    setTitle("펫", `보유 ${d.collection.unique}/${d.collection.total}종 · 장착 ${d.slots.length}/${d.slotCount}`);
    const tabs = `<div class="sec" style="flex-wrap:wrap;"><div class="seg">${[["mine", "내 펫"], ["gacha", "펫 소환"], ["dex", "펫 도감"]].map(([k, l]) => `<button data-tab="${k}" class="${view.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <span class="chip">${COIN} ${fmt(S.me.currency.gold)}</span></div>`;

    if (view.tab === "gacha") {
      const B = PM().bundles, specials = PM().pets.filter((p) => p.special);
      page.innerHTML = `<div class="col" style="gap:16px;">${tabs}
        <div class="card" style="padding:22px 26px;background:radial-gradient(520px 220px at 50% 95%,rgba(255,90,138,.22),transparent 70%),linear-gradient(160deg,#0f3b2a,#0a1814);">
          <div class="h1" style="font-size:26px;">펫 소환</div>
          <div class="t2 small" style="margin-top:4px;">골드로 뽑아요 · 1회 ${comma(B[1].cost)}골드 · 확정 없음(순수 확률) · 중복은 조각이 돼서 별 강화에 써요</div>
          <div style="display:flex;justify-content:center;align-items:flex-end;gap:clamp(8px,2.5vw,30px);margin-top:18px;flex-wrap:wrap;">${specials.map((p) => `<div style="text-align:center;">${petImg(p.look, 72)}<div class="xs" style="font-weight:700;margin-top:4px;">${esc(p.name)}</div>${gradeBadge(p.grade)}</div>`).join("")}</div>
        </div>
        <div class="g3" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));">${Object.entries(B).map(([n, b]) => `<button class="btn ${n === "10" ? "pri" : ""}" data-pull="${n}" style="height:70px;flex-direction:column;gap:3px;" ${S.me.currency.gold < b.cost ? "disabled" : ""}>
          <span style="font-size:15px;">${comma(Number(n))}회 소환</span><span style="font-size:12px;">${COIN} ${fmt(b.cost)}</span></button>`).join("")}</div>
        <div class="card pad col"><div class="sec"><span class="h3">등급별 확률</span><span class="t3 xs">등급 안에서는 모든 펫이 같은 확률</span></div>
          <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;">${PM().grades.map((g) => { const cnt = PM().pets.filter((p) => p.grade === g).length; return `<div class="well" style="padding:10px 4px;text-align:center;">${gradeBadge(g)}<div style="font-weight:700;margin-top:6px;">${PM().rates[g]}%</div><div class="t3 xs">${cnt}종 · 1종당 ${Math.round(PM().rates[g] / cnt * 1000) / 1000}%</div></div>`; }).join("")}</div></div>
      </div>`;
      return;
    }

    if (view.tab === "dex") {
      const c = d.collection;
      const fams = Object.entries(PM().families);
      page.innerHTML = `<div class="col" style="gap:16px;">${tabs}
        <div class="card pad col"><div class="sec"><span class="h3">펫 도감 버프</span><b>${c.unique} / ${c.total}종</b></div>${bar((c.unique / c.total) * 100, "xp", 7)}
          <div class="t2 small">1종당 공격력 · 체력·방어력 +${PM().dexPerPet}% · 지금 합계 <span class="mint">${sumText(c.deltas) || "없음"}</span></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px;">${fams.map(([k, f]) => { const st = c.families[k]; return `<div class="well pad col" style="gap:5px;${st.complete ? "outline:1px solid rgba(163,230,53,.5);" : ""}"><div class="sec"><b class="small">${esc(f.label)} 전부 모으기</b><span class="xs ${st.complete ? "mint" : "t3"}">${st.have}/${st.total}</span></div>${bar((st.have / st.total) * 100, "hp", 4)}<div class="xs ${st.complete ? "mint" : "t3"}">완성 보너스 · ${sumText(f.complete)}</div></div>`; }).join("")}
            <div class="well pad col" style="gap:5px;${c.special.complete ? "outline:1px solid rgba(163,230,53,.5);" : ""}"><div class="sec"><b class="small">특별한 친구들</b><span class="xs ${c.special.complete ? "mint" : "t3"}">${c.special.have}/${c.special.total}</span></div>${bar((c.special.have / c.special.total) * 100, "hp", 4)}<div class="xs ${c.special.complete ? "mint" : "t3"}">완성 보너스 · ${sumText(PM().specialBonus)}</div></div></div></div>
        ${fams.map(([k, f]) => `<div class="card pad col"><div class="sec"><span class="h3">${esc(f.label)}</span><span class="t3 xs">${esc(f.role)} · 장착 효과 ${esc(PM().passiveLabel[f.passive])} · 스킬 「${esc(f.skill.name)}」</span></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;">${PM().pets.filter((p) => p.family === k).map((p) => { const o = owned.get(p.id); return `<button class="well" data-pet="${o ? p.id : ""}" style="border:none;color:inherit;cursor:${o ? "pointer" : "default"};padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;${o ? "" : "opacity:.35;"}">
            <div style="${o ? "" : "filter:brightness(0) opacity(.6);"}">${petImg(p.look, 48)}</div>${gradeBadge(p.grade)}<span class="xs ell" style="font-weight:700;max-width:100%;">${o ? esc(p.name) : "???"}</span>${o ? `<span class="t3 xs">Lv.${o.level} ${stars(o.star)}</span>` : ""}</button>`; }).join("")}</div></div>`).join("")}
      </div>`;
      return;
    }

    // 내 펫
    let list = d.pets.filter((p) => view.fam === "all" || p.family === view.fam);
    list.sort(view.sort === "level" ? (a, b) => b.level - a.level : (a, b) => GI(b.grade) - GI(a.grade) || b.star - a.star || b.level - a.level);
    if (!view.sel || !owned.has(view.sel)) view.sel = d.slots[0] || list[0]?.id || null;
    const sel = view.sel ? owned.get(view.sel) : null;
    const slotCard = (i) => {
      const p = owned.get(d.slots[i]);
      if (!p) return `<div class="card pad" style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;min-height:150px;"><div class="t3">${ic("plus", 22)}</div><div class="t3 small">${i + 1}번 칸 비어 있음</div><div class="t3 xs">아래에서 펫을 골라 장착하세요</div></div>`;
      return `<button class="card pad" data-pet="${p.id}" style="border:none;color:inherit;cursor:pointer;text-align:left;display:flex;gap:14px;align-items:center;background:radial-gradient(260px 140px at 15% 50%,${PGC(p.grade)}33,transparent 70%),linear-gradient(160deg,#122a23,#0b1915);">
        <div style="flex:0 0 auto;">${petImg(p.look, 80)}</div>
        <div class="grow" style="min-width:0;"><div class="row2" style="gap:6px;flex-wrap:wrap;"><span class="chip on" style="height:20px;font-size:10px;">${i + 1}번 칸</span>${gradeBadge(p.grade)}${stars(p.star)}</div>
          <div class="h2" style="margin-top:4px;">${esc(p.name)}</div><div class="t3 xs">${esc(p.familyLabel)} · ${esc(p.role)} · Lv.${p.level}/${p.levelCap}</div>
          <div class="small mint" style="margin-top:6px;">${passiveText(p.passive)}</div><div class="t2 xs">스킬 「${esc(p.skill.skillName)}」 ${skillText(p.skill)}</div></div></button>`;
    };
    page.innerHTML = `<div class="col" style="gap:16px;">${tabs}
      <div class="split">${slotCard(0)}${slotCard(1)}</div>
      <div class="notice mint">${ic("spark", 13)} 펫은 전투에서 같이 공격하고 스킬도 써요. 적은 펫을 공격하지 못해요. 장착 효과 + 도감 버프 합계 · ${sumText(d.passiveSums) || "없음"}</div>
      ${d.pets.length ? `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,340px);gap:16px;align-items:start;" class="eqgrid">
        <div class="col" style="gap:10px;min-width:0;">
          <div class="sec" style="flex-wrap:wrap;"><div class="row2" style="flex-wrap:wrap;gap:6px;"><button class="chip ${view.fam === "all" ? "on" : ""}" data-fam="all">전체 ${d.pets.length}</button>${Object.entries(PM().families).map(([k, f]) => { const n = d.pets.filter((p) => p.family === k).length; return n ? `<button class="chip ${view.fam === k ? "on" : ""}" data-fam="${k}">${esc(f.label)} ${n}</button>` : ""; }).join("")}</div>
            <div class="seg sm"><button data-sort="grade" class="${view.sort === "grade" ? "on" : ""}">등급순</button><button data-sort="level" class="${view.sort === "level" ? "on" : ""}">레벨순</button></div></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px;">${list.map((p) => `<button class="well" data-pet="${p.id}" style="border:none;color:inherit;cursor:pointer;padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;${p.id === view.sel ? "outline:1px solid rgba(163,230,53,.7);background:rgba(163,230,53,.08);" : ""}">
            ${d.slots.includes(p.id) ? `<span class="chip pos" style="position:absolute;top:4px;right:4px;height:18px;font-size:9.5px;padding:0 8px;">장착</span>` : ""}
            <div style="background:radial-gradient(circle,${PGC(p.grade)}33,transparent 70%);">${petImg(p.look, 56)}</div>${gradeBadge(p.grade)}<span class="xs ell" style="font-weight:700;max-width:100%;">${esc(p.name)}</span><span class="t3 xs">Lv.${p.level} ${stars(p.star)}</span></button>`).join("")}</div></div>
        <div class="card pad col" id="petdetail">${sel ? detail(sel) : ""}</div></div>`
      : `<div class="card pad" style="text-align:center;"><div class="h3">아직 펫이 없어요</div><div class="t2 small" style="margin:6px 0 12px;">골드로 펫을 뽑아 보세요. 1회 ${comma(PM().bundles[1].cost)}골드예요.</div><button class="btn pri" data-tab="gacha">${ic("spark", 15)} 펫 소환</button></div>`}
    </div>`;
    function detail(p) {
      const inSlot = d.slots.indexOf(p.id);
      return `<div class="row2" style="gap:12px;"><div style="background:radial-gradient(circle,${PGC(p.grade)}44,transparent 70%);padding:4px;">${petImg(p.look, 72)}</div>
          <div style="min-width:0;"><div class="row2" style="gap:6px;">${gradeBadge(p.grade)}${stars(p.star)}</div><div class="h2" style="margin-top:4px;">${esc(p.name)}</div><div class="t3 xs">${esc(p.familyLabel)} · ${esc(p.role)}</div></div></div>
        ${p.desc ? `<div class="t2 small" style="line-height:1.6;">${esc(p.desc)}</div>` : ""}
        <div>${kv("레벨", `${p.level} / ${p.levelCap}`)}${kv("공격력", comma(p.atk))}${kv("공격속도", `초당 ${p.spd}회`)}${kv("치명타", `${Math.round(p.critRate * 100)}%`)}
          ${kv("장착 효과", `<span class="mint">${passiveText(p.passive)}</span>`)}</div>
        <div class="well pad col" style="gap:4px;"><b class="small">스킬 「${esc(p.skill.skillName)}」</b><div class="t2 xs">${skillText(p.skill)} · 마나 ${p.skill.manaCost}</div></div>
        <div class="well pad col" style="gap:8px;"><div class="sec"><b class="small">레벨업</b><span class="t3 xs">Lv.${p.level} / ${p.levelCap}</span></div>${bar((p.level / p.levelCap) * 100, "xp", 5)}
          ${p.levelUpCost ? `<div class="t2 xs">다음 레벨 ${COIN} ${fmt(p.levelUpCost)}</div><div class="row2"><button class="btn sm grow" data-act="level-up">1레벨</button><button class="btn sm pri grow" data-act="level-max">가능한 만큼</button></div>` : `<div class="t3 xs">최대 레벨이에요</div>`}</div>
        <div class="well pad col" style="gap:8px;"><div class="sec"><b class="small">별 강화</b><span class="t3 xs">★${p.star} / ${p.starMax} · 별마다 능력치 · 효과 +10%</span></div>
          ${p.starUpCost ? `<div class="t2 xs">조각 ${p.shards} / ${p.starUpCost} (같은 펫을 또 뽑으면 조각 +1)</div>${bar((p.shards / p.starUpCost) * 100, "hp", 5)}<button class="btn sm pri" data-act="star-up" ${p.shards < p.starUpCost ? "disabled" : ""}>${ic("star", 13)} ★${p.star + 1} 강화</button>` : `<div class="t3 xs">최대 별이에요 · 남은 조각 ${p.shards}</div>`}</div>
        <div class="row2">${inSlot >= 0 ? `<button class="btn sm grow" data-unequip="${p.id}">해제</button>` : `<button class="btn sm grow" data-equip="0">1번 칸에 장착</button><button class="btn sm grow" data-equip="1">2번 칸에 장착</button>`}</div>`;
    }
  };
  draw();

  const saveSlots = async (ids) => { const r = await post(pp("/pets/slots"), { petIds: ids }); d = { ...d, ...r }; await refreshMe(); draw(); };
  page.onclick = (e) => {
    const t = e.target.closest("[data-tab],[data-fam],[data-sort],[data-pet],[data-act],[data-equip],[data-unequip],[data-pull]");
    if (!t) return;
    if (t.dataset.tab) { view.tab = t.dataset.tab; return draw(); }
    if (t.dataset.fam) { view.fam = t.dataset.fam; return draw(); }
    if (t.dataset.sort) { view.sort = t.dataset.sort; return draw(); }
    if (t.dataset.pet !== undefined) {
      if (!t.dataset.pet) return;
      view.sel = t.dataset.pet; view.tab = "mine"; draw();
      if (matchMedia("(max-width:860px)").matches) page.querySelector("#petdetail")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (t.dataset.pull) return pull(Number(t.dataset.pull), t);
    if (t.dataset.equip !== undefined) {
      const i = Number(t.dataset.equip), ids = [...d.slots].filter((x) => x !== view.sel);
      if (i >= ids.length) ids.push(view.sel); else ids[i] = view.sel;
      return busy(t, async () => { await saveSlots(ids.slice(0, 2)); toast(`${esc(petDef(view.sel).name)} 장착!`); });
    }
    if (t.dataset.unequip) return busy(t, () => saveSlots(d.slots.filter((x) => x !== t.dataset.unequip)));
    if (t.dataset.act) {
      const a = t.dataset.act, id = view.sel;
      return busy(t, async () => {
        const r = a === "star-up" ? await post(pp(`/pets/${id}/star-up`)) : await post(pp(`/pets/${id}/level-up`), { max: a === "level-max" });
        await Promise.all([load(), refreshMe()]); draw();
        toast(a === "star-up" ? `★${r.star} 강화 완료!` : `Lv.${r.level} 달성! (골드 ${fmt(r.spentGold)})`);
      });
    }
  };
  async function pull(size, btn) {
    await busy(btn, async () => {
      const m = openModal(`<div style="text-align:center;padding:30px 0;"><div style="width:110px;height:110px;margin:0 auto;border-radius:50%;background:conic-gradient(#ff5a8a,#facc15,#a3e635,#67e8f9,#ff5a8a);animation:sp 1s linear infinite;filter:blur(1px);box-shadow:0 0 60px rgba(255,90,138,.5);"></div><div class="h2" style="margin-top:20px;">펫을 부르는 중…</div></div>`, { closable: false });
      let r;
      try { [r] = await Promise.all([post(pp("/pets/gacha"), { size }), sleep(1000)]); } finally { m.close(); }
      await Promise.all([load(), refreshMe()]);
      draw();
      showResult(r);
    });
  }
  function showResult(r) {
    let list = r.pulls;
    if (r.size >= 100) list = list.filter((x) => GI(x.pet.grade) >= GI("SR") || x.isNew).sort((a, b) => GI(b.pet.grade) - GI(a.pet.grade));
    const m = openModal(`<div style="text-align:center;"><div class="h1">펫 ${comma(r.size)}회 소환 결과</div><div class="t2 small" style="margin-top:4px;">새 펫 ${r.newCount}마리 · 중복 ${r.pulls.length - r.newCount}마리는 조각으로 바뀌었어요</div></div>
      ${r.size >= 100 ? `<div class="row2" style="flex-wrap:wrap;justify-content:center;gap:6px;">${PM().grades.filter((g) => r.summary[g]).map((g) => `<span class="chip">${gradeBadge(g)} ${r.summary[g]}</span>`).join("")}</div><div class="t3 xs" style="text-align:center;">영웅 등급 이상 · 새 펫만 보여 드려요</div>` : ""}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;max-height:52vh;overflow-y:auto;">${list.map((x) => `<div class="well" style="padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;text-align:center;${x.pet.grade === "UR" ? `outline:1px solid ${PGC("UR")};` : ""}">
        ${x.isNew ? `<span class="badge" style="--c:#a3e635;position:absolute;top:4px;right:4px;font-size:9px;">NEW</span>` : ""}<div style="background:radial-gradient(circle,${PGC(x.pet.grade)}44,transparent 70%);">${petImg(x.pet.look, 52)}</div>${gradeBadge(x.pet.grade)}<div class="ell xs" style="font-weight:700;max-width:100%;">${esc(x.pet.name)}</div><div class="t3 xs">${x.isNew ? "새 펫" : "조각 +1"}</div></div>`).join("") || `<div class="t3">표시할 결과가 없어요</div>`}</div>
      ${r.autoEquipped?.length ? `<div class="notice mint">빈 칸에 새 펫을 자동으로 장착했어요</div>` : ""}
      <div class="row2"><button class="btn ghost grow" data-close>확인</button><button class="btn pri grow" data-again ${S.me.currency.gold < r.cost ? "disabled" : ""}>한 번 더 · ${COIN} ${fmt(r.cost)}</button></div>`, { size: "wide" });
    m.el.querySelector("[data-again]").onclick = (e) => { m.close(); pull(r.size, null); };
  }
  const h = () => draw();
  document.addEventListener("me", h);
  return () => { page.onclick = null; document.removeEventListener("me", h); };
}
