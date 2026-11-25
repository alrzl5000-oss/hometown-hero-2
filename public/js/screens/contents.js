// 콘텐츠 — 일일 던전 3종 · 일일보스 · 랭킹 · PvP 입구
import { S, get, post, pp, refreshMe } from "../api.js";
import { ic, COIN, GEM, fmt, comma, esc, cls, art, portrait, bar, kv, openModal, toast, busy } from "../ui.js";
import { setTitle, go } from "../main.js";
import { mountBattle, playHits, BG, SPRITE, damageTable } from "../battle.js";
import { openTeamPicker, teamStrip } from "../team.js";
import { dropNotice, dropAt, pctTxt } from "./heroes.js";

const DNAME = { gold: "골드 던전", gem: "다이아 던전", exp: "경험치 던전" };
const DREW = { gold: (n) => `${COIN} ${fmt(n)}`, gem: (n) => `${GEM} ${comma(n)}`, exp: (n) => `EXP ${fmt(n)}` };
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export async function render(page) {
  setTitle("콘텐츠", "일일 콘텐츠 · 랭킹 · PvP");
  let d, b, pvp, rk;
  const load = async () => {
    [d, b, pvp, rk] = await Promise.all([get(pp("/dungeons")), get(pp("/daily-boss")), get(pp("/pvp/state")).catch(() => null), get(`/api/rankings?type=stage&playerId=${S.playerId}`).catch(() => null)]);
  };
  await load();
  const draw = () => {
    const cards = [
      ...d.dungeons.map((x) => ({ k: "d:" + x.type, bg: BG[x.type], t: DNAME[x.type], s: `${x.stage}층 (최고 ${x.maxStage}) · 남은 도전 ${x.attemptsMax - x.attemptsUsed}/${x.attemptsMax}`, chip: `${S.meta.classes[S.meta.dungeonWeakRole[x.type]].label}에게 약함`, pos: true })),
      { k: "boss", bg: BG.daily, t: "일일보스", s: `남은 도전 ${b.attemptsMax - b.attemptsUsed}/${b.attemptsMax} · ${b.fightSeconds}초 데미지 레이스`, chip: `오늘: ${esc(S.meta.dailyBossSkills[b.dayIndex % 7]?.name || "")}` },
      { k: "rank", bg: BG.ranking, t: "랭킹", s: rk?.me ? `내 순위 ${rk.me.rank}위 (스테이지)` : "스테이지 · 레벨 · 일일보스 · PvP", chip: "스테이지 · 레벨 · 일일보스 · PvP" },
      { k: "pvp", bg: BG.pvp, t: "PvP 대전", s: pvp ? `레이팅 ${comma(pvp.rating)} · ${pvp.rank}위 · 레이팅전 ${pvp.attempts}/${pvp.maxAttempts}` : "레이팅전 · 자존심전", chip: "자존심전 무제한" },
    ];
    page.innerHTML = `<div class="col" style="gap:14px;">
      <div class="notice">${ic("clock", 13)} 던전 · 일일보스 도전 횟수는 매일 오전 9시(한국시간)에 초기화돼요</div>
      <div class="g3" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));">${cards.map((c) => `<button class="card" data-c="${c.k}" style="padding:0;border:none;color:inherit;text-align:left;cursor:pointer;overflow:hidden;">
        <div class="scene" style="height:140px;background-image:url('${c.bg}');clip-path:none;border:none;"></div>
        <div style="padding:12px 14px 14px;"><div class="sec"><span class="h3">${c.t}</span>${ic("chev", 16)}</div><div class="t2 small" style="margin-top:3px;">${c.s}</div>
        <div style="margin-top:8px;"><span class="chip ${c.pos ? "pos" : ""}" style="height:22px;font-size:10.5px;">${c.chip}</span></div></div></button>`).join("")}</div></div>`;
  };
  draw();
  page.onclick = (e) => {
    const t = e.target.closest("[data-c]");
    if (!t) return;
    const k = t.dataset.c;
    const refresh = async () => { await load(); draw(); };
    if (k.startsWith("d:")) openDungeon(k.slice(2), refresh);
    else if (k === "boss") openDailyBoss(refresh);
    else if (k === "rank") openRanking();
    else if (k === "pvp") go("pvp");
  };
  return () => { page.onclick = null; };
}

function dungeonTeam(raw) {
  const t = raw && raw.team?.some(Boolean) ? raw : { team: S.me.farm.team, formation: S.me.farm.formation };
  return t;
}

