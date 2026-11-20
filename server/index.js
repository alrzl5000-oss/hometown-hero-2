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
import { promotionCost, exPromotionReady, exPromotionCost, exLevelUpGoldCost, exLevelUpDiaCost } from "./data/promotion.js";
import { expPerKill, expToNextLevel, applyExp, levelAtkBonusMult } from "./data/accountLevel.js";
import {
  ABILITY_SLOT_COUNT, ABILITY_SLOT_UNLOCK_LEVEL, unlockedSlotCount, rerollCostFor, rerollAbilityLines,
  gradeProbabilityTable, abilityBonuses, applyAbilityBonuses,
} from "./data/abilities.js";
import { simulateBattle, simulateGauntlet } from "./lib/combat.js";
import { buildStagePhases, stageInfo } from "./data/stages.js";
import { assignFormation, FORMATIONS, TEAM_SIZE, DEFAULT_FORMATION } from "./data/formation.js";
import { DUNGEON_TYPES, dungeonEnemy, dungeonReward, dungeonTip, DUNGEON_MAX_ATTEMPTS, DUNGEON_MAX_STAGE, resolveDungeonAttempt } from "./data/dailyDungeon.js";
import { BOSS_MAX_ATTEMPTS, BOSS_FIGHT_SECONDS, dailyBossEnemy, dayIndex, resolveDailyBossAttempt } from "./data/dailyBoss.js";
import {
  ODYSSEY_THEMES, ODYSSEY_MAX_ATTEMPTS, ODYSSEY_REGEN_SECONDS, ODYSSEY_GRADES,
  themeForStage, odysseyEnemy, equippedOdysseyBonusSums, applyOdysseyEquipmentBonuses, resolveOdysseyFight,
} from "./data/odyssey.js";
import { supabase, hasSupabaseConfig, checkDatabaseConnection } from "./db.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const DIA_PER_PULL = 300; // [임시값] 실제 재화 밸런스는 아직 확정 전 — 추후 조정 필요

function findRosterEntry(characterId) {
  return ROSTER.find((c) => c.id === characterId);
}

// 팀 5명 고정 + 배치(포메이션) 적용까지 한 번에 — /api/battle/simulate, /api/stages/:n/challenge
// 등 모든 콘텐츠 전투 엔드포인트가 이 헬퍼를 통해서만 팀을 만든다(중복 로직 방지).
//
// [어빌리티 연동] abilityLines + accountLevel을 요청 body에 함께 보내면(둘 다 선택 —
// 2.0은 아직 이 전투 엔드포인트들이 DB를 모르는 stateless 설계라, 다른 콘텐츠의
// 진행도/도전횟수와 똑같은 방식으로 "현재 상태"를 클라이언트가 함께 넘긴다), 어빌리티
// 줄(+선택적으로 오디세이 장비 odysseyItems)에서 계산한 팀 전체 버프를 포메이션 보너스
// 위에 한 번 더 적용한다. 둘 다 생략하면 기존과 완전히 동일하게 동작(하위 호환).
function buildFormedTeam(team, formationKey, { abilityLines, accountLevel, odysseyItems } = {}) {
  if (!Array.isArray(team) || team.length !== TEAM_SIZE) {
    throw new Error(`팀은 정확히 ${TEAM_SIZE}명이어야 함(받은 수: ${Array.isArray(team) ? team.length : 0})`);
  }
  if (formationKey && !FORMATIONS[formationKey]) {
    throw new Error(`알 수 없는 포메이션: ${formationKey} (가능: ${Object.keys(FORMATIONS).join(", ")})`);
  }
  const stats = team.map(({ characterId, level, rarity }) => {
    const entry = findRosterEntry(characterId);
    if (!entry) throw new Error(`unknown characterId: ${characterId}`);
    return characterStatsAt(characterId, level || LEVEL_CAP[entry.rarity], rarity);
  });
  const formed = assignFormation(stats, formationKey || DEFAULT_FORMATION);
  if (!abilityLines && !accountLevel) return formed;
  const bonuses = abilityBonuses(abilityLines || [], accountLevel || 1, odysseyItems);
  return applyAbilityBonuses(formed, bonuses);
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
    stats: characterStatsAt(row.character_id, row.level, row.current_rarity),
  }));
  res.json({ currency, characters });
});

