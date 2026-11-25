// ============================================================================
// 게임 2.0 — 오디세이 장비 가방(서버 저장) · 장착 프리셋 3개 · 강화 · 판매 · 일괄판매 · 자동판매
// ============================================================================
// 1.0 그대로: 가방 100칸, 부위(=장비 종류)마다 하나씩 장착, 장비 프리셋 3슬롯(장착/해제 즉시
// 그 슬롯에 반영, 전환 무료), 자동판매는 "설정한 등급 이하"가 가방에 들어오지 않고 바로 판매,
// 일괄판매는 장착 중이지 않은 해당 등급 이하 장비를 한 번에 판매.
import {
  ODYSSEY_GRADES, ODYSSEY_SELL_GOLD, ODYSSEY_SELL_GEMS, ODYSSEY_ENHANCE_MAX_LEVEL,
  odysseyEnhanceSuccessRate, odysseyEnhanceDowngradeChanceOnFail, odysseyEnhanceDowngradeFloor,
} from "./odyssey.js";
import { SLOT_KEYS, slotOf, setOf, enhanceCost } from "./equipment.js";
import { PRESET_SLOTS } from "./presets.js";

export const INVENTORY_CAP = 100;
export const EQUIP_SLOTS = SLOT_KEYS; // 무기/머리/갑옷/망토/목걸이/유물 — 부위마다 1개

export function gradeIndex(grade) {
  return ODYSSEY_GRADES.indexOf(grade);
}
export function assertGrade(grade) {
  if (gradeIndex(grade) < 0) throw new Error(`등급은 ${ODYSSEY_GRADES.join("/")} 중 하나여야 함`);
  return grade;
}
export function shouldAutoSell(grade, threshold) {
  if (!threshold) return false;
  return gradeIndex(grade) >= 0 && gradeIndex(grade) <= gradeIndex(threshold);
}
export function sellValue(item) {
  return { gold: ODYSSEY_SELL_GOLD[item.grade] || 0, gems: ODYSSEY_SELL_GEMS[item.grade] || 0 };
}

export function normalizeEquipPresets(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: PRESET_SLOTS }, (_, i) => (Array.isArray(arr[i]) ? arr[i].filter(Boolean) : []));
}
// 같은 부위에 이미 다른 장비가 있으면 빼고 새 장비를 넣는다(부위 = 장비 카탈로그의 slot).
export function equipInPreset(presetIds, itemsById, itemId) {
  const item = itemsById.get(itemId);
  if (!item) throw new Error("가방에 없는 장비");
  const slot = slotOf(item.item_key);
  const kept = presetIds.filter((id) => id !== itemId && itemsById.has(id) && slotOf(itemsById.get(id).item_key) !== slot);
  return [...kept, itemId];
}
export function unequipInPreset(presetIds, itemId) {
  return presetIds.filter((id) => id !== itemId);
}
export function equippedAnywhere(presets) {
  return new Set(presets.flat());
}

// DB 행 → 전투 계산용 아이템 모양(odyssey.js의 equippedOdysseyBonusSums가 먹는 {key, grade, lines, enhance, equipped})
export function rowToItem(row, equippedIds) {
  return {
    id: row.id, key: row.item_key, set: setOf(row.item_key), slot: slotOf(row.item_key), grade: row.grade, lines: row.lines || [],
    enhance: row.enhance || 0, equipped: equippedIds ? equippedIds.has(row.id) : false,
  };
}

// 강화 1회 — 성공/실패/하락을 결정한다(비용 지불은 호출부).
export function rollEnhance(item, rng = Math.random) {
  const cur = item.enhance || 0;
  if (cur >= ODYSSEY_ENHANCE_MAX_LEVEL) throw new Error(`이미 최대 강화(+${ODYSSEY_ENHANCE_MAX_LEVEL})`);
  const next = cur + 1;
  const cost = enhanceCost(item.grade, cur); // { gold, dust }
  const rate = odysseyEnhanceSuccessRate(next);
  if (rng() < rate) return { success: true, enhance: next, downgraded: false, cost, rate };
  const down = rng() < odysseyEnhanceDowngradeChanceOnFail(next);
  const floor = odysseyEnhanceDowngradeFloor();
  return { success: false, enhance: down ? Math.max(floor, cur - 1) : cur, downgraded: down && cur - 1 >= floor, cost, rate };
}
