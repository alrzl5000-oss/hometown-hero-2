// ============================================================================
// 게임 2.0 — UI(디자인 시안 42화면)에는 있는데 서버에 없던 기능 일괄 추가
// ============================================================================
// · 어빌리티 프리셋 3슬롯 전환 + 콘텐츠별 자동 적용 매핑
// · 파밍 팀 프리셋 3슬롯
// · 오디세이 서버 저장(진행도/도전 횟수 5분 회복/테마별 팀/1회·10회 도전/최초 클리어 보상)
// · 장비 가방(서버 저장) — 장착/해제/강화/판매/일괄판매/자동판매/장비 프리셋 3슬롯
// · 일일던전 3종 서버 저장(매일 09시 KST 초기화) · 일일보스 서버 저장(오늘 누적/최고 기록)
// · 랭킹(스테이지/레벨/일일보스/PvP) · 버프 현황
//
// index.js에만 있는 헬퍼(buildFormedTeam, settleFarm 등)는 registerFeatureRoutes(app, ctx)로
// 주입받는다 — index.js가 import 시 바로 app.listen을 하므로 역으로 import할 수 없음.
import { ROSTER, CLASSES, LEVEL_CAP, characterStatsAt } from "./data/characters.js";
import {
  promotionCost, exPromotionReady, exPromotionCost, exLevelUpGoldCost, exLevelUpDiaCost, baseLevelUpGoldCost,
  EX_STAR_MAX, EX_STAR_STAT_BONUS_PER_STAR, exStarUpCost, applyExStarBonus, PROMOTION_STONE_CRAFT_RECIPE,
} from "./data/promotion.js";
import { expToNextLevel } from "./data/accountLevel.js";
import { gachaRates, HARD_PITY } from "./data/gacha.js";
import { GACHA_BUNDLES } from "./data/gachaBundle.js";
import { SYNERGY_SETS, GRADE_COUNT_CONFIG, DEX_FILL_BONUS_PER_HERO } from "./data/synergy.js";
import { ABILITY_EFFECTS, ABILITY_GRADES, ABILITY_GRADE_LABEL, ABILITY_GRADE_COLOR, ABILITY_SLOT_UNLOCK_LEVEL } from "./data/abilities.js";
import { FIELD_SPECIES, BOSS_SPECIES, STAGES_PER_CHAPTER } from "./data/farming.js";
import { DAILY_BOSS_SKILL_POOL } from "./data/dailyBoss.js";
import { DUNGEON_WEAK_ROLE, DUNGEON_WEAK_ROLE_BONUS_MULT } from "./data/dailyDungeon.js";
import { PVP_MAX_ATTEMPTS, PVP_RATING_START } from "./data/pvp.js";
import { SKILL_KINDS } from "./data/skills.js";
import { FORMATIONS, DEFAULT_FORMATION, TEAM_SIZE } from "./data/formation.js";
import { applyExp, levelAtkBonusMult } from "./data/accountLevel.js";
import { abilityBonuses } from "./data/abilities.js";
import { computeCollectionBonus, computeSynergyState } from "./data/synergy.js";
import {
  DUNGEON_TYPES, DUNGEON_MAX_ATTEMPTS, DUNGEON_MAX_STAGE, dungeonEnemy, dungeonReward, dungeonTip, resolveDungeonAttempt,
} from "./data/dailyDungeon.js";
import { BOSS_MAX_ATTEMPTS, BOSS_FIGHT_SECONDS, dailyBossEnemy, dayIndex, resolveDailyBossAttempt } from "./data/dailyBoss.js";
import {
  ODYSSEY_THEMES, ODYSSEY_THEME_MAP, ODYSSEY_MAX_ATTEMPTS, ODYSSEY_ITEMS, ODYSSEY_STAT_POOL, ODYSSEY_GRADE_COLOR, ODYSSEY_SELL_GOLD, ODYSSEY_SELL_GEMS, ODYSSEY_REGEN_SECONDS, ODYSSEY_GRADES, ODYSSEY_GRADE_LABEL,
  ODYSSEY_ENHANCE_MAX_LEVEL, themeForStage, odysseyEnemy, odysseyFirstClearReward, odysseyEnhanceCost, odysseyEnhanceSuccessRate,
  equippedOdysseyBonusSums, applyOdysseyEquipmentBonuses, resolveOdysseyFight,
} from "./data/odyssey.js";
import {
  PRESET_SLOTS, ABILITY_CONTENT_KEYS, ABILITY_CONTENT_LABELS, assertSlot, normalizeAbilityPresets, abilityLinesForContent,
  abilityPresetIndexForContent, setContentPreset, normalizeTeamPresets, validateTeamIds, normalizeThemePresets,
} from "./data/presets.js";
import {
  INVENTORY_CAP, assertGrade, shouldAutoSell, sellValue, normalizeEquipPresets, equipInPreset, unequipInPreset,
  equippedAnywhere, rowToItem, rollEnhance,
} from "./data/inventory.js";
import { freshDungeonState, freshBossState, regenAttempts } from "./data/daily.js";

const ROSTER_BY_ID = new Map(ROSTER.map((c) => [c.id, c]));
const now = () => new Date().toISOString();
const DUNGEON_REWARD_MULT_KEY = { gold: "goldMult", gem: "gemMult", exp: "expMult" };
export const ODYSSEY_CHALLENGE_COUNTS = [1, 10];
export const RANKING_TYPES = {
  stage: { column: "farm_max_stage", label: "최고 스테이지" },
  level: { column: "level", label: "계정 레벨" },
  boss: { column: "boss_best_damage", label: "일일보스 최고 데미지" },
  pvp: { column: "pvp_rating", label: "PvP 레이팅" },
};
export const RANKING_LIMIT = 50;

