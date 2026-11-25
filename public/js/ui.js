// 공용 UI 도구 — 아이콘, 숫자 표기, 초상화, 모달/시트, 토스트
const P = {
  sword: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  spark: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="M19 3v4M17 5h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 6"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chev: '<path d="m9 18 6-6-6-6"/>', chevl: '<path d="m15 18-6-6 6-6"/>', down: '<path d="m6 9 6 6 6-6"/>', up: '<path d="m18 15-6-6-6 6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  crown: '<path d="m2 7 5 5 5-7 5 7 5-5-2 12H4z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  ff: '<path d="m13 19 9-7-9-7zM2 19l9-7-9-7z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/><circle cx="8.5" cy="15.5" r="1"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  bag: '<path d="M6 7h12l1 14H5z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
  doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-7 6-7 12 0 4 2 7 5 7z"/>',
  drop: '<path d="M12 2s7 7.5 7 13a7 7 0 0 1-14 0c0-5.5 7-13 7-13z"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
  swap: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8S10 3 7.5 4.5 9 8 12 8zm0 0s2-5 4.5-3.5S15 8 12 8z"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  paw: '<circle cx="6.5" cy="9" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="14" cy="5.5" r="2"/><circle cx="17.5" cy="9" r="2"/><path d="M8 17c0-3 2-5.5 4-5.5s4 2.5 4 5.5c0 2-1.5 3-4 3s-4-1-4-3z"/>',
};
export const ic = (name, s = 18, c = "currentColor", w = 1.9) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
export const COIN = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#f5b33d"/><circle cx="8" cy="8" r="4.6" fill="none" stroke="#ffe08a" stroke-width="1.4"/></svg>';
export const GEM = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6 5.5 2.5h5L13 6l-5 7.5z" fill="#57c8ff"/><path d="M3 6h10M5.5 2.5 8 6l2.5-3.5M8 6v7.5" stroke="#b9ecff" stroke-width=".9" fill="none"/></svg>';
export const STONE = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 14 8l-6 6.5L2 8z" fill="#ff9a3d"/><path d="M8 4 11 8l-3 3.5L5 8z" fill="#ffd29a"/></svg>';

export const RARC = { N: "#9AA3B8", R: "#4F8FF7", SR: "#A66CF2", SSR: "#F5B83D", XR: "#FF5FB4", HR: "#FF5A5A", XXR: "#3FE0EE", EX: "#F7C35F" };
export const RANK = { N: 0, R: 1, SR: 2, SSR: 3, XR: 4, HR: 5, XXR: 6, EX: 7 };
const EL = { fire: ["flame", "#ff7a4d", "화"], water: ["drop", "#4fb4ff", "수"], wind: ["wind", "#4fe3a1", "풍"] };
const CLS_IC = { tanker: "shield", dealer: "sword", ranged: "target", assassin: "target", support: "spark" };
export const CLS_LABEL = { tanker: "탱커", dealer: "딜러", ranged: "원거리", assassin: "암살자", support: "서포터" };
export const ROW_LABEL = { front: "앞열", mid: "중열", back: "뒷열" };

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const comma = (n) => Math.round(Number(n) || 0).toLocaleString("ko-KR");
// 한국식 큰 수 — 473억 7,067만 / 5,837만 / 12,840
export function fmt(n) {
  n = Math.floor(Number(n) || 0);
  const neg = n < 0; n = Math.abs(n);
  let out;
  if (n >= 1e12) out = `${comma(Math.floor(n / 1e12))}조${n % 1e12 >= 1e8 ? " " + comma(Math.floor((n % 1e12) / 1e8)) + "억" : ""}`;
  else if (n >= 1e8) out = `${comma(Math.floor(n / 1e8))}억${n % 1e8 >= 1e4 ? " " + comma(Math.floor((n % 1e8) / 1e4)) + "만" : ""}`;
  else if (n >= 1e5) out = `${comma(Math.floor(n / 1e4))}만`;
  else out = comma(n);
  return (neg ? "-" : "") + out;
}
export const pct = (v, d = 1) => `${Math.round(v * 10 ** d) / 10 ** d}%`;
export const secs = (s) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m ? `${m}분 ${s % 60}초` : `${s}초`; };

