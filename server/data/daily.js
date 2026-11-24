// ============================================================================
// 게임 2.0 — 일일 콘텐츠 서버 저장용 공통 로직(던전 · 일일보스 · 오디세이 도전 횟수)
// ============================================================================
// 1.0 안내문 그대로 "매일 오전 9시(한국시간)에 초기화" — 한국시간 09:00 = UTC 00:00 이라
// UTC 날짜가 바뀌는 순간을 하루 경계로 쓴다.
import { DUNGEON_TYPES } from "./dailyDungeon.js";

export function dailyKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// 던전 3종 상태 — {day, gold:{stage,maxStage,attemptsUsed}, gem:{...}, exp:{...}}
// 날이 바뀌면 attemptsUsed만 0으로(스테이지/최고 기록은 유지).
export function freshDungeonState(raw, now = new Date()) {
  const day = dailyKey(now);
  const sameDay = raw && raw.day === day;
  const out = { day };
  for (const t of DUNGEON_TYPES) {
    const s = (raw && raw[t]) || {};
    out[t] = { stage: s.stage || 1, maxStage: s.maxStage || 1, attemptsUsed: sameDay ? s.attemptsUsed || 0 : 0 };
  }
  return out;
}

// 일일보스 — 날이 바뀌면 횟수·오늘 데미지 초기화(최고 기록은 유지).
export function freshBossState(player, now = new Date()) {
  const day = dailyKey(now);
  if (player.boss_day === day) return { day, attemptsUsed: player.boss_attempts_used || 0, damageToday: Number(player.boss_damage_today) || 0 };
  return { day, attemptsUsed: 0, damageToday: 0 };
}

// 시간 회복형 도전 횟수(오디세이 5분당 1회 등) — 가득 차 있으면 기준 시각을 지금으로 당긴다.
export function regenAttempts({ attempts, lastRegenAt, max, regenSeconds, now = new Date() }) {
  const cur = Math.max(0, attempts ?? max);
  const last = lastRegenAt ? new Date(lastRegenAt).getTime() : now.getTime();
  if (cur >= max) return { attempts: max, lastRegenAt: now.toISOString(), nextRegenInSeconds: null };
  const elapsed = Math.max(0, (now.getTime() - last) / 1000);
  const gained = Math.floor(elapsed / regenSeconds);
  const attemptsNow = Math.min(max, cur + gained);
  const newLast = attemptsNow >= max ? now.getTime() : last + gained * regenSeconds * 1000;
  const nextIn = attemptsNow >= max ? null : Math.ceil(regenSeconds - (now.getTime() - newLast) / 1000);
  return { attempts: attemptsNow, lastRegenAt: new Date(newLast).toISOString(), nextRegenInSeconds: nextIn };
}