// ---------------------------------------------------------------------------
// DB 공용 헬퍼 — 장비 가방 / 콘텐츠별 전투 옵션
// ---------------------------------------------------------------------------
export function makePlayerContext({ supabase }) {
  async function fetchItemRows(playerId) {
    const { data, error } = await supabase.from("player_items").select("*").eq("player_id", playerId).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }
  // 지금 활성 장비 프리셋에 장착된 장비만 {key, grade, lines, enhance, equipped:true} 모양으로.
  async function loadEquippedItems(playerId, player) {
    const presets = normalizeEquipPresets(player.equip_presets);
    const ids = presets[player.equip_active_preset || 0] || [];
    if (!ids.length) return [];
    const { data, error } = await supabase.from("player_items").select("*").eq("player_id", playerId).in("id", ids);
    if (error) throw new Error(error.message);
    return (data || []).map((r) => rowToItem(r, new Set(ids)));
  }
  // buildFormedTeam에 넘길 옵션 — 콘텐츠별 어빌리티 프리셋 + 장착 장비 + 계정 레벨.
  async function combatOptionsFor(playerId, player, contentKey) {
    const odysseyItems = await loadEquippedItems(playerId, player);
    return { abilityLines: abilityLinesForContent(player, contentKey), accountLevel: player.level || 1, odysseyItems };
  }
  return { fetchItemRows, loadEquippedItems, combatOptionsFor };
}

