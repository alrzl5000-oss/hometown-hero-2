// ============================================================================
// 게임 2.0 — 서버 엔트리포인트
// ============================================================================
// 지금까지 만든 순수 로직 모듈(stats/skills/combat/characters/gacha/promotion)을 실제로
// 구동되는 HTTP API로 묶는다. Railway가 "No start command detected"로 배포 실패했던 걸
// 고치는 1차 목적 + 이후 클라이언트(프론트엔드)가 붙을 수 있는 최소 API 표면을 제공.
//
// [범위] 지금은 "플레이어 생성 → 가챠 뽑기 → 조각 승급 → 전투 시뮬레이션"까지 한 바퀴
// 돌아가는 수준만 구현한다. 인증은 아직 없음(player_id를 URL에 그대로 노출) — 실제
// 유저가 붙기 전에 꼭 보강해야 할 부분.
import express from "express";
import { ROSTER, LEVEL_CAP, characterStatsAt } from "./data/characters.js";
import { pickCharacter, gachaRates } from "./data/gacha.js";
import {
  promotionCost, exPromotionReady, exPromotionCost, exLevelUpGoldCost, exLevelUpDiaCost,
  baseLevelUpGoldCost, EX_STAR_MAX, EX_STAR_STAT_BONUS_PER_STAR, exStarUpCost, applyExStarBonus,
  promotionStoneCraftCost,
} from "./data/promotion.js";
import { computeCollectionBonus, computeSynergyState } from "./data/synergy.js";
import {
  PVP_RATING_START, PVP_MAX_ATTEMPTS, expectedScore, pvpRatingChange, pvpGoldReward, pvpDiaReward,
  estimateTeamPower, regenPvpAttempts, pickRandomOpponent,
} from "./data/pvp.js";
import { EMAIL_RE, MIN_PASSWORD_LENGTH, hashPassword, comparePassword, signToken, requireAuth } from "./lib/auth.js";
import { expPerKill, expToNextLevel, applyExp, levelAtkBonusMult } from "./data/accountLevel.js";
import {
  ABILITY_SLOT_COUNT, ABILITY_SLOT_UNLOCK_LEVEL, unlockedSlotCount, rerollCostFor, rerollAbilityLines,
  gradeProbabilityTable, abilityBonuses, applyAbilityBonuses,
} from "./data/abilities.js";
import { simulateBattle } from "./lib/combat.js";
import {
  stageInfo, computeFarmTick, resolveBossChallenge, resolveRetreat,
} from "./data/farming.js";
import { assignFormation, FORMATIONS, TEAM_SIZE, DEFAULT_FORMATION } from "./data/formation.js";
import { DUNGEON_TYPES, dungeonEnemy, dungeonReward, dungeonTip, DUNGEON_MAX_ATTEMPTS, DUNGEON_MAX_STAGE, resolveDungeonAttempt } from "./data/dailyDungeon.js";
import { BOSS_MAX_ATTEMPTS, BOSS_FIGHT_SECONDS, dailyBossEnemy, dayIndex, resolveDailyBossAttempt } from "./data/dailyBoss.js";
import {
  ODYSSEY_THEMES, ODYSSEY_MAX_ATTEMPTS, ODYSSEY_REGEN_SECONDS, ODYSSEY_GRADES,
  themeForStage, odysseyEnemy, equippedOdysseyBonusSums, applyOdysseyEquipmentBonuses, resolveOdysseyFight,
} from "./data/odyssey.js";
import { supabase, hasSupabaseConfig, checkDatabaseConnection } from "./db.js";
import { GACHA_BUNDLES, GACHA_BUNDLE_SIZES, pullBundle, aggregatePulls, planBundleApplication } from "./data/gachaBundle.js";
import { normalizeAbilityPresets, abilityLinesForContent, ABILITY_CONTENT_KEYS, ABILITY_CONTENT_LABELS, PRESET_SLOTS } from "./data/presets.js";
import { registerFeatureRoutes, makePlayerContext, teamSnapshot } from "./features.js";
import { rollSetItem, fieldDropCount, rollDrop, pvpTier } from "./data/equipment.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
app.use(express.json());
// 웹 게임 화면(public/) + 캐릭터 도트(art_characters/) 정적 서빙
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
app.use(express.static(path.join(ROOT_DIR, "public"), { maxAge: "1h" }));
app.use("/art", express.static(path.join(ROOT_DIR, "art_characters"), { maxAge: "7d" }));

const PORT = process.env.PORT || 8080;
const DIA_PER_PULL = 300; // [임시값] 실제 재화 밸런스는 아직 확정 전 — 추후 조정 필요
const playerCtx = makePlayerContext({ supabase });

function findRosterEntry(characterId) {
  return ROSTER.find((c) => c.id === characterId);
}

// 클라이언트가 보내는 ownedCharacters는 DB 행 모양({character_id, current_rarity})이든
// camelCase({characterId, currentRarity})든 받아서 synergy.js가 먹는 DB 행 모양으로 맞춘다.
function normalizeOwnedRows(ownedCharacters) {
  if (!Array.isArray(ownedCharacters)) return null;
  return ownedCharacters
    .map((r) => ({
      character_id: r.character_id ?? r.characterId,
      current_rarity: r.current_rarity ?? r.currentRarity ?? r.rarity,
      origin_rarity: r.origin_rarity ?? r.originRarity,
    }))
    .filter((r) => r.character_id && findRosterEntry(r.character_id));
}

// 팀 5명 고정 + 배치(포메이션) 적용까지 한 번에 — /api/battle/simulate, /api/stages/:n/challenge
// 등 모든 콘텐츠 전투 엔드포인트가 이 헬퍼를 통해서만 팀을 만든다(중복 로직 방지).
//
// [어빌리티 연동] abilityLines + accountLevel을 요청 body에 함께 보내면(둘 다 선택 —
// 2.0은 아직 이 전투 엔드포인트들이 DB를 모르는 stateless 설계라, 다른 콘텐츠의
// 진행도/도전횟수와 똑같은 방식으로 "현재 상태"를 클라이언트가 함께 넘긴다), 어빌리티
// 줄(+선택적으로 오디세이 장비 odysseyItems)에서 계산한 팀 전체 버프를 포메이션 보너스
// 위에 한 번 더 적용한다. 둘 다 생략하면 기존과 완전히 동일하게 동작(하위 호환).
//
// [EX 별 / 컬렉션·시너지 연동] 팀 원소에 exStar를 넣으면 별 보너스가 붙고, ownedCharacters
// (지금 보유한 캐릭터 전체 목록)를 넘기면 컬렉션(도감) 보너스 + 이 팀의 시너지 세트 보너스가
// 함께 적용된다. 파밍/PvP처럼 DB를 아는 경로는 서버가 직접 채워 넣고, 던전/보스/오디세이처럼
// 무상태 경로는 어빌리티와 같은 방식으로 클라이언트가 함께 보낸다(생략 시 기존과 동일).
function buildFormedTeam(team, formationKey, { abilityLines, accountLevel, odysseyItems, ownedCharacters } = {}) {
  if (!Array.isArray(team) || team.length !== TEAM_SIZE) {
    throw new Error(`팀은 정확히 ${TEAM_SIZE}명이어야 함(받은 수: ${Array.isArray(team) ? team.length : 0})`);
  }
  if (formationKey && !FORMATIONS[formationKey]) {
    throw new Error(`알 수 없는 포메이션: ${formationKey} (가능: ${Object.keys(FORMATIONS).join(", ")})`);
  }
  const stats = team.map(({ characterId, level, rarity, exStar }) => {
    const entry = findRosterEntry(characterId);
    if (!entry) throw new Error(`unknown characterId: ${characterId}`);
    return applyExStarBonus(characterStatsAt(characterId, level || LEVEL_CAP[entry.rarity], rarity), exStar);
  });
  let formed = assignFormation(stats, formationKey || DEFAULT_FORMATION);
  if (abilityLines || accountLevel) {
    const bonuses = abilityBonuses(abilityLines || [], accountLevel || 1, odysseyItems);
    formed = applyAbilityBonuses(formed, bonuses);
  }
  const ownedRows = normalizeOwnedRows(ownedCharacters);
  if (ownedRows) {
    const collection = computeCollectionBonus(ownedRows);
    const synergy = computeSynergyState(team.map((m) => m.characterId));
    formed = applyStatMult(formed, combineMults(collection.mult, synergy.mult));
  }
  return formed;
}

// 컬렉션(도감)+시너지 보너스를 팀에 적용 — applyAbilityBonuses가 받는 bonuses 객체 모양
// (atkMult/hpMult/defMult/spdMult/critAdd/normalDmgMult/skillDmgMult)과 정확히 같은 모양을
// 만들어 그대로 재사용한다(server/data/synergy.js의 deltasToMult가 만드는 mult가 이미 이
// 모양이다 — 별도 적용 함수를 새로 만들 필요가 없음).
function applyStatMult(team, mult) {
  if (!mult) return team;
  return applyAbilityBonuses(team, { ...mult, normalDmgMult: 1, skillDmgMult: 1 });
}
function combineMults(a, b) {
  return {
    atkMult: (a.atkMult || 1) * (b.atkMult || 1),
    hpMult: (a.hpMult || 1) * (b.hpMult || 1),
    defMult: (a.defMult || 1) * (b.defMult || 1),
    spdMult: (a.spdMult || 1) * (b.spdMult || 1),
    critAdd: (a.critAdd || 0) + (b.critAdd || 0),
  };
}
async function fetchAllOwnedRows(playerId) {
  const { data, error } = await supabase.from("player_characters").select("character_id, current_rarity, origin_rarity, shard_count").eq("player_id", playerId);
  if (error) throw new Error(error.message);
  return data || [];
}
// "버려진 조각" — EX 승급(ex-promote) 시 넘치는 조각이나, 이미 EX인 캐릭터가 또 뽑혔을 때
// 쌓이는 조각(더 이상 정상 승급에 쓸 데가 없음)을 계정 공용 자원으로 환전한다(1.0의
// addDiscardedShards와 동일한 메커니즘 — jsonb 컬럼에 originRarity별로 누적).
async function addDiscardedShards(playerId, currency, originRarity, amount) {
  if (amount <= 0) return currency.discarded_shards || {};
  const current = { ...(currency.discarded_shards || {}) };
  current[originRarity] = (current[originRarity] || 0) + amount;
  await supabase.from("player_currencies").update({ discarded_shards: current, updated_at: new Date().toISOString() }).eq("player_id", playerId);
  return current;
}

