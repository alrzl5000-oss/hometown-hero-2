// 설정 · 패치노트 · 도움말(처음 안내)
import { S, post, pp, refreshMe, clearSession } from "../api.js";
import { ic, esc, avatar, openModal, toast, busy, confirmBox, closeAllModals } from "../ui.js";
import { go } from "../main.js";

export function openSettings() {
  const m = openModal("");
  const draw = () => {
    const me = S.me || {};
    const h = S.heroById.get(me.farm?.team?.[0]);
    const item = (act, i, t, s, danger = false) => `<button class="well" data-act="${act}" style="display:flex;align-items:center;gap:12px;padding:13px 14px;border:none;color:inherit;cursor:pointer;text-align:left;${danger ? "outline:1px solid rgba(251,113,133,.35);" : ""}"><span style="color:${danger ? "var(--red)" : "var(--t2)"};">${ic(i, 18)}</span><div class="grow"><div style="font-weight:700;${danger ? "color:var(--red);" : ""}">${t}</div><div class="t3 xs">${s}</div></div>${ic("chev", 16)}</button>`;
    m.set(`<div class="h1">설정</div>
      <div class="well" style="display:flex;align-items:center;gap:12px;padding:12px 14px;">${avatar(h?.characterId, h?.originRarity, 42)}<div class="grow"><div style="font-weight:700;">${esc(me.nickname || "이름없는 영웅")}</div><div class="t3 xs">Lv.${me.level} · ${me.isGuest ? "게스트 (이 기기에만 저장)" : `이메일 로그인 · ${esc(me.email || "")}`}</div></div></div>
      ${item("nick", "edit", "닉네임 변경", "랭킹과 PvP에 보이는 이름 (2~12자)")}
      ${item("patch", "doc", "패치노트", "업데이트 내역 보기")}
      ${item("welcome", "help", "게임 안내 다시 보기", "처음 시작할 때 본 안내")}
      ${item("logout", "logout", "로그아웃", me.isGuest ? "게스트는 로그아웃하면 다시 들어올 수 없어요" : "이 기기에서 로그아웃")}
      ${item("reset", "trash", "데이터 초기화", "골드·다이아·레벨·스테이지·보유 캐릭터·어빌리티·장비 등 모든 진행을 완전히 되돌려요. 되돌릴 수 없어요.", true)}`);
  };
  m.body.onclick = async (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const a = t.dataset.act;
    if (a === "patch") openPatchNotes();
    else if (a === "welcome") openWelcome();
    else if (a === "nick") {
      const n = openModal(`<div class="h2">닉네임 변경</div><input class="inp" id="nn" maxlength="12" value="${esc(S.me.nickname || "")}" placeholder="2~12자"><button class="btn pri block" id="ok">저장</button>`);
      const inp = n.body.querySelector("#nn"); inp.focus();
      n.body.querySelector("#ok").onclick = (ev) => busy(ev.currentTarget, async () => { await post(pp("/nickname"), { nickname: inp.value }); await refreshMe(); n.close(); draw(); toast("닉네임을 바꿨어요."); });
    } else if (a === "logout") {
      if (S.me.isGuest && !(await confirmBox("로그아웃", "게스트 계정은 로그아웃하면 다시 들어올 방법이 없어요. 그래도 로그아웃할까요?", { ok: "로그아웃", danger: true }))) return;
      clearSession(); closeAllModals(); go("login");
    } else if (a === "reset") {
      const ok = await confirmBox("데이터 초기화", "모든 진행(재화·레벨·스테이지·보유 영웅·장비·어빌리티)이 처음 상태로 돌아가요. <b class='red'>되돌릴 수 없어요.</b> 계정과 닉네임은 그대로예요.", { ok: "초기화", danger: true });
      if (!ok) return;
      busy(t, async () => { await post(pp("/reset-data"), { confirm: "초기화" }); S.me = null; S.heroes = null; closeAllModals(); toast("데이터를 초기화했어요."); location.hash = "#/farm"; location.reload(); });
    }
  };
  draw();
}