export function registerFeatureRoutes(app, ctx) {
  const { supabase, requireDb, buildFormedTeam, fetchOwnedCharacterStats, fetchAllOwnedRows, loadPlayerAndCurrency, settleFarm } = ctx;
  const { fetchItemRows, loadEquippedItems, combatOptionsFor } = makePlayerContext({ supabase });

  // 라우트 공통 래퍼 — DB 확인 + 플레이어 로드 + 에러를 400으로.
  const route = (handler) => async (req, res) => {
    if (!requireDb(res)) return;
    try {
      const loaded = await loadPlayerAndCurrency(req.params.playerId);
      if (!loaded) return res.status(404).json({ error: "플레이어 없음" });
      await handler(req, res, loaded);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  };
  async function updatePlayer(playerId, patch) {
    const { error } = await supabase.from("players").update(patch).eq("id", playerId);
    if (error) throw new Error(error.message);
  }
  async function updateCurrency(playerId, patch) {
    const { error } = await supabase.from("player_currencies").update({ ...patch, updated_at: now() }).eq("player_id", playerId);
    if (error) throw new Error(error.message);
  }
  async function buildOwnedTeam(playerId, player, ids, formation, contentKey) {
    validateTeamIds(ids);
    const [owned, allOwnedRows, opts] = await Promise.all([
      fetchOwnedCharacterStats(playerId, ids),
      fetchAllOwnedRows(playerId),
      combatOptionsFor(playerId, player, contentKey),
    ]);
    return { team: buildFormedTeam(owned, formation || DEFAULT_FORMATION, { ...opts, ownedCharacters: allOwnedRows }), opts };
  }
  // 경험치 지급(레벨업 시 다이아 보상 포함) — players.level/exp + currency.dia 반영값을 돌려준다.
  function grantExp(player, currency, expGained) {
    const r = applyExp(player.level || 1, player.exp || 0, expGained);
    return { playerPatch: { level: r.level, exp: r.exp }, diaFromLevel: r.gemsGained, levelsGained: r.levelsGained };
  }

  // =========================================================================
  // 1. 어빌리티 프리셋
  // =========================================================================
  app.post("/api/players/:playerId/abilities/presets/:slot/activate", route(async (req, res, { player }) => {
    const slot = assertSlot(req.params.slot);
    const { presets } = normalizeAbilityPresets(player);
    await updatePlayer(player.id, {
      ability_presets: presets, ability_active_preset: slot,
      ability_lines: presets[slot].lines, ability_locked_indices: presets[slot].lockedIndices,
    });
    res.json({ activePreset: slot, presets, lines: presets[slot].lines, lockedIndices: presets[slot].lockedIndices });
  }));

  app.get("/api/players/:playerId/abilities/content-presets", route(async (req, res, { player }) => {
    res.json({ contentPresets: player.ability_content_presets || {}, contentKeys: ABILITY_CONTENT_KEYS, labels: ABILITY_CONTENT_LABELS, presetSlots: PRESET_SLOTS });
  }));

  // body: { contentKey, preset } — preset 0 = 사용안함(현재 활성 프리셋 그대로), 1~3 = 그 프리셋
  // 또는 body: { map: {farm:1, pvp:2, ...} } 로 한 번에.
  app.post("/api/players/:playerId/abilities/content-presets", route(async (req, res, { player }) => {
    const { contentKey, preset, map } = req.body || {};
    let next = player.ability_content_presets || {};
    if (map && typeof map === "object") for (const [k, v] of Object.entries(map)) next = setContentPreset(next, k, v);
    else next = setContentPreset(next, contentKey, preset);
    await updatePlayer(player.id, { ability_content_presets: next });
    res.json({ contentPresets: next });
  }));

  // =========================================================================
  // 2. 파밍 팀 프리셋 3슬롯
  // =========================================================================
  app.get("/api/players/:playerId/farm/presets", route(async (req, res, { player }) => {
    res.json({ presets: normalizeTeamPresets(player.farm_team_presets), activePreset: player.farm_active_preset || 0 });
  }));

  // body: { characterIds?, formation? } — 생략하면 지금 파밍 팀을 그대로 저장.
  app.post("/api/players/:playerId/farm/presets/:slot/save", route(async (req, res, { player }) => {
    const slot = assertSlot(req.params.slot);
    const { characterIds, formation } = req.body || {};
    const ids = characterIds || player.farm_team || [];
    validateTeamIds(ids);
    if (formation && !FORMATIONS[formation]) throw new Error(`알 수 없는 포메이션: ${formation}`);
    await fetchOwnedCharacterStats(player.id, ids); // 소유 검증
    const presets = normalizeTeamPresets(player.farm_team_presets);
    presets[slot] = { team: ids, formation: formation || player.farm_formation || DEFAULT_FORMATION };
    await updatePlayer(player.id, { farm_team_presets: presets });
    res.json({ presets, activePreset: player.farm_active_preset || 0 });
  }));

  // 프리셋 전환 — 옛 팀 기준으로 먼저 정산(1.0 원칙) 후 교체. 빈 프리셋이면 파밍 팀도 비운다.
  app.post("/api/players/:playerId/farm/presets/:slot/activate", route(async (req, res, { player, currency }) => {
    const slot = assertSlot(req.params.slot);
    const settled = await settleFarm(player.id, player, currency);
    const presets = normalizeTeamPresets(player.farm_team_presets);
    const p = presets[slot];
    if (p.team.length) await fetchOwnedCharacterStats(player.id, p.team);
    await updatePlayer(player.id, { farm_active_preset: slot, farm_team: p.team, farm_formation: p.formation, farm_last_tick_at: now() });
    res.json({ activePreset: slot, farmTeam: p.team, farmFormation: p.formation, settledGain: settled.gained });
  }));

  // =========================================================================
  // 3. 장비 가방 · 장비 프리셋 · 강화 · 판매 · 자동판매
  // =========================================================================
  function inventoryView(player, rows) {
    const presets = normalizeEquipPresets(player.equip_presets);
    const active = player.equip_active_preset || 0;
    const activeIds = new Set(presets[active]);
    const anywhere = equippedAnywhere(presets);
    const items = rows.map((r) => {
      const it = rowToItem(r, activeIds);
      const nextCost = it.enhance < ODYSSEY_ENHANCE_MAX_LEVEL ? odysseyEnhanceCost(it.grade, it.enhance) : null;
      return {
        ...it, gradeLabel: ODYSSEY_GRADE_LABEL[it.grade], inAnyPreset: anywhere.has(it.id), sellValue: sellValue(it),
        nextEnhance: nextCost ? { cost: nextCost, successRate: odysseyEnhanceSuccessRate(it.enhance + 1) } : null,
      };
    });
    return {
      items, count: rows.length, cap: INVENTORY_CAP, presets, activePreset: active, autoSellGrade: player.auto_sell_grade || null,
      equippedSums: equippedOdysseyBonusSums(items.filter((i) => i.equipped)), grades: ODYSSEY_GRADES,
    };
  }

  app.get("/api/players/:playerId/items", route(async (req, res, { player }) => {
    res.json(inventoryView(player, await fetchItemRows(player.id)));
  }));

  async function findItem(playerId, itemId) {
    const { data, error } = await supabase.from("player_items").select("*").eq("player_id", playerId).eq("id", itemId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("가방에 없는 장비");
    return data;
  }

  app.post("/api/players/:playerId/items/:itemId/equip", route(async (req, res, { player }) => {
    const rows = await fetchItemRows(player.id);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const presets = normalizeEquipPresets(player.equip_presets);
    const active = player.equip_active_preset || 0;
    presets[active] = equipInPreset(presets[active], byId, req.params.itemId);
    await updatePlayer(player.id, { equip_presets: presets });
    res.json(inventoryView({ ...player, equip_presets: presets }, rows));
  }));

  app.post("/api/players/:playerId/items/:itemId/unequip", route(async (req, res, { player }) => {
    const presets = normalizeEquipPresets(player.equip_presets);
    const active = player.equip_active_preset || 0;
    presets[active] = unequipInPreset(presets[active], req.params.itemId);
    await updatePlayer(player.id, { equip_presets: presets });
    res.json(inventoryView({ ...player, equip_presets: presets }, await fetchItemRows(player.id)));
  }));

  app.post("/api/players/:playerId/equip-presets/:slot/activate", route(async (req, res, { player }) => {
    const slot = assertSlot(req.params.slot);
    await updatePlayer(player.id, { equip_active_preset: slot });
    res.json(inventoryView({ ...player, equip_active_preset: slot }, await fetchItemRows(player.id)));
  }));

  app.post("/api/players/:playerId/items/:itemId/enhance", route(async (req, res, { player, currency }) => {
    const row = await findItem(player.id, req.params.itemId);
    const item = rowToItem(row);
    const roll = rollEnhance(item);
    if (currency.gold < roll.cost.gold) throw new Error(`골드 부족 (${currency.gold}/${roll.cost.gold})`);
    if (currency.dia < roll.cost.gems) throw new Error(`다이아 부족 (${currency.dia}/${roll.cost.gems})`);
    await updateCurrency(player.id, { gold: currency.gold - roll.cost.gold, dia: currency.dia - roll.cost.gems });
    if (roll.enhance !== item.enhance) {
      const { error } = await supabase.from("player_items").update({ enhance: roll.enhance }).eq("id", row.id);
      if (error) throw new Error(error.message);
    }
    res.json({ itemId: row.id, success: roll.success, downgraded: roll.downgraded, enhanceBefore: item.enhance, enhance: roll.enhance, cost: roll.cost, successRate: roll.rate });
  }));

  // 판매 — 장착 중(어느 프리셋이든)인 장비는 팔 수 없음.
  async function sellRows(player, currency, rows) {
    if (!rows.length) return { sold: 0, gold: 0, gems: 0 };
    let gold = 0;
    let gems = 0;
    for (const r of rows) {
      const v = sellValue(rowToItem(r));
      gold += v.gold;
      gems += v.gems;
    }
    const { error } = await supabase.from("player_items").delete().eq("player_id", player.id).in("id", rows.map((r) => r.id));
    if (error) throw new Error(error.message);
    await updateCurrency(player.id, { gold: currency.gold + gold, dia: currency.dia + gems });
    return { sold: rows.length, gold, gems };
  }

  app.post("/api/players/:playerId/items/:itemId/sell", route(async (req, res, { player, currency }) => {
    const row = await findItem(player.id, req.params.itemId);
    if (equippedAnywhere(normalizeEquipPresets(player.equip_presets)).has(row.id)) throw new Error("장착 중인 장비는 판매할 수 없음 — 먼저 해제");
    res.json(await sellRows(player, currency, [row]));
  }));

  // body: { maxGrade } — 그 등급 이하 + 어느 프리셋에도 장착 안 된 장비 전부.
  app.post("/api/players/:playerId/items/sell-bulk", route(async (req, res, { player, currency }) => {
    const maxGrade = assertGrade((req.body || {}).maxGrade);
    const equipped = equippedAnywhere(normalizeEquipPresets(player.equip_presets));
    const rows = (await fetchItemRows(player.id)).filter((r) => !equipped.has(r.id) && shouldAutoSell(r.grade, maxGrade));
    res.json(await sellRows(player, currency, rows));
  }));

  // body: { grade } — null이면 자동판매 끔.
  app.post("/api/players/:playerId/items/auto-sell", route(async (req, res, { player }) => {
    const { grade } = req.body || {};
    const next = grade ? assertGrade(grade) : null;
    await updatePlayer(player.id, { auto_sell_grade: next });
    res.json({ autoSellGrade: next });
  }));

  // 드랍 장비를 가방에 넣는다 — 자동판매 등급 이하이거나 가방이 가득 차면 바로 판매.
  async function storeDrops(player, currency, drops) {
    if (!drops.length) return { stored: [], autoSold: [], gold: 0, gems: 0 };
    const { count, error: cErr } = await supabase.from("player_items").select("id", { count: "exact", head: true }).eq("player_id", player.id);
    if (cErr) throw new Error(cErr.message);
    let room = INVENTORY_CAP - (count || 0);
    const toInsert = [];
    const autoSold = [];
    for (const d of drops) {
      if (shouldAutoSell(d.grade, player.auto_sell_grade) || room <= 0) autoSold.push({ ...d, reason: room <= 0 ? "가방 가득 참" : "자동판매" });
      else {
        toInsert.push({ player_id: player.id, item_key: d.key, grade: d.grade, lines: d.lines || [], enhance: 0 });
        room--;
      }
    }
    let stored = [];
    if (toInsert.length) {
      const { data, error } = await supabase.from("player_items").insert(toInsert).select();
      if (error) throw new Error(error.message);
      stored = (data || []).map((r) => rowToItem(r));
    }
    let gold = 0;
    let gems = 0;
    for (const s of autoSold) {
      const v = sellValue(s);
      gold += v.gold;
      gems += v.gems;
    }
    return { stored, autoSold, gold, gems };
  }

  // =========================================================================
  // 4. 오디세이 — 서버 저장
  // =========================================================================
  function odysseyRegen(player) {
    return regenAttempts({ attempts: player.odyssey_attempts, lastRegenAt: player.odyssey_last_regen_at, max: ODYSSEY_MAX_ATTEMPTS, regenSeconds: ODYSSEY_REGEN_SECONDS });
  }
  function odysseyView(player, regen) {
    const stage = player.odyssey_stage || 1;
    return {
      stage, maxStage: player.odyssey_max_stage || 0, attempts: regen.attempts, attemptsMax: ODYSSEY_MAX_ATTEMPTS,
      nextRegenInSeconds: regen.nextRegenInSeconds, regenSeconds: ODYSSEY_REGEN_SECONDS,
      theme: themeForStage(stage), enemy: odysseyEnemy(stage), firstClearReward: odysseyFirstClearReward(stage),
      themeTeams: normalizeThemePresets(player.odyssey_theme_presets), themes: ODYSSEY_THEMES, challengeCounts: ODYSSEY_CHALLENGE_COUNTS,
    };
  }

  app.get("/api/players/:playerId/odyssey", route(async (req, res, { player }) => {
    const regen = odysseyRegen(player);
    if (regen.attempts !== player.odyssey_attempts) await updatePlayer(player.id, { odyssey_attempts: regen.attempts, odyssey_last_regen_at: regen.lastRegenAt });
    res.json(odysseyView(player, regen));
  }));

  // 스테이지 선택(도전할 스테이지 이동) — body: { stage } (1 ~ 최고기록+1)
  app.post("/api/players/:playerId/odyssey/stage", route(async (req, res, { player }) => {
    const stage = Number((req.body || {}).stage);
    const limit = (player.odyssey_max_stage || 0) + 1;
    if (!Number.isInteger(stage) || stage < 1 || stage > limit) throw new Error(`스테이지는 1~${limit} 사이`);
    await updatePlayer(player.id, { odyssey_stage: stage });
    res.json(odysseyView({ ...player, odyssey_stage: stage }, odysseyRegen(player)));
  }));

  // 테마별 팀 — body: { themeKey, characterIds(5), formation? }. 전원 그 테마의 직업이어야 함.
  app.post("/api/players/:playerId/odyssey/theme-team", route(async (req, res, { player }) => {
    const { themeKey, characterIds, formation } = req.body || {};
    const theme = ODYSSEY_THEME_MAP[themeKey];
    if (!theme) throw new Error(`알 수 없는 테마: ${themeKey} (가능: ${ODYSSEY_THEMES.map((t) => t.key).join(", ")})`);
    validateTeamIds(characterIds);
    if (formation && !FORMATIONS[formation]) throw new Error(`알 수 없는 포메이션: ${formation}`);
    const wrong = characterIds.filter((id) => ROSTER_BY_ID.get(id)?.class !== theme.allowedClass);
    if (wrong.length) throw new Error(`${theme.name}에는 ${CLASSES[theme.allowedClass].label}만 배치할 수 있음 (맞지 않는 캐릭터: ${wrong.join(", ")})`);
    await fetchOwnedCharacterStats(player.id, characterIds);
    const presets = normalizeThemePresets(player.odyssey_theme_presets);
    presets[themeKey] = { team: characterIds, formation: formation || DEFAULT_FORMATION };
    await updatePlayer(player.id, { odyssey_theme_presets: presets });
    res.json({ themeTeams: presets });
  }));

  // 도전 — body: { count: 1 | 10 }. 지금 선택된 스테이지를 그 테마의 저장된 팀으로 count번 연속 도전.
  // 승리 1회당 도전 횟수 1 소모(패배는 소모 없음 — 1.0 최종 버전의 "실패는 횟수 차감 없음" 원칙),
  // 패배하면 그 자리에서 멈춘다. 최초 클리어면 보상 지급 + 다음 스테이지로 자동 이동.
  app.post("/api/players/:playerId/odyssey/challenge", route(async (req, res, { player, currency }) => {
    const count = Number((req.body || {}).count || 1);
    if (!ODYSSEY_CHALLENGE_COUNTS.includes(count)) throw new Error(`count는 ${ODYSSEY_CHALLENGE_COUNTS.join(" 또는 ")}`);
    const regen = odysseyRegen(player);
    if (regen.attempts <= 0) throw new Error("도전 횟수가 없음 — 5분마다 1회 충전");

    let stage = player.odyssey_stage || 1;
    let maxStage = player.odyssey_max_stage || 0;
    let attempts = regen.attempts;
    const presets = normalizeThemePresets(player.odyssey_theme_presets);
    const [allOwnedRows, equipped] = await Promise.all([fetchAllOwnedRows(player.id), loadEquippedItems(player.id, player)]);
    const sums = equippedOdysseyBonusSums(equipped);
    const lines = abilityLinesForContent(player, "odyssey");
    const teamCache = new Map();

    const fights = [];
    const drops = [];
    let gold = 0;
    let gems = 0;
    let stones = 0;
    for (let i = 0; i < count && attempts > 0; i++) {
      const theme = themeForStage(stage);
      const preset = presets[theme.key];
      if (preset.team.length !== TEAM_SIZE) {
        if (!fights.length) throw new Error(`${theme.name} 팀이 아직 없음 — POST /odyssey/theme-team 으로 ${CLASSES[theme.allowedClass].label} 5명을 먼저 편성`);
        break;
      }
      if (!teamCache.has(theme.key)) {
        const owned = await fetchOwnedCharacterStats(player.id, preset.team);
        const formed = buildFormedTeam(owned, preset.formation, { abilityLines: lines, accountLevel: player.level, odysseyItems: equipped, ownedCharacters: allOwnedRows });
        teamCache.set(theme.key, applyOdysseyEquipmentBonuses(formed, sums));
      }
      const r = resolveOdysseyFight({ team: teamCache.get(theme.key), stage });
      const fight = { stage, theme: theme.key, win: r.win, timedOut: !!r.timedOut, endedAt: r.endedAt };
      if (count === 1) {
        fight.hits = r.hits;
        fight.team = teamSnapshot(teamCache.get(theme.key));
        fight.enemy = r.enemy;
      }
      if (!r.win) {
        fights.push(fight);
        break;
      }
      attempts--;
      stones += r.stoneGain || 0;
      drops.push(...(r.droppedItems || []));
      if (stage > maxStage) {
        const fc = odysseyFirstClearReward(stage);
        gold += fc.gold;
        gems += fc.gems;
        fight.firstClear = fc;
        maxStage = stage;
        stage += 1;
      }
      fights.push(fight);
    }

    const stored = await storeDrops(player, currency, drops);
    gold += stored.gold;
    gems += stored.gems;
    // regen 기준 시각: 가득 찬 상태에서 처음 소모하면 지금부터 5분 카운트 시작.
    const lastRegenAt = regen.attempts >= ODYSSEY_MAX_ATTEMPTS && attempts < ODYSSEY_MAX_ATTEMPTS ? now() : regen.lastRegenAt;
    await Promise.all([
      updatePlayer(player.id, { odyssey_stage: stage, odyssey_max_stage: maxStage, odyssey_attempts: attempts, odyssey_last_regen_at: lastRegenAt }),
      gold || gems || stones ? updateCurrency(player.id, { gold: currency.gold + gold, dia: currency.dia + gems, stone: (currency.stone || 0) + stones }) : null,
    ]);
    res.json({
      fights, wins: fights.filter((f) => f.win).length, stage, maxStage, attempts,
      rewards: { gold, gems, stones }, items: stored.stored, autoSold: stored.autoSold,
    });
  }));

  // =========================================================================
  // 5. 일일던전 — 서버 저장(매일 09:00 KST 도전 횟수 초기화, 스테이지 기록 유지)
  // =========================================================================
  async function resolveContentTeam(player, explicit) {
    const t = explicit && Array.isArray(explicit.team) && explicit.team.length === TEAM_SIZE ? explicit : { team: player.farm_team || [], formation: player.farm_formation };
    if ((t.team || []).length !== TEAM_SIZE) throw new Error("편성된 팀이 없음 — 던전 팀 또는 파밍 팀을 먼저 5명 편성");
    return t;
  }

  app.get("/api/players/:playerId/dungeons", route(async (req, res, { player }) => {
    const state = freshDungeonState(player.dungeon_state);
    const dungeons = DUNGEON_TYPES.map((type) => ({
      type, ...state[type], attemptsMax: DUNGEON_MAX_ATTEMPTS, maxStageCap: DUNGEON_MAX_STAGE,
      enemy: dungeonEnemy(type, state[type].stage), reward: dungeonReward(type, state[type].stage), tip: dungeonTip(type),
    }));
    res.json({ day: state.day, dungeons, team: player.dungeon_team || null });
  }));

  app.post("/api/players/:playerId/dungeons/team", route(async (req, res, { player }) => {
    const { characterIds, formation } = req.body || {};
    validateTeamIds(characterIds);
    if (formation && !FORMATIONS[formation]) throw new Error(`알 수 없는 포메이션: ${formation}`);
    await fetchOwnedCharacterStats(player.id, characterIds);
    const team = { team: characterIds, formation: formation || DEFAULT_FORMATION };
    await updatePlayer(player.id, { dungeon_team: team });
    res.json({ team });
  }));

  // body: { stage? } — 1 ~ 그 던전 최고 기록 사이 아무 데나(생략 시 현재 스테이지).
  app.post("/api/players/:playerId/dungeons/:type/challenge", route(async (req, res, { player, currency }) => {
    const { type } = req.params;
    if (!DUNGEON_TYPES.includes(type)) throw new Error(`알 수 없는 던전 타입: ${type}`);
    const state = freshDungeonState(player.dungeon_state);
    const s = state[type];
    const reqStage = Number((req.body || {}).stage) || s.stage;
    const stage = Math.max(1, Math.min(reqStage, s.maxStage));
    const t = await resolveContentTeam(player, player.dungeon_team);
    const { team, opts } = await buildOwnedTeam(player.id, player, t.team, t.formation, type);
    const result = resolveDungeonAttempt({ type, team, stage, maxStage: s.maxStage, attemptsUsed: s.attemptsUsed });
    if (result.error) throw new Error(result.error);

    let reward = 0;
    const playerPatch = {};
    const currencyPatch = {};
    let levelUp = null;
    if (result.win) {
      const bonuses = abilityBonuses(opts.abilityLines, opts.accountLevel, opts.odysseyItems);
      reward = Math.round(result.reward * bonuses[DUNGEON_REWARD_MULT_KEY[type]]);
      if (type === "gold") currencyPatch.gold = currency.gold + reward;
      else if (type === "gem") currencyPatch.dia = currency.dia + reward;
      else {
        const g = grantExp(player, currency, reward);
        Object.assign(playerPatch, g.playerPatch);
        if (g.diaFromLevel) currencyPatch.dia = currency.dia + g.diaFromLevel;
        levelUp = { levelsGained: g.levelsGained, diaFromLevel: g.diaFromLevel, level: g.playerPatch.level };
      }
      state[type] = { stage: result.stage, maxStage: result.maxStage, attemptsUsed: result.attemptsUsed };
    }
    playerPatch.dungeon_state = state;
    await Promise.all([updatePlayer(player.id, playerPatch), Object.keys(currencyPatch).length ? updateCurrency(player.id, currencyPatch) : null]);
    res.json({ ...result, reward, levelUp, state: state[type], team: teamSnapshot(team) });
  }));

  // =========================================================================
  // 6. 일일보스 — 서버 저장(오늘 횟수/오늘 누적 데미지/역대 최고 데미지)
  // =========================================================================
  app.get("/api/players/:playerId/daily-boss", route(async (req, res, { player }) => {
    const b = freshBossState(player);
    res.json({
      day: b.day, attemptsUsed: b.attemptsUsed, attemptsMax: BOSS_MAX_ATTEMPTS, damageToday: b.damageToday,
      bestDamage: Number(player.boss_best_damage) || 0, fightSeconds: BOSS_FIGHT_SECONDS,
      enemy: dailyBossEnemy(player.farm_max_stage || 1), dayIndex: dayIndex(),
    });
  }));

  app.post("/api/players/:playerId/daily-boss/challenge", route(async (req, res, { player, currency }) => {
    const b = freshBossState(player);
    const t = await resolveContentTeam(player, player.dungeon_team);
    const { team, opts } = await buildOwnedTeam(player.id, player, t.team, t.formation, "dailyBoss");
    const result = resolveDailyBossAttempt({ team, maxStageReached: player.farm_max_stage || 1, attemptsUsed: b.attemptsUsed });
    if (result.error) throw new Error(result.error);
    const bonuses = abilityBonuses(opts.abilityLines, opts.accountLevel, opts.odysseyItems);
    const reward = { gold: Math.round(result.reward.gold * bonuses.goldMult), gems: Math.round(result.reward.gems * bonuses.gemMult) };
    const damageToday = b.damageToday + result.damageDealt;
    const bestDamage = Math.max(Number(player.boss_best_damage) || 0, result.damageDealt);
    await Promise.all([
      updatePlayer(player.id, { boss_day: b.day, boss_attempts_used: result.attemptsUsed, boss_damage_today: damageToday, boss_best_damage: bestDamage }),
      updateCurrency(player.id, { gold: currency.gold + reward.gold, dia: currency.dia + reward.gems }),
    ]);
    res.json({ ...result, reward, damageToday, bestDamage, newBest: bestDamage > (Number(player.boss_best_damage) || 0), team: teamSnapshot(team) });
  }));

  // =========================================================================
  // 7. 랭킹 — GET /api/rankings?type=stage|level|boss|pvp&playerId=
  // =========================================================================
  app.get("/api/rankings", async (req, res) => {
    if (!requireDb(res)) return;
    const type = String(req.query.type || "stage");
    const def = RANKING_TYPES[type];
    if (!def) return res.status(400).json({ error: `type은 ${Object.keys(RANKING_TYPES).join("/")} 중 하나` });
    try {
      const cols = `id, nickname, level, ${def.column}`;
      let q = supabase.from("players").select(cols).order(def.column, { ascending: false });
      if (type === "level") q = q.order("exp", { ascending: false });
      const { data, error } = await q.limit(RANKING_LIMIT);
      if (error) throw new Error(error.message);
      const top = (data || []).map((p, i) => ({ rank: i + 1, playerId: p.id, nickname: p.nickname || "이름없는 영웅", level: p.level, value: Number(p[def.column]) || 0 }));
      let me = null;
      if (req.query.playerId) {
        const { data: mine } = await supabase.from("players").select(cols).eq("id", req.query.playerId).maybeSingle();
        if (mine) {
          const { count } = await supabase.from("players").select("id", { count: "exact", head: true }).gt(def.column, mine[def.column] ?? 0);
          me = { rank: (count || 0) + 1, playerId: mine.id, nickname: mine.nickname || "이름없는 영웅", level: mine.level, value: Number(mine[def.column]) || 0 };
        }
      }
      res.json({ type, label: def.label, top, me });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // =========================================================================
  // 8. 버프 현황 — GET /api/players/:playerId/buffs?content=farm (콘텐츠별 프리셋 반영)
  // =========================================================================
  app.get("/api/players/:playerId/buffs", route(async (req, res, { player }) => {
    const content = String(req.query.content || "farm");
    if (!ABILITY_CONTENT_KEYS.includes(content)) throw new Error(`content는 ${ABILITY_CONTENT_KEYS.join("/")} 중 하나`);
    const [allOwnedRows, opts] = await Promise.all([fetchAllOwnedRows(player.id), combatOptionsFor(player.id, player, content)]);
    const teamIds = player.farm_team || [];
    res.json({
      content, contentLabel: ABILITY_CONTENT_LABELS[content], abilityPreset: abilityPresetIndexForContent(player, content) + 1,
      level: player.level, levelAtkBonusPct: Math.round((levelAtkBonusMult(player.level || 1) - 1) * 1000) / 10,
      abilityLines: opts.abilityLines, equippedItems: opts.odysseyItems, equipmentSums: equippedOdysseyBonusSums(opts.odysseyItems),
      total: abilityBonuses(opts.abilityLines, opts.accountLevel, opts.odysseyItems),
      collection: computeCollectionBonus(allOwnedRows), synergy: computeSynergyState(teamIds),
    });
  }));

  // =========================================================================
  // 9. 클라이언트(웹 게임 화면)용 — 정적 메타 / 내 정보 / 보유 영웅 성장 정보 / 닉네임 / 초기화
  // =========================================================================
  app.get("/api/meta", (req, res) => res.json(META));

  app.get("/api/players/:playerId/me", route(async (req, res, { player, currency }) => {
    const { count: owned } = await supabase.from("player_characters").select("character_id", { count: "exact", head: true }).eq("player_id", player.id);
    res.json({
      playerId: player.id, nickname: player.nickname || null, email: player.email || null, isGuest: !player.email,
      level: player.level || 1, exp: player.exp || 0, expToNext: expToNextLevel(player.level || 1),
      levelAtkBonusPct: Math.round((levelAtkBonusMult(player.level || 1) - 1) * 1000) / 10,
      currency: { gold: currency.gold, dia: currency.dia, stone: currency.stone, discardedShards: currency.discarded_shards || {} },
      pity: player.pity_count || 0, hardPity: HARD_PITY, gachaRates: gachaRates(player.level || 1),
      ownedCount: owned || 0, rosterCount: ROSTER.length,
      farm: { stage: player.farm_stage || 1, maxStage: player.farm_max_stage || 1, team: player.farm_team || [], formation: player.farm_formation || DEFAULT_FORMATION },
      pvpRating: player.pvp_rating ?? PVP_RATING_START,
    });
  }));

  app.get("/api/players/:playerId/heroes", route(async (req, res, { player }) => {
    const rows = await fetchAllOwnedRowsFull(player.id);
    res.json({ heroes: rows.map(heroView), discardedShards: null });
  }));

  // 닉네임 설정/변경 — 2~12자, 중복 불가.
  app.post("/api/players/:playerId/nickname", route(async (req, res, { player }) => {
    const nickname = String((req.body || {}).nickname || "").trim();
    if (nickname.length < 2 || nickname.length > 12) throw new Error("닉네임은 2~12자");
    const { data: dup } = await supabase.from("players").select("id").eq("nickname", nickname).maybeSingle();
    if (dup && dup.id !== player.id) throw new Error("이미 사용 중인 닉네임");
    await updatePlayer(player.id, { nickname });
    res.json({ nickname });
  }));

  // 데이터 초기화 — 진행도/재화/보유 캐릭터/장비를 처음 상태로(계정·닉네임은 유지). body: { confirm: "초기화" }
  app.post("/api/players/:playerId/reset-data", route(async (req, res, { player }) => {
    if ((req.body || {}).confirm !== "초기화") throw new Error("확인 문구가 필요함");
    const del = await Promise.all([
      supabase.from("player_characters").delete().eq("player_id", player.id),
      supabase.from("player_items").delete().eq("player_id", player.id),
    ]);
    for (const d of del) if (d.error) throw new Error(d.error.message);
    const stamp = now();
    await updatePlayer(player.id, { ...RESET_PLAYER, farm_last_tick_at: stamp, odyssey_last_regen_at: stamp, pvp_last_regen_at: stamp });
    await updateCurrency(player.id, { gold: 10000, dia: 500, stone: 0, discarded_shards: {} });
    res.json({ ok: true });
  }));

  async function fetchAllOwnedRowsFull(playerId) {
    const { data, error } = await supabase.from("player_characters").select("*").eq("player_id", playerId);
    if (error) throw new Error(error.message);
    return data || [];
  }

  return { combatOptionsFor, loadEquippedItems };
}

// ---------------------------------------------------------------------------
// 보유 영웅 1명의 화면용 정보 — 스탯 + 다음 성장 비용(레벨업/승급/EX 승급/별)
// ---------------------------------------------------------------------------
export function heroView(row) {
  const entry = ROSTER_BY_ID.get(row.character_id);
  const rarity = row.current_rarity;
  const stats = applyExStarBonus(characterStatsAt(row.character_id, row.level, rarity), row.ex_star);
  const cap = LEVEL_CAP[rarity] || LEVEL_CAP[row.origin_rarity];
  const isEx = rarity === "EX";
  const levelUp = row.level >= cap ? null : isEx
    ? { gold: exLevelUpGoldCost(row.level), dia: exLevelUpDiaCost(row.level) }
    : { gold: baseLevelUpGoldCost(rarity, row.level), dia: 0 };
  const promo = isEx ? null : promotionCost(row.origin_rarity, rarity);
  const exReady = exPromotionReady(rarity);
  const star = row.ex_star || 0;
  return {
    characterId: row.character_id, name: entry?.name, class: entry?.class, classLabel: CLASSES[entry?.class]?.label, element: entry?.element,
    originRarity: row.origin_rarity, rarity, level: row.level, levelCap: cap, shards: row.shard_count || 0, exStar: star,
    stats: { atk: stats.atk, hp: stats.hp, def: stats.def, spd: stats.spd, critRate: stats.critRate, critDmg: stats.critDmg, mana: stats.mana, pen: stats.pen, res: stats.res },
    skills: (stats.skills || []).map((sk) => ({ key: sk.key, name: sk.skillName || null, kind: sk.kind, manaCost: sk.manaCost, passive: !!sk.passive })),
    dps: Math.round(stats.atk * stats.spd * (1 + stats.critRate * (stats.critDmg - 1))),
    growth: {
      levelUp,
      promote: promo ? { next: promo.nextRarity, shard: promo.shardCost, gold: promo.goldCost } : null,
      exPromote: exReady ? exPromotionCost(row.origin_rarity) : null,
      starUp: isEx && star < EX_STAR_MAX ? exStarUpCost(star + 1, row.origin_rarity) : null,
      starMax: EX_STAR_MAX, starBonusPct: star * EX_STAR_STAT_BONUS_PER_STAR * 100,
    },
  };
}

const RESET_PLAYER = {
  level: 1, exp: 0, pity_count: 0, ability_lines: [], ability_locked_indices: [], ability_presets: [], ability_active_preset: 0,
  ability_content_presets: {}, farm_team: [], farm_formation: DEFAULT_FORMATION, farm_stage: 1, farm_max_stage: 1, farm_team_presets: [],
  farm_active_preset: 0, farm_gold_remainder: 0, farm_exp_remainder: 0, farm_gem_remainder: 0, farm_kill_remainder: 0,
  farm_total_kills: 0, odyssey_stage: 1, odyssey_max_stage: 0, odyssey_attempts: ODYSSEY_MAX_ATTEMPTS, odyssey_theme_presets: {},
  equip_presets: [[], [], []], equip_active_preset: 0, auto_sell_grade: null, dungeon_state: {}, dungeon_team: null,
  boss_day: null, boss_attempts_used: 0, boss_damage_today: 0, boss_best_damage: 0,
  pvp_attack_team: [], pvp_defense_team: [], pvp_rating: PVP_RATING_START, pvp_wins: 0, pvp_losses: 0, pvp_draws: 0, pvp_attempts: PVP_MAX_ATTEMPTS,
};

const plainPool = Object.fromEntries(Object.entries(ODYSSEY_STAT_POOL).map(([k, v]) => [k, { label: v.label, icon: v.icon, unit: v.unit }]));
const META = {
  roster: ROSTER,
  classes: Object.fromEntries(Object.entries(CLASSES).map(([k, v]) => [k, { label: v.label }])),
  elements: { fire: { label: "화" }, wind: { label: "풍" }, water: { label: "수" } },
  rarityOrder: ["N", "R", "SR", "SSR", "XR", "HR", "XXR", "EX"], levelCap: LEVEL_CAP,
  formations: FORMATIONS, teamSize: TEAM_SIZE, presetSlots: PRESET_SLOTS,
  fieldSpecies: FIELD_SPECIES, bossSpecies: BOSS_SPECIES, stagesPerChapter: STAGES_PER_CHAPTER,
  stageTiers: ["마을 외곽 들판", "푸른 숲", "독버섯 늪", "무너진 성채", "지하 던전", "용암 동굴", "저주받은 묘지", "핏빛 폐허", "심연의 균열", "마왕성"],
  gachaBundles: GACHA_BUNDLES, hardPity: HARD_PITY,
  synergySets: SYNERGY_SETS, gradeCountConfig: GRADE_COUNT_CONFIG, dexFillBonusPerHero: DEX_FILL_BONUS_PER_HERO,
  abilityEffects: ABILITY_EFFECTS, abilityGrades: ABILITY_GRADES, abilityGradeLabel: ABILITY_GRADE_LABEL, abilityGradeColor: ABILITY_GRADE_COLOR,
  abilitySlotUnlockLevel: ABILITY_SLOT_UNLOCK_LEVEL, contentKeys: ABILITY_CONTENT_KEYS, contentLabels: ABILITY_CONTENT_LABELS,
  odysseyThemes: ODYSSEY_THEMES, odysseyItems: Object.fromEntries(Object.entries(ODYSSEY_ITEMS).map(([k, v]) => [k, { label: v.label, icon: v.icon, themeKey: v.themeKey }])),
  odysseyStatPool: plainPool, odysseyGrades: ODYSSEY_GRADES, odysseyGradeLabel: ODYSSEY_GRADE_LABEL, odysseyGradeColor: ODYSSEY_GRADE_COLOR,
  odysseySell: { gold: ODYSSEY_SELL_GOLD, gems: ODYSSEY_SELL_GEMS }, odysseyMaxAttempts: ODYSSEY_MAX_ATTEMPTS, odysseyRegenSeconds: ODYSSEY_REGEN_SECONDS,
  enhanceMax: ODYSSEY_ENHANCE_MAX_LEVEL, inventoryCap: INVENTORY_CAP,
  dungeonTypes: DUNGEON_TYPES, dungeonWeakRole: DUNGEON_WEAK_ROLE, dungeonWeakRoleBonusMult: DUNGEON_WEAK_ROLE_BONUS_MULT, dungeonMaxAttempts: DUNGEON_MAX_ATTEMPTS, dungeonMaxStage: DUNGEON_MAX_STAGE,
  dailyBossSkills: DAILY_BOSS_SKILL_POOL.map((s) => ({ key: s.key, name: s.name, kind: s.kind })), dailyBossAttempts: BOSS_MAX_ATTEMPTS, dailyBossSeconds: BOSS_FIGHT_SECONDS,
  skillKinds: Object.fromEntries(Object.entries(SKILL_KINDS).map(([k, v]) => [k, { label: v.label, desc: v.desc }])),
  pvpMaxAttempts: PVP_MAX_ATTEMPTS, rankingTypes: RANKING_TYPES, stoneCraft: PROMOTION_STONE_CRAFT_RECIPE,
};

// 전투 화면용 팀 스냅샷 — 클라이언트가 HP 바를 그릴 수 있게 id/최대 HP만.
export function teamSnapshot(team) {
  return (team || []).map((h) => ({ id: h.characterId, name: h.name, hp: h.hp, class: h.class, element: h.element, rarity: h.rarity }));
}
