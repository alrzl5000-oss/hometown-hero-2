// 앱 셸 — 레일(데스크톱) / 상단바 / 탭바(모바일) + 해시 라우터
import { S, loadMeta, refreshMe, refreshHeroes, clearSession, flag } from "./api.js";
import { ic, COIN, GEM, STONE, fmt, esc, art, $, toast, closeAllModals } from "./ui.js";

const NAV = [
  ["farm", "sword", "전투"], ["odyssey", "map", "오디세이"], ["gacha", "spark", "소환"],
  ["heroes", "users", "영웅"], ["contents", "trophy", "콘텐츠"], ["ability", "zap", "어빌리티"],
];
const NAV_OF = { pvp: "contents", boss: "farm", equipment: "heroes" };
const SCREENS = {
  login: () => import("./screens/login.js"),
  farm: () => import("./screens/farm.js"),
  boss: () => import("./screens/boss.js"),
  odyssey: () => import("./screens/odyssey.js"),
  gacha: () => import("./screens/gacha.js"),
  heroes: () => import("./screens/heroes.js"),
  equipment: () => import("./screens/heroes.js"),
  contents: () => import("./screens/contents.js"),
  pvp: () => import("./screens/pvp.js"),
  ability: () => import("./screens/ability.js"),
};

let cleanup = null;
let title = ["", ""];
export function setTitle(t, sub = "") { title = [t, sub]; drawTop(); }
export const go = (route) => { location.hash = "#/" + route; };

function avatarHero() {
  const ids = S.me?.farm?.team || [];
  const h = S.heroById.get(ids[0]) || [...(S.heroes || [])].sort((a, b) => b.dps - a.dps)[0];
  return h ? art(h.characterId, h.originRarity) : null;
}
function expPct() { return S.me ? Math.min(100, Math.round((S.me.exp / Math.max(1, S.me.expToNext)) * 100)) : 0; }
const nickOf = () => esc(S.me?.nickname || "이름없는 영웅");

function drawRail(active) {
  const a = avatarHero();
  $("#rail").innerHTML = `
    <div class="me" data-open="settings" title="설정" style="background:conic-gradient(#22c55e 0 ${expPct()}%,rgba(255,255,255,.1) ${expPct()}% 100%);">
      <div class="inner">${a ? `<img src="${a}" alt="">` : ""}</div><span class="num lvtag">${S.me?.level || 1}</span></div>
    <div class="nick">${nickOf()}</div>
    ${NAV.map(([k, i, l]) => `<a href="#/${k}" class="nav-a ${k === active ? "on" : ""}">${ic(i, 22)}<span>${l}</span></a>`).join("")}`;
  $("#tabbar").innerHTML = NAV.map(([k, i, l]) => `<a href="#/${k}" class="${k === active ? "on" : ""}">${ic(i, 21)}<span>${l}</span></a>`).join("");
}
function curChips(cls = "chip cchip") {
  const c = S.me?.currency || {};
  return `<span class="${cls}" title="골드">${COIN} ${fmt(c.gold)}</span><span class="${cls}" title="다이아">${GEM} ${fmt(c.dia)}</span><span class="${cls}" title="승급석">${STONE} ${fmt(c.stone)}</span>`;
}
function drawTop() {
  if (!S.me) return;
  $("#top").innerHTML = `<div><div class="h1">${esc(title[0])}</div>${title[1] ? `<div class="t3" style="font-size:12px;margin-top:2px;">${esc(title[1])}</div>` : ""}</div>
    <div class="cur">${curChips()}<span class="vsep"></span>
      <button class="ibtn" data-open="welcome" aria-label="도움말">${ic("help")}</button><button class="ibtn" data-open="settings" aria-label="설정">${ic("gear")}</button></div>`;
  const a = avatarHero();
  $("#topm").innerHTML = `<div class="sec"><div class="row2" style="gap:9px;" data-open="settings">
      <div style="position:relative;width:36px;height:36px;border-radius:50%;padding:2px;background:conic-gradient(#22c55e 0 ${expPct()}%,rgba(255,255,255,.1) ${expPct()}% 100%);"><div class="av" style="width:100%;height:100%;">${a ? `<img src="${a}" alt="">` : ""}</div></div>
      <div><div style="font-size:13px;font-weight:700;">${nickOf()}</div><div class="t3" style="font-size:10.5px;">Lv.${S.me.level} · 경험치 ${expPct()}%</div></div></div>
    <div class="row2" style="gap:6px;"><button class="ibtn" style="width:34px;height:34px;" data-open="welcome" aria-label="도움말">${ic("help", 17)}</button><button class="ibtn" style="width:34px;height:34px;" data-open="settings" aria-label="설정">${ic("gear", 17)}</button></div></div>
    <div class="row2" style="gap:6px;margin-top:9px;flex-wrap:wrap;">${curChips("chip")}</div>
    ${title[0] ? `<div class="h2" style="margin-top:10px;">${esc(title[0])}</div>` : ""}`;
}
document.addEventListener("me", () => { drawTop(); drawRail(currentNav); });
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-open]");
  if (!t) return;
  const what = t.dataset.open;
  const mod = await import("./screens/misc.js");
  if (what === "settings") mod.openSettings();
  if (what === "welcome") mod.openWelcome();
  if (what === "patch") mod.openPatchNotes();
});

let currentNav = "farm";
let routing = 0;
async function route() {
  const my = ++routing;
  const [name, ...args] = (location.hash.replace(/^#\/?/, "") || "farm").split("/");
  const key = SCREENS[name] ? name : "farm";
  if (cleanup) { try { cleanup(); } catch { /* 무시 */ } cleanup = null; }
  closeAllModals();
  const page = $("#page");
  const shell = key !== "login";
  document.body.classList.toggle("noshell", !shell);
  for (const id of ["rail", "top", "topm", "tabbar"]) $("#" + id).style.display = shell ? "" : "none";
  if (shell && !S.playerId) { go("login"); return; }
  page.innerHTML = `<div style="display:flex;justify-content:center;padding:60px;"><div class="spin"></div></div>`;
  try {
    await loadMeta();
    if (shell && (!S.me || !S.heroes)) await Promise.all([refreshMe(), refreshHeroes()]);
  } catch (e) {
    if (/플레이어 없음/.test(e.message)) { clearSession(); go("login"); return; }
    page.innerHTML = `<div class="notice bad">서버에 연결하지 못했어요: ${esc(e.message)}</div>`;
    return;
  }
  if (my !== routing) return;
  currentNav = NAV_OF[key] || key;
  if (shell) { drawRail(currentNav); drawTop(); }
  page.style.padding = shell ? "" : "0";
  page.classList.toggle("page", shell);
  window.scrollTo(0, 0);
  try {
    const mod = await SCREENS[key]();
    if (my !== routing) return;
    cleanup = (await mod.render(page, { args, key })) || null;
  } catch (e) {
    console.error(e);
    page.innerHTML = `<div class="notice bad">화면을 불러오지 못했어요: ${esc(e.message)}</div>`;
  }
  if (shell && !flag("welcomed")) { flag("welcomed", "1"); (await import("./screens/misc.js")).openWelcome(); }
}
window.addEventListener("hashchange", route);
route();

export function reloadAfterLogin() { S.me = null; S.heroes = null; go("farm"); }
export { toast };
