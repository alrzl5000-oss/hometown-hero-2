// 소환 — 1/10/100/1000회, 천장, 등급별 확률, 소환 연출 + 결과
import { S, post, pp, refreshMe, refreshHeroes } from "../api.js";
import { ic, GEM, STONE, fmt, comma, esc, RARC, RANK, art, badge, portrait, bar, openModal, toast, busy, sleep } from "../ui.js";
import { setTitle } from "../main.js";

const SHOW = ["N", "R", "SR", "SSR", "XR", "XXR", "HR"];

export async function render(page) {
  const draw = () => {
    const me = S.me;
    setTitle("소환", `${me.ownedCount}/${me.rosterCount}종 보유 · 천장 ${me.pity}/${comma(me.hardPity)}`);
    const rates = me.gachaRates;
    const rateOf = (r) => (r === "HR" ? rates.HR * 100 : rates[r]);
    const figs = ["HR", "XR", "XXR", "SSR", "SR"].map((r) => S.meta.roster.find((c) => c.rarity === r)).filter(Boolean);
    const B = S.meta.gachaBundles;
    const label = { 1: "확정 없음", 10: "SR 이상 1개 확정", 100: "SR 이상 10개 확정", 1000: "확정 없음 · 순수 확률" };
    page.innerHTML = `<div class="col" style="gap:16px;">
      <div class="card" style="padding:22px 26px;min-height:260px;position:relative;overflow:hidden;background:radial-gradient(500px 220px at 50% 90%,rgba(163,230,53,.25),transparent 70%),linear-gradient(160deg,#0f3b2a,#0a1814);">
        <div class="h1" style="font-size:26px;">영웅 소환</div>
        <div class="t2 small" style="margin-top:4px;">계정 레벨이 오를수록 SSR · XR · XXR 확률이 올라가요 (지금 Lv.${me.level})</div>
        <div style="display:flex;justify-content:center;align-items:flex-end;gap:clamp(6px,2vw,26px);margin-top:18px;">${figs.map((c, i) => `<div style="text-align:center;"><img class="sp" src="${art(c.id, c.rarity)}" alt="" style="width:clamp(64px,9vw,${i === 2 ? 130 : 110}px);filter:drop-shadow(0 0 18px ${RARC[c.rarity]}aa);"><div style="margin-top:-6px;">${badge(c.rarity)}</div></div>`).join("")}</div>
      </div>
      <div class="g2" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));">${[1, 10, 100, 1000].map((n) => `<button class="btn ${n === 10 ? "pri" : ""}" data-pull="${n}" style="height:76px;flex-direction:column;gap:2px;" ${me.currency.dia < B[n].cost ? "disabled" : ""}>
          <span style="font-size:15px;">${comma(n)}회 소환</span><span style="font-size:12px;">${GEM} ${comma(B[n].cost)}</span><span style="font-size:11px;font-weight:600;opacity:.85;">${label[n]}</span></button>`).join("")}</div>
      <div class="split g-pity">
        <div class="card pad col"><div class="sec"><span class="h3">천장</span><span class="small"><b>${me.pity}</b> / ${comma(me.hardPity)} · ${comma(me.hardPity - me.pity)}회 남음</span></div>
          ${bar((me.pity / me.hardPity) * 100, "xp", 8)}
          <div class="t3 xs">${comma(me.hardPity)}회 안에 SSR 이상이 안 나오면 다음 소환에서 SSR 1명 확정 · SSR·XR이 나오면 처음부터 다시 세요</div>
          ${me.level >= 100 ? `<div class="notice">${STONE} Lv.100부터 소환할 때마다 0.01% 확률로 승급석이 나와요</div>` : ""}</div>
        <div class="card pad col"><div class="sec"><span class="h3">등급별 확률 (Lv.${me.level} 기준)</span><span class="t3 xs">XXR은 Lv.50부터 등장</span></div>
          <div class="rates" style="display:grid;grid-template-columns:repeat(${SHOW.length},minmax(0,1fr));gap:6px;">${SHOW.map((r) => `<div class="well" style="padding:10px 4px;text-align:center;">${badge(r)}<div class="small" style="font-weight:700;margin-top:6px;">${fmtRate(rateOf(r))}%</div></div>`).join("")}</div>
          <div class="t3 xs">중복으로 뽑은 영웅은 조각 +1 · 이미 EX가 된 영웅은 계정 공용 '버려진 조각'으로 바뀌어요</div></div>
      </div>
      <div class="t3 small" style="text-align:center;">레벨이 오를수록 확률이 조금씩 오르는 것뿐, 언제 뽑아도 손해는 없어요.</div></div>`;
  };
  draw();
  page.onclick = (e) => {
    const b = e.target.closest("[data-pull]");
    if (b) pull(Number(b.dataset.pull), b, draw);
  };
  const h = () => draw();
  document.addEventListener("me", h);
  return () => { document.removeEventListener("me", h); page.onclick = null; };
}
const fmtRate = (v) => (v >= 1 ? Math.round(v * 100) / 100 : v >= 0.01 ? Math.round(v * 1000) / 1000 : Math.round(v * 100000) / 100000);

