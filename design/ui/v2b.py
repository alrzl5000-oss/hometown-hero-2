# 2.0 확정 방향 B(다크 네온) — 파밍/보스전 데스크톱·모바일 + 10단계 배경 진행표
from v2 import *  # css, SP, MOB, RAR, TEAM, FIELD, unit, mob, doc, THEMES ...

T = dict(THEMES[1])
BGT = ["/_blob/0ba7f617aa75b2a7340ce3fe7696ed14", "/_blob/1adaba1cf0c332648fa12af0daf21e92", "/_blob/b9784aeaa263bd3ff24255c09a8ea1a7",
       "/_blob/8117e521c11e4bdc36971d0995fe594c", "/_blob/8f11977a98c5f81ee40dbe6d079bcd17", "/_blob/3e9624207d83dd421e28b6620931a188",
       "/_blob/e4badf1eb99e63d46f93c9503b57305a", "/_blob/9fc4babaac11f067bf0e2ae405003857", "/_blob/89e2228ee904c68bd58b0f9bab45a845",
       "/_blob/4d23eb36ba64eb5f47bf66d5047019e0"]
TIERS = [("1–10", "마을 외곽 들판"), ("11–20", "푸른 숲"), ("21–30", "독버섯 늪"), ("31–40", "무너진 성채"), ("41–50", "지하 던전"),
         ("51–60", "용암 동굴"), ("61–70", "저주받은 묘지"), ("71–80", "핏빛 폐허"), ("81–90", "심연의 균열"), ("91–100+", "마왕성")]