const PATCHES = [
  { date: "2026-11-24", title: "2.0 웹 게임 화면 오픈 + 서버 기능 확장", items: [
    "새 테마 'Jade 비취 밤' — 데스크톱과 모바일 화면을 모두 지원해요.",
    "소환: 1/10/100/1000회 묶음 소환. 10회는 SR 이상 1명, 100회는 SR 이상 10명 확정, 1000회는 순수 확률이에요.",
    "어빌리티 프리셋 3개 + 콘텐츠별 자동 적용(파밍·층보스·일일보스·던전 3종·PvP·오디세이).",
    "파밍 팀 배치 프리셋 3개, 오디세이 테마별 팀 저장.",
    "오디세이 진행도·도전 횟수(30회, 5분마다 1회 충전)가 서버에 저장돼요. 1회/10연속 도전.",
    "장비 가방(100칸) — 장착·강화(+15)·판매·일괄판매·자동판매·장비 프리셋 3개.",
    "일일 던전 3종과 일일보스 기록이 서버에 저장돼요(매일 오전 9시 초기화).",
    "랭킹(스테이지·레벨·일일보스·PvP)과 콘텐츠별 받는 버프 보기 추가.",
  ] },
  { date: "2026-08-30", title: "신규 재화 '승급석' 획득 경로 추가 + 1000연차 안내 정정", items: [
    "1000연차 소환에 있던 'SR 이상 확정' 안내를 없앴어요 — 1000연차는 처음부터 순수 확률로만 진행돼요.",
    "EX 승급에 필요한 '승급석'을 얻는 방법이 세 가지 열렸어요: ① Lv.100부터 소환할 때 아주 낮은 확률 ② 오디세이 클리어 시 낮은 확률 ③ 버려진 조각으로 직접 제작.",
    "캐릭터 개인 조각은 EX 승급에 필요한 만큼까지만 쌓이고, 넘치는 조각은 계정 공용 '버려진 조각'으로 바뀌어요.",
    "상단바에 승급석 보유량이 항상 보여요.",
    "소환·오디세이 중 승급석을 얻으면 결과 화면에 전용 알림이 떠요.",
    "EX 승급 화면의 별 보너스 안내가 '미반영'으로 잘못 나오던 걸 고쳤어요 — 별 보너스는 이미 적용되고 있었어요.",
  ] },
];
export function openPatchNotes() {
  openModal(`<div class="h1">패치노트</div><div class="col" style="gap:10px;max-height:65vh;overflow-y:auto;">${PATCHES.map((p) => `<div class="well" style="padding:16px;"><div class="sec"><span class="h3">${esc(p.title)}</span><span class="t3 xs">${p.date}</span></div>
    <ul style="margin:12px 0 0;padding-left:18px;font-size:12.5px;line-height:1.7;color:var(--t2);">${p.items.map((t) => `<li style="margin-bottom:6px;">${esc(t)}</li>`).join("")}</ul></div>`).join("")}</div>`, { size: "wide" });
}

