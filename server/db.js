// ============================================================================
// 게임 2.0 — Supabase 연결
// ============================================================================
// [알려진 한계 — 보안] 지금은 anon(publishable) 키만 쓴다. service_role 키는 민감 정보라
// 에이전트 도구로는 발급/조회가 안 되고(의도된 제한), players/player_currencies/
// player_characters 테이블은 아직 RLS를 켜지 않은 상태라 이 키만으로 전부 읽고 쓸 수
// 있다 — 지금 단계(서버가 유일한 호출자, 실제 결제/유저 없음)에서는 당장 위험하지 않지만,
// 실제 유저가 붙기 전에 꼭 해결해야 한다. 해결 방법 둘 중 하나:
//   1) Supabase 대시보드(Settings → API)에서 service_role 키를 직접 복사해 Railway
//      SUPABASE_SERVICE_ROLE_KEY 변수로 넣기(가장 간단, 서버만 쓰는 키라 RLS와 무관하게 전권한)
//   2) RLS를 켜고 anon 역할에 맞는 좁은 정책을 설계(더 번거로움)
// claude/game2-meta-progression.md에 이 항목을 기록해 둔다.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  : null;

// 서버 기동 시 1회 호출 — 기존 게임(minsu100)의 "✅ 데이터베이스 연결 및 스키마 확인 완료"와
// 같은 역할의 헬스체크. 테이블이 비어 있어도(count=0) 연결 자체는 성공으로 본다.
export async function checkDatabaseConnection() {
  if (!hasSupabaseConfig) return { ok: false, reason: "SUPABASE_URL/KEY 환경변수 없음" };
  const { error } = await supabase.from("players").select("id", { count: "exact", head: true });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
