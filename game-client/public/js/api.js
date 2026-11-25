// 서버 API + 공용 상태(내 정보 / 메타 / 보유 영웅)
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { return null; } };

export const S = {
  playerId: LS("hh2.playerId"),
  meta: null,
  me: null,
  heroes: null,
  heroById: new Map(),
  rosterById: new Map(),
};

export function setSession(playerId, token) {
  S.playerId = playerId;
  LS("hh2.playerId", playerId);
  if (token) LS("hh2.token", token);
}
export function clearSession() {
  S.playerId = null; S.me = null; S.heroes = null; S.heroById = new Map();
  LS("hh2.playerId", null); LS("hh2.token", null);
}
export const flag = (k, v) => LS("hh2.flag." + k, v);

async function req(method, path, body) {
  const token = LS("hh2.token");
  const r = await fetch(path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let j = null;
  try { j = await r.json(); } catch { /* 빈 응답 */ }
  if (!r.ok) throw new Error((j && j.error) || `요청 실패 (${r.status})`);
  return j;
}
export const get = (p) => req("GET", p);
export const post = (p, b = {}) => req("POST", p, b);
export const pp = (p) => `/api/players/${S.playerId}${p}`;

export async function loadMeta() {
  if (S.meta) return S.meta;
  S.meta = await get("/api/meta");
  S.rosterById = new Map(S.meta.roster.map((c) => [c.id, c]));
  return S.meta;
}
export async function refreshMe() {
  S.me = await get(pp("/me"));
  document.dispatchEvent(new CustomEvent("me"));
  return S.me;
}
export async function refreshHeroes() {
  const { heroes } = await get(pp("/heroes"));
  S.heroes = heroes;
  S.heroById = new Map(heroes.map((h) => [h.characterId, h]));
  return heroes;
}
// 로스터 원본 등급(도트 파일명) — 보유 여부와 무관
export const rosterRarity = (id) => S.rosterById.get(id)?.rarity || "N";