// ---------------------------------------------------------------- 던전
export async function openDungeon(type, onDone) {
  const m = openModal(`<div class="spin"></div>`);
  let data, sel, busyFight = false;
  const load = async () => { data = await get(pp("/dungeons")); };
  await load();
  const ab = await get(pp("/abilities"));
  const draw = (res) => {
    const x = data.dungeons.find((q) => q.type === type);
    if (sel == null) sel = x.stage;
    const team = dungeonTeam(data.team);
    const weak = S.meta.dungeonWeakRole[type];
    const left = x.attemptsMax - x.attemptsUsed;
    const firstClear = sel >= x.maxStage && sel < x.maxStageCap;
    m.set(`<div class="row2" style="gap:12px;"><div class="well" style="width:46px;height:46px;display:flex;align-items:center;justify-content:center;">${type === "gold" ? COIN : type === "gem" ? GEM : ic("star", 20, "#a3e635")}</div>
        <div><div class="h1">${DNAME[type]}</div><div class="t3 small">스테이지가 오를수록 처치 보상이 기하급수로 커져요</div></div></div>
      <div class="notice mint">${ic("target", 13)} 이 던전 보스는 ${cls(weak, 12)}에게 약해요 — 피해 ×${S.meta.dungeonWeakRoleBonusMult}<div class="xs" style="margin-top:4px;opacity:.85;">${esc(x.tip.replace(/^💡\s*/, ""))}</div></div>
      <div class="scene" id="dsc" style="height:170px;background-image:url('${BG[type]}');"></div>
      <div class="well pad col" style="gap:8px;"><div class="sec"><span class="h3">던전 전용 팀 · ${team.team.filter((id) => S.heroById.get(id)?.class === weak).length}명이 ${S.meta.classes[weak].label}</span><button class="btn xs" data-team>${ic("users", 12)} 편성</button></div>${teamStrip(team.team, 36)}
        ${data.team ? "" : `<div class="t3 xs">던전 팀이 없으면 파밍 팀으로 싸워요</div>`}</div>
      <div class="notice">${ic("zap", 12)} 어빌리티 프리셋 ${ab.contentPresets?.[type] || ab.activePreset + 1}번 자동 적용</div>
      <div class="sec"><button class="ibtn" data-s="-1" ${sel <= 1 ? "disabled" : ""}>${ic("chevl", 16)}</button><div style="text-align:center;"><div class="num" style="font-size:24px;">STAGE ${sel}</div><div class="t3 xs">최고 ${x.maxStage} · 최대 ${x.maxStageCap}층</div></div><button class="ibtn" data-s="1" ${sel >= x.maxStage ? "disabled" : ""}>${ic("chev", 16)}</button></div>
      <div>${kv("승리 보상", `${DREW[type](sel === x.stage ? x.reward : Math.round(x.reward * Math.pow(1.11, sel - x.stage)))}${firstClear ? "" : " (재도전)"}`)}${kv("남은 도전", `${left} / ${x.attemptsMax}`)}${kv("장비", `${esc(S.meta.equipment.sets[type].name)} 세트 · 승리 시 ${pctTxt(dropAt(type, sel * 5))} (층이 높을수록 ↑)`)}${kv("처음 깨는 층", `<span class="mint">도전 횟수가 가득 다시 채워져요</span>`)}${kv("실패", "도전 횟수 소모 없음")}</div>
      ${res ? `<div class="notice ${res.win ? "mint" : "bad"}">${res.win ? `승리! ${DREW[type](res.reward)}${res.isFirstClear ? ` · 최초 클리어 — ${res.stage}층이 열리고 도전 횟수가 다시 채워졌어요` : ""}${res.levelUp?.levelsGained ? ` · 계정 Lv.${res.levelUp.level}!` : ""}` : "패배… 팀을 강화해서 다시 도전해 보세요 (횟수 소모 없음)"}</div>${dropNotice(res.drop)}` : ""}
      <button class="btn pri lg block" data-go ${left <= 0 ? "disabled" : ""}>${left <= 0 ? "오늘 도전 횟수를 모두 썼어요" : `${ic("sword", 17)} 도전하기`}</button>`);
    const sc = m.body.querySelector("#dsc");
    mountBattle(sc, { heroes: team.team.map((id) => (id ? { id, hp: 1 } : null)), foes: [{ id: "e", hp: 1, sprite: SPRITE["dungeon_" + type], size: 90 }], formation: S.meta.formations[team.formation], heroSize: 44 });
  };
  m.body.onclick = (e) => {
    const t = e.target.closest("button");
    if (!t || busyFight) return;
    if (t.dataset.s) { sel += Number(t.dataset.s); draw(); }
    else if (t.dataset.team !== undefined) {
      const cur = dungeonTeam(data.team);
      openTeamPicker({ title: "던전 · 일일보스 팀", sub: "던전 3종과 일일보스에서 함께 써요.", ids: cur.team, formation: cur.formation, onSave: async (ids, formation) => { const r = await post(pp("/dungeons/team"), { characterIds: ids, formation }); data.team = r.team; draw(); toast("던전 팀을 저장했어요."); } });
    } else if (t.dataset.go !== undefined) {
      busyFight = true;
      busy(t, async () => {
        const r = await post(pp(`/dungeons/${type}/challenge`), { stage: sel });
        const sc = m.body.querySelector("#dsc");
        const units = mountBattle(sc, { heroes: r.team.map((h) => ({ ...h })), foes: [{ id: r.enemy.characterId, hp: r.enemy.hp, sprite: SPRITE["dungeon_" + type], size: 90 }], formation: S.meta.formations[dungeonTeam(data.team).formation], heroSize: 44 });
        const p = playHits(sc, units, r.hits, { endedAt: r.endedAt, speed: 2 });
        await p.done;
        await Promise.all([load(), refreshMe()]);
        sel = r.win ? r.stage : sel;
        draw(r);
        onDone && onDone();
      }).finally(() => { busyFight = false; });
    }
  };
  draw();
}