export const art = (id, rarity) => `/art/${id}_${rarity}.png`;
export const el = (e, s = 13, label = false) => {
  const v = EL[e]; if (!v) return "";
  return `<span style="display:inline-flex;align-items:center;gap:3px;color:${v[1]};">${ic(v[0], s, v[1], 2.2)}${label ? v[2] : ""}</span>`;
};
export const elName = (e) => EL[e]?.[2] || "";
export const cls = (c, s = 12) => `<span style="display:inline-flex;align-items:center;gap:3px;">${ic(CLS_IC[c] || "users", s)}${CLS_LABEL[c] || c}</span>`;
export const badge = (r, star = 0) => `<span class="badge" style="--c:${RARC[r] || "#888"};">${r}${star ? " " + "★".repeat(star) : ""}</span>`;
export const bar = (p, c = "hp", h = 6) => `<div class="bar" style="height:${h}px;"><i class="${c}" style="width:${Math.max(0, Math.min(100, p))}%;"></i></div>`;
export const kv = (k, v) => `<div class="rowkv"><span class="t2">${k}</span><b>${v}</b></div>`;

// 초상화 — rosterRarity(원본 도트 파일명 등급), showRarity(테두리 색)
export function portrait(id, rosterRarity, showRarity, s = 64) {
  return `<div class="ring" style="--c:${RARC[showRarity] || RARC.N};width:${s + 4}px;"><div style="width:${s}px;height:${s}px;"><img src="${art(id, rosterRarity)}" alt="" loading="lazy"></div></div>`;
}
export const avatar = (id, rosterRarity, s = 28) =>
  `<div class="av" style="width:${s}px;height:${s}px;">${id ? `<img src="${art(id, rosterRarity)}" alt="">` : ""}</div>`;

// --- DOM helpers ---
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function on(root, event, sel, fn) {
  root.addEventListener(event, (e) => {
    const t = e.target.closest(sel);
    if (t && root.contains(t)) fn(e, t);
  });
}

// --- 토스트 ---
let toastWrap;
export function toast(msg, type = "ok", ms = 2600) {
  if (!toastWrap) { toastWrap = document.createElement("div"); toastWrap.className = "toast-wrap"; document.body.appendChild(toastWrap); }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = msg;
  toastWrap.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// --- 모달(데스크톱) / 바텀시트(모바일) — CSS가 화면 폭으로 모양을 바꾼다 ---
const stack = [];
export function openModal(html, { size = "", onClose, closable = true } = {}) {
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  scrim.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true"><div class="grab"></div>${closable ? `<button class="ibtn x" data-close aria-label="닫기">${ic("x", 16)}</button>` : ""}<div class="mbody col" style="gap:14px;">${html}</div></div>`;
  const close = () => {
    if (!scrim.isConnected) return;
    scrim.remove();
    const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
    onClose && onClose();
  };
  const api = { el: scrim, body: scrim.querySelector(".mbody"), close, set: (h) => { api.body.innerHTML = h; } };
  if (closable) {
    scrim.addEventListener("click", (e) => { if (e.target === scrim || e.target.closest("[data-close]")) close(); });
  }
  document.body.appendChild(scrim);
  stack.push(api);
  return api;
}
export function closeAllModals() { [...stack].forEach((m) => m.close()); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && stack.length) stack[stack.length - 1].close(); });

export function confirmBox(title, msg, { ok = "확인", danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal(`<div class="h2">${title}</div><div class="tip">${msg}</div>
      <div class="row2"><button class="btn ghost grow" data-no>취소</button><button class="btn ${danger ? "danger" : "pri"} grow" data-yes>${ok}</button></div>`,
      { onClose: () => { if (!done) resolve(false); } });
    m.el.querySelector("[data-yes]").onclick = () => { done = true; m.close(); resolve(true); };
    m.el.querySelector("[data-no]").onclick = () => { done = true; m.close(); resolve(false); };
  });
}

// 버튼 잠금 + 에러 토스트 래퍼
export async function busy(btn, fn) {
  if (btn) { if (btn.disabled) return; btn.disabled = true; }
  try { return await fn(); }
  catch (e) { toast(esc(e.message || String(e)), "err"); }
  finally { if (btn && btn.isConnected) btn.disabled = false; }
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