// ---------------------------------------------------------------------------
// 헬스체크 / 메타데이터
// ---------------------------------------------------------------------------
app.get("/health", async (req, res) => {
  const db = await checkDatabaseConnection();
  res.json({ ok: db.ok, db, charactersLoaded: ROSTER.length });
});

app.get("/api/characters", (req, res) => {
  res.json({ characters: ROSTER, levelCap: LEVEL_CAP });
});

app.get("/api/characters/:id", (req, res) => {
  const entry = findRosterEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: "unknown characterId" });
  const level = Number(req.query.level) || LEVEL_CAP[entry.rarity];
  const currentRarity = req.query.rarity || undefined;
  try {
    res.json(characterStatsAt(req.params.id, level, currentRarity));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/formations", (req, res) => {
  res.json({ formations: FORMATIONS, teamSize: TEAM_SIZE, default: DEFAULT_FORMATION });
});

app.get("/api/gacha/rates", (req, res) => {
  const level = Number(req.query.level) || 1;
  res.json({ rates: gachaRates(level), diaPerPull: DIA_PER_PULL });
});

// ---------------------------------------------------------------------------
// 플레이어 — players / player_currencies / player_characters (Supabase)
// ---------------------------------------------------------------------------
function requireDb(res) {
  if (!hasSupabaseConfig) {
    res.status(503).json({ error: "DB 연결 안 됨 — SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_ANON_KEY) 환경변수 확인 필요" });
    return false;
  }
  return true;
}

app.post("/api/players", async (req, res) => {
  if (!requireDb(res)) return;
  const { data: player, error: playerErr } = await supabase.from("players").insert({}).select().single();
  if (playerErr) return res.status(500).json({ error: playerErr.message });
  const { error: currencyErr } = await supabase.from("player_currencies").insert({ player_id: player.id });
  if (currencyErr) return res.status(500).json({ error: currencyErr.message });
  res.json({ playerId: player.id });
});

app.get("/api/players/:playerId", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const [{ data: currency, error: currErr }, { data: owned, error: ownedErr }] = await Promise.all([
    supabase.from("player_currencies").select("*").eq("player_id", playerId).single(),
    supabase.from("player_characters").select("*").eq("player_id", playerId),
  ]);
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });
  if (ownedErr) return res.status(500).json({ error: ownedErr.message });
  const characters = owned.map((row) => ({
    ...row,
    stats: applyExStarBonus(characterStatsAt(row.character_id, row.level, row.current_rarity), row.ex_star),
  }));
  res.json({ currency, characters });
});

// 가챠 뽑기 — body: { size: 1 | 10 | 100 | 1000 } (생략 시 1). server/data/gachaBundle.js 참고.
// 10연 SR 이상 1개 확정 / 100연 SR 이상 10개 확정 / 1000연은 순수 확률(1.0 그대로).
// 처음 보유하는 캐릭터는 새 행, 이미 보유 중이면 조각 +n, 이미 EX면 계정 공용 "버려진 조각"으로 환전.
// 천장(pity)은 1회씩 뽑은 것과 똑같이 이어지고, 승급석 드랍(stoneGain)은 currency.stone에 적립.
app.get("/api/gacha/bundles", (req, res) => res.json({ bundles: GACHA_BUNDLES, sizes: GACHA_BUNDLE_SIZES }));

app.post("/api/players/:playerId/gacha/pull", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const size = Number((req.body || {}).size || 1);
  if (!GACHA_BUNDLES[size]) return res.status(400).json({ error: `size는 ${GACHA_BUNDLE_SIZES.join("/")} 중 하나` });
  try {
    const [{ data: currency, error: currErr }, { data: player, error: playerErr }, { data: ownedRows, error: ownedErr }] = await Promise.all([
      supabase.from("player_currencies").select("*").eq("player_id", playerId).single(),
      supabase.from("players").select("level, pity_count").eq("id", playerId).single(),
      supabase.from("player_characters").select("*").eq("player_id", playerId),
    ]);
    if (currErr || playerErr) return res.status(404).json({ error: "플레이어 없음" });
    if (ownedErr) throw new Error(ownedErr.message);
    const cost = GACHA_BUNDLES[size].cost;
    if (currency.dia < cost) return res.status(400).json({ error: `다이아 부족 (${currency.dia}/${cost})` });

    const bundle = pullBundle({ level: player.level, pity: player.pity_count, size });
    const agg = aggregatePulls(bundle.pulls);
    const existingById = new Map((ownedRows || []).map((r) => [r.character_id, r]));
    const plan = planBundleApplication(agg, existingById);

    // 새 캐릭터 + 조각 증가를 한 번의 upsert로(PK: player_id, character_id).
    const stamp = new Date().toISOString();
    const upserts = [
      ...plan.inserts.map((r) => ({ ...r, player_id: playerId, updated_at: stamp })),
      ...[...plan.shardAdds].map(([id, n]) => {
        const row = existingById.get(id);
        return { player_id: playerId, character_id: id, origin_rarity: row.origin_rarity, current_rarity: row.current_rarity, level: row.level, shard_count: (row.shard_count || 0) + n, updated_at: stamp };
      }),
    ];
    if (upserts.length) {
      const { error } = await supabase.from("player_characters").upsert(upserts, { onConflict: "player_id,character_id", defaultToNull: false });
      if (error) throw new Error(error.message);
    }
    const discarded = { ...(currency.discarded_shards || {}) };
    let discardedShardsGained = 0;
    for (const [k, n] of Object.entries(plan.discarded)) {
      discarded[k] = (discarded[k] || 0) + n;
      discardedShardsGained += n;
    }
    await Promise.all([
      supabase.from("player_currencies").update({
        dia: currency.dia - cost, stone: currency.stone + bundle.stoneGain, discarded_shards: discarded, updated_at: stamp,
      }).eq("player_id", playerId),
      supabase.from("players").update({ pity_count: bundle.pity }).eq("id", playerId),
    ]);

    const seenNew = new Set();
    const pulls = bundle.pulls.map((p) => {
      const isNew = plan.newIds.has(p.character.id) && !seenNew.has(p.character.id);
      if (isNew) seenNew.add(p.character.id);
      return { character: p.character, rarity: p.rarity, pool: p.pool, guaranteed: !!p.guaranteed, isNew };
    });
    const summary = {};
    for (const p of pulls) summary[p.rarity] = (summary[p.rarity] || 0) + 1;
    const first = pulls[0];
    // size 1 응답은 기존 필드(character/rarity/pool/isNew)를 그대로 유지(하위 호환).
    res.json({
      size, cost, pulls, summary, newCount: plan.newIds.size, pity: bundle.pity, stoneGain: bundle.stoneGain, discardedShardsGained,
      dia: currency.dia - cost,
      ...(size === 1 ? { character: first.character, rarity: first.rarity, pool: first.pool, isNew: first.isNew } : {}),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 전투/던전/보스 승리 후 계정 경험치 적립 — body: { expGained }. 레벨업 시 레벨당
// LEVEL_UP_GEM_REWARD(300) 다이아를 지급(기존 라이브게임은 "젬"이지만 2.0엔 다이아만 있어
// 다이아로 치환 — server/data/accountLevel.js 주석 참고).
app.post("/api/players/:playerId/gain-exp", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { expGained } = req.body || {};
  if (!Number.isFinite(expGained) || expGained < 0) return res.status(400).json({ error: "expGained은 0 이상의 숫자여야 함" });

  const [{ data: player, error: playerErr }, { data: currency, error: currErr }] = await Promise.all([
    supabase.from("players").select("level, exp").eq("id", playerId).single(),
    supabase.from("player_currencies").select("dia").eq("player_id", playerId).single(),
  ]);
  if (playerErr) return res.status(404).json({ error: "플레이어 없음" });
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });

  const { level, exp, levelsGained, gemsGained } = applyExp(player.level, player.exp, expGained);
  await Promise.all([
    supabase.from("players").update({ level, exp }).eq("id", playerId),
    gemsGained > 0
      ? supabase.from("player_currencies").update({ dia: currency.dia + gemsGained, updated_at: new Date().toISOString() }).eq("player_id", playerId)
      : Promise.resolve(),
  ]);

  res.json({ level, exp, levelsGained, gemsGained, levelAtkBonusMult: levelAtkBonusMult(level) });
});

// ---------------------------------------------------------------------------
// 어빌리티 — server/data/abilities.js. 3슬롯(계정레벨 10/20/30 해금), 재설정은 골드
// 소모(잠금된 슬롯은 배율 가산). 1차 포팅 범위: 프리셋 전환/콘텐츠별 자동전환, EX 초과
// 조각 "버려진 조각" 환전은 제외(파일 상단 주석 참고).
// ---------------------------------------------------------------------------
app.get("/api/players/:playerId/abilities", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { data: player, error } = await supabase
    .from("players")
    .select("level, ability_lines, ability_locked_indices, ability_presets, ability_active_preset, ability_content_presets")
    .eq("id", playerId)
    .single();
  if (error) return res.status(404).json({ error: "플레이어 없음" });

  const slots = unlockedSlotCount(player.level);
  const { presets, active } = normalizeAbilityPresets(player);
  res.json({
    level: player.level,
    unlockedSlots: slots,
    slotUnlockLevels: ABILITY_SLOT_UNLOCK_LEVEL,
    lines: presets[active].lines,
    lockedIndices: presets[active].lockedIndices,
    rerollCost: rerollCostFor(presets[active].lockedIndices, slots),
    gradeProbabilities: gradeProbabilityTable(player.level),
    presets: presets.map((p) => ({ ...p, rerollCost: rerollCostFor(p.lockedIndices, slots) })),
    activePreset: active,
    presetSlots: PRESET_SLOTS,
    contentPresets: player.ability_content_presets || {},
    contentKeys: ABILITY_CONTENT_KEYS,
    contentLabels: ABILITY_CONTENT_LABELS,
  });
});

