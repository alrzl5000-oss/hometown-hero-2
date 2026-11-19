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
import { simulateBattle, simulateGauntlet } from "./lib/combat.js";
import { buildStagePhases, stageInfo } from "./data/stages.js";
import { supabase, hasSupabaseConfig, checkDatabaseConnection } from "./db.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const DIA_PER_PULL = 300; // [임시값] 실제 재화 밸런스는 아직 확정 전 — 추후 조정 필요

function findRosterEntry(characterId) {
  return ROSTER.find((c) => c.id === characterId);
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

app.get("/api/gacha/rates", (req, res) => {
  res.json({ rates: gachaRates(), diaPerPull: DIA_PER_PULL });
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
app.post("/api/players/:playerId/gacha/pull", async (req, res) => {
  if (!requireDb(res)) return;
  const { playerId } = req.params;
  const { data: currency, error: currErr } = await supabase.from("player_currencies").select("*").eq("player_id", playerId).single();
  if (currErr) return res.status(404).json({ error: "플레이어 없음" });
  if (currency.dia < DIA_PER_PULL) return res.status(400).json({ error: "다이아 부족" });

  const { character, rarity, pool } = pickCharacter();
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
  await supabase.from("player_currencies").update({ dia: currency.dia - DIA_PER_PULL, updated_at: new Date().toISOString() }).eq("player_id", playerId);

  res.json({ character, rarity, pool, isNew: !existing });
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
app.post("/api/battle/simulate", (req, res) => {
  const { teamA, teamB, timeLimitSeconds } = req.body || {};
  if (!Array.isArray(teamA) || !Array.isArray(teamB) || !teamA.length || !teamB.length) {
    return res.status(400).json({ error: "teamA/teamB는 1명 이상의 {characterId, level, rarity?} 배열이어야 함" });
  }
  try {
    const buildTeam = (team) =>
      team.map(({ characterId, level, rarity }) => {
        const entry = findRosterEntry(characterId);
        if (!entry) throw new Error(`unknown characterId: ${characterId}`);
        return characterStatsAt(characterId, level || LEVEL_CAP[entry.rarity], rarity);
      });
    const result = simulateBattle(buildTeam(teamA), buildTeam(teamB), { timeLimitSeconds: timeLimitSeconds || 60 });
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
  const { team, timeLimitSeconds } = req.body || {};
  if (!Number.isInteger(stageNumber) || stageNumber < 1) return res.status(400).json({ error: "stageNumber는 1 이상의 정수여야 함" });
  if (!Array.isArray(team) || !team.length) return res.status(400).json({ error: "team은 1명 이상의 {characterId, level, rarity?} 배열이어야 함" });
  try {
    const playerTeam = team.map(({ characterId, level, rarity }) => {
      const entry = findRosterEntry(characterId);
      if (!entry) throw new Error(`unknown characterId: ${characterId}`);
      return characterStatsAt(characterId, level || LEVEL_CAP[entry.rarity], rarity);
    });
    const phases = buildStagePhases(stageNumber);
    const result = simulateGauntlet(playerTeam, phases, { timeLimitSeconds: timeLimitSeconds || 30 });
    res.json({ stage: stageInfo(stageNumber), cleared: result.cleared, phaseResults: result.phaseResults, endedAt: result.t, hitCount: result.hits.length });
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