const SLIDES = [
  { t: "우리동네 영웅 키우기 2.0", s: "무엇이 바뀌었는지 빠르게 훑어볼게요.", grid: [["users", "5명 팀", "앞열·중열·뒷열 진형 3가지"], ["eye", "몹 여러 마리", "필드에 5종이 섞여 나와요"], ["crown", "보스 6종", "보스마다 속성이 달라요"], ["zap", "마나 스킬", "마나가 차면 스킬 발동"]] },
  { t: "전투 · 파밍", s: "영웅 5명을 편성하면 자동으로 사냥해요. 앱을 꺼도 최대 8시간까지 골드·경험치·다이아가 쌓이고, 다시 들어오면 한 번에 받아요.", grid: [["sword", "균형진 2-2-1", "무난한 기본 진형"], ["target", "공세진 1-1-3", "뒷열 화력 위주"], ["shield", "철벽진 3-1-1", "오래 버티는 진형"], ["layers", "배치 프리셋", "팀을 3개까지 저장"]] },
  { t: "층보스 · 스테이지", s: "층보스를 이기면 다음 층이 열려요. 지더라도 페널티는 없어요. 10층마다 배경이 바뀌고 점점 더 무서워져요.", grid: [["flame", "화 > 풍", "유리하면 피해 ×1.25"], ["wind", "풍 > 수", "불리하면 ×0.85"], ["drop", "수 > 화", "보스 속성을 확인하세요"], ["chev", "자유 이동", "깬 층은 언제든 이동"]] },
  { t: "소환", s: "다이아로 영웅을 뽑아요. 계정 레벨이 오를수록 높은 등급 확률이 올라가요.", grid: [["spark", "10회", "SR 이상 1명 확정"], ["spark", "100회", "SR 이상 10명 확정"], ["star", "천장 1,000회", "SSR 이상 확정"], ["gift", "중복", "조각으로 바뀌어 승급에 써요"]] },
  { t: "영웅 성장", s: "골드로 레벨업, 조각으로 등급 승급(N→R→SR→SSR→XR), XR은 승급석으로 EX가 되고 별 강화까지 할 수 있어요.", grid: [["up", "레벨업", "등급마다 최대 레벨이 달라요"], ["star", "EX 승급", "승급석 + 조각"], ["doc", "도감", "모을수록 팀 전체 강화"], ["layers", "시너지", "세트 영웅을 함께 배치"]] },
  { t: "오디세이 · 장비", s: "5층마다 배치할 수 있는 직업이 바뀌는 탑이에요. 이기면 장비가 떨어지고, 장비는 모든 콘텐츠에 효과가 있어요.", grid: [["map", "도전 30회", "5분마다 1회 충전"], ["bag", "장비 가방", "100칸 · 자동판매"], ["up", "강화 +15", "+11부터 하락 위험"], ["layers", "장비 프리셋", "3개 저장"]] },
  { t: "콘텐츠 · 어빌리티", s: "매일 오전 9시에 던전과 일일보스 횟수가 초기화돼요. 어빌리티는 계정 Lv.10/20/30에 한 줄씩 열려요.", grid: [["trophy", "던전 3종", "골드·다이아·경험치"], ["crown", "일일보스", "20초 데미지 레이스"], ["users", "PvP", "레이팅전 · 자존심전"], ["zap", "콘텐츠별 프리셋", "도전할 때 자동 전환"]] },
];
export function openWelcome() {
  let i = 0;
  const m = openModal("");
  const draw = () => {
    const s = SLIDES[i];
    m.set(`<div style="text-align:center;"><div style="width:64px;height:64px;margin:0 auto;background:var(--pg);display:flex;align-items:center;justify-content:center;clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);box-shadow:0 10px 30px rgba(163,230,53,.4);">${ic(i === 0 ? "spark" : s.grid[0][0], 32, "#052e16")}</div>
      <div class="h1" style="margin-top:14px;">${esc(s.t)}</div><div class="t2" style="font-size:13px;margin-top:6px;line-height:1.6;">${esc(s.s)}</div></div>
      <div class="g2" style="gap:8px;">${s.grid.map(([icn, a, b]) => `<div class="well" style="padding:12px;display:flex;gap:10px;align-items:center;"><div style="width:36px;height:36px;background:var(--p-soft);color:#86efac;display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${ic(icn, 18)}</div><div><div style="font-weight:700;">${esc(a)}</div><div class="t3 xs">${esc(b)}</div></div></div>`).join("")}</div>
      <div style="display:flex;justify-content:center;gap:5px;">${SLIDES.map((_, k) => `<span style="width:${k === i ? 18 : 7}px;height:7px;background:${k === i ? "#a3e635" : "rgba(255,255,255,.2)"};"></span>`).join("")}</div>
      <div class="row2"><button class="btn ghost grow" data-skip>${i === SLIDES.length - 1 ? "닫기" : "건너뛰기"}</button><button class="btn pri grow" data-next style="flex:1.5;">${i === SLIDES.length - 1 ? "시작하기" : "다음"}</button></div>`);
  };
  m.body.onclick = (e) => {
    if (e.target.closest("[data-skip]")) return m.close();
    if (e.target.closest("[data-next]")) { if (i === SLIDES.length - 1) return m.close(); i++; draw(); }
  };
  draw();
}
