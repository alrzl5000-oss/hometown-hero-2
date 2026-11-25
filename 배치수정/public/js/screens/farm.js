// 전투(파밍 방치) — 스테이지 장면, 내 파밍 팀, 스테이지 이동, 층보스, 출현 몬스터, 콘텐츠별 어빌리티 프리셋
import { S, get, post, pp, refreshMe } from "../api.js";
import { ic, COIN, GEM, fmt, comma, esc, el, elName, cls, badge, portrait, bar, kv, toast, busy, secs, openModal, ROW_LABEL } from "../ui.js";
import { setTitle, go } from "../main.js";
import { idleFarm, floatText, tierBg, SPRITE } from "../battle.js";
import { openTeamPicker, synergyOf, deltaText, rowsOf } from "../team.js";
import { dropToast, dropAt, pctTxt } from "./heroes.js";

const BEATS = { fire: "wind", wind: "water", water: "fire" };
export const matchup = (heroEl, foeEl) => (BEATS[heroEl] === foeEl ? 1.25 : BEATS[foeEl] === heroEl ? 0.85 : 1);

export async function render(page) {
  let farm, ab, scene = null, idle = null, poll = null, alive = true;
  const recent = [];
  let firstGain = null;

  async function load() {
    [farm, ab] = await Promise.all([get(pp("/farm")), get(pp("/abilities"))]);
    if (!firstGain && farm.gained) { firstGain = farm.gained; if (farm.gained.drops?.length) dropToast({ items: farm.gained.drops, autoHandled: farm.gained.autoHandled }); }
    else if (farm.gained && farm.gained.elapsedSeconds < 120) recent.push({ t: Date.now(), ...farm.gained });
  }
  await load();

  const teamHeroes = () => (farm.farmTeam || []).map((id) => S.heroById.get(id)).filter(Boolean);
  const tierName = (st) => S.meta.stageTiers[Math.min(9, Math.floor((st - 1) / 10))];

  function draw() {
    const st = farm.stage, max = farm.maxStage, info = farm.stageInfo;
    setTitle("전투", `스테이지 ${st} · ${tierName(st)}`);
    const team = teamHeroes();
    const rows = rowsOf(5, farm.farmFormation);
    const teamDps = team.reduce((s, h) => s + h.dps, 0);
    const boss = info.boss;
    const bossSp = S.meta.bossSpecies.find((b) => b.key === boss.speciesKey) || {};
    const good = team.filter((h) => matchup(h.element, bossSp.element) > 1).length;
    const bad = team.filter((h) => matchup(h.element, bossSp.element) < 1).length;
    const avgHp = info.fieldSpecies.reduce((s, f) => s + f.hp * f.weight, 0);
    const avgAtk = info.fieldSpecies.reduce((s, f) => s + f.atk * f.weight, 0);
    const avgDef = info.fieldSpecies.reduce((s, f) => s + f.def * f.weight, 0);
    const killSec = teamDps ? Math.max(1.5, avgHp / teamDps) : null;
    const syn = synergyOf(farm.farmFormation ? farm.farmTeam : []).filter((s) => s.tier);
    const now = Date.now();
    const win = recent.filter((r) => now - r.t <= 60000);
    const sum = (k) => win.reduce((s, r) => s + (r[k] || 0), 0);
    const presets = ab.contentPresets || {};

    const lo = Math.max(1, Math.min(st - 5, max - 12)), hi = Math.max(lo + 14, st + 8);
    let blades = "";
    for (let n = lo; n <= hi; n++) {
      if (n % 10 === 1) blades += `<div class="blade ch" style="background-image:linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),url('${tierBg(n)}');" title="${tierName(n)}"><b class="num" style="font-size:12px;">${n}</b>${tierName(n)}</div>`;
      blades += `<button class="blade ${n === st ? "cur" : ""} ${n > max ? "locked" : ""}" data-stage="${n}" ${n > max ? "disabled" : ""}>${n}</button>`;
    }

    page.innerHTML = `<div class="grid-main">
    <div class="col" style="gap:16px;min-width:0;">
      <div class="scene" id="scene" style="height:clamp(240px,34vw,360px);background-image:url('${tierBg(st)}');">
        <div class="hud glass" style="left:14px;top:14px;padding:8px 12px;"><div class="row2"><span class="num" style="font-size:20px;">STAGE ${st}</span><span class="t2 small">${esc(tierName(st))} · 파밍 중</span></div><div class="t3 xs" style="margin-top:3px;">최고 기록 ${max}층 · 잡몹 ${info.fieldSpecies.length}종 혼합 출현</div></div>
        <div class="hud glass" style="right:14px;top:14px;padding:8px 12px;text-align:right;"><div class="t3 xs">누적 처치</div><div><span class="num" id="kills" style="font-size:22px;">${comma(farm.totalKills)}</span> <span class="t2 small">마리</span></div></div>
        <button class="hud chip" data-buffs style="right:14px;bottom:14px;background:rgba(6,16,13,.7);color:var(--t1);">${ic("spark", 13)} 받는 버프 보기</button>
        ${team.length < 1 ? `<div class="hud" style="inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,16,13,.55);"><div class="glass" style="padding:18px 22px;text-align:center;"><div class="h3">파밍 팀이 아직 없어요</div><div class="t2 small" style="margin:6px 0 12px;">영웅을 1명 이상 편성하면 자동으로 사냥을 시작해요.</div><button class="btn pri" data-edit>${ic("users", 15)} 팀 편성</button></div></div>` : ""}
      </div>
      <div class="notice">${ic("gift", 13)} 지금 스테이지 잡몹 1마리당 골드 ${fmt(info.fieldSpecies[0].goldPerKill)}~ · 경험치 ${fmt(info.fieldSpecies[0].expPerKill)}~ · 다이아는 처치당 20% 확률 · <b>개척자 세트 장비</b>는 1마리당 ${pctTxt(dropAt("field", st))} (스테이지가 높을수록 ↑).</div>

      <div class="card pad col">
        <div class="sec"><div><div class="h2">내 파밍 팀</div><div class="t3 small">${team.length}명 · 팀 예상 DPS <span class="mint">${comma(teamDps)}</span></div></div>
          <div class="row2"><button class="btn sm" data-edit>${ic("users", 14)} 팀 편성</button><button class="btn sm pri" data-boss ${team.length < 1 ? "disabled" : ""}>${ic("crown", 14)} 보스전</button></div></div>
        <div class="g5">${[0, 1, 2, 3, 4].map((i) => {
          const h = team[i];
          if (!h) return `<button class="well slot" data-edit style="min-height:150px;border:none;cursor:pointer;">${ic("plus", 18)}</button>`;
          return `<div class="well" style="padding:8px;display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center;min-width:0;cursor:pointer;" data-hero="${h.characterId}">
            <div class="sec" style="width:100%;">${badge(h.rarity, h.exStar)}<span class="t3 xs">${ROW_LABEL[rows[i]]}</span></div>
            ${portrait(h.characterId, h.originRarity, h.rarity, 52)}
            <div class="ell" style="font-weight:700;font-size:12px;max-width:100%;">${esc(h.name)}</div>
            <div class="t3 xs hide-m">${cls(h.class, 10)} ${el(h.element, 10, true)} Lv.${h.level}</div>
            <div style="width:100%;" class="hide-m">${bar(100, "hp", 4)}<div style="height:3px"></div>${bar(60, "mp", 3)}</div>
            <div class="t3 xs hide-m">공 ${fmt(h.stats.atk)} · 체 ${fmt(h.stats.hp)} · 방 ${fmt(h.stats.def)}</div>
            <div class="gold xs" style="font-weight:700;">DPS ${fmt(h.dps)}</div></div>`;
        }).join("")}</div>
        <div class="sec" style="flex-wrap:wrap;">
          <div class="row2"><span class="t3 small">진형</span><div class="seg sm">${Object.entries(S.meta.formations).map(([k, f]) => `<button data-form="${k}" class="${k === farm.farmFormation ? "on" : ""}">${f.label} ${f.front}-${f.mid}-${f.back}</button>`).join("")}</div></div>
          <div class="row2"><span class="t3 small">배치 프리셋</span><div class="seg sm" id="fpre">${[0, 1, 2].map((i) => `<button data-fp="${i}">${i + 1}</button>`).join("")}</div></div>
        </div>
        <div class="row2" style="flex-wrap:wrap;gap:6px;">
          ${syn.map((s) => `<span class="chip pos">${ic("layers", 12)} ${esc(s.set.name)} ${s.matched.length}명 · ${deltaText(s.tier.delta)}</span>`).join("")}
          <span class="chip">${ic("doc", 12)} 도감 ${S.me.ownedCount}/${S.me.rosterCount}</span>
          <span class="chip">${ic("zap", 12)} 어빌리티 프리셋 ${presets.farm ? presets.farm : (ab.activePreset + 1)}</span>
          <button class="chip on" data-growth>성장 보너스 전체 보기 ${ic("chev", 12)}</button>
        </div>
        <div class="row2" style="flex-wrap:wrap;gap:8px;"><span class="t3 small">펫</span>
          ${(S.me.petSlots || []).map((id) => { const p = S.meta.pets.pets.find((x) => x.id === id); return p ? `<a href="#/pets" class="chip" style="height:34px;color:var(--t1);"><img class="sp" src="/assets/pets/${p.look}.png" alt="" style="width:24px;height:24px;">${esc(p.name)}</a>` : ""; }).join("")}
          ${(S.me.petSlots || []).length < 2 ? `<a href="#/pets" class="chip">${ic("plus", 12)} 펫 장착 (최대 2마리)</a>` : ""}
        </div>
      </div>

      <div class="card pad col">
        <div class="sec" style="flex-wrap:wrap;"><div><div class="h2">스테이지 이동</div><div class="t3 small">1~${max}층은 눌러서 바로 이동 · ${max + 1}층부터는 층보스 승리로 열려요</div></div>
          <div class="row2"><button class="btn sm" data-mv="${st - 1}" ${st <= 1 ? "disabled" : ""}>${ic("chevl", 14)} 이전 층</button><button class="btn sm" data-mv="${st + 1}" ${st + 1 > max ? "disabled" : ""}>다음 층 ${ic("chev", 14)}</button><button class="btn sm" data-mv="${max}" ${st === max ? "disabled" : ""}>${ic("up", 14)} 최고 층으로</button></div></div>
        <div class="well blades" id="blades">${blades}</div>
        <div class="sec t3 small"><span>${ic("flame", 12)} ${Math.floor((st - 1) / 10) * 10 + 1}–${Math.floor((st - 1) / 10) * 10 + 10} ${esc(tierName(st))}</span><span>${Math.floor((st - 1) / 10) * 10 + 11}–${Math.floor((st - 1) / 10) * 10 + 20} ${esc(tierName(st + 10))} ${ic("chev", 12)}</span></div>
        <div>${kv("구간", `${Math.floor((st - 1) / 10) * 10 + 1}–${Math.floor((st - 1) / 10) * 10 + 10}층 · ${esc(tierName(st))}`)}${kv("잡몹 속성", "없음 — 파밍은 예측 가능하게")}${kv("잡몹 평균 체력 · 공격 · 방어", `${comma(avgHp)} · ${comma(avgAtk)} · ${comma(avgDef)}`)}
          ${kv("내 팀 예상 DPS", `<span class="mint">${comma(teamDps)}</span>`)}${kv("평균 처치 시간", killSec ? `${killSec.toFixed(1)}초 / 마리` : "-")}
          ${kv("층보스", `<span style="color:var(--sky)">${esc(bossSp.name || boss.name)} · ${elName(bossSp.element)}속성</span>`)}${kv("보스 체력 · 공격", `${comma(boss.hp)} · ${comma(boss.atk)}`)}</div>
      </div>
    </div>

    <div class="col" style="gap:16px;min-width:0;">
      <div class="card pad col">
        <div class="row2" style="gap:12px;"><div class="well" style="width:72px;height:72px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;"><img class="sp" src="${SPRITE[boss.speciesKey]}" alt="" style="width:62px;"></div>
          <div class="grow"><div class="t3 xs">${st}층 층보스 · 이기면 ${st + 1}층 열림</div><div class="h2">${esc(bossSp.name || "")} ${el(bossSp.element, 14, true)}</div></div></div>
        <div class="row2" style="flex-wrap:wrap;gap:6px;">
          <span class="chip pos">${el(Object.keys(BEATS).find((k) => BEATS[k] === bossSp.element), 12, true)} 영웅 피해 ×1.25</span>
          <span class="chip bad">${el(BEATS[bossSp.element], 12, true)} 영웅 ×0.85</span></div>
        <div class="t3 small">내 팀 상성: 유리 <b class="mint">${good}명</b> · 불리 <b class="red">${bad}명</b></div>
        <button class="btn pri lg block" data-boss ${team.length < 1 ? "disabled" : ""}>${ic("crown", 18)} 보스 도전</button>
      </div>
      <div class="card pad col">
        <div class="sec"><span class="h3">최근 1분 파밍 현황</span><button class="btn xs ghost" data-reset>${ic("refresh", 12)} 다시 측정</button></div>
        <div class="g2" style="gap:8px;">
          ${[["처치", `${comma(sum("kills"))}마리`], ["골드", comma(sum("gold"))], ["경험치", comma(sum("exp"))], ["다이아", comma(sum("gem"))]].map(([a, b]) => `<div class="well pad"><div class="t3 xs">${a}</div><div style="font-weight:700;font-size:15px;margin-top:2px;">${b}</div></div>`).join("")}
        </div>
        ${firstGain && firstGain.elapsedSeconds > 90 ? `<div class="notice mint">${ic("moon", 12)} 자리 비운 ${secs(firstGain.elapsedSeconds)} 동안 <b>+${fmt(firstGain.gold)} 골드 · ${comma(firstGain.kills)}마리 처치</b> (최대 8시간 적립)</div>` : ""}
      </div>
      <div class="card pad col">
        <div class="sec"><span class="h3">출현 몬스터</span><span class="t3 xs">속성 없음</span></div>
        ${info.fieldSpecies.map((f) => `<div class="row2" style="gap:10px;"><div class="well" style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;"><img class="sp" src="${SPRITE[f.key]}" alt="" style="width:26px;"></div><span class="grow small">${esc(f.name)}</span><div style="width:90px;">${bar(f.weight * 300, "hp", 5)}</div><span class="t2 xs" style="width:30px;text-align:right;">${Math.round(f.weight * 100)}%</span></div>`).join("")}
      </div>
      <div class="card pad col">
        <div><div class="h3">콘텐츠별 어빌리티 프리셋</div><div class="t3 xs">도전하는 순간 자동 전환, 끝나면 원래 프리셋으로 돌아와요</div></div>
        <div>${S.meta.contentKeys.map((k) => `<div class="rowkv"><span class="small">${esc(S.meta.contentLabels[k])}</span><div class="seg sm">${[1, 2, 3, 0].map((n) => `<button data-cp="${k}:${n}" class="${(presets[k] || 0) === n ? "on" : ""}">${n || "끔"}</button>`).join("")}</div></div>`).join("")}</div>
      </div>
    </div></div>`;

    page.querySelector(`#fpre [data-fp="${S.me.farmActivePreset ?? farm.activePreset ?? 0}"]`)?.classList.add("on");
    const cur = page.querySelector("#blades .cur"), bl = page.querySelector("#blades");
    if (cur && bl) bl.scrollLeft = cur.offsetLeft - bl.clientWidth / 2 + cur.clientWidth / 2;
    scene = page.querySelector("#scene");
    if (idle) idle.stop();
    if (team.length > 0) idle = idleFarm(scene, { heroes: team.map((h) => ({ id: h.characterId })), formation: S.meta.formations[farm.farmFormation], species: info.fieldSpecies, dps: Math.max(1, teamDps / team.length), pets: S.me.petSlots || [] });
  }

  async function presetsInfo() {
    try { const r = await get(pp("/farm/presets")); farm.activePreset = r.activePreset; farm.presets = r.presets; } catch { /* 무시 */ }
  }
  await presetsInfo();
  draw();
  page.querySelector(`#fpre [data-fp]`) && page.querySelectorAll("#fpre button").forEach((b) => b.classList.toggle("on", Number(b.dataset.fp) === (farm.activePreset || 0)));

  async function saveTeam(ids, formation) {
    await post(pp("/farm/team"), { characterIds: ids, formation });
    await post(pp(`/farm/presets/${farm.activePreset || 0}/save`), { characterIds: ids, formation });
    await Promise.all([load(), refreshMe()]);
    draw(); markPreset();
    toast("파밍 팀을 저장했어요.");
  }
  const markPreset = () => page.querySelectorAll("#fpre button").forEach((b) => b.classList.toggle("on", Number(b.dataset.fp) === (farm.activePreset || 0)));

  page.onclick = async (e) => {
    const t = e.target.closest("button,[data-hero]");
    if (!t) return;
    if (t.dataset.edit !== undefined) {
      openTeamPicker({ title: "팀 편성", sub: "파밍 · 층보스에 쓰는 팀이에요. 저장하면 지금 배치 프리셋에도 함께 저장돼요.", ids: farm.farmTeam, formation: farm.farmFormation, onSave: saveTeam });
    } else if (t.dataset.boss !== undefined) go("boss");
    else if (t.dataset.hero) (await import("./heroes.js")).openHeroDetail(t.dataset.hero);
    else if (t.dataset.growth !== undefined) (await import("./heroes.js")).openGrowth(farm.farmTeam);
    else if (t.dataset.buffs !== undefined) openBuffs("farm");
    else if (t.dataset.reset !== undefined) { recent.length = 0; firstGain = null; draw(); markPreset(); }
    else if (t.dataset.form) {
      if (teamHeroes().length < 1) return toast("먼저 팀을 편성해 주세요.", "err");
      busy(t, () => saveTeam(farm.farmTeam, t.dataset.form));
    } else if (t.dataset.fp) {
      busy(t, async () => {
        const r = await post(pp(`/farm/presets/${t.dataset.fp}/activate`));
        farm.activePreset = r.activePreset;
        await Promise.all([load(), refreshMe()]); draw(); markPreset();
        toast(r.farmTeam.length ? `배치 프리셋 ${Number(t.dataset.fp) + 1}로 바꿨어요.` : `프리셋 ${Number(t.dataset.fp) + 1}은 비어 있어요 — 팀 편성 후 저장하면 이 칸에 들어가요.`);
      });
    } else if (t.dataset.stage || t.dataset.mv) {
      const n = Number(t.dataset.stage || t.dataset.mv);
      busy(t, async () => { await post(pp("/farm/retreat"), { stage: n }); await Promise.all([load(), refreshMe()]); draw(); markPreset(); });
    } else if (t.dataset.cp) {
      const [k, n] = t.dataset.cp.split(":");
      busy(t, async () => { const r = await post(pp("/abilities/content-presets"), { contentKey: k, preset: Number(n) }); ab.contentPresets = r.contentPresets; draw(); markPreset(); });
    }
  };

  // 3초마다 정산(서버가 흐른 시간만큼 적립) → 획득 연출
  poll = setInterval(async () => {
    if (!alive || document.hidden) return;
    try {
      const r = await get(pp("/farm"));
      const g = r.gained;
      const stageChanged = r.stage !== farm.stage;
      farm = { ...farm, ...r };
      if (g) {
        recent.push({ t: Date.now(), ...g });
        while (recent.length && Date.now() - recent[0].t > 60000) recent.shift();
        if (scene && (g.gold || g.exp)) floatText(scene, 46, 30, `+${fmt(g.gold)} G · +${fmt(g.exp)} EXP`, "gain");
        if (scene && g.kills) floatText(scene, 70, 40, `+${g.kills} 처치`, "gain");
        const k = page.querySelector("#kills"); if (k) k.textContent = comma(r.totalKills);
        if (S.me) { S.me.currency = { ...S.me.currency, gold: r.currency.gold, dia: r.currency.dia }; S.me.level = r.level; S.me.exp = r.exp; }
        if (g.drops?.length || g.autoHandled) dropToast({ items: g.drops, autoHandled: g.autoHandled });
        if (g.levelsGained) { toast(`계정 레벨 업! Lv.${r.level} (+${g.accountGemsGained} 다이아)`); refreshMe(); }
        else document.dispatchEvent(new CustomEvent("me"));
      }
      if (stageChanged) { draw(); markPreset(); }
    } catch { /* 네트워크 일시 오류는 다음 주기에 */ }
  }, 3000);

  return () => { alive = false; clearInterval(poll); idle && idle.stop(); page.onclick = null; };
}

