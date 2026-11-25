// PvP 대전 — 레이팅전(랜덤 매칭, 횟수 제한) · 자존심전(직접 골라 도전, 무제한, 보상 없음)
import { S, get, post, pp, refreshMe } from "../api.js";
import { ic, GEM, COIN, fmt, comma, esc, openModal, toast, busy, avatar } from "../ui.js";
import { setTitle } from "../main.js";
import { mountBattle, playHits, BG } from "../battle.js";
import { openTeamPicker, teamStrip } from "../team.js";
import { dropNotice, dropAt, pctTxt, pvpTier } from "./heroes.js";
import { rosterRarity } from "../api.js";

export async function render(page) {
  setTitle("PvP 대전", "레이팅전은 비슷한 상대와 자동 매칭, 자존심전은 직접 골라 도전");
  let st, targets = [], hist = [], tab = "targets", ab;
  const load = async () => {
    [st, ab] = await Promise.all([get(pp("/pvp/state")), get(pp("/abilities"))]);
    const [t, h] = await Promise.all([get(pp("/pvp/targets")).catch(() => ({ targets: [] })), get(pp("/pvp/history")).catch(() => ({ matches: [] }))]);
    targets = t.targets; hist = h.matches;
  };
  await load();
  const draw = () => {
    const atk = st.attackTeam?.length === 5 ? st.attackTeam : st.defenseTeam?.length === 5 ? st.defenseTeam : S.me.farm.team;
    const def = st.defenseTeam?.length === 5 ? st.defenseTeam : S.me.farm.team;
    const left = `<div class="row2" style="gap:8px;">${[["레이팅", comma(st.rating)], ["순위", `${st.rank}위`], ["전적", `${st.wins}승 ${st.losses}패`]].map(([a, b]) => `<div class="well" style="flex:1;padding:12px;text-align:center;"><div class="t3 xs">${a}</div><div style="font-size:clamp(16px,2vw,22px);font-weight:700;margin-top:3px;">${b}</div></div>`).join("")}</div>
      <div class="well pad col" style="gap:8px;"><div class="sec"><span class="h3">공격 팀${st.attackTeam?.length === 5 ? "" : " <span class='t3 xs'>(없으면 방어 팀 → 파밍 팀)</span>"}</span><button class="btn xs" data-team="attack">${ic("sword", 12)} 편성</button></div>${teamStrip(atk, 40)}</div>
      <div class="well pad col" style="gap:8px;"><div class="sec"><span class="h3">방어 팀${st.defenseTeam?.length === 5 ? "" : " <span class='t3 xs'>(없으면 파밍 팀)</span>"}</span><button class="btn xs" data-team="defense">${ic("shield", 12)} 편성</button></div>${teamStrip(def, 40)}</div>
      <div class="card pad col" style="background:linear-gradient(140deg,rgba(34,197,94,.2),transparent 60%),linear-gradient(160deg,#122a23,#0b1915);">
        <div class="sec" style="flex-wrap:wrap;"><span class="h2">레이팅전</span><span class="chip">랜덤 매칭 · 레이팅·보상 있음</span></div>
        <div class="sec"><span class="t2">남은 도전</span><b>${st.attempts} / ${st.maxAttempts} <span class="t3" style="font-weight:400;">· 10분마다 1회</span></b></div>
        <div class="t3 xs">승리 ${GEM} 약 1,300 + 골드 (강한 상대일수록 많이) · 패배 ${GEM} 50 · 승리 시 ${pctTxt(dropAt("pvp", pvpTier(st.rating)))} 확률로 투기장 세트 장비</div>
        <button class="btn pri lg block" data-rand ${st.attempts <= 0 ? "disabled" : ""}>${ic("dice", 18)} 랜덤 매칭 시작</button></div>
      <div class="notice">${ic("zap", 12)} 어빌리티 프리셋 ${ab.contentPresets?.pvp || ab.activePreset + 1}번 자동 적용</div>`;
    const list = tab === "targets"
      ? (targets.length ? targets.map((t) => `<div class="well" style="padding:12px;display:flex;align-items:center;gap:12px;"><div class="grow"><div class="sec"><b>${esc(t.nickname || "이름없는 영웅")}</b><span class="t3 xs">레이팅 ${comma(t.rating)}</span></div>
          <div class="t3 xs" style="margin-top:2px;">${t.wins}승 ${t.losses}패 · 최고 ${t.maxStage}층 · 예상 화력 <span class="gold">${fmt(t.estimatedPower)}</span></div>
          <div class="row2" style="gap:4px;margin-top:8px;">${(t.teamIds || []).map((id) => avatar(id, rosterRarity(id), 24)).join("")}</div></div><button class="btn sm" data-fight="${t.playerId}">도전</button></div>`).join("")
        : `<div class="t3 small" style="padding:16px;text-align:center;">아직 대결할 상대가 없어요 — 다른 플레이어가 팀을 편성하면 나타나요.</div>`)
      : (hist.length ? hist.map((h) => `<div class="well" style="padding:10px 12px;"><div class="sec"><b class="${h.attacker_win ? "red" : "mint"}">${h.attacker_win ? "방어 실패" : "방어 성공"}</b><span class="t3 xs">${new Date(h.created_at).toLocaleString("ko-KR")}</span></div>
          <div class="t3 xs" style="margin-top:3px;">${h.rated ? `레이팅전 · 내 레이팅 ${h.defender_rating_before} → ${h.defender_rating_after}` : "자존심전 · 레이팅 변동 없음"}</div></div>`).join("")
        : `<div class="t3 small" style="padding:16px;text-align:center;">아직 나를 공격한 기록이 없어요.</div>`);
    page.innerHTML = `<div class="g2" style="gap:20px;align-items:start;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));">
      <div class="card pad col">${left}</div>
      <div class="card pad col"><div class="sec" style="flex-wrap:wrap;"><span class="h2">자존심전</span><span class="chip">직접 도전 · 무제한 · 보상 없음</span></div>
        <div class="seg full"><button data-tab="targets" class="${tab === "targets" ? "on" : ""}">도전 상대</button><button data-tab="hist" class="${tab === "hist" ? "on" : ""}">대결 기록</button></div>
        <div class="col" style="gap:8px;max-height:620px;overflow-y:auto;">${list}</div></div></div>`;
  };
  draw();

  async function fight(btn, url) {
    await busy(btn, async () => {
      const r = await post(pp(url));
      const m = openModal(`<div class="sec"><span class="h2">${r.rated ? "레이팅전" : "자존심전"} · vs ${esc(r.defenderNickname || "상대")}</span></div>
        <div class="scene" id="psc" style="height:260px;background-image:url('${BG.pvp}');"><button class="hud btn xs" data-skip style="right:12px;bottom:12px;">${ic("ff", 12)} 결과 바로 보기</button></div><div id="pres"></div>`, { size: "wide" });
      const sc = m.body.querySelector("#psc");
      const units = mountBattle(sc, { heroes: r.teamA.map((h) => ({ ...h })), foes: [], heroSize: 52 });
      // 상대 팀은 오른쪽에 영웅 도트(좌우 반전)로
      const foeUnits = mountFoes(sc, r.teamB);
      for (const [k, v] of foeUnits) units.set(k, v);
      const p = playHits(sc, units, r.hits, { endedAt: r.endedAt });
      m.body.querySelector("[data-skip]").onclick = () => p.skip();
      await p.done;
      m.body.querySelector("#pres").innerHTML = `<div style="text-align:center;"><div class="num" style="font-size:30px;color:${r.win ? "var(--mint)" : "var(--red)"};">${r.win ? "VICTORY" : "DEFEAT"}</div>
        ${r.rated ? `<div class="t2 small" style="margin-top:4px;">레이팅 ${comma(r.attackerRatingBefore)} → <b>${comma(r.attackerRatingAfter)}</b> (${r.attackerRatingAfter - r.attackerRatingBefore >= 0 ? "+" : ""}${r.attackerRatingAfter - r.attackerRatingBefore})</div>` : ""}
        <div class="t2 small" style="margin-top:4px;">${COIN} +${fmt(r.goldReward)} · ${GEM} +${comma(r.diaReward)}</div></div>${dropNotice(r.drop)}<button class="btn pri block" data-close>확인</button>`;
      await Promise.all([load(), refreshMe()]);
      draw();
    });
  }
  function mountFoes(sc, team) {
    const map = new Map();
    team.filter((h) => !h.isPet).forEach((h, i) => {
      const x = 64 + (i % 2) * 10 + (i > 2 ? 12 : 0), y = 62 + (i * 30) / 4;
      const u = document.createElement("div");
      u.className = "unit foe";
      u.style.left = x + "%"; u.style.top = y + "%";
      u.innerHTML = `<img src="/art/${h.id}_${rosterRarity(h.id)}.png" alt="" style="width:52px;height:52px;transform:scaleX(-1);"><div class="ub"><div class="bar"><i class="ehp" style="width:100%"></i></div></div>`;
      sc.appendChild(u);
      map.set(h.id + (team === null ? "" : ""), { el: u, side: "B", hp: h.hp, max: h.hp, x, y, dealt: 0 });
    });
    return map;
  }

  page.onclick = (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; draw(); }
    else if (t.dataset.team) {
      const isAtk = t.dataset.team === "attack";
      const ids = isAtk ? st.attackTeam : st.defenseTeam;
      openTeamPicker({
        title: isAtk ? "PvP 공격 팀" : "PvP 방어 팀", sub: isAtk ? "레이팅전 · 자존심전에서 공격할 때 써요." : "다른 플레이어가 나를 공격할 때 이 팀이 막아요.",
        ids: ids?.length === 5 ? ids : S.me.farm.team, formation: isAtk ? st.attackFormation : st.defenseFormation,
        onSave: async (sel, formation) => { await post(pp(`/pvp/${isAtk ? "attack-team" : "defense"}`), { characterIds: sel, formation }); await load(); draw(); toast("PvP 팀을 저장했어요."); },
      });
    } else if (t.dataset.rand !== undefined) fight(t, "/pvp/random-match");
    else if (t.dataset.fight) fight(t, `/pvp/attack/${t.dataset.fight}`);
  };
  return () => { page.onclick = null; };
}