app.post("/api/players/:playerId/abilities/reroll", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const [{ data: player, error: playerErr }, { data: currency, error: currErr }] = await Promise.all([
    supabase.from("players").select("level, ability_lines, ability_locked_indices, ability_presets, ability_active_preset").eq("id", playerId).single(),
    supabase.from("player_currencies").select("gold").eq("player_id", playerId).single(),
  ]);
  if (playerErr) return res.status(404).json({ error: "플레이어 없음" });
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });

  const slots = unlockedSlotCount(player.level);
  if (slots <= 0) return res.status(400).json({ error: "아직 해금된 어빌리티 슬롯이 없음(계정 레벨 10부터)" });
  // 재설정은 "지금 활성 프리셋"에만 — 프리셋마다 따로 재설정(1.0 그대로).
  const { presets, active } = normalizeAbilityPresets(player);
  const lockedIndices = presets[active].lockedIndices;
  const cost = rerollCostFor(lockedIndices, slots);
  if (currency.gold < cost) return res.status(400).json({ error: `골드 부족 (${currency.gold}/${cost})` });

  const newLines = rerollAbilityLines(presets[active].lines, slots, lockedIndices, player.level);
  presets[active] = { ...presets[active], lines: newLines };
  await Promise.all([
    supabase.from("players").update({ ability_lines: newLines, ability_presets: presets, ability_active_preset: active }).eq("id", playerId),
    supabase.from("player_currencies").update({ gold: currency.gold - cost, updated_at: new Date().toISOString() }).eq("player_id", playerId),
  ]);

  res.json({ lines: newLines, spent: cost, activePreset: active });
});

app.post("/api/players/:playerId/abilities/lock", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { slotIndex } = req.body || {};
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= ABILITY_SLOT_COUNT) {
    return res.status(400).json({ error: `slotIndex는 0~${ABILITY_SLOT_COUNT - 1} 사이의 정수여야 함` });
  }
  const { data: player, error } = await supabase
    .from("players").select("ability_lines, ability_locked_indices, ability_presets, ability_active_preset").eq("id", playerId).single();
  if (error) return res.status(404).json({ error: "플레이어 없음" });

  const { presets, active } = normalizeAbilityPresets(player);
  const current = presets[active].lockedIndices;
  const nextLocked = current.includes(slotIndex) ? current.filter((i) => i !== slotIndex) : [...current, slotIndex];
  presets[active] = { ...presets[active], lockedIndices: nextLocked };
  await supabase.from("players").update({ ability_locked_indices: nextLocked, ability_presets: presets, ability_active_preset: active }).eq("id", playerId);

  res.json({ lockedIndices: nextLocked, activePreset: active });
});

// ---------------------------------------------------------------------------
// 필드 파밍(방치) + 층보스 — server/data/farming.js. 1.0(alrzl5000-oss/minsu100)을 그대로
// 리부트한 서버-주도형 모델: 클라이언트가 3초(또는 그보다 느리게)마다 GET /farm을 poll하면
// 서버가 마지막 틱(farm_last_tick_at) 이후 흐른 시간만큼 골드/경험치/다이아/킬을 계산해서
// 적립한다 — 앱을 꺼둬도(오프라인) 다시 켰을 때 그 사이 쌓인 몫이 한 번에 들어온다(상한
// FARM_OFFLINE_CAP_SECONDS=8시간). 2.0의 다른 전투 콘텐츠(스테이지 구 버전/던전/보스/
// 오디세이)는 전부 "클라이언트가 지금 상태를 함께 보내는 무상태" 방식이었는데, 이 콘텐츠만
// 예외적으로 서버가 진행도(farm_stage/farm_team 등)를 직접 기억한다 — 1.0 원본이 원래
// 그런 구조였고, 방치형 파밍은 구조적으로 무상태가 될 수 없기 때문(민수님이 지적한
// "근간인 스테이지" 재설계의 핵심).
// ---------------------------------------------------------------------------
function requireFarmTeamSize(ids) {
  if (!Array.isArray(ids) || ids.length !== TEAM_SIZE) {
    throw new Error(`파밍 팀은 정확히 ${TEAM_SIZE}명이어야 함(받은 수: ${Array.isArray(ids) ? ids.length : 0})`);
  }
}

// 플레이어가 실제로 보유한 캐릭터인지 Supabase에서 직접 확인하고, 그 캐릭터의 "실제"
// level/current_rarity(클라이언트가 임의로 더 세게 보낼 수 없도록)를 그대로 사용한다.
async function fetchOwnedCharacterStats(playerId, characterIds) {
  const { data: rows, error } = await supabase
    .from("player_characters")
    .select("character_id, level, current_rarity, ex_star")
    .eq("player_id", playerId)
    .in("character_id", characterIds);
  if (error) throw new Error(error.message);
  const byId = new Map(rows.map((r) => [r.character_id, r]));
  return characterIds.map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error(`보유하지 않은 캐릭터: ${id}`);
    return { characterId: id, level: row.level, rarity: row.current_rarity, exStar: row.ex_star || 0 };
  });
}

// 파밍 상태를 "지금 시점까지" 정산한다 — 틱 계산 + DB 반영을 한 번에. 팀 변경/보스전/
// 후퇴처럼 상태가 바뀌는 모든 액션 앞에서 먼저 호출해, 1.0 원칙("상태 변화 전에 먼저
// 틱 적용")을 그대로 지킨다. team이 아직 설정 안 돼 있으면(farm_team 비어있음) gained:
// null, team: null로 반환(호출부가 "팀부터 설정하라"고 안내할 수 있게).
async function settleFarm(playerId, player, currency) {
  const farmTeamIds = player.farm_team || [];
  let team = null;
  let rewardMult = { goldMult: 1, expMult: 1, gemMult: 1 };
  if (farmTeamIds.length === TEAM_SIZE) {
    // EX 별(fetchOwnedCharacterStats가 exStar 포함) + 컬렉션/시너지(보유 전체 목록)까지
    // buildFormedTeam 한 곳에서 적용 — 다른 콘텐츠와 완전히 같은 경로.
    // 어빌리티는 "파밍" 콘텐츠 프리셋 매핑, 장비는 지금 활성 장비 프리셋(server/features.js).
    const [owned, allOwnedRows, opts] = await Promise.all([
      fetchOwnedCharacterStats(playerId, farmTeamIds),
      fetchAllOwnedRows(playerId),
      playerCtx.combatOptionsFor(playerId, player, "farm"),
    ]);
    team = buildFormedTeam(owned, player.farm_formation || DEFAULT_FORMATION, { ...opts, ownedCharacters: allOwnedRows });
    // 골드/경험치/다이아 획득량(어빌리티 · 장비 · 세트 효과)이 파밍 수입에도 실제로 붙는다
    // (2026-11-25 장비 개편 — 이전엔 던전/일일보스 보상에만 적용되고 파밍엔 빠져 있었음).
    rewardMult = abilityBonuses(opts.abilityLines || [], opts.accountLevel || 1, opts.odysseyItems);
  }

  const now = Date.now();
  const lastTick = player.farm_last_tick_at ? new Date(player.farm_last_tick_at).getTime() : now;
  const elapsedSeconds = Math.max(0, (now - lastTick) / 1000);

  if (!team || elapsedSeconds <= 0) {
    if (!player.farm_last_tick_at) {
      await supabase.from("players").update({ farm_last_tick_at: new Date(now).toISOString() }).eq("id", playerId);
    }
    return { player, currency, gained: null, team };
  }

  const tick = computeFarmTick(team, player.farm_stage || 1, elapsedSeconds);
  const goldAcc = (Number(player.farm_gold_remainder) || 0) + tick.gold * rewardMult.goldMult;
  const expAcc = (Number(player.farm_exp_remainder) || 0) + tick.exp * rewardMult.expMult;
  const gemAcc = (Number(player.farm_gem_remainder) || 0) + tick.gem * rewardMult.gemMult;
  const killAcc = (Number(player.farm_kill_remainder) || 0) + tick.kills;
  const goldWhole = Math.floor(goldAcc);
  const expWhole = Math.floor(expAcc);
  const gemWhole = Math.floor(gemAcc);
  const killWhole = Math.floor(killAcc);

  const { level, exp, levelsGained, gemsGained } = applyExp(player.level, player.exp, expWhole);
  const playerUpdates = {
    farm_last_tick_at: new Date(now).toISOString(),
    farm_gold_remainder: goldAcc - goldWhole,
    farm_exp_remainder: expAcc - expWhole,
    farm_gem_remainder: gemAcc - gemWhole,
    farm_kill_remainder: killAcc - killWhole,
    farm_total_kills: (Number(player.farm_total_kills) || 0) + killWhole,
    level,
    exp,
  };
  // 개척자 세트 — 잡몹 처치 수에 비례해 낮은 확률로 드랍(자리 비움 중 몫 포함, 한 번에 최대 15개)
  const dropN = fieldDropCount(killWhole, player.farm_stage || 1);
  const drops = dropN ? await playerCtx.storeDrops(player, Array.from({ length: dropN }, () => rollSetItem("field", { tier: player.farm_stage || 1 }))) : null;
  const currencyUpdates = {
    gold: currency.gold + goldWhole + (drops?.gold || 0),
    dia: currency.dia + gemWhole + gemsGained + (drops?.gems || 0),
    ...(drops?.dust ? { dust: (Number(currency.dust) || 0) + drops.dust } : {}),
    updated_at: new Date().toISOString(),
  };
  await Promise.all([
    supabase.from("players").update(playerUpdates).eq("id", playerId),
    supabase.from("player_currencies").update(currencyUpdates).eq("player_id", playerId),
  ]);

  return {
    player: { ...player, ...playerUpdates },
    currency: { ...currency, ...currencyUpdates },
    gained: {
      gold: goldWhole, exp: expWhole, gem: gemWhole, kills: killWhole,
      levelsGained, accountGemsGained: gemsGained, elapsedSeconds: tick.cappedSeconds,
      drops: drops ? drops.stored : [], autoHandled: drops ? drops.autoSold.length : 0,
    },
    team,
  };
}