STAGE, MAXST = 56, 69
SCENE = BGT[(STAGE - 1) // 10]
DPS = ["21,402", "18,930", "38,115", "9,880", "57,778"]
TEAM_STATS = [("공 3,120 · 체 41,800 · 방 2,904"), ("공 2,640 · 체 38,210 · 방 2,560"), ("공 6,880 · 체 22,140 · 방 1,310"),
              ("공 2,210 · 체 24,900 · 방 1,480"), ("공 9,420 · 체 19,880 · 방 1,050")]
G, BAD, INFO, WARN = T["good"], T["bad"], T["info"], T["warn"]
EXTRA = """
.sec{display:flex;justify-content:space-between;align-items:center}
.tbl .r{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ffffff12;font-size:12px}
.tbl .r b{color:#fff}
.pill{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 7px;font-size:11px;border:1px solid #3b3566;color:#a9a4c4;background:#15132a}
.pill.on{border:1px solid #ffd166;color:#ffd166;background:#2a2410;font-weight:800;box-shadow:0 0 10px #ffd16644}
.pill.sel{border:1px solid #8f7cff;color:#fff;background:#2a2450;font-weight:800;box-shadow:0 0 10px #8f7cff55}
.hex{width:44px;height:50px;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);display:flex;align-items:center;justify-content:center;font-family:'Galmuri11',monospace;font-weight:700;font-size:13px;flex:0 0 auto}
.hs{overflow-x:auto;scrollbar-width:none}
"""


def page_css():
    return css(T) + EXTRA


def topbar_m():
    return f'''<header style="padding:8px 12px 6px;{T['top']}">
  <div style="display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:6px;"><span class="pf px" style="padding:3px 7px;font-size:11px;{T['lv']}">Lv.300</span><span class="pf" style="font-size:13px;color:#fff;">GM백민수</span></div>
    <div style="display:flex;gap:6px;"><button class="btn chip" aria-label="도움말" style="width:32px;height:28px;">❓</button><button class="btn chip" aria-label="설정" style="width:32px;height:28px;">⚙️</button></div>
  </div>
  <div style="display:flex;gap:5px;margin-top:6px;font-size:11px;"><span class="chip" style="padding:3px 7px;">💰 473억</span><span class="chip" style="padding:3px 7px;">💎 5,837만</span><span class="chip" style="padding:3px 7px;">🔶 0</span><span class="chip" style="padding:3px 7px;margin-left:auto;">스테이지 {STAGE}</span></div>
  <div class="bar" style="height:4px;margin-top:6px;"><i style="width:41%;background:{T['exp']};"></i></div>
</header>'''


def nav_m(active="battle"):
    tabs = [("battle", "⚔️", "전투"), ("odyssey", "🗺️", "오디세이"), ("gacha", "🎰", "소환"), ("heroes", "📖", "영웅"), ("contents", "🏆", "콘텐츠"), ("ability", "⚡", "어빌리티")]
    items = "".join(f'<a href="#" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-decoration:none;{T["navon"] if k == active else ""}"><span style="font-size:19px;">{i}</span><span style="font-size:10px;color:{"#fff" if k == active else "#a9a4c4"};">{l}</span></a>' for k, i, l in tabs)
    return f'<nav style="position:absolute;left:0;right:0;bottom:0;height:62px;display:flex;padding:4px;{T["nav"]}">{items}</nav>'


def munit(u, x, y, s=54, cast=None):
    c = f'<div class="pf" style="position:absolute;top:-17px;left:50%;transform:translateX(-50%);font-size:9px;padding:1px 4px;background:{T["acc"]};color:#fff;white-space:nowrap;">{cast}</div>' if cast else ""
    return f'''<div style="position:absolute;left:{x}px;top:{y}px;width:{s}px;">{c}<img class="sp" src="{SP[u['sp']]}" alt="{u['name']}" style="width:{s}px;height:{s}px;">
<div style="width:40px;margin:0 auto;"><div class="bar" style="height:3px;border:1px solid #000;"><i style="width:{u['hp']}%;background:#5fd46e;"></i></div><div class="bar" style="height:3px;border:1px solid #000;border-top:none;"><i style="width:{u['mp']}%;background:#5d8cff;"></i></div></div></div>'''


def mmob(k, x, y, w, hp=None):
    hb = f'<div class="bar" style="width:28px;margin:1px auto 0;height:3px;border:1px solid #000;"><i style="width:{hp}%;background:#e0473d;"></i></div>' if hp is not None else ""
    return f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;"><img class="sp" src="{MOB[k]}" alt="" style="width:{w}px;">{hb}</div>'


# ---------------------------------------------------------------- 공통 블록 (데스크톱)
def scene_farm(h=420):
    units = "".join(unit(T, u, x, y) for u, (x, y) in zip(TEAM, POS))
    mobs = "".join(mob(k, x, y, w, hp) for k, x, y, w, hp in MOBS_ON)
    return f'''<div style="position:relative;height:{h}px;overflow:hidden;background:url('{SCENE}') center bottom / cover;image-rendering:pixelated;">
  {mobs}{units}
  <div class="dmg" style="left:57%;top:140px;font-size:18px;color:#fff;">-12,480</div>
  <div class="dmg" style="left:66%;top:200px;font-size:24px;color:#ffd166;">-38,211!</div>
  <div class="dmg" style="left:79%;top:140px;font-size:14px;color:#9cf;">+1 처치</div>
  <div class="dmg" style="left:47%;top:110px;font-size:13px;color:#b7ffb0;">💰+2,108 ⭐+31</div>
  <div class="panel px" style="position:absolute;left:14px;top:12px;padding:8px 12px;">
    <div class="h" style="font-size:16px;">스테이지 {STAGE} <span class="muted" style="font-size:11px;font-family:inherit;">· 용암 동굴 · 파밍 중</span></div>
    <div class="muted" style="font-size:11px;margin-top:3px;">최고 기록 {MAXST}층 · 잡몹 5종 혼합 출현</div>
  </div>
  <div class="panel px" style="position:absolute;right:14px;top:12px;padding:8px 12px;text-align:right;">
    <div class="muted" style="font-size:11px;">누적 처치</div><div class="h" style="font-size:22px;">12,840<span style="font-size:12px;"> 마리</span></div>
  </div>
  <button class="btn chip pf" style="position:absolute;right:14px;bottom:12px;height:30px;padding:0 12px;font-size:12px;border-color:#8f7cff;">🌟 지금 받는 버프 9개 보기</button>
</div>'''


def my_team_panel(cardw=150):
    cards = ""
    for u, dps, st in zip(TEAM, DPS, TEAM_STATS):
        c = RAR[u["rar"]]; star = f' <span style="color:#ffd166;">{"★" * u["star"]}</span>' if u["star"] else ""
        cards += f'''<div style="flex:1;min-width:0;background:linear-gradient(180deg,#1a1830,#121022);border:1px solid {c};box-shadow:0 0 12px {c}33;padding:8px;">
  <div style="display:flex;justify-content:space-between;font-size:10px;"><span class="pf" style="background:{c};color:#111;padding:1px 5px;">{u['rar']}{star}</span><span class="muted">{u['row']}</span></div>
  <img class="sp" src="{SP[u['sp']]}" alt="" style="width:64px;height:64px;margin:4px auto 2px;">
  <div style="font-size:12px;font-weight:800;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;">{u['name']}</div>
  <div class="muted" style="font-size:10.5px;text-align:center;">{u['cls']} · {u['el']} · Lv.35</div>
  <div class="bar" style="margin-top:6px;"><i style="width:{u['hp']}%;background:#5fd46e;"></i></div>
  <div class="bar" style="margin-top:2px;height:4px;"><i style="width:{u['mp']}%;background:#5d8cff;"></i></div>
  <div class="muted" style="font-size:10px;text-align:center;margin-top:5px;">{st}</div>
  <div class="pf" style="font-size:11px;text-align:center;color:#ffd166;margin-top:2px;">DPS {dps}</div></div>'''
    return f'''<div class="panel px" style="padding:14px;display:flex;flex-direction:column;gap:12px;">
  <div class="sec"><span class="h" style="font-size:15px;">내 파밍 팀 <span class="muted" style="font-size:12px;font-family:inherit;">5명 · 팀 예상 DPS <b style="color:#7be08a;">145,603</b></span></span>
    <div style="display:flex;gap:8px;"><button class="btn btn-sub px" style="height:32px;padding:0 14px;font-size:12px;">🧩 팀 편성</button><button class="btn btn-main px" style="height:32px;padding:0 16px;font-size:13px;">👑 보스전</button></div></div>
  <div style="display:flex;gap:10px;">{cards}</div>
  <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;font-size:12px;">
    <span class="muted">진형</span><span class="pill sel">균형진 2·2·1</span><span class="pill">공세진 1·1·3</span><span class="pill">철벽진 3·1·1</span>
    <span class="muted" style="margin-left:10px;">배치 프리셋</span><span class="pill">1</span><span class="pill on">2</span><span class="pill">3</span><span style="color:#ffd166;font-size:11px;font-weight:800;">✓ 프리셋 2 사용 중</span>
  </div>
  {bonus_strip(T)}
</div>'''


def stage_strip(compact=False):
    chips = ""
    for n in range(50, 66):
        if n == STAGE: bg, fg = "linear-gradient(180deg,#ffd877,#f0a92f)", "#3a2600"
        elif n <= MAXST: bg, fg = "#0d2350", "#6aa8ff"
        else: bg, fg = "#1a182e", "#4e4b63"
        boss = '<div style="position:absolute;top:-4px;right:-2px;font-size:10px;">👑</div>' if n == MAXST + 1 else ""
        mark = '<div style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);font-size:9px;color:#ffd166;white-space:nowrap;">지금</div>' if n == STAGE else ""
        chips += f'<div style="position:relative;padding:4px 3px 16px;"><div class="hex" style="background:{bg};color:{fg};{"width:38px;height:44px;font-size:12px;" if compact else ""}">{n}</div>{boss}{mark}</div>'
        if n == 60:
            chips += '<div style="flex:0 0 auto;width:2px;margin:0 6px 16px;background:#ff5a8a;box-shadow:0 0 8px #ff5a8a;"></div>'
    return chips


def stage_panel():
    info = [("스테이지", f"{STAGE}층 · 용암 동굴 (51–60)"), ("잡몹 속성", "없음 (파밍은 예측 가능하게)"), ("잡몹 평균 체력", "719,419"), ("잡몹 평균 공격력", "20,115"),
            ("잡몹 평균 방어력", "3,110"), ("내 팀 예상 DPS", "145,603"), ("평균 처치 시간", "1.6초 / 마리"), ("파밍 난이도", "✅ 여유롭게 클리어"),
            ("👑 층보스", "얼음 거인 💧 수속성"), ("👑 보스 체력 / 공격력", "1,079,129 / 24,138"), ("👑 보조 스킬", "비늘 강화 (피해 2회 차단)")]
    rows = "".join(f'<div class="r"><span class="muted">{a}</span><b style="color:{G if "✅" in b or a == "내 팀 예상 DPS" else "#fff"};">{b}</b></div>' for a, b in info)
    return f'''<div class="panel px" style="padding:14px;">
  <div class="sec"><span class="h" style="font-size:15px;">스테이지 이동</span><span class="muted" style="font-size:11px;">최고 기록 <b style="color:#fff;">{MAXST}층</b> · 1~{MAXST}층은 눌러서 바로 이동(후퇴·복귀) · {MAXST + 1}층부터는 👑 보스를 이겨야 열려요</span></div>
  <div class="hs" style="display:flex;align-items:flex-end;margin-top:10px;background:#0f0d1c;border:1px solid #2c2850;padding:8px 6px 4px;">{stage_strip()}</div>
  <div style="display:flex;justify-content:space-between;font-size:10.5px;margin-top:6px;"><span style="color:#ff9a5a;">🔥 51–60 용암 동굴</span><span style="color:#b8c4d8;">61–70 저주받은 묘지 ▶</span></div>
  <div style="display:flex;gap:8px;margin-top:10px;"><button class="btn btn-sub px" style="height:32px;padding:0 12px;font-size:12px;">◀ 이전 층</button><button class="btn btn-sub px" style="height:32px;padding:0 12px;font-size:12px;">다음 층 ▶</button><button class="btn btn-sub px" style="height:32px;padding:0 12px;font-size:12px;">⏫ 최고 층({MAXST})으로</button></div>
  <div class="tbl" style="margin-top:12px;">{rows}</div></div>'''


def ability_panel():
    rows = "".join(f'<div class="r" style="align-items:center;"><span>{l}</span><span style="display:flex;gap:3px;"><span class="pill on" style="height:22px;min-width:22px;">1</span><span class="pill" style="height:22px;min-width:22px;">2</span><span class="pill" style="height:22px;min-width:22px;">3</span><span class="pill" style="height:22px;">끔</span></span></div>'
                   for l in ["파밍", "층보스", "일일보스", "골드 던전", "다이아 던전", "경험치 던전", "PvP", "오디세이"])
    return f'''<div class="panel px" style="padding:14px;"><div class="h" style="font-size:14px;">⚡ 콘텐츠별 어빌리티 프리셋</div>
  <div class="muted" style="font-size:10.5px;margin:4px 0 4px;">도전하는 순간 자동 전환, 끝나면 원래 프리셋으로</div><div class="tbl">{rows}</div></div>'''


def farm_status():
    return f'''<div class="panel px" style="padding:14px;">
  <div class="sec"><span class="h" style="font-size:14px;">📊 파밍 현황 (최근 1분)</span><button class="btn btn-sub px" style="height:26px;font-size:11px;padding:0 10px;">🔄 다시 측정</button></div>
  <div class="tbl" style="margin-top:6px;"><div class="r"><span>⚔️ 처치</span><b>38마리</b></div><div class="r"><span>💰 골드</span><b>1,284,300</b></div><div class="r"><span>⭐ 경험치</span><b>1,178</b></div><div class="r"><span>💎 다이아</span><b>처치당 20% · 2,478개</b></div></div>
  <div style="margin-top:8px;font-size:11px;padding:8px;background:#1d2a20;border:1px solid #3e8a4e;color:#a8f0b0;">🌙 자리 비운 2시간 14분 동안 +1억 7,204만 골드 · 5,104마리 처치 (최대 8시간 적립)</div></div>'''


def boss_card():
    return f'''<div class="panel px" style="padding:14px;">
  <div style="display:flex;gap:12px;align-items:center;"><img class="sp" src="{MOB['ice']}" alt="얼음 거인" style="width:76px;height:60px;object-fit:contain;">
  <div style="flex:1;"><div class="muted" style="font-size:11px;">{STAGE}층 층보스 · 이기면 {STAGE + 1}층 열림</div><div class="h" style="font-size:17px;">얼음 거인 <span style="font-size:12px;color:{INFO};">💧 수속성</span></div></div></div>
  <div style="font-size:11.5px;margin-top:8px;"><b style="color:{G};">🌪 풍 영웅 피해 ×1.25</b> · <span style="color:{BAD};">🔥 화 영웅 ×0.85</span></div>
  <div class="muted" style="font-size:11px;margin-top:3px;">내 팀: 풍 2명 · 화 2명 · 수 1명 · 예상 승률 <b style="color:{G};">높음</b></div>
  <button class="btn btn-main px" style="width:100%;height:46px;font-size:16px;margin-top:10px;">👑 보스 도전</button></div>'''


# ---------------------------------------------------------------- 데스크톱 파밍
def farm_desktop():
    body = f'''{topbar(T)}
<div style="display:grid;grid-template-columns:1fr 390px;gap:16px;padding:16px 20px 100px;">
  <div style="display:flex;flex-direction:column;gap:14px;min-width:0;">
    <div class="px" style="overflow:hidden;border:2px solid {T['line']};">{scene_farm()}</div>
    <div class="muted" style="font-size:11.5px;">💡 가난한 서버를 위해 재화 획득 수식을 간단하게 표기했어요. 지금 스테이지 다이아 획득 확률: <b style="color:#c9c0ff;">처치당 20% 확률로 💎2,478개</b></div>
    {my_team_panel()}
    {stage_panel()}
  </div>
  <div style="display:flex;flex-direction:column;gap:14px;">{boss_card()}{farm_status()}{species_list(T)}{ability_panel()}</div>
</div>'''
    return body


# ---------------------------------------------------------------- 데스크톱 보스전
def boss_desktop():
    units = "".join(unit(T, u, x, y, cast=("필살기!" if i == 4 else None)) for i, (u, (x, y)) in enumerate(zip(TEAM, POS)))
    scene = f'''<div style="position:relative;height:460px;overflow:hidden;background:url('{SCENE}') center bottom / cover;image-rendering:pixelated;">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 75% 45%,#4aa8ff33,transparent 55%);"></div>
  {mob('ice', 760, 90, 250, 0, boss=True)}{units}
  <div class="dmg" style="left:58%;top:140px;font-size:26px;color:#7be08a;">-184,220 효과적!</div>
  <div class="dmg" style="left:66%;top:250px;font-size:16px;color:#ffb0a0;">-21,004 (약함)</div>
  <div class="dmg" style="left:62%;top:330px;font-size:14px;color:#9cf;">🛡 보호막 1회 남음</div>
  <div class="panel px" style="position:absolute;left:14px;top:12px;width:min(560px,62%);padding:10px 14px;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;"><span class="h" style="font-size:16px;">{STAGE}층 층보스 · 얼음 거인</span><span style="font-size:12px;color:{INFO};">💧 수속성</span></div>
    <div class="bar" style="height:12px;margin-top:6px;border:1px solid #000;"><i style="width:63%;background:linear-gradient(90deg,#e0473d,#f4874a);"></i></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:3px;"><span>679,851 / 1,079,129</span><span style="color:#9cf;">마나 ▮▮▮▮▯ 「비늘 강화」 준비 중</span></div>
  </div>
  <div style="position:absolute;right:14px;top:12px;display:flex;gap:6px;"><span class="chip pf" style="padding:6px 10px;font-size:12px;">⏱ 0:42</span><span class="chip pf" style="padding:6px 10px;font-size:12px;">▶ x1</span><span class="chip pf" style="padding:6px 10px;font-size:12px;opacity:.6;">x2</span><span class="chip pf" style="padding:6px 10px;font-size:12px;">⏭ 결과 바로 보기</span></div>
</div>'''
    cards = "".join(team_card(T, u, w=150) for u in TEAM)
    return f'''{topbar(T)}
<div style="display:grid;grid-template-columns:1fr 390px;gap:16px;padding:16px 20px 100px;">
  <div style="display:flex;flex-direction:column;gap:14px;min-width:0;">
    <div class="px" style="overflow:hidden;border:2px solid {T['line']};">{scene}</div>
    <div style="display:flex;gap:10px;">{cards}</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:14px;">{element_card(T)}{battle_log(T)}
    <div class="panel px" style="padding:14px;"><div class="h" style="font-size:13px;">승리 보상</div><div class="tbl" style="margin-top:6px;"><div class="r"><span>다음 층 해금</span><b>{STAGE + 1}층</b></div><div class="r"><span>💎 첫 클리어 보너스</span><b>20</b></div><div class="r"><span>패배 시</span><b>페널티 없음 · 그 층에서 계속 파밍</b></div></div></div>
  </div>
</div>'''


# ---------------------------------------------------------------- 모바일
MPOS = [(166, 92), (150, 150), (104, 78), (90, 140), (30, 112)]
MMOBS = [("mongrel", 206, 150, 66, 80), ("shroom", 246, 96, 58, 55), ("golem", 292, 176, 54, 100), ("bat", 300, 84, 52, 35), ("spirit", 344, 132, 40, 90), ("shroom", 330, 200, 50, 70)]


def farm_mobile():
    units = "".join(munit(u, x, y) for u, (x, y) in zip(TEAM, MPOS))
    mobs = "".join(mmob(k, x, y, w, hp) for k, x, y, w, hp in MMOBS)
    mini = "".join(f'''<div style="flex:1;min-width:0;background:#15132a;border:1px solid {RAR[u['rar']]};padding:4px 2px;text-align:center;">
  <img class="sp" src="{SP[u['sp']]}" alt="" style="width:40px;height:40px;margin:0 auto;"><div style="font-size:9.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{u['name']}</div>
  <div class="bar" style="height:3px;margin-top:2px;"><i style="width:{u['hp']}%;background:#5fd46e;"></i></div><div class="bar" style="height:3px;margin-top:1px;"><i style="width:{u['mp']}%;background:#5d8cff;"></i></div>
  <div class="pf" style="font-size:9px;color:#ffd166;margin-top:2px;">{d}</div></div>''' for u, d in zip(TEAM, ["21.4K", "18.9K", "38.1K", "9.9K", "57.8K"]))
    acc = lambda t, open_, inner: f'<div class="panel" style="padding:10px 12px;"><div class="sec"><span class="h" style="font-size:13px;">{t}</span><span class="muted">{"▴" if open_ else "▾"}</span></div>{inner if open_ else ""}</div>'
    species = "".join(f'<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px;"><img class="sp" src="{MOB[k]}" alt="" style="width:26px;height:18px;object-fit:contain;"><span style="flex:1;">{n}</span><span class="pf">{p}%</span></div>' for k, i, n, p in FIELD)
    return f'''{topbar_m()}
<div style="position:relative;height:270px;overflow:hidden;background:url('{SCENE}') center bottom / cover;image-rendering:pixelated;">
  {mobs}{units}
  <div class="dmg" style="left:228px;top:128px;font-size:13px;color:#ffd166;">-38,211!</div>
  <div class="dmg" style="left:300px;top:150px;font-size:11px;color:#9cf;">+1</div>
  <div class="panel" style="position:absolute;left:8px;top:8px;padding:5px 8px;"><div class="h" style="font-size:13px;">스테이지 {STAGE}</div><div class="muted" style="font-size:9.5px;">용암 동굴 · 최고 {MAXST}층</div></div>
  <div class="panel" style="position:absolute;right:8px;top:8px;padding:5px 8px;text-align:right;"><div class="muted" style="font-size:9.5px;">누적 처치</div><div class="h" style="font-size:15px;">12,840</div></div>
  <button class="btn chip pf" style="position:absolute;right:8px;bottom:8px;height:26px;padding:0 8px;font-size:10.5px;">🌟 버프 9</button>
</div>
<div style="padding:10px 10px 80px;display:flex;flex-direction:column;gap:10px;">
  <div style="display:flex;gap:8px;"><button class="btn btn-sub px" style="flex:1;height:44px;font-size:13px;">🧩 팀 편성</button><button class="btn btn-main px" style="flex:1.4;height:44px;font-size:15px;">👑 보스 도전</button></div>
  <div class="sec"><span class="h" style="font-size:13px;">내 팀 <span class="muted" style="font-size:10.5px;font-family:inherit;">DPS 145.6K · 균형진</span></span><span style="display:flex;gap:3px;"><span class="pill" style="height:22px;min-width:22px;">1</span><span class="pill on" style="height:22px;min-width:22px;">2</span><span class="pill" style="height:22px;min-width:22px;">3</span></span></div>
  <div style="display:flex;gap:4px;">{mini}</div>
  <div class="hs" style="display:flex;gap:6px;white-space:nowrap;">{"".join(f'<span class="chip" style="font-size:10.5px;padding:4px 8px;flex:0 0 auto;">{c}</span>' for c in ["🔗 이재훈 계보 2세트 +12%", "🗂 컬렉션 +45.9%", "⭐ EX 별 +15%", "⚡ 어빌 프리셋 2"])}</div>
  <div class="panel" style="padding:10px 12px;display:flex;gap:10px;align-items:center;"><img class="sp" src="{MOB['ice']}" alt="" style="width:52px;height:42px;object-fit:contain;"><div style="flex:1;"><div class="h" style="font-size:13px;">층보스 얼음 거인 <span style="color:{INFO};font-size:10.5px;">💧수</span></div><div style="font-size:10.5px;"><b style="color:{G};">풍 ×1.25</b> · <span style="color:{BAD};">화 ×0.85</span> · 보호막 스킬</div></div></div>
  <div class="panel" style="padding:10px 8px;"><div class="sec" style="padding:0 4px;"><span class="h" style="font-size:13px;">스테이지 이동</span><span class="muted" style="font-size:10px;">1~{MAXST}층 자유 이동</span></div>
    <div class="hs" style="display:flex;align-items:flex-end;margin-top:6px;">{stage_strip(compact=True)}</div>
    <div style="display:flex;gap:6px;margin-top:6px;"><button class="btn btn-sub px" style="flex:1;height:32px;font-size:11px;">◀ 이전</button><button class="btn btn-sub px" style="flex:1;height:32px;font-size:11px;">다음 ▶</button><button class="btn btn-sub px" style="flex:1.3;height:32px;font-size:11px;">⏫ 최고 층</button></div></div>
  {acc("📊 파밍 현황 (1분)", True, '<div class="tbl" style="margin-top:4px;"><div class="r"><span>⚔️ 처치</span><b>38마리</b></div><div class="r"><span>💰 골드</span><b>128만</b></div><div class="r"><span>⭐ 경험치</span><b>1,178</b></div><div class="r"><span>💎 다이아</span><b>20% · 2,478개</b></div></div>')}
  {acc("👾 출현 몬스터 5종", True, '<div style="margin-top:4px;">' + species + '</div>')}
  {acc("📋 스테이지 정보", False, "")}
  {acc("⚡ 콘텐츠별 어빌리티 프리셋", False, "")}
</div>'''


def boss_mobile():
    units = "".join(munit(u, x, y, cast=("필살기!" if i == 4 else None)) for i, (u, (x, y)) in enumerate(zip(TEAM, [(150, 130), (136, 190), (92, 118), (80, 180), (20, 150)])))
    mini = "".join(f'''<div style="flex:1;min-width:0;background:#15132a;border:1px solid {RAR[u['rar']]};padding:4px 2px;text-align:center;"><img class="sp" src="{SP[u['sp']]}" alt="" style="width:36px;height:36px;margin:0 auto;">
<div class="bar" style="height:3px;"><i style="width:{u['hp']}%;background:#5fd46e;"></i></div><div class="bar" style="height:3px;margin-top:1px;"><i style="width:{u['mp']}%;background:#5d8cff;"></i></div></div>''' for u in TEAM)
    return f'''{topbar_m()}
<div style="position:relative;height:330px;overflow:hidden;background:url('{SCENE}') center bottom / cover;image-rendering:pixelated;">
  <div style="position:absolute;left:8px;right:8px;top:8px;" class="panel"><div style="padding:6px 8px;"><div class="sec"><span class="h" style="font-size:12.5px;">{STAGE}층 보스 · 얼음 거인</span><span style="color:{INFO};font-size:10.5px;">💧 수</span></div>
    <div class="bar" style="height:8px;margin-top:4px;border:1px solid #000;"><i style="width:63%;background:linear-gradient(90deg,#e0473d,#f4874a);"></i></div><div style="display:flex;justify-content:space-between;font-size:9.5px;margin-top:2px;"><span>679,851 / 1,079,129</span><span style="color:#9cf;">「비늘 강화」 준비</span></div></div></div>
  {mmob('ice', 230, 100, 140)}{units}
  <div class="dmg" style="left:200px;top:120px;font-size:15px;color:#7be08a;">-184,220 효과적!</div>
  <div style="position:absolute;right:8px;bottom:8px;display:flex;gap:4px;"><span class="chip pf" style="padding:3px 7px;font-size:10px;">⏱ 0:42</span><span class="chip pf" style="padding:3px 7px;font-size:10px;">x1</span><span class="chip pf" style="padding:3px 7px;font-size:10px;">⏭ 결과</span></div>
</div>
<div style="padding:10px 10px 80px;display:flex;flex-direction:column;gap:10px;">
  <div style="display:flex;gap:4px;">{mini}</div>
  <div class="panel" style="padding:10px 12px;"><div class="pf" style="font-size:13px;">🔥 화 ▶ 🌪 풍 ▶ 💧 수 ▶ 🔥 화</div><div class="muted" style="font-size:10.5px;margin-top:3px;">유리 ×1.25 · 불리 ×0.85</div></div>
  {battle_log(T).replace('padding:12px 14px;', 'padding:10px 12px;')}
</div>'''


# ---------------------------------------------------------------- 배경 진행표
def bg_board():
    cells = ""
    for i, ((rng, name), url) in enumerate(zip(TIERS, BGT)):
        cur = i == (STAGE - 1) // 10
        cells += f'''<div style="display:flex;flex-direction:column;gap:6px;">
  <div style="position:relative;height:138px;background:url('{url}') center / cover;image-rendering:pixelated;border:2px solid {'#ffd166' if cur else '#3b3566'};{'box-shadow:0 0 16px #ffd16666;' if cur else ''}">
    {'<span class="pf" style="position:absolute;left:6px;top:6px;font-size:10px;background:#ffd166;color:#2a1600;padding:2px 6px;">지금 56층</span>' if cur else ''}</div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;"><span class="h" style="font-size:13px;">{name}</span><span class="pf muted" style="font-size:11px;">{rng}층</span></div></div>'''
    return f'''<div style="padding:28px 28px 32px;">
  <div class="h" style="font-size:22px;">파밍 배경 — 10스테이지마다 교체, 갈수록 무섭게</div>
  <div class="muted" style="font-size:12.5px;margin-top:6px;">밝은 들판에서 시작해 숲 → 늪 → 성채 → 던전 → 용암 → 묘지 → 핏빛 폐허 → 심연 → 마왕성 순으로 어두워져요. 100층 이후는 마왕성이 계속되고 색만 더 붉어져요. 새 구간에 처음 들어가면 배경 이름이 크게 뜨는 연출을 넣어요.</div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:18px 16px;margin-top:20px;">{cells}</div></div>'''


def files():
    c = page_css()
    def mk(title, inner, h, w=1280, nav=True, mobile=False):
        navh = nav_m() if mobile else navbar(T)
        body = f'<div style="position:relative;width:100%;height:{h}px;overflow:hidden;background:{T["bg"]};">{inner}{navh if nav else ""}</div>'
        html = doc(title, body, h).replace("@@CSS@@", c).replace('"width": 1280', f'"width": {w}')
        return html, h, title, w
    return {
        "V2BFarm": mk("2.0 · 전투(파밍) — 데스크톱", farm_desktop(), 1620),
        "V2BBoss": mk("2.0 · 층보스전 — 데스크톱", boss_desktop(), 920),
        "V2BFarmMobile": mk("2.0 · 전투(파밍) — 모바일", farm_mobile(), 1340, w=390, mobile=True),
        "V2BBossMobile": mk("2.0 · 층보스전 — 모바일", boss_mobile(), 844, w=390, mobile=True),
        "V2BStageBackgrounds": mk("2.0 · 스테이지 배경 10단계", bg_board(), 520, nav=False),
    }
