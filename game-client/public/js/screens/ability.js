// 어빌리티 — 계정 레벨 보너스, 3줄 재설정·고정, 프리셋 3개, 콘텐츠별 자동 적용
import { S, get, post, pp, refreshMe } from "../api.js";
import { ic, COIN, fmt, comma, esc, bar, kv, toast, busy } from "../ui.js";
import { setTitle } from "../main.js";

export const abilityLineText = (l) => {
  const e = S.meta.abilityEffects[l.key] || { label: l.key, unit: "%" };
  return `${esc(e.icon || "")} ${esc(e.label)} +${l.value}${e.unit || "%"}`;
};
const gradeChip = (g) => `<span class="badge" style="--c:${S.meta.abilityGradeColor[g]};color:#fff;">${esc(S.meta.abilityGradeLabel[g])}</span>`;

export async function render(page) {
  let a;
  const load = async () => { a = await get(pp("/abilities")); };
  await load();
  const draw = () => {
    const me = S.me;
    setTitle("어빌리티", "계정 레벨에 따라 열리는 영구 팀 버프");
    const act = a.activePreset;
    const lines = a.presets[act].lines, locked = a.presets[act].lockedIndices;
    const slots = [0, 1, 2].map((i) => {
      const open = i < a.unlockedSlots;
      const l = lines[i];
      if (!open) return `<div class="well pad row2" style="gap:12px;opacity:.55;">${ic("lock", 18)}<div><b>${i + 1}번째 줄</b><div class="t3 xs">계정 Lv.${a.slotUnlockLevels[i]}에 열려요</div></div></div>`;
      const isLocked = locked.includes(i);
      return `<div class="well pad row2" style="gap:12px;${isLocked ? "outline:1px solid rgba(250,204,21,.45);" : ""}">
        <div style="width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:var(--p-soft);color:var(--mint);flex:0 0 auto;">${ic("zap", 18)}</div>
        <div class="grow">${l ? `<div class="row2" style="gap:6px;">${gradeChip(l.grade)}<span class="t3 xs">${i + 1}번째 줄 · Lv.${a.slotUnlockLevels[i]} 개방</span></div><div style="font-weight:700;margin-top:4px;">${abilityLineText(l)}</div>` : `<div class="t3 small">아직 비어 있어요 — 재설정하면 효과가 생겨요</div>`}</div>
        <button class="btn sm ${isLocked ? "gold" : ""}" data-lock="${i}">${ic("lock", 13)} ${isLocked ? "고정됨" : "고정"}</button></div>`;
    }).join("");
    const probs = Object.fromEntries((a.gradeProbabilities || []).map((p) => [p.grade, p.pct]));
    page.innerHTML = `<div class="grid-main">
      <div class="col" style="gap:16px;min-width:0;">
        <div class="card pad col"><div class="sec"><div><div class="t3 xs">계정 레벨</div><div class="num" style="font-size:24px;">Lv.${me.level}</div></div><div style="text-align:right;"><div class="t3 xs">레벨업 팀 공격력 보너스</div><div class="num mint" style="font-size:22px;">+${me.levelAtkBonusPct}%</div></div></div>
          ${bar((me.exp / me.expToNext) * 100, "xp", 8)}<div class="t3 xs">${comma(me.exp)} / ${comma(me.expToNext)} · 레벨당 +0.6%p, 최대 +60% · 레벨업마다 다이아 300</div></div>
        <div class="sec"><span class="h2">활성 프리셋 ${act + 1} · 어빌리티 줄</span><span class="t3 xs">고정한 줄은 재설정해도 그대로 남아요</span></div>
        <div class="col" style="gap:10px;">${slots}</div>
        <div class="card pad col"><div><div class="h3">콘텐츠별 어빌리티 프리셋</div><div class="t3 xs">도전하는 순간 자동 전환, 끝나면 원래 프리셋으로 돌아와요</div></div>
          <div>${a.contentKeys.map((k) => `<div class="rowkv"><span class="small">${esc(a.contentLabels[k])}</span><div class="seg sm">${[1, 2, 3, 0].map((n) => `<button data-cp="${k}:${n}" class="${(a.contentPresets[k] || 0) === n ? "on" : ""}">${n || "끔"}</button>`).join("")}</div></div>`).join("")}</div></div>
      </div>
      <div class="col" style="gap:16px;">
        <div class="card pad col"><div class="h3">재설정</div><div class="tip">골드를 내고 고정 안 한 줄을 한 번에 다시 굴려요. 등급 확률은 계정 레벨에 따라 올라가요.</div>
          <div class="g2" style="grid-template-columns:repeat(4,1fr);gap:6px;">${S.meta.abilityGrades.map((g) => `<div class="well" style="padding:8px 4px;text-align:center;"><div class="xs" style="color:${S.meta.abilityGradeColor[g]};font-weight:700;">${esc(S.meta.abilityGradeLabel[g])}</div><div style="font-weight:700;margin-top:3px;">${probs[g] != null ? Math.round(probs[g] * 10) / 10 : "-"}%</div></div>`).join("")}</div>
          <button class="btn pri lg block" data-reroll ${a.unlockedSlots ? "" : "disabled"}>${ic("dice", 17)} 재설정 · ${COIN} ${fmt(a.rerollCost)}</button>
          <div class="t3 xs" style="text-align:center;">${a.unlockedSlots ? `기본 ${fmt(50000)} × 고정한 줄 1개당 ×1.6` : "계정 Lv.10부터 열려요"}</div></div>
        <div class="card pad col"><div><div class="h3">프리셋</div><div class="t3 xs">슬롯 3개가 각자 따로 재설정돼요. 전환은 무료 · 즉시</div></div>
          ${a.presets.map((p, i) => `<div class="well" style="padding:10px 12px;display:flex;align-items:center;gap:10px;${i === act ? "outline:1px solid rgba(163,230,53,.5);" : ""}"><b class="small" style="flex:0 0 auto;">프리셋 ${i + 1}</b>
            <span class="t3 xs grow ell">${p.lines.length ? p.lines.map((l) => esc(S.meta.abilityGradeLabel[l.grade])).join(" · ") : "비어 있음"}</span>
            <button class="btn xs ${i === act ? "pri" : ""}" data-use="${i}" ${i === act ? "disabled" : ""}>${i === act ? "사용 중" : "사용"}</button></div>`).join("")}</div>
      </div></div>`;
  };
  draw();
  page.onclick = (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.lock) busy(t, async () => { await post(pp("/abilities/lock"), { slotIndex: Number(t.dataset.lock) }); await load(); draw(); });
    else if (t.dataset.reroll !== undefined) busy(t, async () => { await post(pp("/abilities/reroll")); await Promise.all([load(), refreshMe()]); draw(); toast("재설정 완료!"); });
    else if (t.dataset.use) busy(t, async () => { await post(pp(`/abilities/presets/${t.dataset.use}/activate`)); await load(); draw(); toast(`프리셋 ${Number(t.dataset.use) + 1} 사용`); });
    else if (t.dataset.cp) { const [k, n] = t.dataset.cp.split(":"); busy(t, async () => { const r = await post(pp("/abilities/content-presets"), { contentKey: k, preset: Number(n) }); a.contentPresets = r.contentPresets; draw(); }); }
  };
  const h = () => draw();
  document.addEventListener("me", h);
  return () => { page.onclick = null; document.removeEventListener("me", h); };
}
export { kv };