// ---------------------------------------------------------------- 일일보스
export async function openDailyBoss(onDone) {
  const m = openModal(`<div class="spin"></div>`);
  let b = await get(pp("/daily-boss"));
  const [ab, dg] = await Promise.all([get(pp("/abilities")), get(pp("/dungeons"))]);
  let fighting = false;
  const draw = (res) => {
    const skill = S.meta.dailyBossSkills[b.dayIndex % 7];
    const left = b.attemptsMax - b.attemptsUsed;
    m.set(`<div class="h1">일일보스</div><div class="tip">체력이 아주 높은 보스에게 ${b.fightSeconds}초 동안 데미지를 넣는 레이스예요. 이길 필요 없이 넣은 만큼 바로 보상을 받아요.</div>
      <div class="scene" id="bsc" style="height:170px;background-image:url('${BG.daily}');">
        <div class="hud glass" style="left:12px;top:12px;padding:8px 12px;"><div class="h3">오늘의 보스</div><div class="t2 xs">오늘의 스킬 · ${esc(skill?.name || "")}</div></div>
        <div class="hud glass num" id="btimer" style="right:12px;top:12px;padding:6px 10px;">${b.fightSeconds}.0s</div></div>
      <div class="h3">요일별 보스 스킬</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;">${DAYS.map((dd, i) => `<div class="well" style="padding:8px 2px;text-align:center;${i === b.dayIndex ? "outline:1px solid rgba(251,113,133,.6);background:rgba(251,113,133,.08);" : ""}"><div class="t3 xs">${dd}</div><div style="font-size:10.5px;font-weight:700;margin-top:2px;word-break:keep-all;">${esc(S.meta.dailyBossSkills[i]?.name || "")}</div></div>`).join("")}</div>
      <div>${kv("남은 도전", `${left} / ${b.attemptsMax}`)}${kv("오늘 누적 데미지", comma(b.damageToday))}${kv("역대 최고 데미지", comma(b.bestDamage))}${kv("장비", `토벌대 세트 · 도전마다 ${pctTxt(dropAt("dailyBoss", S.me.farm.maxStage))} (최고 스테이지가 높을수록 ↑)`)}${kv("초기화", "매일 오전 9시")}</div>
      <div class="notice">${ic("zap", 12)} 어빌리티 프리셋 ${ab.contentPresets?.dailyBoss || ab.activePreset + 1}번 자동 적용 · 팀은 던전 팀(없으면 파밍 팀)</div>
      ${res ? `<div class="notice mint">데미지 <b>${comma(res.damageDealt)}</b>${res.newBest ? " · 최고 기록 갱신!" : ""} · 보상 ${COIN} ${fmt(res.reward.gold)} + ${GEM} ${comma(res.reward.gems)}</div>${dropNotice(res.drop)}` : ""}
      <button class="btn pri lg block" data-go ${left <= 0 ? "disabled" : ""}>${left <= 0 ? "오늘 도전을 모두 마쳤어요" : `${ic("clock", 17)} ${b.fightSeconds}초 도전`}</button>`);
    const sc = m.body.querySelector("#bsc");
    const t = dungeonTeam(dg.team);
    mountBattle(sc, { heroes: (t.team || []).map((id) => (id ? { id, hp: 1 } : null)), foes: [{ id: "b", hp: 1, sprite: SPRITE.daily, size: 140 }], formation: S.meta.formations[t.formation], heroSize: 44 });
  };
  m.body.onclick = (e) => {
    const t = e.target.closest("[data-go]");
    if (!t || fighting) return;
    fighting = true;
    busy(t, async () => {
      const r = await post(pp("/daily-boss/challenge"));
      const sc = m.body.querySelector("#bsc");
      const units = mountBattle(sc, { heroes: r.team.map((h) => ({ ...h })), foes: [{ id: r.enemy.characterId, hp: r.enemy.hp, sprite: SPRITE.daily, size: 140 }], heroSize: 44 });
      const p = playHits(sc, units, r.hits, { endedAt: r.endedAt, speed: 2, onTick: (tt, total) => { const n = m.body.querySelector("#btimer"); if (n) n.textContent = Math.max(0, total - tt).toFixed(1) + "s"; } });
      await p.done;
      b = await get(pp("/daily-boss"));
      await refreshMe();
      draw(r);
      onDone && onDone();
    }).finally(() => { fighting = false; });
  };
  draw();
}

