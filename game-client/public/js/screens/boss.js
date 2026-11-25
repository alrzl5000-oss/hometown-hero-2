// 층보스전 — 서버 실제 전투 결과를 재생
import { S, post, pp, refreshMe } from "../api.js";
import { ic, GEM, fmt, comma, esc, el, elName, portrait, bar, openModal, toast } from "../ui.js";
import { setTitle, go } from "../main.js";
import { mountBattle, playHits, tierBg, SPRITE, damageTable } from "../battle.js";
import { matchup } from "./farm.js";

export async function render(page) {
  const stage = S.me.farm.stage;
  setTitle("층보스전", `${stage}층 · 승리하면 ${stage + 1}층이 열려요`);
  page.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:60px;"><div class="spin"></div><div class="t2">${stage}층 보스에게 도전하는 중…</div></div>`;
  let r;
  try { r = await post(pp("/farm/boss-challenge")); }
  catch (e) { page.innerHTML = `<div class="notice bad">${esc(e.message)}</div><button class="btn" style="margin-top:12px;" onclick="location.hash='#/farm'">전투로 돌아가기</button>`; return; }
  const sp = S.meta.bossSpecies.find((b) => b.key === r.boss.speciesKey) || {};
  const formation = S.meta.formations[S.me.farm.formation];
  const nameOf = (id) => S.heroById.get(id)?.name || id;

  page.innerHTML = `<div class="grid-main">
    <div class="col" style="gap:14px;min-width:0;">
      <div class="scene" id="scene" style="height:clamp(260px,36vw,420px);background-image:url('${tierBg(stage)}');">
        <div class="hud glass" style="left:14px;right:180px;top:14px;padding:8px 12px;">
          <div class="sec"><b>${stage}층 층보스 · ${esc(sp.name || "")} ${el(sp.element, 13)}</b><span class="t3 xs" id="bhpT"></span></div>
          <div style="margin-top:6px;">${bar(100, "bhp", 8).replace('style="width:100%;"', 'id="bhp" style="width:100%;"')}</div></div>
        <div class="hud row2" style="right:14px;top:14px;gap:6px;">
          <span class="chip glass num" id="timer" style="color:var(--t1);">0.0s</span>
          <button class="chip glass" data-spd style="color:var(--t1);">x1</button></div>
        <button class="hud btn sm" data-skip style="right:14px;bottom:14px;">${ic("ff", 14)} 결과 바로 보기</button>
      </div>
      <div class="g5" id="hpstrip">${r.team.map((h) => {
        const hh = S.heroById.get(h.id);
        return `<div class="well" style="padding:8px;display:flex;align-items:center;gap:8px;min-width:0;">${portrait(h.id, hh?.originRarity || "N", hh?.rarity || "N", 32)}<div class="grow"><div class="ell small" style="font-weight:700;">${esc(nameOf(h.id))}</div><div data-hp="${h.id}">${bar(100, "hp", 5)}</div></div></div>`;
      }).join("")}</div>
    </div>
    <div class="col" style="gap:14px;">
      <div class="card pad col"><div class="h3">속성 상성</div>
        <div class="row2" style="flex-wrap:wrap;gap:6px;">${r.team.map((h) => { const m = matchup(h.element, sp.element); return `<span class="chip ${m > 1 ? "pos" : m < 1 ? "bad" : ""}">${el(h.element, 12)} ${esc(nameOf(h.id))} ×${m}</span>`; }).join("")}</div>
        <div class="t3 xs">화 > 풍 > 수 > 화 — 유리하면 ×1.25, 불리하면 ×0.85</div></div>
      <div class="card pad col"><div class="h3">전투 기록</div><div id="log"></div></div>
      <div class="card pad col"><div class="h3">승리 보상</div>
        ${r.win ? "" : ""}<div id="rew">${stage + 1 > S.me.farm.maxStage ? `<div class="rowkv"><span class="t2">첫 클리어 보너스</span><b>${GEM} 20${(stage + 1) % 10 === 0 ? " + 50" : ""}</b></div>` : `<div class="t3 small">이미 클리어한 층이에요 — 보너스 없이 다음 층으로 이동해요.</div>`}
        <div class="rowkv"><span class="t2">패배 시</span><b>페널티 없음 · 그 자리에서 파밍 계속</b></div></div></div>
    </div></div>`;

  const scene = page.querySelector("#scene");
  const units = mountBattle(scene, {
    heroes: r.team.map((h) => ({ id: h.id, hp: h.hp })),
    foes: [{ id: r.boss.characterId, hp: r.boss.hp, sprite: SPRITE[r.boss.speciesKey], size: 170 }],
    formation,
  });
  const bossU = units.get(r.boss.characterId);
  const log = page.querySelector("#log");
  let speed = 1;
  const player = playHits(scene, units, r.hits, {
    endedAt: r.endedAt,
    onTick: (t) => {
      page.querySelector("#timer").textContent = t.toFixed(1) + "s";
      page.querySelector("#bhp").style.width = Math.max(0, (bossU.hp / bossU.max) * 100) + "%";
      page.querySelector("#bhpT").textContent = `${comma(Math.max(0, bossU.hp))} / ${comma(bossU.max)}`;
      for (const h of r.team) { const u = units.get(h.id); const n = page.querySelector(`[data-hp="${h.id}"] i`); if (n) n.style.width = Math.max(0, (u.hp / u.max) * 100) + "%"; }
      log.innerHTML = damageTable(units, nameOf).map((d, i) => `<div class="rowkv"><span class="small"><b class="num" style="display:inline-block;width:18px;">${i + 1}</b>${esc(d.name)}</span><b class="small">${fmt(d.dealt)}</b></div>`).join("");
    },
  });
  page.querySelector("[data-skip]").onclick = () => player.skip();
  page.querySelector("[data-spd]").onclick = (e) => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; player.setSpeed(speed); e.currentTarget.textContent = "x" + speed; };

  player.done.then(async () => {
    await refreshMe();
    const m = openModal(`<div style="text-align:center;">
        <div class="num" style="font-size:34px;color:${r.win ? "var(--mint)" : "var(--red)"};">${r.win ? "VICTORY" : "DEFEAT"}</div>
        <div class="t2" style="margin-top:6px;">${r.win ? `${stage}층 보스를 쓰러뜨렸어요! ${r.stage}층으로 이동했어요.` : "보스를 쓰러뜨리지 못했어요. 팀을 키워서 다시 도전해 보세요."}</div></div>
      ${r.win && r.diaBonus ? `<div class="notice mint">${GEM} 첫 클리어 보너스 다이아 +${r.diaBonus}</div>` : ""}
      ${!r.win ? `<div class="tip">팁: 보스 속성(${elName(sp.element)})에 유리한 영웅을 넣거나, 영웅 레벨업·승급, 어빌리티 재설정으로 팀을 강화해 보세요.</div>` : ""}
      <div class="row2"><button class="btn ghost grow" data-back>전투로</button>${r.win ? `<button class="btn pri grow" data-next>${ic("crown", 15)} 다음 층 보스 도전</button>` : `<button class="btn pri grow" data-retry>${ic("refresh", 15)} 다시 도전</button>`}</div>`, { onClose: () => {} });
    m.el.querySelector("[data-back]").onclick = () => { m.close(); go("farm"); };
    const again = m.el.querySelector("[data-next],[data-retry]");
    again.onclick = () => { m.close(); player.stop(); render(page); };
  });
  return () => player.stop();
}
export { toast };
