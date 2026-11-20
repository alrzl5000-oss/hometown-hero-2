// ============================================================================
// 게임 2.0 — 인증(이메일/비밀번호/JWT)
// ============================================================================
// [배경] 1.0(alrzl5000-oss/minsu100)의 server/routes/auth.js를 읽고 그대로 이식한
// 메커니즘: bcrypt 해시 비교 + jwt.sign({uid}, SECRET, {expiresIn:"30d"}).
//
// [2.0 적용 범위 — 솔직한 스코프 조정]
// 1.0은 "회원가입 = 계정(유저) 생성"이었지만, 2.0은 지금까지 전부 playerId(uuid) 하나로
// 익명 플레이가 가능한 "스테이트풀 클라이언트" 구조로 짜여 있다(모든 기존 라우트가
// req.params.playerId를 그대로 신뢰). 이번에 인증을 "처음부터 있던 것처럼" 모든 라우트에
// 강제로 끼워 넣으면 기존 게스트 플레이 흐름과 테스트가 전부 깨지므로, 이번 포팅은:
//   - POST /api/auth/register: email/password/nickname으로 "새 playerId를 발급하면서
//     동시에 로그인 자격도 붙이는" 가입 — 익명 생성(POST /api/players)의 상위호환.
//   - POST /api/auth/login: email/password로 JWT 발급, playerId 반환.
//   - POST /api/auth/reset: requireAuth 필수 — 진행 데이터 초기화(이메일/닉네임/비밀번호는
//     유지, 1.0 routes/auth.js의 RESETTABLE 패턴 그대로).
//   - requireAuth 미들웨어 자체는 만들어 두지만, 기존 :playerId 경로 라우트 전체에
//     강제 적용하진 않았다(클라이언트가 아직 토큰을 보낼 준비가 안 된 상태에서 전부
//     잠그면 즉시 모든 기능이 깨짐) — 다음 단계(클라이언트 로그인 플로우 붙을 때) 과제로
//     claude/game2-meta-progression.md에 남겨둔다.
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-바꿔야함-실배포전필수";
if (!process.env.JWT_SECRET) {
  console.warn("⚠️ JWT_SECRET 환경변수가 없어 개발용 기본값을 사용 중 — 실제 배포 전 Railway 환경변수로 반드시 설정할 것.");
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 6;

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}
export function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}
export function signToken(playerId) {
  return jwt.sign({ pid: playerId }, JWT_SECRET, { expiresIn: "30d" });
}
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// 라우트에 끼우면 req.authPlayerId를 세팅한다. 토큰이 없거나 무효면 401.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const decoded = token && verifyToken(token);
  if (!decoded || !decoded.pid) return res.status(401).json({ error: "로그인이 필요합니다" });
  req.authPlayerId = decoded.pid;
  next();
}