async function loadPlayerAndCurrency(playerId) {
  const [{ data: player, error: playerErr }, { data: currency, error: currErr }] = await Promise.all([
    supabase.from("players").select("*").eq("id", playerId).single(),
    supabase.from("player_currencies").select("*").eq("player_id", playerId).single(),
  ]);
  if (playerErr || currErr) return null;
  return { player, currency };
}

// 현재 파밍 상태 조회 — 호출할 때마다 그 자리에서 틱을 정산한다(클라이언트가 3초 간격
// 정도로 polling하는 걸 전제 — 1.0의 GET /battle/state와 동일한 패턴).
app.get("/api/players/:playerId/farm", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const loaded = await loadPlayerAndCurrency(playerId);
  if (!loaded) return res.status(404).json({ error: "플레이어 없음" });
  try {
    const settled = await settleFarm(playerId, loaded.player, loaded.currency);
    const p = settled.player;
    res.json({
      stage: p.farm_stage || 1,
      maxStage: p.farm_max_stage || 1,
      totalKills: p.farm_total_kills || 0,
      farmTeam: p.farm_team || [],
      farmFormation: p.farm_formation || DEFAULT_FORMATION,
      teamSet: !!settled.team,
      currency: settled.currency,
      level: p.level,
      exp: p.exp,
      gained: settled.gained,
      stageInfo: stageInfo(p.farm_stage || 1),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 파밍 팀/배치 설정 — body: { characterIds: [5개], formation? }. 소유 검증은 서버가
// player_characters에서 직접 확인(클라이언트가 보낸 level/rarity를 신뢰하지 않음).
app.post("/api/players/:playerId/farm/team", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { characterIds, formation } = req.body || {};
  try {
    requireFarmTeamSize(characterIds);
    if (formation && !FORMATIONS[formation]) throw new Error(`알 수 없는 포메이션: ${formation} (가능: ${Object.keys(FORMATIONS).join(", ")})`);
    const loaded = await loadPlayerAndCurrency(playerId);
    if (!loaded) return res.status(404).json({ error: "플레이어 없음" });

    // 팀 교체 전에 "지금까지 쌓인 몫"을 옛 팀 기준으로 먼저 정산(1.0 원칙).
    const settled = await settleFarm(playerId, loaded.player, loaded.currency);
    await fetchOwnedCharacterStats(playerId, characterIds); // 소유 검증(미보유면 throw)

    const nextFormation = formation || settled.player.farm_formation || DEFAULT_FORMATION;
    await supabase.from("players").update({
      farm_team: characterIds,
      farm_formation: nextFormation,
      farm_last_tick_at: new Date().toISOString(),
    }).eq("id", playerId);

    res.json({ farmTeam: characterIds, farmFormation: nextFormation, settledGain: settled.gained });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 층보스 도전 — 실시간 1회 전투(simulateBattle, 승패가 사전에 정해지지 않음). 승리해야만
// stage가 오르고(=진짜 관문), 패배는 페널티 없이 그 자리에서 파밍 계속. 도전 횟수 제한
// 없음(1.0의 floor boss와 동일 — 지는 데 비용이 없으니 굳이 막을 이유가 없음).
app.post("/api/players/:playerId/farm/boss-challenge", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const loaded = await loadPlayerAndCurrency(playerId);
  if (!loaded) return res.status(404).json({ error: "플레이어 없음" });
  try {
    const settled = await settleFarm(playerId, loaded.player, loaded.currency);
    if (!settled.team) return res.status(400).json({ error: "먼저 파밍 팀을 설정해야 함 — POST /farm/team" });

    const stage = settled.player.farm_stage || 1;
    const maxStage = settled.player.farm_max_stage || 1;
    // 층보스는 "층보스" 콘텐츠 프리셋으로 다시 조립(매핑이 없으면 파밍 팀과 동일한 결과).
    const [ownedBoss, allOwnedBoss, bossOpts] = await Promise.all([
      fetchOwnedCharacterStats(playerId, settled.player.farm_team),
      fetchAllOwnedRows(playerId),
      playerCtx.combatOptionsFor(playerId, settled.player, "floorBoss"),
    ]);
    const bossTeam = buildFormedTeam(ownedBoss, settled.player.farm_formation || DEFAULT_FORMATION, { ...bossOpts, ownedCharacters: allOwnedBoss });
    const result = resolveBossChallenge({ team: bossTeam, stage, maxStage });

    let nextCurrency = settled.currency;
    if (result.win && result.diaBonus > 0) {
      nextCurrency = { ...settled.currency, dia: settled.currency.dia + result.diaBonus };
      await supabase.from("player_currencies").update({ dia: nextCurrency.dia, updated_at: new Date().toISOString() }).eq("player_id", playerId);
    }
    await supabase.from("players").update({
      farm_stage: result.stage,
      farm_max_stage: result.maxStage,
      farm_last_tick_at: new Date().toISOString(),
    }).eq("id", playerId);
    // 정복자 세트 — 처음 깨는 층의 보스를 이겼을 때만 30%(이미 깬 층 재도전은 드랍 없음)
    const drop = result.win && result.isFirstClear && rollDrop("floorBoss", stage) ? await playerCtx.grantSetDrops(settled.player, "floorBoss", 1, stage) : null;

    res.json({
      win: result.win,
      stage: result.stage,
      maxStage: result.maxStage,
      isFirstClear: !!result.isFirstClear,
      diaBonus: result.diaBonus || 0,
      boss: { name: result.boss.name, icon: result.boss.icon, speciesKey: result.boss.speciesKey, hp: result.boss.hp, characterId: result.boss.characterId, element: result.boss.element },
      team: teamSnapshot(bossTeam),
      hits: result.hits,
      endedAt: result.endedAt,
      currency: nextCurrency,
      settledGain: settled.gained,
      drop,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 자유 후퇴 — maxStage 이하 어디로든. body: { stage }
app.post("/api/players/:playerId/farm/retreat", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { stage } = req.body || {};
  const loaded = await loadPlayerAndCurrency(playerId);
  if (!loaded) return res.status(404).json({ error: "플레이어 없음" });
  try {
    const settled = await settleFarm(playerId, loaded.player, loaded.currency);
    const nextStage = resolveRetreat(stage, settled.player.farm_max_stage || 1);
    await supabase.from("players").update({ farm_stage: nextStage, farm_last_tick_at: new Date().toISOString() }).eq("id", playerId);
    res.json({ stage: nextStage, maxStage: settled.player.farm_max_stage || 1, settledGain: settled.gained });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 조각+골드 승급 — N→R→SR→SSR→XR
app.post("/api/players/:playerId/characters/:characterId/promote", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId, characterId } = req.params;
  const [{ data: owned, error: ownedErr }, { data: currency, error: currErr }] = await Promise.all([
    supabase.from("player_characters").select("*").eq("player_id", playerId).eq("character_id", characterId).maybeSingle(),
    supabase.from("player_currencies").select("*").eq("player_id", playerId).single(),
  ]);
  if (ownedErr || !owned) return res.status(404).json({ error: "보유하지 않은 캐릭터" });
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });

  const cost = promotionCost(owned.origin_rarity, owned.current_rarity);
  if (!cost) return res.status(400).json({ error: "더 이상 승급할 수 없음(XR 도달 — EX 프레스티지는 /ex-promote 참고)" });
  if (owned.shard_count < cost.shardCost) return res.status(400).json({ error: `조각 부족 (${owned.shard_count}/${cost.shardCost})` });
  if (currency.gold < cost.goldCost) return res.status(400).json({ error: `골드 부족 (${currency.gold}/${cost.goldCost})` });

  await supabase
    .from("player_characters")
    .update({ shard_count: owned.shard_count - cost.shardCost, current_rarity: cost.nextRarity, updated_at: new Date().toISOString() })
    .eq("player_id", playerId)
    .eq("character_id", characterId);
  await supabase.from("player_currencies").update({ gold: currency.gold - cost.goldCost, updated_at: new Date().toISOString() }).eq("player_id", playerId);

  res.json({ characterId, newRarity: cost.nextRarity, spent: cost });
});

// EX 프레스티지 승급 — XR에서만 가능. (돌/골드/다이아 소모 — 돌 획득 경로는 아직 미구현이라
// 실제로는 거의 도달 못 하지만, 로직/비용 계산은 미리 맞춰둔다.)
app.post("/api/players/:playerId/characters/:characterId/ex-promote", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId, characterId } = req.params;
  const [{ data: owned, error: ownedErr }, { data: currency, error: currErr }] = await Promise.all([
    supabase.from("player_characters").select("*").eq("player_id", playerId).eq("character_id", characterId).maybeSingle(),
    supabase.from("player_currencies").select("*").eq("player_id", playerId).single(),
  ]);
  if (ownedErr || !owned) return res.status(404).json({ error: "보유하지 않은 캐릭터" });
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });
  if (!exPromotionReady(owned.current_rarity)) return res.status(400).json({ error: "XR 등급에 도달해야 EX 프레스티지 승급이 가능합니다" });

  const cost = exPromotionCost(owned.origin_rarity);
  if (owned.shard_count < cost.shard) return res.status(400).json({ error: `조각 부족 (${owned.shard_count}/${cost.shard})` });
  if (currency.stone < cost.stone) return res.status(400).json({ error: `승급석 부족 (${currency.stone}/${cost.stone})` });
  if (currency.gold < cost.gold) return res.status(400).json({ error: `골드 부족` });
  if (currency.dia < cost.dia) return res.status(400).json({ error: `다이아 부족` });

  // EX 승급 이후엔 정상 조각 풀이 더 필요 없으므로, 소모하고 남은 조각은 버리지 않고
  // 계정 공용 "버려진 조각"으로 전환한다(1.0의 EX 승급 시 addDiscardedShards 호출 그대로) —
  // 이 조각은 나중에 EX 스타(별)와 승급석 제작에 쓰인다.
  const leftoverShards = owned.shard_count - cost.shard;
  await supabase
    .from("player_characters")
    .update({ shard_count: 0, current_rarity: "EX", ex_unlocked: true, ex_star: 0, updated_at: new Date().toISOString() })
    .eq("player_id", playerId)
    .eq("character_id", characterId);
  await supabase
    .from("player_currencies")
    .update({ stone: currency.stone - cost.stone, gold: currency.gold - cost.gold, dia: currency.dia - cost.dia, updated_at: new Date().toISOString() })
    .eq("player_id", playerId);
  const discardedShards = await addDiscardedShards(playerId, currency, owned.origin_rarity, leftoverShards);

  res.json({ characterId, newRarity: "EX", discardedShardsGained: leftoverShards, discardedShards });
});

// ---------------------------------------------------------------------------
// 캐릭터 골드 레벨업(비-EX 등급) — 1.0 routes/characters.js의 /level-up, /level-up-max를
// 그대로 이식. 골드만 소모(조각/스톤 불필요), 그 등급의 레벨캡(LEVEL_CAP)에서 막힌다.
// ---------------------------------------------------------------------------
app.post("/api/players/:playerId/characters/:characterId/level-up", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId, characterId } = req.params;
  const [{ data: owned, error: ownedErr }, { data: currency, error: currErr }] = await Promise.all([
    supabase.from("player_characters").select("*").eq("player_id", playerId).eq("character_id", characterId).maybeSingle(),
    supabase.from("player_currencies").select("*").eq("player_id", playerId).single(),
  ]);
  if (ownedErr || !owned) return res.status(404).json({ error: "보유하지 않은 캐릭터" });
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });
  if (owned.current_rarity === "EX") return res.status(400).json({ error: "EX 등급은 /ex-level-up을 사용해야 함(골드+다이아 별도 비용)" });

  const cap = LEVEL_CAP[owned.current_rarity] || LEVEL_CAP[owned.origin_rarity];
  if (owned.level >= cap) return res.status(400).json({ error: `이미 이 등급의 레벨캡(${cap})에 도달함(승급해야 더 올릴 수 있음)` });
  const cost = baseLevelUpGoldCost(owned.current_rarity, owned.level);
  if (currency.gold < cost) return res.status(400).json({ error: `골드 부족 (${currency.gold}/${cost})` });

  const nextLevel = owned.level + 1;
  await Promise.all([
    supabase.from("player_characters").update({ level: nextLevel, updated_at: new Date().toISOString() }).eq("player_id", playerId).eq("character_id", characterId),
    supabase.from("player_currencies").update({ gold: currency.gold - cost, updated_at: new Date().toISOString() }).eq("player_id", playerId),
  ]);
  res.json({ characterId, level: nextLevel, levelCap: cap, spentGold: cost });
});