// 받는 버프(콘텐츠별) — 레벨·어빌리티·장비·도감·시너지
export async function openBuffs(content = "farm") {
  const m = openModal(`<div class="spin"></div>`, { size: "" });
  const draw = async (c) => {
    const b = await get(pp(`/buffs?content=${c}`));
    const t = b.total;
    const p = (x) => `+${Math.round((x - 1) * 1000) / 10}%`;
    m.set(`<div class="h1">받는 버프</div>
      <select class="inp" id="bc">${S.meta.contentKeys.map((k) => `<option value="${k}" ${k === c ? "selected" : ""}>${esc(S.meta.contentLabels[k])}</option>`).join("")}</select>
      <div class="notice mint">${ic("zap", 13)} 이 콘텐츠는 어빌리티 프리셋 ${b.abilityPreset}번이 적용돼요.</div>
      <div>${kv("계정 레벨 공격력", `+${b.levelAtkBonusPct}%`)}${kv("공격력 (레벨·어빌리티·장비)", p(t.atkMult))}${kv("체력·방어력", p(t.hpMult))}${kv("공격속도", p(t.spdMult))}${kv("치명타 확률", `+${Math.round(t.critAdd * 1000) / 10}%p`)}
      ${kv("스킬 피해", p(t.skillDmgMult))}${kv("골드 획득", p(t.goldMult))}${kv("다이아 획득", p(t.gemMult))}${kv("경험치 획득", p(t.expMult))}
      ${kv("도감 보너스", `공·체·방 +${Math.round(b.collection.deltas.atk * 100) / 100}%`)}${kv("배치 시너지", b.synergy.active.filter((s) => s.delta).map((s) => esc(s.name)).join(", ") || "없음")}
      ${kv("장착 장비", `${b.equippedItems.length}개`)}
      ${kv("펫 (장착 효과 + 펫 도감)", Object.entries(b.petSums || {}).filter(([, v]) => v).map(([k, v]) => `${esc(S.meta.pets.passiveLabel[k] || k)} +${Math.round(v * 10) / 10}%`).join(" · ") || "없음")}</div>`);
    m.body.querySelector("#bc").onchange = (e) => draw(e.target.value);
  };
  try { await draw(content); } catch (e) { m.set(`<div class="notice bad">${esc(e.message)}</div>`); }
}
export { COIN, GEM };