// 가챠 1회 뽑기 — 다이아 차감, 처음 보유하는 캐릭터면 태초/현재 등급을 뽑힌 등급으로
// 새로 만들고, 이미 보유 중이면 조각(shard_count)만 +1.
// [수정 — 2026-11-20] players.level/pity_count를 읽어 pickCharacter({level,pity})에 넘기고,
// 갱신된 pity를 다시 저장. stoneGain은 player_currencies.stone에 적립(승급석 가챠 드랍).
app.post("/api/players/:playerId/gacha/pull", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const [{ data: currency, error: currErr }, { data: player, error: playerErr }] = await Promise.all([
    supabase.from("player_currencies").select("*").eq("player_id", playerId).single(),
    supabase.from("players").select("level, pity_count").eq("id", playerId).single(),
  ]);
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });
  if (playerErr) return res.status(404).json({ error: "플레이어 없음" });
  if (currency.dia < DIA_PER_PULL) return res.status(400).json({ error: "다이아 부족" });

  const { character, rarity, pool, pity, stoneGain } = pickCharacter({ level: player.level, pity: player.pity_count });
  const { data: existing } = await supabase
    .from("player_characters")
    .select("*")
    .eq("player_id", playerId)
    .eq("character_id", character.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("player_characters")
      .update({ shard_count: existing.shard_count + 1, updated_at: new Date().toISOString() })
      .eq("player_id", playerId)
      .eq("character_id", character.id);
  } else {
    await supabase.from("player_characters").insert({
      player_id: playerId,
      character_id: character.id,
      origin_rarity: rarity,
      current_rarity: rarity,
      level: 1,
    });
  }
  await Promise.all([
    supabase.from("player_currencies")
      .update({ dia: currency.dia - DIA_PER_PULL, stone: currency.stone + stoneGain, updated_at: new Date().toISOString() })
      .eq("player_id", playerId),
    supabase.from("players").update({ pity_count: pity }).eq("id", playerId),
  ]);

  res.json({ character, rarity, pool, isNew: !existing, pity, stoneGain });
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
    .select("level, ability_lines, ability_locked_indices")
    .eq("id", playerId)
    .single();
  if (error) return res.status(404).json({ error: "플레이어 없음" });

  const slots = unlockedSlotCount(player.level);
  res.json({
    level: player.level,
    unlockedSlots: slots,
    slotUnlockLevels: ABILITY_SLOT_UNLOCK_LEVEL,
    lines: player.ability_lines || [],
    lockedIndices: player.ability_locked_indices || [],
    rerollCost: rerollCostFor(player.ability_locked_indices || [], slots),
    gradeProbabilities: gradeProbabilityTable(player.level),
  });
});

app.post("/api/players/:playerId/abilities/reroll", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const [{ data: player, error: playerErr }, { data: currency, error: currErr }] = await Promise.all([
    supabase.from("players").select("level, ability_lines, ability_locked_indices").eq("id", playerId).single(),
    supabase.from("player_currencies").select("gold").eq("player_id", playerId).single(),
  ]);
  if (playerErr) return res.status(404).json({ error: "플레이어 없음" });
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });

  const slots = unlockedSlotCount(player.level);
  if (slots <= 0) return res.status(400).json({ error: "아직 해금된 어빌리티 슬롯이 없음(계정 레벨 10부터)" });
  const lockedIndices = player.ability_locked_indices || [];
  const cost = rerollCostFor(lockedIndices, slots);
  if (currency.gold < cost) return res.status(400).json({ error: `골드 부족 (${currency.gold}/${cost})` });

  const newLines = rerollAbilityLines(player.ability_lines || [], slots, lockedIndices, player.level);
  await Promise.all([
    supabase.from("players").update({ ability_lines: newLines }).eq("id", playerId),
    supabase.from("player_currencies").update({ gold: currency.gold - cost, updated_at: new Date().toISOString() }).eq("player_id", playerId),
  ]);

  res.json({ lines: newLines, spent: cost });
});

app.post("/api/players/:playerId/abilities/lock", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { slotIndex } = req.body || {};
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= ABILITY_SLOT_COUNT) {
    return res.status(400).json({ error: `slotIndex는 0~${ABILITY_SLOT_COUNT - 1} 사이의 정수여야 함` });
  }
  const { data: player, error } = await supabase.from("players").select("ability_locked_indices").eq("id", playerId).single();
  if (error) return res.status(404).json({ error: "플레이어 없음" });

  const current = player.ability_locked_indices || [];
  const nextLocked = current.includes(slotIndex) ? current.filter((i) => i !== slotIndex) : [...current, slotIndex];
  await supabase.from("players").update({ ability_locked_indices: nextLocked }).eq("id", playerId);

  res.json({ lockedIndices: nextLocked });
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

  await supabase
    .from("player_characters")
    .update({ shard_count: owned.shard_count - cost.shard, current_rarity: "EX", ex_unlocked: true, updated_at: new Date().toISOString() })
    .eq("player_id", playerId)
    .eq("character_id", characterId);
  await supabase
    .from("player_currencies")
    .update({ stone: currency.stone - cost.stone, gold: currency.gold - cost.gold, dia: currency.dia - cost.dia, updated_at: new Date().toISOString() })
    .eq("player_id", playerId);

  res.json({ characterId, newRarity: "EX" });
});