// 골드가 바닥날 때까지(또는 레벨캡까지) 한 번에 쭉 올리는 벌크 버전(1.0 /level-up-max).
app.post("/api/players/:playerId/characters/:characterId/level-up-max", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId, characterId } = req.params;
  const [{ data: owned, error: ownedErr }, { data: currency, error: currErr }] = await Promise.all([
    supabase.from("player_characters").select("*").eq("player_id", playerId).eq("character_id", characterId).maybeSingle(),
    supabase.from("player_currencies").select("*").eq("player_id", playerId).single(),
  ]);
  if (ownedErr || !owned) return res.status(404).json({ error: "보유하지 않은 캐릭터" });
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });
  if (owned.current_rarity === "EX") return res.status(400).json({ error: "EX 등급은 /ex-level-up-max를 사용해야 함(골드+다이아 별도 비용)" });

  const cap = LEVEL_CAP[owned.current_rarity] || LEVEL_CAP[owned.origin_rarity];
  let level = owned.level;
  let gold = currency.gold;
  let spent = 0;
  let levelsGained = 0;
  while (level < cap) {
    const cost = baseLevelUpGoldCost(owned.current_rarity, level);
    if (gold < cost) break;
    gold -= cost;
    spent += cost;
    level += 1;
    levelsGained += 1;
  }
  if (levelsGained === 0) {
    const reason = level >= cap ? `이미 이 등급의 레벨캡(${cap})에 도달함` : `골드 부족(다음 레벨 비용 ${baseLevelUpGoldCost(owned.current_rarity, level)})`;
    return res.status(400).json({ error: reason });
  }
  await Promise.all([
    supabase.from("player_characters").update({ level, updated_at: new Date().toISOString() }).eq("player_id", playerId).eq("character_id", characterId),
    supabase.from("player_currencies").update({ gold, updated_at: new Date().toISOString() }).eq("player_id", playerId),
  ]);
  res.json({ characterId, level, levelCap: cap, levelsGained, spentGold: spent });
});

// EX 등급 전용 레벨업 — 골드+다이아 둘 다 소모(exLevelUpGoldCost/exLevelUpDiaCost, 기존
// promotion.js에 이미 있던 공식인데 지금까지 라우트가 없어 안 쓰이고 있었다 — 이번에 연결).
app.post("/api/players/:playerId/characters/:characterId/ex-level-up", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId, characterId } = req.params;
  const [{ data: owned, error: ownedErr }, { data: currency, error: currErr }] = await Promise.all([
    supabase.from("player_characters").select("*").eq("player_id", playerId).eq("character_id", characterId).maybeSingle(),
    supabase.from("player_currencies").select("*").eq("player_id", playerId).single(),
  ]);
  if (ownedErr || !owned) return res.status(404).json({ error: "보유하지 않은 캐릭터" });
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });
  if (owned.current_rarity !== "EX") return res.status(400).json({ error: "EX 프레스티지 승급을 먼저 해야 함(/ex-promote)" });

  const cap = LEVEL_CAP.EX;
  if (owned.level >= cap) return res.status(400).json({ error: `이미 EX 레벨캡(${cap})에 도달함` });
  const goldCost = exLevelUpGoldCost(owned.level);
  const diaCost = exLevelUpDiaCost(owned.level);
  if (currency.gold < goldCost) return res.status(400).json({ error: `골드 부족 (${currency.gold}/${goldCost})` });
  if (currency.dia < diaCost) return res.status(400).json({ error: `다이아 부족 (${currency.dia}/${diaCost})` });

  const nextLevel = owned.level + 1;
  await Promise.all([
    supabase.from("player_characters").update({ level: nextLevel, updated_at: new Date().toISOString() }).eq("player_id", playerId).eq("character_id", characterId),
    supabase.from("player_currencies").update({ gold: currency.gold - goldCost, dia: currency.dia - diaCost, updated_at: new Date().toISOString() }).eq("player_id", playerId),
  ]);
  res.json({ characterId, level: nextLevel, levelCap: cap, spentGold: goldCost, spentDia: diaCost });
});

app.post("/api/players/:playerId/characters/:characterId/ex-level-up-max", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId, characterId } = req.params;
  const [{ data: owned, error: ownedErr }, { data: currency, error: currErr }] = await Promise.all([
    supabase.from("player_characters").select("*").eq("player_id", playerId).eq("character_id", characterId).maybeSingle(),
    supabase.from("player_currencies").select("*").eq("player_id", playerId).single(),
  ]);
  if (ownedErr || !owned) return res.status(404).json({ error: "보유하지 않은 캐릭터" });
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });
  if (owned.current_rarity !== "EX") return res.status(400).json({ error: "EX 프레스티지 승급을 먼저 해야 함(/ex-promote)" });

  const cap = LEVEL_CAP.EX;
  let level = owned.level;
  let gold = currency.gold;
  let dia = currency.dia;
  let spentGold = 0;
  let spentDia = 0;
  let levelsGained = 0;
  while (level < cap) {
    const goldCost = exLevelUpGoldCost(level);
    const diaCost = exLevelUpDiaCost(level);
    if (gold < goldCost || dia < diaCost) break;
    gold -= goldCost;
    dia -= diaCost;
    spentGold += goldCost;
    spentDia += diaCost;
    level += 1;
    levelsGained += 1;
  }
  if (levelsGained === 0) return res.status(400).json({ error: level >= cap ? `이미 EX 레벨캡(${cap})에 도달함` : "골드 또는 다이아 부족" });
  await Promise.all([
    supabase.from("player_characters").update({ level, updated_at: new Date().toISOString() }).eq("player_id", playerId).eq("character_id", characterId),
    supabase.from("player_currencies").update({ gold, dia, updated_at: new Date().toISOString() }).eq("player_id", playerId),
  ]);
  res.json({ characterId, level, levelCap: cap, levelsGained, spentGold, spentDia });
});