export async function pull(size, btn, after) {
  await busy(btn, async () => {
    const load = openModal(`<div style="text-align:center;padding:30px 0;"><div style="width:120px;height:120px;margin:0 auto;border-radius:50%;background:conic-gradient(#22c55e,#a3e635,#facc15,#22c55e);animation:sp 1s linear infinite;filter:blur(1px);box-shadow:0 0 60px rgba(163,230,53,.6);"></div>
      <div class="h2" style="margin-top:20px;">소환 중…</div><div class="t3 small">${comma(size)}회 소환</div></div>`, { closable: false });
    try {
      const [r] = await Promise.all([post(pp("/gacha/pull"), { size }), sleep(1100)]);
      load.close();
      await Promise.all([refreshMe(), refreshHeroes()]);
      showResult(r, after);
    } catch (e) { load.close(); throw e; }
  });
}

function showResult(r, after) {
  const many = r.size >= 100;
  let list = r.pulls;
  if (many) list = list.filter((p) => RANK[p.rarity] >= RANK.SR || p.isNew).sort((a, b) => RANK[b.rarity] - RANK[a.rarity]);
  const cell = (p) => `<div class="well" style="padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;text-align:center;">
      ${p.isNew ? `<span class="badge" style="--c:#a3e635;position:absolute;top:4px;right:4px;font-size:9px;">NEW</span>` : ""}
      ${portrait(p.character.id, p.character.rarity, p.rarity, 52)}${badge(p.rarity)}<div class="ell xs" style="font-weight:700;max-width:100%;">${esc(p.character.name)}</div>
      <div class="t3 xs">${p.isNew ? "새 영웅" : "조각 +1"}${p.guaranteed ? " · 확정" : ""}</div></div>`;
  const dup = r.pulls.length - r.newCount;
  const m = openModal(`<div style="text-align:center;"><div class="h1">${comma(r.size)}회 소환 결과</div><div class="t2 small" style="margin-top:4px;">새 영웅 ${r.newCount}명 · 중복 ${dup}명은 조각으로 바뀌었어요${r.discardedShardsGained ? ` · 버려진 조각 +${r.discardedShardsGained}` : ""}</div></div>
    ${r.stoneGain ? `<div class="notice">${STONE} 승급석 +${r.stoneGain} 획득!</div>` : ""}
    ${many ? `<div class="row2" style="flex-wrap:wrap;justify-content:center;gap:6px;">${SHOW.filter((k) => r.summary[k]).map((k) => `<span class="chip">${badge(k)} ${comma(r.summary[k])}</span>`).join("")}</div><div class="t3 xs" style="text-align:center;">SR 이상 · 새 영웅만 보여 드려요</div>` : ""}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;max-height:52vh;overflow-y:auto;">${list.map(cell).join("") || `<div class="t3">표시할 결과가 없어요</div>`}</div>
    <div class="row2"><button class="btn ghost grow" data-close>확인</button><button class="btn pri grow" data-again ${S.me.currency.dia < r.cost ? "disabled" : ""}>한 번 더 · ${GEM} ${comma(r.cost)}</button></div>`, { size: "wide" });
  m.el.querySelector("[data-again]").onclick = (e) => { m.close(); pull(r.size, null, after); };
  after && after();
}
export { toast };
