// ============================================================================
// 게임 2.0 — 프리셋(어빌리티 3슬롯 · 콘텐츠별 자동 적용 · 파밍 팀 3슬롯 · 오디세이 테마별 팀)
// ============================================================================
// 1.0의 "프리셋 1/2/3 · 전환은 무료·즉시 · 슬롯마다 따로 재설정" 구조와
// "⚡ 콘텐츠별 어빌리티 프리셋 자동 적용(도전하는 순간 전환, 끝나면 원래 프리셋으로)" 구조를 그대로 옮겼다.
// [하위 호환] players.ability_lines / ability_locked_indices는 계속 "지금 활성 프리셋"의 거울로
// 유지한다 — 기존 코드가 그 두 컬럼을 그대로 읽어도 활성 프리셋 값이 나오게.
import { DEFAULT_FORMATION, FORMATIONS, TEAM_SIZE, okTeam } from "./formation.js";
import { ODYSSEY_THEMES } from "./odyssey.js";

export const PRESET_SLOTS = 3;
export const ABILITY_CONTENT_KEYS = ["farm", "floorBoss", "dailyBoss", "gold", "gem", "exp", "pvp", "odyssey"];
export const ABILITY_CONTENT_LABELS = {
  farm: "파밍 (스테이지 방치)", floorBoss: "층보스", dailyBoss: "일일보스", gold: "골드 던전",
  gem: "다이아 던전", exp: "경험치 던전", pvp: "PvP (레이팅전/자존심전)", odyssey: "영웅의 오디세이",
};

export function assertSlot(slot) {
  const n = Number(slot);
  if (!Number.isInteger(n) || n < 0 || n >= PRESET_SLOTS) throw new Error(`프리셋 슬롯은 0~${PRESET_SLOTS - 1} 사이여야 함`);
  return n;
}

// ---------------------------------------------------------------- 어빌리티
export function normalizeAbilityPresets(player) {
  const raw = Array.isArray(player.ability_presets) ? player.ability_presets : [];
  const active = Number.isInteger(player.ability_active_preset) ? player.ability_active_preset : 0;
  const presets = [];
  for (let i = 0; i < PRESET_SLOTS; i++) {
    const p = raw[i] || {};
    presets.push({ lines: Array.isArray(p.lines) ? p.lines : [], lockedIndices: Array.isArray(p.lockedIndices) ? p.lockedIndices : [] });
  }
  // 프리셋이 아직 한 번도 저장된 적 없으면(마이그레이션 직후) 기존 단일 줄을 활성 슬롯에 넣는다.
  if (!raw.length) presets[active] = { lines: player.ability_lines || [], lockedIndices: player.ability_locked_indices || [] };
  return { presets, active };
}

// 콘텐츠별 자동 적용 — 1~3이면 그 프리셋, 0/없음("사용안함")이면 지금 활성 프리셋 그대로.
export function abilityPresetIndexForContent(player, contentKey) {
  const { active } = normalizeAbilityPresets(player);
  const map = player.ability_content_presets || {};
  const v = Number(map[contentKey]);
  return Number.isInteger(v) && v >= 1 && v <= PRESET_SLOTS ? v - 1 : active;
}
export function abilityLinesForContent(player, contentKey) {
  const { presets } = normalizeAbilityPresets(player);
  return presets[abilityPresetIndexForContent(player, contentKey)].lines;
}
export function setContentPreset(current, contentKey, presetNumber) {
  if (!ABILITY_CONTENT_KEYS.includes(contentKey)) throw new Error(`알 수 없는 콘텐츠: ${contentKey} (가능: ${ABILITY_CONTENT_KEYS.join(", ")})`);
  const n = Number(presetNumber);
  if (!Number.isInteger(n) || n < 0 || n > PRESET_SLOTS) throw new Error(`프리셋 번호는 0(사용안함)~${PRESET_SLOTS}`);
  return { ...(current || {}), [contentKey]: n };
}

// ---------------------------------------------------------------- 팀
export function normalizeTeam(team) {
  return { team: Array.isArray(team?.team) ? team.team : [], formation: FORMATIONS[team?.formation] ? team.formation : DEFAULT_FORMATION };
}
export function normalizeTeamPresets(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: PRESET_SLOTS }, (_, i) => normalizeTeam(arr[i]));
}
export function validateTeamIds(ids) {
  if (!Array.isArray(ids) || ids.length > TEAM_SIZE) throw new Error(`팀은 1~${TEAM_SIZE}명이어야 함`);
  const real = ids.filter(Boolean);
  if (new Set(real).size !== real.length) throw new Error("같은 캐릭터를 두 번 넣을 수 없음");
  if (!okTeam(ids)) throw new Error(`팀은 1~${TEAM_SIZE}명이어야 함`);
  return ids;
}

// ---------------------------------------------------------------- 오디세이 테마별 팀
export const ODYSSEY_THEME_KEYS = ODYSSEY_THEMES.map((t) => t.key);
export function normalizeThemePresets(raw) {
  const out = {};
  for (const k of ODYSSEY_THEME_KEYS) out[k] = normalizeTeam(raw?.[k]);
  return out;
}