// ---------------------------------------------------------------------------
// EX 스타(5성 합성) — EX 승급 이후의 최종 성장. "버려진 조각"(태초 등급별 jsonb)+승급석
// 소모, 별마다 EX_STAR_STAT_BONUS_PER_STAR(5%)만큼 전투 스탯 가산 — applyExStarBonus가
// buildFormedTeam(모든 전투 경로)과 캐릭터 목록 조회 양쪽에 똑같이 적용한다.
// ---------------------------------------------------------------------------
app.post("/api/players/:playerId/characters/:characterId/star-up", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId, characterId } = req.params;
  const [{ data: owned, error: ownedErr }, { data: currency, error: currErr }] = await Promise.all([
    supabase.from("player_characters").select("*").eq("player_id", playerId).eq("character_id", characterId).maybeSingle(),
    supabase.from("player_currencies").select("*").eq("player_id", playerId).single(),
  ]);
  if (ownedErr || !owned) return res.status(404).json({ error: "보유하지 않은 캐릭터" });
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });
  if (owned.current_rarity !== "EX") return res.status(400).json({ error: "EX 프레스티지 승급을 먼저 해야 스타 합성이 가능합니다" });

  const currentStar = owned.ex_star || 0;
  if (currentStar >= EX_STAR_MAX) return res.status(400).json({ error: `이미 최대 별(${EX_STAR_MAX}성)에 도달함` });
  const cost = exStarUpCost(currentStar + 1, owned.origin_rarity);
  const discarded = currency.discarded_shards || {};
  const availableShard = discarded[owned.origin_rarity] || 0;
  if (availableShard < cost.shard) return res.status(400).json({ error: `버려진 조각 부족 (${availableShard}/${cost.shard}, ${owned.origin_rarity}등급)` });
  if (currency.stone < cost.stone) return res.status(400).json({ error: `승급석 부족 (${currency.stone}/${cost.stone})` });

  const nextDiscarded = { ...discarded, [owned.origin_rarity]: availableShard - cost.shard };
  const nextStar = currentStar + 1;
  await Promise.all([
    supabase.from("player_characters").update({ ex_star: nextStar, updated_at: new Date().toISOString() }).eq("player_id", playerId).eq("character_id", characterId),
    supabase.from("player_currencies").update({ stone: currency.stone - cost.stone, discarded_shards: nextDiscarded, updated_at: new Date().toISOString() }).eq("player_id", playerId),
  ]);
  res.json({ characterId, star: nextStar, starMax: EX_STAR_MAX, statBonusPct: nextStar * EX_STAR_STAT_BONUS_PER_STAR * 100, spent: cost });
});

// 승급석 제작 — 버려진 조각을 소모해 확률적으로 승급석 1개를 만든다(실패해도 재료는
// 소모됨, 1.0 설계 그대로). body: { originRarity }
app.post("/api/players/:playerId/craft-promotion-stone", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { originRarity } = req.body || {};
  const recipe = promotionStoneCraftCost(originRarity);
  if (!recipe) return res.status(400).json({ error: `알 수 없는 태초 등급: ${originRarity}` });

  const { data: currency, error: currErr } = await supabase.from("player_currencies").select("*").eq("player_id", playerId).single();
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });
  const discarded = currency.discarded_shards || {};
  const available = discarded[originRarity] || 0;
  if (available < recipe.shard) return res.status(400).json({ error: `버려진 조각 부족 (${available}/${recipe.shard}, ${originRarity}등급)` });
  if (currency.gold < recipe.gold) return res.status(400).json({ error: `골드 부족 (${currency.gold}/${recipe.gold})` });

  const success = Math.random() < recipe.successRate;
  const nextDiscarded = { ...discarded, [originRarity]: available - recipe.shard };
  await supabase.from("player_currencies").update({
    discarded_shards: nextDiscarded,
    gold: currency.gold - recipe.gold,
    stone: currency.stone + (success ? 1 : 0),
    updated_at: new Date().toISOString(),
  }).eq("player_id", playerId);

  res.json({ success, originRarity, spent: recipe, stoneGained: success ? 1 : 0 });
});

// ---------------------------------------------------------------------------
// 컬렉션(도감)+시너지 정보 조회 — 1.0 /bonuses와 동일: 전투에는 settleFarm에서 이미
// 자동 반영되지만(파밍 경로), 클라이언트 UI가 "지금 뭐가 발동 중인지" 보여줄 수 있게
// 별도로 조회 가능하게 한다. ?teamIds=h01,h02,... 쿼리로 미리보기 팀을 넘기면 그 팀
// 기준으로, 생략하면 현재 설정된 파밍 팀 기준으로 계산한다.
// ---------------------------------------------------------------------------
app.get("/api/players/:playerId/bonuses", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const [{ data: player, error: playerErr }, allOwnedRows] = await Promise.all([
    supabase.from("players").select("farm_team").eq("id", playerId).single(),
    fetchAllOwnedRows(playerId),
  ]);
  if (playerErr) return res.status(404).json({ error: "플레이어 없음" });
  const teamIds = req.query.teamIds ? String(req.query.teamIds).split(",").filter(Boolean) : player.farm_team || [];
  const collection = computeCollectionBonus(allOwnedRows);
  const synergy = computeSynergyState(teamIds);
  res.json({ teamIds, collection, synergy });
});