// ---------------------------------------------------------------- 랭킹
export async function openRanking() {
  const m = openModal(`<div class="spin"></div>`);
  let type = "stage";
  const unit = { stage: (v) => `${comma(v)}층`, level: (v) => `Lv.${comma(v)}`, boss: (v) => fmt(v), pvp: (v) => comma(v) };
  const draw = async () => {
    const r = await get(`/api/rankings?type=${type}&playerId=${S.playerId}`);
    const top3 = [r.top[1], r.top[0], r.top[2]];
    const podH = [100, 130, 80];
    const meIn = r.top.some((x) => x.playerId === S.playerId);
    m.set(`<div class="h1">랭킹</div>
      <div class="seg full">${Object.entries(S.meta.rankingTypes).map(([k, v]) => `<button data-rt="${k}" class="${k === type ? "on" : ""}">${{ stage: "스테이지", level: "레벨", boss: "일일보스", pvp: "PvP" }[k]}</button>`).join("")}</div>
      <div style="display:flex;gap:10px;align-items:flex-end;">${top3.map((p, i) => p ? `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;">
          <div class="av" style="width:48px;height:48px;">${ic("users", 20)}</div><div class="ell small" style="font-weight:700;max-width:100%;">${esc(p.nickname)}</div>
          <div class="card" style="width:100%;height:${podH[i]}px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(180deg,${["rgba(200,210,230,.25)", "rgba(250,204,21,.3)", "rgba(205,127,50,.25)"][i]},var(--s1));--cut:10px;">
          <span class="num" style="font-size:22px;">${p.rank}</span><span class="t2 xs">${unit[type](p.value)}</span></div></div>` : `<div style="flex:1;"></div>`).join("")}</div>
      <div style="max-height:40vh;overflow-y:auto;">${r.top.slice(3).map((p) => row(p, p.playerId === S.playerId)).join("")}${!meIn && r.me ? row(r.me, true) : ""}</div>
      <div class="t3 xs">${esc(r.label)} 기준 상위 ${r.top.length}명</div>`);
    function row(p, me) { return `<div class="rowkv" style="${me ? "background:rgba(34,197,94,.12);padding-left:10px;padding-right:10px;" : ""}"><span><b class="num" style="display:inline-block;width:34px;">${p.rank}</b>${esc(p.nickname)}${me ? ` <span class="chip pos" style="height:20px;font-size:10px;">나</span>` : ""}</span><b>${unit[type](p.value)}</b></div>`; }
  };
  m.body.onclick = (e) => { const t = e.target.closest("[data-rt]"); if (t) { type = t.dataset.rt; draw(); } };
  try { await draw(); } catch (e) { m.set(`<div class="notice bad">${esc(e.message)}</div>`); }
}
export { art, portrait, bar, damageTable };
