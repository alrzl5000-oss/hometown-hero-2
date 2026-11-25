// 로그인 · 회원가입 · 게스트 시작
import { S, post, setSession, loadMeta } from "../api.js";
import { ic, art, RARC, esc, busy, toast } from "../ui.js";
import { reloadAfterLogin } from "../main.js";

const TIPS = [
  "오디세이는 5층마다 배치 가능한 직업이 바뀌어요.",
  "파밍은 앱을 꺼도 최대 8시간까지 쌓여요.",
  "10회 소환은 SR 이상 1명, 100회 소환은 SR 이상 10명이 확정이에요.",
  "보스는 속성이 있어요 — 화 > 풍 > 수 > 화 상성을 노려 보세요.",
  "던전과 일일보스 도전 횟수는 매일 오전 9시(한국시간)에 초기화돼요.",
];

export async function render(page) {
  await loadMeta();
  let mode = "login";
  const pick = (r) => S.meta.roster.filter((c) => c.rarity === r)[0];
  const figs = ["SSR", "XR", "XXR", "HR"].map(pick).filter(Boolean);
  const draw = () => {
    page.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;gap:60px;flex-wrap:wrap;padding:40px 16px;background:radial-gradient(900px 500px at 30% 30%,#0f3b2a,transparent 60%),var(--bg);">
      <div style="text-align:center;">
        <div style="display:flex;gap:8px;justify-content:center;align-items:flex-end;">${figs.map((c, i) => `<img class="sp" src="${art(c.id, c.rarity)}" alt="" style="width:${i % 3 === 0 ? 96 : 112}px;filter:drop-shadow(0 0 16px ${RARC[c.rarity]}88);">`).join("")}</div>
        <div style="font-size:34px;font-weight:800;letter-spacing:-.03em;margin-top:10px;background:linear-gradient(120deg,#ecfff6,#a3e635);-webkit-background-clip:text;color:transparent;">우리동네 영웅 키우기</div>
        <div class="num mint" style="font-size:18px;margin-top:4px;">2.0</div>
        <div class="t3 small" style="margin-top:14px;">팁 · ${esc(TIPS[Math.floor(Math.random() * TIPS.length)])}</div>
      </div>
      <form class="card" id="f" style="width:min(380px,100%);padding:24px;display:flex;flex-direction:column;gap:12px;">
        <div class="seg full"><button type="button" data-m="login" class="${mode === "login" ? "on" : ""}">로그인</button><button type="button" data-m="signup" class="${mode === "signup" ? "on" : ""}">회원가입</button></div>
        <label class="t2 col" style="gap:6px;font-size:12px;">이메일<input class="inp" name="email" type="email" autocomplete="email" placeholder="name@example.com" required></label>
        <label class="t2 col" style="gap:6px;font-size:12px;">비밀번호<input class="inp" name="password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" placeholder="6자 이상" required></label>
        ${mode === "signup" ? `<label class="t2 col" style="gap:6px;font-size:12px;">닉네임<input class="inp" name="nickname" maxlength="12" placeholder="2~12자" required></label>` : ""}
        <button class="btn pri lg block" type="submit">${mode === "login" ? "로그인" : "가입하고 시작"}</button>
        <button class="btn ghost block" type="button" id="guest">${ic("users", 15)} 게스트로 시작하기</button>
        <div class="t3 xs" style="text-align:center;">게스트는 이 기기에만 저장돼요. 나중에 계속하려면 회원가입을 추천해요.</div>
      </form></div>`;
    page.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => { mode = b.dataset.m; draw(); }));
    const f = page.querySelector("#f");
    f.onsubmit = (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      busy(f.querySelector("[type=submit]"), async () => {
        const r = await post(mode === "login" ? "/api/auth/login" : "/api/auth/register", d);
        setSession(r.playerId, r.token);
        toast(mode === "login" ? "다시 오신 걸 환영해요!" : "가입 완료! 영웅 소환부터 시작해 보세요.");
        reloadAfterLogin();
      });
    };
    page.querySelector("#guest").onclick = (e) => busy(e.currentTarget, async () => {
      const r = await post("/api/players");
      setSession(r.playerId);
      toast("게스트로 시작했어요. 설정에서 닉네임을 정할 수 있어요.");
      reloadAfterLogin();
    });
  };
  draw();
}