// ---------------------------------------------------------------------------
// 전투 시뮬레이션 — DB 없이도 동작(팀을 characterId+level+rarity로 직접 지정).
// body: { teamA: [{characterId, level, rarity?}], teamB: [...] }
// ---------------------------------------------------------------------------
// teamA/teamB: 각각 정확히 5명 — formationA/formationB(생략 시 "balanced")로 배치(앞열/
// 중열/뒷열) 효과까지 반영해서 시뮬레이션한다.
app.post("/api/battle/simulate", (req, res) => {
  const { teamA, teamB, formationA, formationB, timeLimitSeconds, abilityLines, accountLevel, odysseyItems, ownedCharacters } = req.body || {};
  try {
    const result = simulateBattle(
      buildFormedTeam(teamA, formationA, { abilityLines, accountLevel, odysseyItems, ownedCharacters }),
      buildFormedTeam(teamB, formationB),
      { timeLimitSeconds: timeLimitSeconds || 60 }
    );
    res.json({ winner: result.winner, endedAt: result.t, hitCount: result.hits.length, hits: result.hits });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 스테이지 미리보기 — 전투 없이 그 스테이지의 필드 몬스터 종 풀 + 층보스 정보만 보여준다.
// 실제 파밍/보스전은 아래 "필드 파밍(방치)" 섹션의 /api/players/:playerId/farm/* 가 담당
// (DB 필요 — 1.0을 그대로 리부트한 서버-주도형/상시 누적 방치 모델로, 이 콘텐츠만큼은
// 2.0의 다른 콘텐츠처럼 "클라이언트가 상태를 매번 보내는 무상태 방식"이 아니다).
// ---------------------------------------------------------------------------
app.get("/api/stages/:stageNumber", (req, res) => {
  const stageNumber = Number(req.params.stageNumber);
  if (!Number.isInteger(stageNumber) || stageNumber < 1) return res.status(400).json({ error: "stageNumber는 1 이상의 정수여야 함" });
  res.json(stageInfo(stageNumber));
});

// ---------------------------------------------------------------------------
// 일일던전(골드/다이아/경험치) — server/data/dailyDungeon.js. DB 불필요(스테이지/도전
// 횟수는 클라이언트가 함께 보내는 무상태 방식 — stages.js와 동일한 패턴).
// body: { team, formation, stage, maxStage, attemptsUsed, timeLimitSeconds }
// ---------------------------------------------------------------------------
app.get("/api/daily-dungeon/:type", (req, res) => {
  const { type } = req.params;
  if (!DUNGEON_TYPES.includes(type)) return res.status(400).json({ error: `알 수 없는 던전 타입: ${type} (가능: ${DUNGEON_TYPES.join(", ")})` });
  const stage = Number(req.query.stage) || 1;
  res.json({ type, stage, enemy: dungeonEnemy(type, stage), reward: dungeonReward(type, stage), tip: dungeonTip(type), attemptsMax: DUNGEON_MAX_ATTEMPTS, maxStage: DUNGEON_MAX_STAGE });
});

// 던전 타입(gold/gem/exp)에 맞는 어빌리티 보상 배율 키를 고른다 — goldMult는 gold 타입에,
// gemMult는 gem 타입에, expMult는 exp 타입에만 적용(다른 콘텐츠 보상에는 손대지 않음).
const DUNGEON_REWARD_MULT_KEY = { gold: "goldMult", gem: "gemMult", exp: "expMult" };

app.post("/api/daily-dungeon/:type/challenge", (req, res) => {
  const { type } = req.params;
  const { team, formation, stage, maxStage, attemptsUsed, timeLimitSeconds, abilityLines, accountLevel, odysseyItems, ownedCharacters } = req.body || {};
  try {
    const playerTeam = buildFormedTeam(team, formation, { abilityLines, accountLevel, odysseyItems, ownedCharacters });
    const result = resolveDungeonAttempt({
      type, team: playerTeam, stage: stage || 1, maxStage: maxStage || 1, attemptsUsed: attemptsUsed || 0, timeLimitSeconds,
    });
    if (result.error) return res.status(400).json(result);
    if (result.win && (abilityLines || accountLevel)) {
      const bonuses = abilityBonuses(abilityLines || [], accountLevel || 1, odysseyItems);
      const multKey = DUNGEON_REWARD_MULT_KEY[type];
      if (multKey) result.reward = Math.round(result.reward * bonuses[multKey]);
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 일일보스 — server/data/dailyBoss.js. 승패가 아니라 제한시간 동안 넣은 데미지에
// 비례해 보상이 지급된다. body: { team, formation, maxStageReached, attemptsUsed }
// ---------------------------------------------------------------------------
app.get("/api/daily-boss", (req, res) => {
  const maxStageReached = Number(req.query.maxStageReached) || 1;
  res.json({ enemy: dailyBossEnemy(maxStageReached), attemptsMax: BOSS_MAX_ATTEMPTS, fightSeconds: BOSS_FIGHT_SECONDS, dayIndex: dayIndex() });
});

app.post("/api/daily-boss/challenge", (req, res) => {
  const { team, formation, maxStageReached, attemptsUsed, abilityLines, accountLevel, odysseyItems, ownedCharacters } = req.body || {};
  try {
    const playerTeam = buildFormedTeam(team, formation, { abilityLines, accountLevel, odysseyItems, ownedCharacters });
    const result = resolveDailyBossAttempt({ team: playerTeam, maxStageReached: maxStageReached || 1, attemptsUsed: attemptsUsed || 0 });
    if (result.error) return res.status(400).json(result);
    if (result.reward && (abilityLines || accountLevel)) {
      const bonuses = abilityBonuses(abilityLines || [], accountLevel || 1, odysseyItems);
      result.reward = {
        ...result.reward,
        gold: Math.round(result.reward.gold * bonuses.goldMult),
        gems: Math.round(result.reward.gems * bonuses.gemMult),
      };
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 오디세이 — server/data/odyssey.js. 5스테이지마다 직업 고정 테마가 순환하고, 장비가
// 드랍된다. 팀은 TEAM_SIZE(5)명 전원이 그 테마의 allowedClass와 같아야 한다.
// body: { team, formation, stage, items? } — items는 보유 장비 중 장착(equipped:true)된
// 것들(장비 저장소가 아직 없어 클라이언트가 함께 보냄).
// ---------------------------------------------------------------------------
app.get("/api/odyssey/:stage", (req, res) => {
  const stage = Number(req.params.stage);
  if (!Number.isInteger(stage) || stage < 1) return res.status(400).json({ error: "stage는 1 이상의 정수여야 함" });
  const theme = themeForStage(stage);
  res.json({ stage, theme, enemy: odysseyEnemy(stage), attemptsMax: ODYSSEY_MAX_ATTEMPTS, regenSeconds: ODYSSEY_REGEN_SECONDS, grades: ODYSSEY_GRADES, themes: ODYSSEY_THEMES });
});

app.post("/api/odyssey/:stage/challenge", (req, res) => {
  const stage = Number(req.params.stage);
  const { team, formation, items, abilityLines, accountLevel, ownedCharacters } = req.body || {};
  if (!Number.isInteger(stage) || stage < 1) return res.status(400).json({ error: "stage는 1 이상의 정수여야 함" });
  try {
    // 오디세이 장비(items)는 전투 스탯(equippedOdysseyBonusSums)과 어빌리티 보너스
    // 집계(abilityBonuses의 odysseyItems 인자) 양쪽에 다 쓰인다 — 같은 장비 목록.
    const formed = buildFormedTeam(team, formation, { abilityLines, accountLevel, odysseyItems: items, ownedCharacters });
    const result = resolveOdysseyFight({ team: formed, stage });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 인증 — server/lib/auth.js. 1.0 routes/auth.js를 이식(이메일/비밀번호/JWT, bcrypt+jsonwebtoken).
// 범위는 lib/auth.js 주석 참고 — 기존 익명 playerId 흐름을 깨지 않도록, 회원가입은 "새
// playerId를 만들면서 동시에 로그인 자격도 붙이는" 상위호환 가입으로 설계했다.
// ---------------------------------------------------------------------------
app.post("/api/auth/register", async (req, res) => {
  if (!requireDb(res)) return;
  const { email, password, nickname } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: "올바른 이메일 형식이 아닙니다" });
  if (!password || password.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다` });
  if (!nickname || !nickname.trim()) return res.status(400).json({ error: "닉네임을 입력해야 합니다" });

  const passwordHash = hashPassword(password);
  const { data: player, error: playerErr } = await supabase
    .from("players")
    .insert({ email, password_hash: passwordHash, nickname: nickname.trim() })
    .select()
    .single();
  if (playerErr) {
    if (playerErr.code === "23505") return res.status(409).json({ error: "이미 사용 중인 이메일 또는 닉네임입니다" });
    return res.status(500).json({ error: playerErr.message });
  }
  const { error: currencyErr } = await supabase.from("player_currencies").insert({ player_id: player.id });
  if (currencyErr) return res.status(500).json({ error: currencyErr.message });

  res.json({ token: signToken(player.id), playerId: player.id });
});

app.post("/api/auth/login", async (req, res) => {
  if (!requireDb(res)) return;
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "이메일/비밀번호를 입력해야 합니다" });

  const { data: player, error } = await supabase.from("players").select("id, password_hash").eq("email", email).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!player || !player.password_hash || !comparePassword(password, player.password_hash)) {
    return res.status(401).json({ error: "이메일 또는 비밀번호가 올바르지 않습니다" });
  }
  res.json({ token: signToken(player.id), playerId: player.id });
});

// 진행 데이터 초기화 — 이메일/닉네임/비밀번호는 유지, 나머지(레벨/재화/보유 캐릭터/파밍/
// PvP 전적)는 전부 새 계정 기본값으로(1.0 routes/auth.js /reset 그대로).
app.post("/api/auth/reset", requireAuth, async (req, res) => {
  if (!requireDb(res)) return;
  const playerId = req.authPlayerId;
  const nowIso = new Date().toISOString();
  await supabase.from("player_characters").delete().eq("player_id", playerId);
  await Promise.all([
    supabase.from("players").update({
      level: 1, exp: 0, pity_count: 0, ability_lines: [], ability_locked_indices: [],
      farm_stage: 1, farm_max_stage: 1, farm_team: [], farm_formation: "balanced", farm_last_tick_at: nowIso,
      farm_gold_remainder: 0, farm_exp_remainder: 0, farm_gem_remainder: 0, farm_kill_remainder: 0, farm_total_kills: 0,
      pvp_rating: PVP_RATING_START, pvp_wins: 0, pvp_losses: 0, pvp_draws: 0, pvp_attempts: PVP_MAX_ATTEMPTS, pvp_last_regen_at: nowIso,
      pvp_defense_team: [], pvp_defense_formation: "balanced", pvp_attack_team: [], pvp_attack_formation: "balanced",
    }).eq("id", playerId),
    supabase.from("player_currencies").update({ gold: 10000, dia: 500, stone: 0, discarded_shards: {}, updated_at: nowIso }).eq("player_id", playerId),
  ]);
  res.json({ ok: true, playerId });
});

// ---------------------------------------------------------------------------
// PvP(대결) + 랭킹 — server/data/pvp.js. 실제 전투는 1.0처럼 별도 엔진을 안 두고
// 2.0의 simulateBattle(server/lib/combat.js, 보스전과 동일한 엔진)을 그대로 재사용한다.
// "랭크전"(rated)만 시도 횟수 제한+시간 회복, "친선전"(friendly)은 무제한(1.0 최종 설계
// 그대로) — 레이팅 변동은 랭크전에만 있다.
// ---------------------------------------------------------------------------
async function resolvePvpTeam(playerId, teamIds, formation, player) {
  if (!Array.isArray(teamIds) || teamIds.length !== TEAM_SIZE) return null;
  const [owned, allOwnedRows, opts] = await Promise.all([
    fetchOwnedCharacterStats(playerId, teamIds),
    fetchAllOwnedRows(playerId),
    player ? playerCtx.combatOptionsFor(playerId, player, "pvp") : {},
  ]);
  return buildFormedTeam(owned, formation || DEFAULT_FORMATION, { ...opts, ownedCharacters: allOwnedRows });
}
// 1.0의 "공격팀 → 수비팀 → 현재 파밍팀" 순서의 대체 해결 체인(전용 팀을 아직 안 짰어도
// 바로 참여 가능하게) 그대로 이식.
async function resolveEffectiveAttackTeam(playerId, player) {
  const attack = await resolvePvpTeam(playerId, player.pvp_attack_team, player.pvp_attack_formation, player).catch(() => null);
  if (attack) return attack;
  const defense = await resolvePvpTeam(playerId, player.pvp_defense_team, player.pvp_defense_formation, player).catch(() => null);
  if (defense) return defense;
  return resolvePvpTeam(playerId, player.farm_team, player.farm_formation, player).catch(() => null);
}
async function resolveEffectiveDefenseTeam(playerId, player) {
  const defense = await resolvePvpTeam(playerId, player.pvp_defense_team, player.pvp_defense_formation, player).catch(() => null);
  if (defense) return defense;
  return resolvePvpTeam(playerId, player.farm_team, player.farm_formation, player).catch(() => null);
}

app.get("/api/players/:playerId/pvp/state", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { data: player, error } = await supabase.from("players").select("*").eq("id", playerId).single();
  if (error) return res.status(404).json({ error: "플레이어 없음" });

  const regen = regenPvpAttempts({ attempts: player.pvp_attempts ?? PVP_MAX_ATTEMPTS, lastRegenAt: player.pvp_last_regen_at, now: new Date() });
  if (regen.attempts !== player.pvp_attempts || regen.lastRegenAt !== player.pvp_last_regen_at) {
    await supabase.from("players").update({ pvp_attempts: regen.attempts, pvp_last_regen_at: regen.lastRegenAt }).eq("id", playerId);
  }
  const { count: rank } = await supabase.from("players").select("id", { count: "exact", head: true }).gt("pvp_rating", player.pvp_rating ?? PVP_RATING_START);

  res.json({
    rating: player.pvp_rating ?? PVP_RATING_START,
    wins: player.pvp_wins || 0,
    losses: player.pvp_losses || 0,
    draws: player.pvp_draws || 0,
    attempts: regen.attempts,
    maxAttempts: PVP_MAX_ATTEMPTS,
    rank: (rank || 0) + 1,
    defenseTeam: player.pvp_defense_team || [],
    attackTeam: player.pvp_attack_team || [],
    defenseFormation: player.pvp_defense_formation || "balanced",
    attackFormation: player.pvp_attack_formation || "balanced",
    nextRegenAt: regen.attempts >= PVP_MAX_ATTEMPTS ? null : new Date(new Date(regen.lastRegenAt).getTime() + 600000).toISOString(),
  });
});

app.post("/api/players/:playerId/pvp/defense", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { characterIds, formation } = req.body || {};
  try {
    requireFarmTeamSize(characterIds);
    await fetchOwnedCharacterStats(playerId, characterIds);
    await supabase.from("players").update({ pvp_defense_team: characterIds, pvp_defense_formation: formation || "balanced" }).eq("id", playerId);
    res.json({ defenseTeam: characterIds, defenseFormation: formation || "balanced" });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/players/:playerId/pvp/attack-team", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { characterIds, formation } = req.body || {};
  try {
    requireFarmTeamSize(characterIds);
    await fetchOwnedCharacterStats(playerId, characterIds);
    await supabase.from("players").update({ pvp_attack_team: characterIds, pvp_attack_formation: formation || "balanced" }).eq("id", playerId);
    res.json({ attackTeam: characterIds, attackFormation: formation || "balanced" });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 상대 목록 — 레이팅이 가까운 후보 중 최대 50명(1.0 GET /targets와 동일), 전투력 추정치 포함.
app.get("/api/players/:playerId/pvp/targets", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { data: me, error: meErr } = await supabase.from("players").select("pvp_rating").eq("id", playerId).single();
  if (meErr) return res.status(404).json({ error: "플레이어 없음" });
  const myRating = me.pvp_rating ?? PVP_RATING_START;

  const { data: candidates, error } = await supabase
    .from("players")
    .select("*")
    .neq("id", playerId)
    .order("pvp_rating", { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });

  const withTeam = candidates.filter((c) => (c.pvp_defense_team && c.pvp_defense_team.length === TEAM_SIZE) || (c.farm_team && c.farm_team.length === TEAM_SIZE));
  const sorted = [...withTeam].sort((a, b) => Math.abs((a.pvp_rating ?? PVP_RATING_START) - myRating) - Math.abs((b.pvp_rating ?? PVP_RATING_START) - myRating)).slice(0, 50);

  const targets = await Promise.all(sorted.map(async (c) => {
    const team = await resolveEffectiveDefenseTeam(c.id, c);
    return {
      playerId: c.id, nickname: c.nickname || null, rating: c.pvp_rating ?? PVP_RATING_START, estimatedPower: team ? estimateTeamPower(team) : 0,
      maxStage: c.farm_max_stage || 1, wins: c.pvp_wins || 0, losses: c.pvp_losses || 0,
      teamIds: (c.pvp_defense_team && c.pvp_defense_team.length === TEAM_SIZE ? c.pvp_defense_team : c.farm_team) || [],
    };
  }));
  res.json({ targets });
});

async function settlePvpMatch({ attackerId, defenderId, rated }) {
  const [{ data: attacker, error: aErr }, { data: defender, error: dErr }] = await Promise.all([
    supabase.from("players").select("*").eq("id", attackerId).single(),
    supabase.from("players").select("*").eq("id", defenderId).single(),
  ]);
  if (aErr || dErr) throw new Error("플레이어 없음");

  const [attackTeam, defenseTeam] = await Promise.all([
    resolveEffectiveAttackTeam(attackerId, attacker),
    resolveEffectiveDefenseTeam(defenderId, defender),
  ]);
  if (!attackTeam) throw new Error("공격에 쓸 수 있는 팀이 없음(공격팀/수비팀/파밍팀 중 하나라도 5인 편성이 필요)");
  if (!defenseTeam) throw new Error("상대가 아직 방어 가능한 팀이 없음");

  const result = simulateBattle(attackTeam, defenseTeam, { timeLimitSeconds: 30 });
  const win = result.winner === "A";
  const attackerRating = attacker.pvp_rating ?? PVP_RATING_START;
  const defenderRating = defender.pvp_rating ?? PVP_RATING_START;
  const expected = expectedScore(attackerRating, defenderRating);

  let ratingChange = { deltaA: 0, deltaB: 0 };
  if (rated) {
    ratingChange = pvpRatingChange(attackerRating, defenderRating, win);
    await Promise.all([
      supabase.from("players").update({
        pvp_rating: attackerRating + ratingChange.deltaA,
        pvp_wins: (attacker.pvp_wins || 0) + (win ? 1 : 0),
        pvp_losses: (attacker.pvp_losses || 0) + (win ? 0 : 1),
        pvp_attempts: Math.max(0, (attacker.pvp_attempts ?? PVP_MAX_ATTEMPTS) - 1),
      }).eq("id", attackerId),
      supabase.from("players").update({
        pvp_rating: defenderRating + ratingChange.deltaB,
        pvp_wins: (defender.pvp_wins || 0) + (win ? 0 : 1),
        pvp_losses: (defender.pvp_losses || 0) + (win ? 1 : 0),
      }).eq("id", defenderId),
    ]);
  }

  const goldReward = pvpGoldReward(attacker.farm_max_stage || 1, win, expected);
  const diaReward = pvpDiaReward(win);
  const { data: attackerCurrency } = await supabase.from("player_currencies").select("gold, dia").eq("player_id", attackerId).single();
  if (attackerCurrency) {
    await supabase.from("player_currencies").update({
      gold: attackerCurrency.gold + goldReward, dia: attackerCurrency.dia + diaReward, updated_at: new Date().toISOString(),
    }).eq("player_id", attackerId);
  }

  // 투기장 세트 — 레이팅전 승리 시, 레이팅이 높을수록 확률·등급 ↑ (최대 4%)
  // 확률·등급 모두 레이팅 기준(경기 전 내 레이팅)
  const pvpT = pvpTier(attackerRating);
  const drop = rated && win && rollDrop("pvp", pvpT) ? await playerCtx.grantSetDrops(attacker, "pvp", 1, pvpT) : null;

  await supabase.from("pvp_matches").insert({
    attacker_id: attackerId, defender_id: defenderId, attacker_win: win, rated: !!rated,
    attacker_rating_before: attackerRating, defender_rating_before: defenderRating,
    attacker_rating_after: attackerRating + ratingChange.deltaA, defender_rating_after: defenderRating + ratingChange.deltaB,
    gold_reward: goldReward, dia_reward: diaReward,
  });

  return {
    win, rated: !!rated, hits: result.hits, endedAt: result.t, teamA: teamSnapshot(attackTeam), teamB: teamSnapshot(defenseTeam),
    defenderNickname: defender.nickname || null, drop,
    attackerRatingBefore: attackerRating, attackerRatingAfter: attackerRating + ratingChange.deltaA,
    defenderRatingBefore: defenderRating, defenderRatingAfter: defenderRating + ratingChange.deltaB,
    goldReward, diaReward,
  };
}

// 랭크전(무작위 매칭) — 시도 횟수를 소모하고, 승패에 따라 레이팅이 변동한다.
app.post("/api/players/:playerId/pvp/random-match", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { data: me, error: meErr } = await supabase.from("players").select("*").eq("id", playerId).single();
  if (meErr) return res.status(404).json({ error: "플레이어 없음" });

  const regen = regenPvpAttempts({ attempts: me.pvp_attempts ?? PVP_MAX_ATTEMPTS, lastRegenAt: me.pvp_last_regen_at, now: new Date() });
  if (regen.attempts <= 0) return res.status(400).json({ error: "랭크전 시도 횟수가 부족함(시간이 지나면 회복)" });
  if (regen.attempts !== me.pvp_attempts || regen.lastRegenAt !== me.pvp_last_regen_at) {
    await supabase.from("players").update({ pvp_attempts: regen.attempts, pvp_last_regen_at: regen.lastRegenAt }).eq("id", playerId);
  }

  const { data: candidates, error } = await supabase
    .from("players").select("id, pvp_rating, pvp_defense_team, farm_team").neq("id", playerId).limit(200);
  if (error) return res.status(500).json({ error: error.message });
  const withTeam = candidates.filter((c) => (c.pvp_defense_team && c.pvp_defense_team.length === TEAM_SIZE) || (c.farm_team && c.farm_team.length === TEAM_SIZE));
  const opponent = pickRandomOpponent(withTeam, me.pvp_rating ?? PVP_RATING_START);
  if (!opponent) return res.status(400).json({ error: "매칭 가능한 상대가 없음" });

  try {
    const result = await settlePvpMatch({ attackerId: playerId, defenderId: opponent.id, rated: true });
    res.json({ opponentId: opponent.id, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 친선전(지정 상대, 무제한, 레이팅 변동 없음).
app.post("/api/players/:playerId/pvp/attack/:targetPlayerId", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId, targetPlayerId } = req.params;
  if (playerId === targetPlayerId) return res.status(400).json({ error: "자기 자신과는 대결할 수 없음" });
  try {
    const result = await settlePvpMatch({ attackerId: playerId, defenderId: targetPlayerId, rated: false });
    res.json({ opponentId: targetPlayerId, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 수비 기록(나를 공격한 전적) — defender 입장에서 최근 매치 조회.
app.get("/api/players/:playerId/pvp/history", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { data, error } = await supabase
    .from("pvp_matches").select("*").eq("defender_id", playerId).order("created_at", { ascending: false }).limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ matches: data });
});

// UI에 있는데 서버에 없던 기능들(프리셋/장비 가방/오디세이·던전·일일보스 서버 저장/랭킹/버프).
registerFeatureRoutes(app, {
  supabase, requireDb, buildFormedTeam, fetchOwnedCharacterStats, fetchAllOwnedRows, loadPlayerAndCurrency, settleFarm,
});

app.listen(PORT, () => {
  console.log(`🎮 우리동네 영웅 키우기 2.0 서버 실행 중 → http://localhost:${PORT}`);
  checkDatabaseConnection().then((db) => {
    console.log(db.ok ? "✅ 데이터베이스 연결 확인 완료" : `⚠️ 데이터베이스 연결 실패: ${db.reason}`);
  });
});