// ---------------------------------------------------------------------------
// 전투 시뮬레이션 — DB 없이도 동작(팀을 characterId+level+rarity로 직접 지정).
// body: { teamA: [{characterId, level, rarity?}], teamB: [...] }
// ---------------------------------------------------------------------------
// teamA/teamB: 각각 정확히 5명 — formationA/formationB(생략 시 "balanced")로 배치(앞열/
// 중열/뒷열) 효과까지 반영해서 시뮬레이션한다.
app.post("/api/battle/simulate", (req, res) => {
  const { teamA, teamB, formationA, formationB, timeLimitSeconds, abilityLines, accountLevel, odysseyItems } = req.body || {};
  try {
    const result = simulateBattle(
      buildFormedTeam(teamA, formationA, { abilityLines, accountLevel, odysseyItems }),
      buildFormedTeam(teamB, formationB),
      { timeLimitSeconds: timeLimitSeconds || 60 }
    );
    res.json({ winner: result.winner, endedAt: result.t, hitCount: result.hits.length, hits: result.hits });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 스테이지 — "필드 웨이브 → 보스" 연속전(세븐나이츠 키우기 참고). DB 불필요(characterId+
// level+rarity로 팀을 직접 지정) — 클리어 판정만 보고, 보상/진행도 저장은 다음 단계.
// body: { team: [{characterId, level, rarity?}] }
// ---------------------------------------------------------------------------
app.get("/api/stages/:stageNumber", (req, res) => {
  const stageNumber = Number(req.params.stageNumber);
  if (!Number.isInteger(stageNumber) || stageNumber < 1) return res.status(400).json({ error: "stageNumber는 1 이상의 정수여야 함" });
  res.json(stageInfo(stageNumber));
});

app.post("/api/stages/:stageNumber/challenge", (req, res) => {
  const stageNumber = Number(req.params.stageNumber);
  const { team, formation, timeLimitSeconds, abilityLines, accountLevel, odysseyItems } = req.body || {};
  if (!Number.isInteger(stageNumber) || stageNumber < 1) return res.status(400).json({ error: "stageNumber는 1 이상의 정수여야 함" });
  try {
    const playerTeam = buildFormedTeam(team, formation, { abilityLines, accountLevel, odysseyItems });
    const phases = buildStagePhases(stageNumber);
    const result = simulateGauntlet(playerTeam, phases, { timeLimitSeconds: timeLimitSeconds || 30 });
    res.json({ stage: stageInfo(stageNumber), cleared: result.cleared, phaseResults: result.phaseResults, endedAt: result.t, hitCount: result.hits.length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
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
  const { team, formation, stage, maxStage, attemptsUsed, timeLimitSeconds, abilityLines, accountLevel, odysseyItems } = req.body || {};
  try {
    const playerTeam = buildFormedTeam(team, formation, { abilityLines, accountLevel, odysseyItems });
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
  const { team, formation, maxStageReached, attemptsUsed, abilityLines, accountLevel, odysseyItems } = req.body || {};
  try {
    const playerTeam = buildFormedTeam(team, formation, { abilityLines, accountLevel, odysseyItems });
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
  const { team, formation, items, abilityLines, accountLevel } = req.body || {};
  if (!Number.isInteger(stage) || stage < 1) return res.status(400).json({ error: "stage는 1 이상의 정수여야 함" });
  try {
    // 오디세이 장비(items)는 전투 스탯(equippedOdysseyBonusSums)과 어빌리티 보너스
    // 집계(abilityBonuses의 odysseyItems 인자) 양쪽에 다 쓰인다 — 같은 장비 목록.
    const formed = buildFormedTeam(team, formation, { abilityLines, accountLevel, odysseyItems: items });
    const sums = equippedOdysseyBonusSums(Array.isArray(items) ? items : []);
    const geared = applyOdysseyEquipmentBonuses(formed, sums);
    const result = resolveOdysseyFight({ team: geared, stage });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`🎮 우리동네 영웅 키우기 2.0 서버 실행 중 → http://localhost:${PORT}`);
  checkDatabaseConnection().then((db) => {
    console.log(db.ok ? "✅ 데이터베이스 연결 확인 완료" : `⚠️ 데이터베이스 연결 실패: ${db.reason}`);
  });
});
