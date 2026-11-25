// 영웅의 오디세이 — 5층마다 테마(배치 직업)가 바뀌는 탑. 도전 횟수 30회(5분마다 1회 충전)
import { S, get, post, pp, refreshMe } from "../api.js";
import { ic, GEM, COIN, STONE, fmt, comma, esc, cls, portrait, bar, kv, openModal, toast, busy, secs } from "../ui.js";
import { setTitle, go } from "../main.js";
import { mountBattle, playHits, BG, SPRITE } from "../battle.js";
import { openTeamPicker, teamStrip } from "../team.js";
import { itemCard, itemIcon, dropAt, pctTxt, odysseyTier } from "./heroes.js";

export async function render(page) {
  let o, ab, player = null, timer = null;
  const load = async () => { [o, ab] = await Promise.all([get(pp("/odyssey")), get(pp("/abilities"))]); };
  await load();
  let regenLeft = o.nextRegenInSeconds;

  function draw() {
    const th = o.theme;
    setTitle("오디세이", `${o.stage}층 · ${th.name}`);
    const myTeam = o.themeTeams[th.key];
    const preset = ab.contentPresets?.odyssey || ab.activePreset + 1;
    const lo = Math.max(1, o.stage - 7), hi = lo + 16;
    let hexes = "";
    for (let n = lo; n <= hi; n++) {
      if (n > lo && (n - 1) % 5 === 0) hexes += `<span style="width:8px;"></span>`;
      const state = n === o.stage ? "cur" : n <= o.maxStage ? "done" : n > o.maxStage + 1 ? "locked" : "";
      hexes += `<button class="hex ${state}" data-st="${n}" ${state === "locked" ? "disabled" : ""}>${n}</button>`;
    }
    const itemKey = th.itemKey;
    const item = S.meta.odysseyItems[itemKey] || {};
    page.innerHTML = `<div class="grid-main">
      <div class="col" style="gap:16px;min-width:0;">
        <div class="card pad row2" style="gap:14px;align-items:flex-start;">
          <div class="well" style="width:46px;height:46px;display:flex;align-items:center;justify-content:center;color:var(--gold);flex:0 0 auto;">${ic("shield", 22)}</div>
          <div class="grow"><div class="row2" style="flex-wrap:wrap;"><span class="h2">${esc(th.name)}</span><span class="chip warn">${cls(th.allowedClass, 11)}만 배치 가능</span></div>
            <div class="tip" style="margin-top:4px;">${esc(th.desc || "")}</div></div></div>
        <div class="scene" id="scene" style="height:clamp(240px,32vw,380px);background-image:url('${BG.odyssey}');">
          <div class="hud glass" style="left:14px;top:14px;right:140px;padding:8px 12px;"><div class="sec"><b>${o.stage}층 · ${esc(th.bossName)}</b><span class="t3 xs">${o.stage > o.maxStage ? "최초 도전" : "클리어한 층"}</span></div>
            <div style="margin-top:6px;" id="ehpw">${bar(100, "bhp", 7)}</div><div class="t3 xs" style="margin-top:3px;">체력 ${comma(o.enemy.hp)} · 공격 ${comma(o.enemy.atk)} · 방어 ${comma(o.enemy.def)}</div></div>
        </div>
        <div class="card pad col">
          <div class="sec" style="flex-wrap:wrap;"><div><div class="h2">오디세이 전용 팀</div><div class="t3 small">테마가 바뀌면 그 테마에 저장한 팀이 자동으로 들어와요</div></div>
            <button class="btn sm" data-edit="${th.key}">${ic("users", 14)} 지금 테마 팀 편성</button></div>
          ${teamStrip(myTeam.team, 44)}
        </div>
        <div class="card pad col">
          <div class="sec"><span class="h2">스테이지</span><span class="t3 small">최고 기록 ${o.maxStage}층 · 5층마다 테마(배치 직업)가 바뀌어요</span></div>
          <div class="blades" style="gap:4px;align-items:center;">${hexes}</div>
        </div>
      </div>
      <div class="col" style="gap:16px;">
        <div class="card pad col">
          <div class="sec"><span class="h3">남은 도전</span><span class="num" style="font-size:18px;">${o.attempts} <span class="t3" style="font-size:12px;">/ ${o.attemptsMax}</span></span></div>
          ${bar((o.attempts / o.attemptsMax) * 100, "xp", 6)}
          <div class="t3 xs" id="regen">${o.attempts >= o.attemptsMax ? "가득 찼어요" : `다음 충전까지 ${secs(regenLeft || 0)} · 5분마다 1회`}</div>
          <button class="btn pri lg block" data-go="1" ${o.attempts <= 0 ? "disabled" : ""}>${ic("sword", 17)} 도전하기</button>
          <button class="btn block" data-go="10" ${o.attempts <= 0 ? "disabled" : ""}>${ic("ff", 15)} 10연속 도전</button>
          <div class="t3 xs">이기면 도전 횟수 1회 소모 · 지면 소모 없음 · 연속 도전은 지는 순간 멈춰요</div>
        </div>
        <div class="notice">${ic("zap", 12)} 이 콘텐츠는 어빌리티 프리셋 ${preset}번이 자동 적용돼요</div>
        <div class="card pad col">
          <div><div class="h3">테마별 배치 프리셋</div><div class="t3 xs">테마마다 팀을 한 번 저장해 두면 매번 다시 짤 필요 없어요</div></div>
          ${o.themes.map((t) => {
            const tt = o.themeTeams[t.key];
            const cur = t.key === th.key;
            return `<button class="well" data-edit="${t.key}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:none;color:inherit;cursor:pointer;text-align:left;${cur ? "outline:1px solid rgba(250,204,21,.6);background:rgba(250,204,21,.06);" : ""}">
              <span class="t2">${cls(t.allowedClass, 13)}</span><div class="grow"><div class="row2"><b class="small">${esc(t.name)}</b>${cur ? `<span class="chip warn" style="height:20px;font-size:10px;">지금 테마</span>` : ""}</div>
              <div class="t3 xs">${tt.team.length === 5 ? `${tt.team.map((id) => esc(S.heroById.get(id)?.name || "")).join(" · ")}` : "아직 편성 안 됨"}</div></div>${ic("chev", 14)}</button>`;
          }).join("")}
        </div>
        <div class="card pad col"><div class="h3">보상</div>
          ${kv("최초 클리어", `${GEM} ${comma(o.firstClearReward.gems)} + ${COIN} ${fmt(o.firstClearReward.gold)}`)}
          ${kv("장비 드랍", `${itemIcon(itemKey, 18)} ${esc(item.label || "")} ${pctTxt(dropAt("odyssey", odysseyTier(o.stage)))} · ${itemIcon("odysseus_bow", 18)} 활 ${pctTxt(dropAt("odysseyBow", odysseyTier(o.stage)))}`)}
          ${kv("승급석", `${STONE} 승리마다 0.1%`)}
          <button class="btn sm block" onclick="location.hash='#/equipment'">${ic("bag", 14)} 장비 가방 열기</button></div>
      </div></div>`;
    const scene = page.querySelector("#scene");
    const heroes = myTeam.team.length === 5 ? myTeam.team.map((id) => ({ id, hp: 1 })) : [];
    mountBattle(scene, { heroes, foes: [{ id: "boss", hp: 1, sprite: SPRITE[th.key], size: 150 }], formation: S.meta.formations[myTeam.formation] });
  }

  function editTheme(key) {
    const t = o.themes.find((x) => x.key === key);
    const cur = o.themeTeams[key];
    openTeamPicker({
      title: `${t.name} 팀`, sub: `${S.meta.classes[t.allowedClass].label}만 배치할 수 있어요.`, ids: cur.team, formation: cur.formation, filterClass: t.allowedClass,
      onSave: async (ids, formation) => { const r = await post(pp("/odyssey/theme-team"), { themeKey: key, characterIds: ids, formation }); o.themeTeams = r.themeTeams; draw(); toast("테마 팀을 저장했어요."); },
    });
  }

  async function challenge(btn, count) {
    await busy(btn, async () => {
      const r = await post(pp("/odyssey/challenge"), { count });
      if (count === 1 && r.fights[0]?.hits) {
        const f = r.fights[0];
        const scene = page.querySelector("#scene");
        const units = mountBattle(scene, { heroes: f.team.map((h) => ({ ...h })), foes: [{ id: f.enemy.characterId, hp: f.enemy.hp, sprite: SPRITE[f.theme], size: 150 }], formation: S.meta.formations[o.themeTeams[f.theme]?.formation] });
        const eu = units.get(f.enemy.characterId);
        player = playHits(scene, units, f.hits, { endedAt: f.endedAt, onTick: () => { const i = page.querySelector("#ehpw i"); if (i) i.style.width = Math.max(0, (eu.hp / eu.max) * 100) + "%"; } });
        await player.done;
      }
      await Promise.all([load(), refreshMe()]);
      regenLeft = o.nextRegenInSeconds;
      draw();
      showResult(r, count);
    });
  }

  function showResult(r, count) {
    const wins = r.wins;
    const last = r.fights[r.fights.length - 1];
    openModal(`<div style="text-align:center;"><div class="num" style="font-size:30px;color:${wins ? "var(--mint)" : "var(--red)"};">${count === 1 ? (wins ? "VICTORY" : "DEFEAT") : `${wins}승`}</div>
        <div class="t2" style="margin-top:4px;">${count === 1 ? (wins ? `${last.stage}층 클리어!` : `${last.stage}층에서 패배했어요 — 도전 횟수는 줄지 않았어요.`) : `${r.fights.length}번 싸워 ${wins}번 이겼어요${last && !last.win ? ` (${last.stage}층에서 멈춤)` : ""}.`}</div></div>
      ${r.fights.filter((f) => f.firstClear).length ? `<div class="notice mint">${ic("gift", 13)} 최초 클리어 ${r.fights.filter((f) => f.firstClear).length}회 보상</div>` : ""}
      <div>${kv("골드", `${COIN} +${fmt(r.rewards.gold)}`)}${kv("다이아", `${GEM} +${comma(r.rewards.gems)}`)}${r.rewards.stones ? kv("승급석", `<span class="gold">${STONE} +${r.rewards.stones} 획득!</span>`) : ""}</div>
      ${r.items.length ? `<div class="h3">획득 장비 ${r.items.length}개</div><div class="g2" style="max-height:300px;overflow-y:auto;">${r.items.map((it) => itemCard(it)).join("")}</div>` : ""}
      ${r.autoSold.length ? `<div class="t3 small">자동판매 ${r.autoSold.length}개 (${r.autoSold.filter((a) => a.reason === "가방 가득 참").length ? "가방이 가득 찼어요 · " : ""}판매 금액은 위 보상에 포함)</div>` : ""}
      <button class="btn pri block" data-close>확인</button>`);
  }

  page.onclick = (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.edit) editTheme(t.dataset.edit);
    else if (t.dataset.go) challenge(t, Number(t.dataset.go));
    else if (t.dataset.st) busy(t, async () => { const r = await post(pp("/odyssey/stage"), { stage: Number(t.dataset.st) }); o = { ...o, ...r }; draw(); });
  };
  draw();
  timer = setInterval(async () => {
    if (o.attempts >= o.attemptsMax || regenLeft == null) return;
    regenLeft -= 1;
    const n = page.querySelector("#regen");
    if (regenLeft <= 0) { await load(); regenLeft = o.nextRegenInSeconds; draw(); }
    else if (n) n.textContent = `다음 충전까지 ${secs(regenLeft)} · 5분마다 1회`;
  }, 1000);
  return () => { clearInterval(timer); player && player.stop(); page.onclick = null; };
}
export { go };
