# 오디세이 / 어빌리티 / 소환 / 영웅 / 장비 / 콘텐츠 / 던전 / 일일보스 / 랭킹 / PvP / 설정 / 패치노트 / 도움말 / 로그인 — Jade 테마
from ds import *
from n_battle import unit, mob, m_unit, m_mob, acc, TEAM

ODY_BG = BGT[4]  # 오디세이 전투 배경(던전 톤)
TANKS = [dict(t, cls="🛡 탱커") for t in [
    dict(sp="n_tank", name="이재훈", rar="EX", el="🔥", row="앞열", hp=100, mp=60, star=1),
    dict(sp="ssr_tank", name="팔씨름박주환", rar="SSR", el="🌪", row="앞열", hp=92, mp=45, star=0),
    dict(sp="hr", name="댄싱머신채영기", rar="HR", el="🔥", row="중열", hp=100, mp=80, star=0),
    dict(sp="n_tank", name="박주환", rar="EX", el="💧", row="중열", hp=88, mp=30, star=2),
    dict(sp="ssr_tank", name="유부남 박주환", rar="SSR", el="🔥", row="뒷열", hp=100, mp=70, star=0)]]
THEMES = [("cyclops", "target", "키클롭스의 굴", "암살자만", "평타가 전혀 안 통해요 — 스킬로만 싸워요"),
          ("giant", "shield", "거인의 발걸음", "탱커만", "체력의 일부가 공격력으로 전환돼요 (등급이 높을수록 크게)"),
          ("circe", "spark", "키르케의 저주", "서포터만", "서포터의 치유량이 그대로 보스 피해로 바뀌어요"),
          ("siren", "target", "세이렌의 유혹", "원거리만", "보스 체력이 아주 높아요"),
          ("helios", "sword", "헬리오스의 섬", "딜러만", "기믹 없는 정면 승부")]


def kv(a, b, c=""):
    return f'<div class="row"><span class="t2">{a}</span><b class="{c}">{b}</b></div>'


# ================================================================== 오디세이
def ody_scene(h, mobile=False):
    if mobile:
        pos = [(150, 120), (136, 180), (92, 108), (80, 170), (20, 140)]
        units = "".join(m_unit(u, x, y) for u, (x, y) in zip(TANKS, pos))
        return f'''<div class="scene card" style="height:{h}px;background-image:url('{ODY_BG}');border-radius:16px;">{m_mob("golem", 250, 110, 110)}{units}
  <div class="glass" style="position:absolute;z-index:4;left:10px;right:10px;top:10px;padding:8px 10px;"><div class="sec"><span style="font-weight:700;font-size:12.5px;">157층 · 대지를 뒤흔드는 거인</span><span class="chip" style="height:22px;font-size:10.5px;">{ic("spark",11)} 버프 14</span></div><div style="margin-top:5px;">{bar(100, "bhp", 7)}</div></div></div>'''
    pos = [(470, 160), (440, 265), (325, 135), (300, 240), (170, 190)]
    units = "".join(unit(u, round(x / 12.8, 2), y) for u, (x, y) in zip(TANKS, pos))
    return f'''<div class="scene card" style="height:{h}px;background-image:url('{ODY_BG}');border-radius:18px;">
  {mob("golem", 62, 120, 200)}{units}
  <div class="glass" style="position:absolute;z-index:4;left:16px;top:16px;width:min(560px,58%);padding:12px 14px;">
    <div class="sec"><span class="h3">157층 · 대지를 뒤흔드는 거인</span><span class="t3" style="font-size:11px;">속성 없음</span></div>
    <div style="margin-top:8px;">{bar(100, "bhp", 10)}</div><div class="t3" style="font-size:11px;margin-top:4px;">1,419,169 / 1,419,169</div></div>
  <a class="btn sm" style="position:absolute;z-index:4;right:16px;top:16px;background:rgba(10,14,26,.75);">{ic("spark",14)} 받는 버프 14개</a>
</div>'''


def ody_hex(compact=False):
    # 비스듬히 잘린 칼날 타일 (테마 C) — 위에 그 층의 배치 직업 아이콘
    icons = {150: "sword", 151: "target", 152: "target", 153: "target", 154: "target", 155: "target", 156: "shield", 157: "shield", 158: "shield", 159: "shield", 160: "shield", 161: "spark", 162: "spark", 163: "spark", 164: "spark"}
    out = ""
    w, h = (34, 40) if compact else (44, 50)
    cut = "clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%);"
    for n in range(150, 165):
        if n == 157: st = "background:var(--pg);color:var(--on-p);"
        elif n < 157: st = "background:var(--s4);color:var(--t1);"
        else: st = "background:var(--s2);color:var(--t3);"
        inner = str(n) if n <= 157 else ic("lock", 11)
        out += f'<div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:4px;margin-right:-4px;"><span style="color:{"var(--p2)" if n == 157 else "var(--t3)"};">{ic(icons[n], 12)}</span><div class="num" style="width:{w}px;height:{h}px;display:flex;align-items:center;justify-content:center;font-size:{12 if compact else 14}px;{cut}{st}">{inner}</div></div>'
        if n in (155, 160): out += '<div style="flex:0 0 auto;width:2px;align-self:stretch;margin:0 10px;background:var(--st2);"></div>'
    return out


def ody_presets(compact=False):
    rows = ""
    for k, i, name, cls_, g in THEMES:
        on = k == "giant"
        rows += f'''<div class="well" style="display:flex;align-items:center;gap:12px;padding:10px 12px;{'border-color:rgba(247,195,95,.5);background:rgba(247,195,95,.07);' if on else ''}">
  <div style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--s3);color:{'var(--gold)' if on else 'var(--t2)'};">{ic(i,17)}</div>
  <div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:13px;">{name}{' <span class="chip" style="height:20px;font-size:10.5px;color:var(--gold);border-color:rgba(247,195,95,.4);">지금 테마</span>' if on else ''}</div><div class="t3" style="font-size:11px;">{cls_} 배치 · 5명 편성됨{'' if compact else ' · ' + g}</div></div>
  <span class="t2">{ic("chev",16)}</span></div>'''
    return rows


def ody_drops():
    return f'''<div class="card pad"><div class="h3">보상</div>
  {kv("최초 클리어", f"{GEM} 300 + 층당 100 · {COIN} 6만+")}{kv("장비 드랍", "테마 장비 100%")}{kv("오디세우스의 활", "추가 10%")}{kv("승급석", "0.1%")}
  <div class="tip" style="margin-top:6px;">장비 줄 수: 1줄 80% · 2줄 19% · 3줄 1%</div></div>'''


def odyssey_d():
    team = "".join(f'<div class="well" style="flex:1;min-width:0;padding:10px;display:flex;gap:10px;align-items:center;">{portrait(u["sp"], u["rar"], 44)}<div style="min-width:0;"><div style="font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{u["name"]}</div><div class="t3" style="font-size:11px;">{u["row"]} · {cls(u["cls"],11)}</div></div></div>' for u in TANKS)
    inner = f'''<div style="display:grid;grid-template-columns:1fr 380px;gap:20px;">
  <div style="display:flex;flex-direction:column;gap:16px;min-width:0;">
    <div class="card pad" style="display:flex;gap:16px;align-items:center;background:linear-gradient(120deg,rgba(247,195,95,.12),transparent 50%),var(--s1);">
      <div style="width:56px;height:56px;border-radius:16px;background:var(--s3);display:flex;align-items:center;justify-content:center;color:var(--gold);">{ic("shield",28)}</div>
      <div style="flex:1;"><div class="h2">거인의 발걸음 <span class="chip" style="height:24px;color:var(--gold);border-color:rgba(247,195,95,.4);">{ic("shield",12)} 탱커만 배치 가능</span></div>
      <div class="tip" style="margin-top:4px;">묵직한 발걸음마다 대지가 흔들립니다. 버티는 자, 오직 탱커만 나아갈 수 있습니다. 체력의 일부가 공격력으로 전환돼요 — 등급이 높을수록 전환율도 커져요.</div></div></div>
    {ody_scene(440)}
    <div class="card pad"><div class="sec"><div><div class="h2">오디세이 전용 팀</div><div class="t3" style="font-size:12px;margin-top:2px;">테마가 바뀌면 그 테마에 저장한 팀이 자동으로 들어가요</div></div><a href="N_Formation.dc.html" class="btn">{ic("users",16)} 지금 테마 팀 편성</a></div>
      <div style="display:flex;gap:10px;margin-top:12px;">{team}</div></div>
    <div class="card pad"><div class="sec"><div class="h2">스테이지</div><span class="t3" style="font-size:12px;">최고 기록 157층 · 5층마다 테마(배치 가능 직업)가 바뀌어요</span></div>
      <div class="well hs" style="display:flex;align-items:center;margin-top:12px;padding:4px 8px;">{ody_hex()}</div></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:16px;">
    <div class="card pad"><div class="sec"><span class="h3">남은 도전</span><span><b style="font-size:20px;">30</b><span class="t3"> / 30</span></span></div><div style="margin-top:8px;">{bar(100, "xp", 6)}</div><div class="t3" style="font-size:11.5px;margin-top:6px;">5분마다 1회 자동 충전</div>
      <a class="btn pri lg" style="width:100%;margin-top:14px;">도전하기</a><a class="btn" style="width:100%;margin-top:8px;">10연속 도전</a></div>
    <div class="notice">{ic("zap",13)} 이 콘텐츠는 <b>어빌리티 프리셋 1번</b>이 자동 적용돼요 (버프 3개)</div>
    <div class="card pad"><div class="h3">테마별 배치 프리셋</div><div class="tip" style="margin:4px 0 10px;">테마마다 팀을 한 번씩 저장해두면 매번 다시 짤 필요 없어요.</div><div style="display:flex;flex-direction:column;gap:8px;">{ody_presets()}</div></div>
    {ody_drops()}
  </div></div>'''
    return screen_d("오디세이", "157층 · 거인의 발걸음", "odyssey", inner, 1340)


def odyssey_m():
    mini = "".join(f'<div class="well" style="flex:1;min-width:0;padding:6px 3px;display:flex;flex-direction:column;align-items:center;gap:3px;">{portrait(u["sp"], u["rar"], 36)}<div style="font-size:10px;font-weight:700;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{u["name"]}</div></div>' for u in TANKS)
    inner = f'''<div class="card" style="padding:12px;display:flex;gap:12px;align-items:center;background:linear-gradient(120deg,rgba(247,195,95,.14),transparent 60%),var(--s1);"><div style="width:42px;height:42px;border-radius:12px;background:var(--s3);display:flex;align-items:center;justify-content:center;color:var(--gold);">{ic("shield",22)}</div><div><div class="h3">거인의 발걸음</div><div class="t2" style="font-size:11.5px;">탱커만 · 체력 일부가 공격력으로</div></div></div>
<div style="margin-top:10px;">{ody_scene(270, True)}</div>
<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">
  <div style="display:flex;gap:8px;"><a class="btn pri" style="flex:1.4;height:48px;font-size:15px;">도전하기 · 30/30</a><a class="btn" style="flex:1;height:48px;">10연속</a></div>
  <div class="card" style="padding:12px;"><div class="sec"><span class="h3">전용 팀</span><a class="btn sm">{ic("users",14)} 편성</a></div><div style="display:flex;gap:5px;margin-top:10px;">{mini}</div></div>
  <div class="card" style="padding:12px 8px;"><div class="sec" style="padding:0 4px;"><span class="h3">스테이지</span><span class="t3" style="font-size:11px;">5층마다 테마 변경</span></div><div class="hs" style="display:flex;align-items:center;margin-top:4px;">{ody_hex(True)}</div></div>
  <div class="notice" style="font-size:11.5px;">{ic("zap",12)} 어빌리티 프리셋 1번 자동 적용</div>
  {acc("테마별 배치 프리셋", True, '<div style="display:flex;flex-direction:column;gap:6px;margin-top:10px;">' + ody_presets(True) + '</div>', "layers")}
  {acc("보상 · 드랍 확률", False, "", "gift")}
</div>'''
    return screen_m("odyssey", inner, 1390)


# ================================================================== 어빌리티
AB = [("에픽", "#a855f7", "wind", "팀 전체 공격속도 +8.9%", False), ("레전드리", "#ff4d6d", "wind", "팀 전체 공격속도 +18.4%", True), ("레전드리", "#ff4d6d", "wind", "팀 전체 공격속도 +20.2%", True)]


def ab_lines(compact=False):
    out = ""
    for i, (g, c, icn, txt, lock) in enumerate(AB):
        out += f'''<div class="card" style="padding:{12 if compact else 16}px;display:flex;align-items:center;gap:14px;border-color:{c}55;background:linear-gradient(110deg,{c}1f,transparent 55%),var(--s1);">
  <div style="width:40px;height:40px;border-radius:12px;background:{c}22;color:{c};display:flex;align-items:center;justify-content:center;">{ic(icn,20)}</div>
  <div style="flex:1;min-width:0;"><div style="display:flex;gap:6px;align-items:center;"><span class="badge" style="--c:{c};color:#fff;">{g}</span><span class="t3" style="font-size:11px;">{i + 1}번째 줄 · Lv.{[10, 20, 30][i]} 개방</span></div><div style="font-size:{13.5 if compact else 15}px;font-weight:700;margin-top:5px;">{txt}</div></div>
  <a class="btn sm {'gold' if lock else ''}">{ic("lock",14)} {'고정됨' if lock else '고정'}</a></div>'''
    return out


def ab_presets():
    rows = [("프리셋 1", "레전드리 · 레전드리 · 레전드리", False), ("프리셋 2", "에픽 · 레전드리 · 레전드리", True), ("프리셋 3", "레전드리 · 레전드리 · 레전드리", False)]
    return "".join(f'<div class="well" style="display:flex;align-items:center;gap:10px;padding:10px 12px;{"border-color:rgba(124,92,255,.55);background:rgba(124,92,255,.1);" if on else ""}"><b style="width:64px;">{n}</b><span class="t2" style="flex:1;font-size:12px;">{d} · {ic("lock",11)}×2</span><a class="btn sm {"pri" if on else ""}">{"사용 중" if on else "사용"}</a></div>' for n, d, on in rows)


def ability_d():
    rates = "".join(f'<div class="well" style="flex:1;padding:10px 12px;"><div style="font-size:11px;color:{c};font-weight:700;">{g}</div><div style="font-size:18px;font-weight:700;margin-top:2px;">{p}</div></div>' for g, c, p in [("레어", "#4c8bf5", "77.2%"), ("에픽", "#a855f7", "16%"), ("유니크", "#f5b301", "5%"), ("레전드리", "#ff4d6d", "1.8%")])
    inner = f'''<div style="display:grid;grid-template-columns:1fr 400px;gap:20px;">
  <div style="display:flex;flex-direction:column;gap:16px;">
    <div class="card pad"><div class="sec"><div><div class="t3" style="font-size:12px;">계정 레벨</div><div class="h1" style="margin-top:2px;">Lv.300</div></div><div style="text-align:right;"><div class="t3" style="font-size:12px;">레벨업 팀 공격력 보너스</div><div class="h1 gold" style="margin-top:2px;">+60.0%</div></div></div>
      <div style="margin-top:12px;">{bar(42, "xp", 8)}</div><div class="t3" style="font-size:11.5px;margin-top:6px;">27,996 / 66,423 · 레벨당 +0.6%p, 최대 +60%</div></div>
    <div class="sec"><div class="h2">활성 프리셋 2 · 어빌리티 줄</div><span class="t3" style="font-size:12px;">고정한 줄은 재설정할 때 그대로 남아요</span></div>
    {ab_lines()}
  </div>
  <div style="display:flex;flex-direction:column;gap:16px;">
    <div class="card pad"><div class="h3">재설정</div><div class="tip" style="margin-top:4px;">골드를 내고 고정 안 한 줄을 한 번에 다시 굴려요. 등급 확률은 계정 레벨에 따라 올라가요.</div>
      <div style="display:flex;gap:8px;margin-top:12px;">{rates}</div>
      <a class="btn pri lg" style="width:100%;margin-top:14px;">{ic("dice",18)} 재설정 · {COIN} 128,000</a>
      <div class="t3" style="font-size:11.5px;margin-top:8px;text-align:center;">기본 50,000 × 고정한 줄 2개 (줄당 ×1.6)</div></div>
    <div class="card pad"><div class="h3">프리셋</div><div class="tip" style="margin:4px 0 10px;">슬롯 3개가 각자 따로 재설정돼요. 전환은 무료·즉시.</div><div style="display:flex;flex-direction:column;gap:8px;">{ab_presets()}</div></div>
  </div></div>'''
    return screen_d("어빌리티", "계정 레벨로 열리는 영구 팀 버프", "ability", inner, 880)


def ability_m():
    inner = f'''<div class="card" style="padding:14px;"><div class="sec"><div><div class="t3" style="font-size:11px;">계정 레벨</div><div class="h2">Lv.300</div></div><div style="text-align:right;"><div class="t3" style="font-size:11px;">팀 공격력</div><div class="h2 gold">+60.0%</div></div></div><div style="margin-top:10px;">{bar(42, "xp", 6)}</div></div>
<div class="seg full" style="margin-top:10px;"><span>프리셋 1</span><span class="on">프리셋 2</span><span>프리셋 3</span></div>
<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">{ab_lines(True)}</div>
<div class="card" style="padding:14px;margin-top:10px;"><div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;"><span style="color:#4c8bf5;">레어 77.2%</span><span style="color:#a855f7;">에픽 16%</span><span style="color:#f5b301;">유니크 5%</span><span style="color:#ff4d6d;">레전드리 1.8%</span></div>
  <a class="btn pri lg" style="width:100%;margin-top:12px;">{ic("dice",18)} 재설정 · {COIN} 128,000</a><div class="t3" style="font-size:11px;margin-top:6px;text-align:center;">고정 2줄 · 줄당 비용 ×1.6</div></div>'''
    return screen_m("ability", inner, 900)


# ================================================================== 소환
LINEUP = [("hr", "HR"), ("xr_asn", "XR"), ("xxr", "XXR"), ("ssr_tank", "SSR"), ("sr_dps", "SR")]
RATES = [("N", "55.9%"), ("R", "32.5%"), ("SR", "10.2%"), ("SSR", "1.4%"), ("XR", "0.035%"), ("XXR", "0.005%"), ("HR", "0.02% · 별도 추첨")]
PULLS = [("1회", "300", "", "btn"), ("10회", "2,700", "SR 이상 1개 확정", "btn pri"), ("100회", "27,000", "SR 이상 10개 확정", "btn"), ("1000회", "270,000", "확정 없음 · 순수 확률", "btn")]


def gacha_banner(h, mobile=False):
    figs = "".join(f'<div style="display:flex;flex-direction:column;align-items:center;transform:translateY({[10, -6, -18, -6, 10][i]}px);"><img class="sp" src="{SP[s]}" alt="" style="width:{70 if mobile else 130}px;filter:drop-shadow(0 0 18px {RARC[r]}aa);"><span class="badge" style="--c:{RARC[r]};margin-top:-4px;">{r}</span></div>' for i, (s, r) in enumerate(LINEUP))
    return f'''<div class="card" style="position:relative;height:{h}px;overflow:hidden;background:radial-gradient(ellipse at 50% 85%,rgba(138,107,255,.45),transparent 60%),radial-gradient(ellipse at 50% 120%,rgba(63,224,238,.35),transparent 55%),linear-gradient(180deg,#121a33,#0a0f1e);">
  <div style="position:absolute;left:50%;bottom:-{h // 3}px;transform:translateX(-50%);width:{h * 1.6}px;height:{h * 0.7}px;border-radius:50%;border:2px solid rgba(138,107,255,.5);box-shadow:0 0 40px rgba(138,107,255,.5),inset 0 0 40px rgba(63,224,238,.3);"></div>
  <div style="position:absolute;left:{14 if mobile else 24}px;top:{12 if mobile else 22}px;"><div class="{'h2' if mobile else 'h1'}" style="{'' if mobile else 'font-size:28px;'}">영웅 소환</div><div class="t2" style="font-size:{11.5 if mobile else 13}px;margin-top:4px;">계정 레벨이 오를수록 SSR · XR · XXR 확률이 올라가요 (현재 최대치)</div></div>
  <div style="position:absolute;left:0;right:0;bottom:{14 if mobile else 26}px;display:flex;justify-content:center;gap:{4 if mobile else 18}px;align-items:flex-end;">{figs}</div></div>'''


def pity(mobile=False):
    return f'<div class="card" style="padding:{12 if mobile else 16}px;"><div class="sec"><span class="h3">천장</span><span style="font-size:12.5px;"><b>49</b><span class="t3"> / 1,000회 · 951회 남음</span></span></div><div style="margin-top:8px;">{bar(4.9, "xp", 8)}</div><div class="t3" style="font-size:11.5px;margin-top:6px;">1,000회 안에 SSR 이상 1개 확정 · XR·XXR은 천장 대상이 아니에요</div></div>'


def gacha_d():
    pulls = "".join(f'<a class="{c}" style="flex:1;height:76px;flex-direction:column;gap:3px;{"border-radius:16px;" }"><span style="font-size:15px;">{n} 소환</span><span style="display:flex;align-items:center;gap:4px;font-size:14px;">{GEM}{p}</span>{f"<span style=&quot;font-size:10.5px;opacity:.8;font-weight:500;&quot;>{s}</span>" if s else ""}</a>' for n, p, s, c in PULLS)
    rates = "".join(f'<div class="well" style="padding:10px;text-align:center;">{rarity_badge(r)}<div style="font-weight:700;margin-top:6px;font-size:13px;">{p}</div></div>' for r, p in RATES)
    inner = f'''<div style="display:flex;flex-direction:column;gap:16px;">
  {gacha_banner(360)}
  <div style="display:flex;gap:12px;">{pulls}</div>
  <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:16px;">{pity()}
    <div class="card pad"><div class="sec"><span class="h3">등급별 확률 (Lv.100 이상 기준)</span><span class="t3" style="font-size:11.5px;">XXR은 Lv.50부터 등장</span></div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-top:12px;">{rates}</div>
      <div class="t3" style="font-size:11.5px;margin-top:10px;">중복으로 뽑으면 그 영웅의 조각 +1 · Lv.100부터 승급석이 0.01% 확률로 함께 나와요</div></div></div>
  <div class="t3" style="font-size:12px;font-style:italic;text-align:center;">레벨이 오를수록 확률이 조금씩 오르는, 멋쟁이 영웅이 될 수 있는 기회도 있답니다.. — 호메로스</div></div>'''
    return screen_d("소환", "1회 💎300", "gacha", inner, 1000)


def gacha_m():
    pulls = "".join(f'<a class="{c}" style="height:64px;flex-direction:column;gap:2px;border-radius:14px;"><span style="font-size:13.5px;">{n} 소환</span><span style="display:flex;align-items:center;gap:4px;font-size:12.5px;">{GEM}{p}</span></a>' for n, p, s, c in PULLS)
    inner = f'''{gacha_banner(260, True)}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">{pulls}</div>
<div style="margin-top:10px;">{pity(True)}</div>
<div class="card" style="padding:12px;margin-top:10px;"><div class="h3">등급별 확률</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px;">{"".join(f'<div class="well" style="padding:8px 4px;text-align:center;">{rarity_badge(r)}<div style="font-weight:700;margin-top:4px;font-size:11.5px;">{p.split(" ")[0]}</div></div>' for r, p in RATES[:7])}</div></div>'''
    return screen_m("gacha", inner, 840)


RESULT = [("n_sup", "N", "강원도사나이", False), ("r_dps", "R", "매산고조승현", False), ("sr_dps", "SR", "분노한김유창", False), ("n_tank", "N", "박주환", False), ("xr_asn", "XR", "백인백민수", True),
          ("r_dps", "R", "조승현", False), ("n_sup", "N", "이재훈", False), ("ssr_tank", "SSR", "유부남 박주환", True), ("n_tank", "N", "견습궁수 렌", False), ("sr_dps", "SR", "그림자수련생 묘", False)]


def result_body(mobile=False):
    s = 52 if mobile else 78
    cells = "".join(f'<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;">{portrait(sp, r, s)}{"<span class=badge style=--c:var(--mint);position:absolute;top:-6px;right:-4px;>NEW</span>" if new else ""}{rarity_badge(r)}<div style="font-size:{10 if mobile else 11.5}px;font-weight:600;max-width:{s + 8}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{n}</div>{"" if new else f"<div class=t3 style=font-size:10px;>조각 +1</div>"}</div>' for sp, r, n, new in RESULT)
    return f'''<div style="text-align:center;"><div class="h1">10회 소환 결과</div><div class="t2" style="font-size:12.5px;margin-top:4px;">새 영웅 2명 · 중복 8명은 조각으로 바뀌었어요</div></div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:{10 if mobile else 18}px {6 if mobile else 12}px;padding:{4 if mobile else 10}px 0;">{cells}</div>
  <div style="display:flex;gap:8px;"><a class="btn {'lg' if not mobile else ''}" style="flex:1;{'height:48px;' if mobile else ''}">확인</a><a class="btn pri {'lg' if not mobile else ''}" style="flex:1.3;{'height:48px;' if mobile else ''}">한 번 더 · {GEM} 2,700</a></div>'''


def gacha_result_d():
    return f'<div class="app" style="height:1000px;">{backdrop("N_Gacha", 1000)}{modal(result_body(), w=640, top=150)}</div>'


def gacha_result_m():
    return f'<div class="app" style="height:1000px;">{backdrop("N_GachaM", 1000)}{sheet(result_body(True))}</div>'


def gacha_loading():
    return f'''<div class="app" style="height:1000px;">{backdrop("N_Gacha", 1000)}<div class="scrim" style="background:radial-gradient(circle at 50% 45%,rgba(138,107,255,.35),rgba(3,5,10,.92) 55%);"></div>
  <style>@keyframes spin{{to{{transform:translate(-50%,-50%) rotate(360deg)}}}}@keyframes pulse{{50%{{opacity:.4}}}}</style>
  <div style="position:absolute;z-index:22;left:50%;top:44%;width:220px;height:220px;border-radius:50%;transform:translate(-50%,-50%);border:3px solid transparent;border-top-color:#8a6bff;border-right-color:#3fe0ee;animation:spin 1.1s linear infinite;box-shadow:0 0 60px rgba(138,107,255,.5);"></div>
  <div style="position:absolute;z-index:22;left:50%;top:44%;transform:translate(-50%,-50%);color:#fff;animation:pulse 1.2s infinite;">{ic("spark",56)}</div>
  <div style="position:absolute;z-index:22;left:0;right:0;top:61%;text-align:center;"><div class="h2">소환 중...</div><div class="t2" style="font-size:12.5px;margin-top:4px;">화면을 누르면 결과로 바로 넘어가요</div></div></div>'''


# ================================================================== 영웅
HEROES = [("xxr", "XXR", "MINSU-DARKMAN", "🗡 암살자", "🌪", 40, "11,436", 0), ("xxr", "XXR", "시즌2 우승자-이재훈", "⚔ 딜러", "💧", 40, "11,892", 0),
          ("hr", "HR", "댄싱머신채영기", "🛡 탱커", "🔥", 35, "1,930", 0), ("hr", "HR", "박탈감을느낀조승탁", "🛡 탱커", "💧", 35, "930", 0),
          ("xr_asn", "XR", "백인백민수", "🗡 암살자", "🔥", 35, "30,906", 0), ("xr_asn", "XR", "20대조청월", "🗡 암살자", "🔥", 35, "3,016", 0),
          ("ssr_tank", "SSR", "유부남 박주환", "🛡 탱커", "🔥", 35, "2,140", 0), ("ssr_tank", "SSR", "팔씨름박주환", "🛡 탱커", "🌪", 35, "2,140", 0),
          ("sr_dps", "SR", "분노한김유창", "⚔ 딜러", "🔥", 35, "14,081", 0), ("sr_dps", "SR", "4번타자조승현", "⚔ 딜러", "🌪", 35, "6,374", 0),
          ("n_sup", "EX", "이재훈", "✨ 서포터", "🔥", 35, "2,567", 1), ("n_tank", "EX", "박주환", "🛡 탱커", "💧", 35, "2,140", 2),
          ("r_dps", "R", "매산고조승현", "⚔ 딜러", "🌪", 35, "6,374", 0), ("r_dps", "R", "좌파이재훈", "⚔ 딜러", "🔥", 35, "9,293", 0)]


def hero_tile(h, s=84, small=False):
    sp, r, n, c, e, lv, dps, star = h
    return f'''<a href="N_HeroDetail.dc.html" class="card" style="padding:{8 if small else 12}px;display:flex;flex-direction:column;align-items:center;gap:{3 if small else 5}px;">
  {portrait(sp, r, s)}
  <div style="display:flex;gap:4px;align-items:center;margin-top:2px;">{rarity_badge(r, star)}</div>
  <div style="font-size:{11 if small else 12.5}px;font-weight:700;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{n}</div>
  {'' if small else f'<div class="t2" style="font-size:11px;display:flex;gap:6px;">{cls(c,11)}{el(e,11,True)}</div>'}
  <div class="t3" style="font-size:{10 if small else 11}px;">Lv.{lv} · <span class="gold" style="font-weight:700;">{dps}</span></div></a>'''


def growth_banner(mobile=False):
    return f'''<a href="N_Growth.dc.html" class="card" style="padding:{12 if mobile else 16}px;display:flex;align-items:center;gap:14px;background:linear-gradient(110deg,rgba(52,227,176,.14),rgba(124,92,255,.1) 60%,transparent),var(--s1);border-color:rgba(52,227,176,.3);">
  <div style="width:{40 if mobile else 48}px;height:{40 if mobile else 48}px;border-radius:14px;background:rgba(52,227,176,.15);color:var(--mint);display:flex;align-items:center;justify-content:center;">{ic("chart",22)}</div>
  <div style="flex:1;"><div class="h3">성장 보너스 몰아보기</div><div class="t2" style="font-size:{11.5 if mobile else 12.5}px;margin-top:2px;">도감 102/102 · 공·체·방 <b class="mint">+45.9%</b> · 시너지 <b class="mint">치명타 +18%p</b></div></div>{ic("chev",18)}</a>'''


def heroes_d():
    filters = "".join(f'<span class="chip {"on" if i == 0 else ""}">{t}</span>' for i, t in enumerate(["전체 102", "탱커 21", "딜러 21", "원거리 20", "암살자 20", "서포터 20"]))
    inner = f'''<div style="display:flex;flex-direction:column;gap:16px;">
  {growth_banner()}
  <div class="sec"><div class="seg"><span class="on">{ic("users",14)} 영웅</span><a href="N_Equipment.dc.html" style="display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;color:var(--t2);font-size:12.5px;font-weight:600;">{ic("bag",14)} 장비</a></div>
    <div style="display:flex;gap:8px;align-items:center;">{filters}<span class="chip">등급순 {ic("down",12)}</span></div></div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:14px;">{"".join(hero_tile(h) for h in HEROES)}</div></div>'''
    return screen_d("영웅", "보유 102명", "heroes", inner, 900)


def heroes_m():
    inner = f'''{growth_banner(True)}<div class="seg full" style="margin-top:10px;"><span class="on">영웅</span><span>장비</span></div>
<div class="hs" style="display:flex;gap:6px;margin-top:10px;">{"".join(f'<span class="chip {"on" if i == 0 else ""}" style="flex:0 0 auto;">{t}</span>' for i, t in enumerate(["전체", "탱커", "딜러", "원거리", "암살자", "서포터", "등급순"]))}</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;">{"".join(hero_tile(h, 60, True) for h in HEROES[:12])}</div>'''
    return screen_m("heroes", inner, 1060)


def hero_detail_body(mobile=False):
    stats = [("공격력", "3,996"), ("체력", "31,968"), ("방어력", "3,108"), ("마나", "114"), ("공격속도", "초당 1회"), ("치명타", "30% · ×2.2"), ("관통", "24.4%"), ("저항", "5.2%")]
    sg = "".join(f'<div class="well" style="padding:9px 11px;"><div class="t3" style="font-size:10.5px;">{a}</div><div style="font-weight:700;margin-top:2px;">{b}</div></div>' for a, b in stats)
    skills = [("bolt2", "폭발 일격", "마나 66", "적 하나에게 큰 피해 — 공격력 배율 피해"), ("clock", "둔화의 일격", "마나 50", "적의 공격속도를 일정 시간 낮춰요")]
    sk = "".join(f'<div class="well" style="display:flex;gap:12px;padding:11px 12px;align-items:flex-start;"><div style="width:36px;height:36px;border-radius:10px;background:rgba(124,92,255,.18);color:#b9a8ff;display:flex;align-items:center;justify-content:center;flex:0 0 auto;">{ic(i,18)}</div><div style="flex:1;"><div class="sec"><b>{n}</b><span class="chip" style="height:22px;font-size:10.5px;color:var(--sky);">{m}</span></div><div class="t2" style="font-size:12px;margin-top:3px;">{d}</div></div></div>' for i, n, m, d in skills)
    grow = [("레벨업", "Lv.40 / 40 · 최대", "max", ""), ("등급 승급", "XXR — 최고 등급", "max", ""), ("EX 승급", "조각 12 / 30", "go", f"{COIN} 30만"), ("별 강화", "★0 → ★1 · 별 1개당 공·체·방 +5%", "go", f"{STONE} 1 · 버려진 조각 15")]
    gr = "".join(f'<div class="row"><div><div style="font-weight:700;">{a}</div><div class="t3" style="font-size:11.5px;">{b}</div></div>{"<span class=chip>완료</span>" if s == "max" else f"<a class=\'btn sm pri\'>{c}</a>"}</div>' for a, b, s, c in grow)
    head = f'''<div style="display:flex;gap:{14 if mobile else 20}px;align-items:center;">{portrait("xxr", "XXR", 84 if mobile else 120)}
  <div><div style="display:flex;gap:6px;">{rarity_badge("XXR")}<span class="chip" style="height:20px;font-size:10.5px;">태초 XXR</span></div><div class="h1" style="margin-top:6px;font-size:{19 if mobile else 24}px;">MINSU-DARKMAN</div>
  <div class="t2" style="font-size:12.5px;display:flex;gap:10px;margin-top:4px;">{cls("🗡 암살자",13)}{el("🌪",13,True)}<span>Lv.40</span></div><div class="gold" style="font-weight:700;margin-top:6px;">예상 DPS 11,436</div></div></div>'''
    if mobile:
        return f'{head}<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">{sg}</div><div class="h3">스킬</div>{sk}<div class="h3">성장</div><div>{gr}</div>'
    return f'''{head}<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
  <div style="display:flex;flex-direction:column;gap:10px;"><div class="h3">능력치</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">{sg}</div><div class="h3" style="margin-top:6px;">스킬</div>{sk}</div>
  <div><div class="h3">성장</div><div style="margin-top:4px;">{gr}</div><div class="notice mint" style="margin-top:10px;">{ic("layers",13)} 시너지 「흑백의 민수」 — 백민수 계열과 함께 편성하면 발동</div></div></div>'''


def hero_detail_d():
    return f'<div class="app" style="height:900px;">{backdrop("N_Heroes", 900)}{modal(hero_detail_body(), w=860, top=90)}</div>'


def hero_detail_m():
    return f'<div class="app" style="height:1240px;">{backdrop("N_HeroesM", 1240)}{sheet(hero_detail_body(True), top=60)}</div>'


# ================================================================== 성장 보너스
def growth_body(tab, mobile=False):
    seg = f'<div class="seg full"><span class="{"on" if tab == "c" else ""}">{ic("doc",14)} 컬렉션</span><span class="{"on" if tab == "s" else ""}">{ic("layers",14)} 배치 시너지</span></div>'
    if tab == "c":
        tiers = [("R", "방어력 +5%", [3, 8, 15, 25, 40, 60]), ("SR", "공격력 +5%", [3, 8, 15, 25, 40, 60]), ("SSR", "공격력·체력 +7%", [3, 8, 15, 25, 35, 45]), ("XR", "공·체·방 +9%", [3, 8, 15, 25, 35, 45])]
        t = "".join(f'<div class="well" style="padding:12px;"><div class="sec"><span>{rarity_badge(r)} <b style="margin-left:6px;">이상 89명</b></span><span class="mint" style="font-size:11.5px;font-weight:700;">모든 단계 달성</span></div><div style="display:flex;gap:6px;margin-top:10px;">{"".join(f"<span class=chip style=height:26px;color:var(--mint);border-color:rgba(52,227,176,.4);>{m}</span>" for m in ms)}</div><div class="t3" style="font-size:11.5px;margin-top:8px;">단계마다 {b}</div></div>' for r, b, ms in tiers)
        body = f'''<div class="card" style="padding:14px;"><div class="sec"><span class="h3">도감 보유 영웅</span><b>102 / 102</b></div><div style="margin-top:8px;">{bar(100, "hp", 8)}</div><div class="t2" style="font-size:12px;margin-top:8px;">1명당 공·체·방 +0.45% → 합계 <b class="mint">+45.9%</b></div></div>
  <div class="h3">등급 보유수 보너스</div><div class="tip" style="margin-top:-6px;">그 등급 "이상"에 도달한 영웅 수 기준이에요. 여러 명을 골고루 승급시킬수록 이득이에요.</div>{t}'''
    else:
        sets = [("이재훈 계보", "2 / 6명", True, "팀 공격력 +12%", "추가로 공격력 +25%, 치명타 +15%p"), ("조승현 계보", "0 / 7명", False, "팀 공격속도 +12%", "추가로 공격속도 +20%, 공격력 +15%"), ("흑백의 민수", "1 / 2명", False, "팀 치명타 피해 +20%", "—")]
        faces = lambda: "".join(f'<div style="width:28px;height:28px;border-radius:50%;overflow:hidden;background:var(--s3);border:1px solid var(--st2);"><img class="sp" src="{SP[s]}" alt="" style="width:100%;transform:scale(1.5) translateY(4px);"></div>' for s in ["n_sup", "r_dps", "sr_dps", "n_tank", "ssr_tank", "hr"])
        t = "".join(f'<div class="well" style="padding:12px;{"border-color:rgba(52,227,176,.4);" if on else ""}"><div class="sec"><b>{n}</b><span class="{"mint" if on else "t3"}" style="font-size:11.5px;font-weight:700;">{c} {"· 발동 중" if on else ""}</span></div><div style="display:flex;gap:5px;margin-top:8px;">{faces()}</div><div style="margin-top:8px;font-size:12px;"><span class="chip {"pos" if on else ""}" style="height:22px;font-size:11px;">2세트</span> <span class="t2">{s2}</span></div>{f"<div style=margin-top:4px;font-size:12px;><span class=chip style=height:22px;font-size:11px;>4세트</span> <span class=t2>{s4}</span></div>" if s4 != "—" else ""}</div>' for n, c, on, s2, s4 in sets)
        body = f'<div class="tip">지금 전투 탭 팀 기준이에요. 2명 이상이면 2세트, 4명 이상이면 4세트 효과가 함께 발동해요.</div><div class="notice mint"><b>발동 중인 시너지 합계: 치명타 +18%p · 공격력 +12%</b></div>{t}'
    return f'<div class="h1">성장 보너스</div>{seg}{body}'


def growth_d(tab):
    return f'<div class="app" style="height:900px;">{backdrop("N_Heroes", 900)}{modal(growth_body(tab), w=560, top=70, h=800)}</div>'


def growth_m():
    return f'<div class="app" style="height:1060px;">{backdrop("N_HeroesM", 1060)}{sheet(growth_body("c", True), top=80)}</div>'


# ================================================================== 장비
ITEMS = [("👁️", "레전드리", "#ff4d6d", 13, "키클롭스의 눈", ["골드 획득량 +22.5%"], "적 방어력 -31.8%", True),
         ("📿", "레전드리", "#ff4d6d", 12, "세이렌의 목걸이", ["팀 치명타 피해 +19.2%"], "치명타 확률 +26.4%p", True),
         ("🛡️", "유니크", "#f5b301", 10, "거인의 갑주", ["팀 공격력 +11.1%"], "체력·방어력 +24.2%", True),
         ("🏹", "유니크", "#f5b301", 12, "오디세우스의 활", ["스킬 피해 +15.2%"], "치명타 피해 +29%", True),
         ("🧣", "에픽", "#a855f7", 10, "헬리오스의 황금 망토", ["팀 공격력 +8.7%", "치명타 피해 +6.8%"], "공격력 +14.5%", True),
         ("🦜", "에픽", "#a855f7", 11, "키르케의 앵무새", ["마나 회복 +12%"], "공격속도 +10.4%", True),
         ("🦜", "레전드리", "#ff4d6d", 10, "키르케의 앵무새", ["팀 공격속도 +12.9%"], "공격속도 +25.3%", False),
         ("🏹", "유니크", "#f5b301", 0, "오디세우스의 활", ["전완근력 +8.2% (효과 없음)"], "치명타 피해 +0%", False),
         ("🦜", "유니크", "#f5b301", 0, "키르케의 앵무새", ["팀 공격력 +69.6"], "공격속도 +0%", False)]


def item_tile(it, small=False):
    e, g, c, lv, n, lines, enh, eq = it
    return f'''<div class="card" style="padding:{8 if small else 12}px;display:flex;flex-direction:column;gap:5px;border-color:{c}66;background:linear-gradient(170deg,{c}26,transparent 50%),var(--s1);{"box-shadow:0 0 0 2px var(--mint),0 12px 32px rgba(0,0,0,.35);" if eq else ""}">
  <div class="sec"><span class="badge" style="--c:{c};color:#fff;">{g}{f" +{lv}" if lv else ""}</span>{f'<span class="mint" style="font-size:10.5px;font-weight:700;">장착</span>' if eq else ""}</div>
  <div style="font-size:{28 if small else 38}px;text-align:center;line-height:1.2;">{e}</div>
  <div style="font-size:{11 if small else 12.5}px;font-weight:700;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{n}</div>
  {'' if small else "".join(f'<div class="t2" style="font-size:11.5px;">{l}</div>' for l in lines) + f'<div class="gold" style="font-size:11.5px;font-weight:600;">강화 · {enh}</div>'}</div>'''


def equipment_d():
    slots = [("👁️", 50, 6), ("📿", 50, 24), ("🧣", 22, 40), ("🦜", 78, 40), ("🛡️", 50, 50), ("🏹", 78, 74)]
    sl = "".join(f'<div style="position:absolute;left:{x}%;top:{y}%;transform:translate(-50%,0);width:44px;height:44px;border-radius:14px;background:var(--s3);border:1px solid rgba(52,227,176,.55);box-shadow:0 0 14px rgba(52,227,176,.35);display:flex;align-items:center;justify-content:center;font-size:22px;">{e}</div>' for e, x, y in slots)
    sel = ITEMS[0]
    inner = f'''<div style="display:flex;flex-direction:column;gap:16px;">
  <div class="sec"><div class="seg"><a href="N_Heroes.dc.html" style="display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;color:var(--t2);font-size:12.5px;font-weight:600;">{ic("users",14)} 영웅</a><span class="on">{ic("bag",14)} 장비</span></div>
    <div style="display:flex;gap:8px;align-items:center;"><span class="t3" style="font-size:12px;">보유 9 / 100</span><span class="chip">자동판매: 에픽 이하 {ic("down",12)}</span><a class="btn sm">{ic("trash",14)} 일괄판매</a></div></div>
  <div style="display:grid;grid-template-columns:320px 1fr 340px;gap:16px;">
    <div class="card pad"><div class="h3">장착 중</div><div style="position:relative;height:300px;margin-top:8px;">
      <div style="position:absolute;left:50%;top:14%;transform:translateX(-50%);width:120px;height:220px;border-radius:60px 60px 20px 20px;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px dashed var(--st2);"></div>{sl}</div>
      <div class="seg full"><span>프리셋 1</span><span class="on">프리셋 2</span><span>프리셋 3</span></div></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-content:start;">{"".join(item_tile(it) for it in ITEMS)}</div>
    <div class="card pad" style="align-self:start;"><div class="sec"><span class="badge" style="--c:#ff4d6d;color:#fff;">레전드리 +13</span><span class="mint" style="font-size:12px;font-weight:700;">장착 중</span></div>
      <div style="font-size:46px;text-align:center;margin:8px 0;">{sel[0]}</div><div class="h2" style="text-align:center;">키클롭스의 눈</div>
      <div style="margin-top:10px;">{kv("랜덤 줄 1", "골드 획득량 +22.5%")}{kv("강화 고유 능력", "적 방어력 -31.8%", "gold")}{kv("다음 강화", "+13 → +14 · 성공 8.8%")}{kv("실패 시", "11강부터 단계 하락 위험", "red")}{kv("판매가", f"{COIN} 250만 · {GEM} 250")}</div>
      <div style="display:flex;gap:8px;margin-top:14px;"><a class="btn" style="flex:1;">해제</a><a class="btn pri" style="flex:1.4;">{ic("up",15)} 강화</a></div></div>
  </div></div>'''
    return screen_d("영웅 · 장비", "오디세이에서 얻는 장비", "heroes", inner, 960)


def equipment_m():
    inner = f'''<div class="seg full"><span>영웅</span><span class="on">장비</span></div>
<div class="card" style="padding:12px;margin-top:10px;"><div class="sec"><span class="h3">장착 중 · 프리셋 2</span><span class="t3" style="font-size:11px;">9 / 100</span></div><div style="display:flex;gap:6px;margin-top:10px;">{"".join(f'<div class="well" style="flex:1;height:46px;display:flex;align-items:center;justify-content:center;font-size:22px;border-color:rgba(52,227,176,.45);">{e}</div>' for e in ["👁️", "📿", "🛡️", "🏹", "🧣", "🦜"])}</div></div>
<div style="display:flex;gap:6px;margin-top:10px;"><span class="chip">자동판매: 에픽 이하</span><a class="btn sm" style="margin-left:auto;">{ic("trash",13)} 일괄판매</a></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;">{"".join(item_tile(it, True) for it in ITEMS)}</div>'''
    return screen_m("heroes", inner, 860)


# ================================================================== 콘텐츠 + 팝업들
CONTENTS = [("N_Dungeon", BGT[0], "골드 던전", "45층 (최고 45) · 남은 도전 3/3", "원거리 딜러에게 약함", "gold"),
            ("N_Dungeon", BGT[2], "다이아 던전", "45층 (최고 45) · 남은 도전 3/3", "암살자에게 약함", "gem"),
            ("N_Dungeon", BGT[1], "경험치 던전", "45층 (최고 45) · 남은 도전 3/3", "서포터에게 약함", "exp"),
            ("N_DailyBoss", BGT[7], "일일보스", "남은 도전 3/3 · 20초 데미지 레이스", "오늘: 약점 노출 (방어력 감소)", ""),
            ("N_Ranking", BGT[3], "랭킹", "내 순위 4위 (스테이지)", "스테이지 · 레벨 · 일일보스 · PvP", ""),
            ("N_Pvp", BGT[6], "PvP 대전", "레이팅 2021 · 1위 · 레이팅전 10/10", "자존심전 무제한", "")]


def contents_d():
    cards = "".join(f'''<a href="{f}.dc.html" class="card" style="overflow:hidden;"><div class="scene" style="height:150px;background-image:url('{bg}');"></div>
  <div style="padding:14px 16px;"><div class="sec"><span class="h2">{t}</span>{ic("chev",18)}</div><div class="t2" style="font-size:12.5px;margin-top:4px;">{s}</div><div style="margin-top:10px;"><span class="chip {"pos" if "약함" in w else ""}">{w}</span></div></div></a>''' for f, bg, t, s, w, k in CONTENTS)
    inner = f'<div class="notice" style="margin-bottom:16px;">{ic("clock",13)} 던전 · 일일보스 도전 횟수는 매일 오전 9시(한국시간)에 초기화돼요</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">{cards}</div>'
    return screen_d("콘텐츠", "일일 콘텐츠 · 랭킹 · PvP", "contents", inner, 820)


def contents_m():
    cards = "".join(f'''<a href="{f}M.dc.html" class="card" style="display:flex;overflow:hidden;"><div class="scene" style="width:104px;flex:0 0 auto;background-image:url('{bg}');"></div><div style="padding:12px;flex:1;min-width:0;"><div class="sec"><span class="h3">{t}</span>{ic("chev",16)}</div><div class="t2" style="font-size:11.5px;margin-top:3px;">{s}</div><div style="margin-top:6px;"><span class="chip {"pos" if "약함" in w else ""}" style="height:22px;font-size:10.5px;">{w}</span></div></div></a>''' for f, bg, t, s, w, k in CONTENTS)
    return screen_m("contents", f'<div style="display:flex;flex-direction:column;gap:10px;">{cards}</div>', 900)


def dungeon_body(mobile=False):
    team = "".join(f'<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">{portrait(s, r, 40 if mobile else 48)}<span class="{"mint" if c == "원거리" else "t3"}" style="font-size:10.5px;font-weight:600;">{c}</span></div>' for s, r, c in [("ssr_tank", "SSR", "탱커"), ("n_tank", "EX", "탱커"), ("r_dps", "R", "원거리"), ("sr_dps", "SR", "원거리"), ("n_sup", "EX", "서포터")])
    return f'''<div style="display:flex;gap:12px;align-items:center;"><div style="width:48px;height:48px;border-radius:14px;background:rgba(247,195,95,.15);display:flex;align-items:center;justify-content:center;">{COIN.replace('width="16" height="16"', 'width="28" height="28"')}</div><div><div class="h1">골드 던전</div><div class="t2" style="font-size:12px;">스테이지가 오를수록 처치 보상이 기하급수로 커져요</div></div></div>
  <div class="notice mint"><b>{ic("target",13)} 이 던전 보스는 원거리 딜러에게 약해요 — 피해 ×1.3</b><br>탱커로 앞열을 지키고 원거리 딜러로 밀어붙이세요.</div>
  <div class="well" style="padding:12px;"><div class="sec"><span class="h3">던전 전용 팀 · 원거리 2명</span><a class="btn sm">{ic("users",13)} 편성</a></div><div style="display:flex;justify-content:space-between;margin-top:10px;">{team}</div></div>
  <div class="notice">{ic("zap",13)} 어빌리티 프리셋 1번 자동 적용 (버프 3개)</div>
  <div class="sec"><a class="ibtn" aria-label="이전 층">{ic("chevl",16)}</a><div style="text-align:center;"><div class="num" style="font-size:22px;">STAGE 45</div><div class="t3" style="font-size:11px;">최고 45 · 최대 45층</div></div><a class="ibtn" aria-label="다음 층" style="opacity:.4;">{ic("chev",16)}</a></div>
  <div>{kv("승리 보상", f"{COIN} 1,184,111 (재도전)", "gold")}{kv("남은 도전", "3 / 3")}{kv("처음 깨는 층", "도전 횟수가 가득 다시 채워져요", "mint")}</div>
  <a class="btn pri lg" style="width:100%;">도전하기</a>'''


def dungeon_d():
    return f'<div class="app" style="height:820px;">{backdrop("N_Contents", 820)}{modal(dungeon_body(), w=500, top=40)}</div>'


def dungeon_m():
    return f'<div class="app" style="height:900px;">{backdrop("N_ContentsM", 900)}{sheet(dungeon_body(True))}</div>'


def dailyboss_body():
    days = "".join(f'<div class="well" style="padding:8px 4px;text-align:center;{"border-color:rgba(255,92,122,.5);background:rgba(255,92,122,.08);" if i == 1 else ""}"><div class="t3" style="font-size:10.5px;">{d}</div><div style="font-size:11px;font-weight:700;margin-top:2px;">{s}</div></div>' for i, (d, s) in enumerate([("월", "기절"), ("화", "방어 감소"), ("수", "속도 감소"), ("목", "디스펠"), ("금", "보호막 관통"), ("토", "마나 소각"), ("일", "도발")]))
    return f'''<div class="h1">일일보스</div><div class="tip">체력이 아주 높은 보스에게 20초 동안 데미지를 넣는 레이스예요. 이길 필요 없이 넣은 만큼 바로 보상을 받아요.</div>
  <div class="scene card" style="height:150px;background-image:url('{BGT[7]}');"><img class="sp" src="{MOB['wolf']}" alt="" style="position:absolute;z-index:2;right:40px;bottom:14px;width:170px;"><div class="glass" style="position:absolute;z-index:3;left:12px;top:12px;padding:8px 12px;"><div class="h3">포효하는 늑대왕</div><div class="t2" style="font-size:11px;">오늘의 스킬 · 약점 노출 (방어력 감소)</div></div></div>
  <div class="h3">요일별 보스 스킬</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;">{days}</div>
  <div>{kv("남은 도전", "3 / 3")}{kv("오늘 누적 데미지", "0")}{kv("초기화", "매일 오전 9시")}</div>
  <a class="btn pri lg" style="width:100%;">{ic("clock",17)} 20초 도전</a>'''


def dailyboss_d():
    return f'<div class="app" style="height:820px;">{backdrop("N_Contents", 820)}{modal(dailyboss_body(), w=540, top=40)}</div>'


def ranking_body(mobile=False):
    pod = [(2, "유부남 박주환", "71층", "ssr_tank", 100), (1, "4번타자조승현", "72층", "sr_dps", 130), (3, "좌파이재훈", "70층", "r_dps", 80)]
    podium = "".join(f'<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;"><img class="sp" src="{SP[s]}" alt="" style="width:{56 if mobile else 72}px;"><div style="font-size:12px;font-weight:700;text-align:center;">{n}</div><div class="card" style="width:100%;height:{h * (0.7 if mobile else 1)}px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(180deg,{["", "rgba(247,195,95,.3)", "rgba(200,210,230,.25)", "rgba(205,127,50,.25)"][r]},var(--s1));"><span class="num" style="font-size:22px;">{r}</span><span class="t2" style="font-size:11.5px;">{v}</span></div></div>' for r, n, v, s, h in pod)
    rest = "".join(f'<div class="row" style="{"background:rgba(124,92,255,.12);border-radius:10px;padding-left:10px;padding-right:10px;" if me else ""}"><span><b class="num" style="display:inline-block;width:28px;">{r}</b>{n}{" <span class=chip style=height:20px;font-size:10px;>나</span>" if me else ""}</span><b>{v}</b></div>' for r, n, v, me in [(4, "GM백민수", "69층", True), (5, "XR청월", "60층", False), (6, "넘저패겠다", "53층", False), (7, "포커페이스", "1층", False), (8, "zx파괴분쇄7 | xz", "1층", False)])
    return f'<div class="h1">랭킹</div><div class="seg full"><span class="on">스테이지</span><span>레벨</span><span>일일보스</span><span>PvP</span></div><div style="display:flex;gap:10px;align-items:flex-end;">{podium}</div><div>{rest}</div>'


def dailyboss_m():
    return f'<div class="app" style="height:900px;">{backdrop("N_ContentsM", 900)}{sheet(dailyboss_body())}</div>'


def ranking_d():
    return f'<div class="app" style="height:820px;">{backdrop("N_Contents", 820)}{modal(ranking_body(), w=520, top=40)}</div>'


def ranking_m():
    return f'<div class="app" style="height:900px;">{backdrop("N_ContentsM", 900)}{sheet(ranking_body(True))}</div>'


def pvp_inner(mobile=False):
    team = lambda: "".join(portrait(u["sp"], u["rar"], 34 if mobile else 40) for u in TEAM)
    opps = [("4번타자조승현", 1988, "537승 112패", "444,612"), ("유부남 박주환", 1698, "371승 315패", "525,116"), ("좌파이재훈", 1264, "314승 357패", "297,845")]
    ol = "".join(f'<div class="well" style="padding:12px;display:flex;align-items:center;gap:12px;"><div style="flex:1;min-width:0;"><div class="sec"><b>{n}</b><span class="t3" style="font-size:11.5px;">레이팅 {r}</span></div><div class="t3" style="font-size:11.5px;margin-top:2px;">{w} · 예상 화력 <span class="gold">{p}</span></div><div style="display:flex;gap:4px;margin-top:8px;">{"".join(f"<div style=width:24px;height:24px;border-radius:50%;overflow:hidden;background:var(--s3);><img class=sp src={SP[s]} style=width:100%;transform:scale(1.5)translateY(3px);></div>" for s in ["hr", "sr_dps", "ssr_tank", "n_sup", "xr_asn"])}</div></div><a class="btn sm">도전</a></div>' for n, r, w, p in opps)
    stats = "".join(f'<div class="well" style="flex:1;padding:{10 if mobile else 14}px;text-align:center;"><div class="t3" style="font-size:11px;">{a}</div><div style="font-size:{17 if mobile else 22}px;font-weight:700;margin-top:3px;">{b}</div></div>' for a, b in [("레이팅", "2,021"), ("순위", "1위"), ("전적", "626승 102패")])
    left = f'''<div style="display:flex;gap:8px;">{stats}</div>
  <div class="well" style="padding:12px;"><div class="sec"><span class="h3">공격 팀</span><a class="btn sm">{ic("sword",13)} 편성</a></div><div style="display:flex;gap:6px;margin-top:8px;">{team()}</div></div>
  <div class="well" style="padding:12px;"><div class="sec"><span class="h3">방어 팀</span><a class="btn sm">{ic("shield",13)} 편성</a></div><div style="display:flex;gap:6px;margin-top:8px;">{team()}</div></div>
  <div class="card" style="padding:14px;background:linear-gradient(140deg,rgba(124,92,255,.2),transparent 60%),var(--s1);"><div class="sec"><span class="h2">레이팅전</span><span class="chip">랜덤 매칭 · 레이팅·보상 있음</span></div>
    <div class="sec" style="margin-top:10px;"><span class="t2">남은 도전</span><b>10 / 10 <span class="t3" style="font-weight:400;">· 10분마다 1회</span></b></div>
    <div class="t3" style="font-size:11.5px;margin-top:4px;">승리 {GEM} 약 1,300 + 골드 (강한 상대일수록 많이) · 패배 {GEM} 50</div>
    <a class="btn pri lg" style="width:100%;margin-top:12px;">{ic("dice",18)} 랜덤 매칭 시작</a></div>
  <div class="notice">{ic("zap",13)} 어빌리티 프리셋 1번 자동 적용</div>'''
    right = f'<div class="sec"><span class="h2">자존심전</span><span class="chip">직접 도전 · 무제한 · 보상 없음</span></div><div class="seg full"><span class="on">도전 상대</span><span>대결 기록</span></div>{ol}'
    if mobile:
        return f'<div style="display:flex;flex-direction:column;gap:10px;">{left}{right}</div>'
    return f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;"><div class="card pad" style="display:flex;flex-direction:column;gap:12px;">{left}</div><div class="card pad" style="display:flex;flex-direction:column;gap:12px;">{right}</div></div>'


def pvp_d():
    return screen_d("PvP 대전", "레이팅전은 비슷한 상대와 자동 매칭, 자존심전은 직접 골라 도전", "contents", pvp_inner(), 860)


def pvp_m():
    return screen_m("contents", pvp_inner(True), 1100)


# ================================================================== 설정 · 패치노트 · 도움말 · 로그인
def settings_body():
    item = lambda i, t, s, href="#", danger=False: f'<a href="{href}" class="well" style="display:flex;align-items:center;gap:12px;padding:13px 14px;{"border-color:rgba(255,92,122,.35);" if danger else ""}"><span style="color:{"var(--red)" if danger else "var(--t2)"};">{ic(i,18)}</span><div style="flex:1;"><div style="font-weight:700;{"color:var(--red);" if danger else ""}">{t}</div><div class="t3" style="font-size:11.5px;">{s}</div></div>{ic("chev",16)}</a>'
    return f'''<div class="h1">설정</div>
  <div class="well" style="display:flex;align-items:center;gap:12px;padding:12px 14px;">{portrait("xr_asn", "XR", 40)}<div><div style="font-weight:700;">GM백민수</div><div class="t3" style="font-size:11.5px;">Lv.300 · 이메일 로그인</div></div></div>
  {item("doc", "패치노트", "업데이트 내역 보기", "N_PatchNotes.dc.html")}{item("logout", "로그아웃", "이 기기에서 로그아웃")}{item("trash", "데이터 초기화", "골드·다이아·레벨·스테이지·보유 캐릭터·어빌리티 등 모든 진행을 완전히 되돌려요. 되돌릴 수 없어요.", danger=True)}'''


def settings_d():
    return f'<div class="app" style="height:760px;">{backdrop("N_Farm", 760)}{modal(settings_body(), w=480, top=120)}</div>'


def settings_m():
    return f'<div class="app" style="height:844px;">{backdrop("N_FarmM", 844)}{sheet(settings_body())}</div>'


def patch_body():
    items = ["1000연차 소환에 있던 'SR 이상 확정' 안내를 없앴어요 — 1000연차는 처음부터 순수 확률로만 진행돼요.",
             "EX 승급에 필요한 '승급석'을 얻는 방법이 세 가지 열렸어요: ① Lv.100부터 소환할 때 아주 낮은 확률 ② 오디세이 클리어 시 낮은 확률 ③ 버려진 조각으로 직접 제작.",
             "캐릭터 개인 조각은 EX 승급에 필요한 만큼까지만 쌓이고, 넘치는 조각은 계정 공용 '버려진 조각'으로 바뀌어요.",
             "상단바에 승급석 보유량이 항상 보여요.",
             "소환·오디세이 중 승급석을 얻으면 결과 화면에 전용 알림이 떠요.",
             "EX 승급 화면의 별 보너스 안내가 '미반영'으로 잘못 나오던 걸 고쳤어요 — 별 보너스는 이미 적용되고 있었어요."]
    li = "".join(f'<li style="margin-bottom:8px;">{t}</li>' for t in items)
    return f'''<div class="h1">패치노트</div><div class="well" style="padding:16px;max-height:480px;overflow:hidden;"><div class="sec"><span class="h3">신규 재화 '승급석' 획득 경로 추가 + 1000연차 안내 정정</span><span class="t3" style="font-size:11.5px;">2026-08-30</span></div>
  <ul style="margin:12px 0 0;padding-left:18px;font-size:12.5px;line-height:1.7;color:var(--t2);">{li}</ul></div>'''


def patch_d():
    return f'<div class="app" style="height:760px;">{backdrop("N_Farm", 760)}{modal(patch_body(), w=560, top=70)}</div>'


def welcome_body():
    pts = [("users", "5명 팀", "앞열·중열·뒷열 진형 3가지"), ("eye", "몹 여러 마리", "필드에 5종이 섞여 나와요"), ("crown", "보스 6종", "보스마다 속성이 달라요"), ("zap", "마나 스킬", "마나가 차면 스킬 발동")]
    g = "".join(f'<div class="well" style="padding:12px;display:flex;gap:10px;align-items:center;"><div style="width:36px;height:36px;border-radius:10px;background:rgba(124,92,255,.18);color:#b9a8ff;display:flex;align-items:center;justify-content:center;">{ic(i,18)}</div><div><div style="font-weight:700;">{t}</div><div class="t3" style="font-size:11.5px;">{s}</div></div></div>' for i, t, s in pts)
    dots = "".join(f'<span style="width:{18 if i == 0 else 7}px;height:7px;border-radius:9px;background:{"#8a6bff" if i == 0 else "rgba(255,255,255,.2)"};"></span>' for i in range(7))
    return f'''<div style="text-align:center;"><div style="width:64px;height:64px;margin:0 auto;border-radius:20px;background:linear-gradient(135deg,#8a6bff,#3fa2ff);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(92,110,255,.5);">{ic("spark",32,"#fff")}</div>
  <div class="h1" style="margin-top:14px;">우리동네 영웅 키우기 2.0</div><div class="t2" style="font-size:13px;margin-top:6px;line-height:1.6;">무엇이 바뀌었는지 빠르게 훑어볼게요.</div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">{g}</div>
  <div style="display:flex;justify-content:center;gap:5px;">{dots}</div>
  <div style="display:flex;gap:8px;"><a class="btn ghost" style="flex:1;">건너뛰기</a><a class="btn pri" style="flex:1.5;">다음</a></div>'''


def welcome_d():
    return f'<div class="app" style="height:760px;">{backdrop("N_Farm", 760)}{modal(welcome_body(), w=520, top=110)}</div>'


def login(mobile=False):
    figs = "".join(f'<img class="sp" src="{SP[s]}" alt="" style="width:{64 if mobile else 110}px;filter:drop-shadow(0 0 16px {RARC[r]}88);">' for s, r in [("ssr_tank", "SSR"), ("xr_asn", "XR"), ("xxr", "XXR"), ("hr", "HR")])
    w = 340 if mobile else 380
    form = f'''<div class="card" style="width:{w}px;padding:24px;display:flex;flex-direction:column;gap:12px;">
  <div class="seg full"><span class="on">로그인</span><span>회원가입</span></div>
  <label style="display:flex;flex-direction:column;gap:6px;font-size:12px;" class="t2">이메일<input placeholder="name@example.com" style="height:44px;border-radius:12px;border:1px solid var(--st2);background:rgba(0,0,0,.3);color:var(--t1);padding:0 14px;font:inherit;"></label>
  <label style="display:flex;flex-direction:column;gap:6px;font-size:12px;" class="t2">비밀번호<input type="password" placeholder="••••••••" style="height:44px;border-radius:12px;border:1px solid var(--st2);background:rgba(0,0,0,.3);color:var(--t1);padding:0 14px;font:inherit;"></label>
  <a class="btn pri lg" style="width:100%;margin-top:4px;">로그인</a><a class="btn ghost" style="width:100%;">게스트로 시작하기</a></div>'''
    load = f'''<div style="width:{w}px;display:flex;flex-direction:column;gap:10px;align-items:center;"><div class="t2" style="font-size:12.5px;">필살기 충전 중...</div><div style="width:100%;">{bar(68, "xp", 8)}</div><div class="t3" style="font-size:11.5px;text-align:center;">팁 · 오디세이는 5층마다 배치 가능한 직업이 바뀌어요</div></div>'''
    hero = f'''<div style="text-align:center;"><div style="display:flex;justify-content:center;gap:{6 if mobile else 18}px;align-items:flex-end;">{figs}</div>
  <div style="font-size:{26 if mobile else 38}px;font-weight:700;letter-spacing:-.03em;margin-top:14px;background:linear-gradient(135deg,#fff,#b9a8ff 60%,#7fd7ff);-webkit-background-clip:text;background-clip:text;color:transparent;">우리동네 영웅 키우기</div><div class="num" style="font-size:{14 if mobile else 16}px;color:var(--t2);margin-top:4px;">2.0</div></div>'''
    if mobile:
        return f'<div class="app" style="height:844px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:20px;">{hero}{form}</div>'
    return f'''<div class="app" style="height:820px;display:flex;align-items:center;justify-content:center;gap:90px;">
  <div style="display:flex;flex-direction:column;align-items:center;gap:26px;">{hero}<div class="t3" style="font-size:11px;">↑ 로그인 화면</div></div>
  <div style="display:flex;flex-direction:column;gap:40px;align-items:center;">{form}{load}<div class="t3" style="font-size:11px;">↑ 로그인 직후 로딩 바</div></div></div>'''


FILES = {
    "N_Login": ("로그인 · 로딩 · 데스크톱", login(), 1440, 820), "N_LoginM": ("로그인 · 모바일", login(True), 390, 844),
    "N_Odyssey": ("오디세이 · 데스크톱", odyssey_d(), 1440, 1340), "N_OdysseyM": ("오디세이 · 모바일", odyssey_m(), 390, 1390),
    "N_Ability": ("어빌리티 · 데스크톱", ability_d(), 1440, 880), "N_AbilityM": ("어빌리티 · 모바일", ability_m(), 390, 900),
    "N_Gacha": ("소환 · 데스크톱", gacha_d(), 1440, 1000), "N_GachaM": ("소환 · 모바일", gacha_m(), 390, 840),
    "N_GachaLoading": ("팝업 · 소환 중", gacha_loading(), 1440, 1000),
    "N_GachaResult": ("팝업 · 소환 결과 · 데스크톱", gacha_result_d(), 1440, 1000), "N_GachaResultM": ("팝업 · 소환 결과 · 모바일", gacha_result_m(), 390, 1000),
    "N_Heroes": ("영웅 · 데스크톱", heroes_d(), 1440, 900), "N_HeroesM": ("영웅 · 모바일", heroes_m(), 390, 1060),
    "N_HeroDetail": ("팝업 · 영웅 상세 · 데스크톱", hero_detail_d(), 1440, 900), "N_HeroDetailM": ("팝업 · 영웅 상세 · 모바일", hero_detail_m(), 390, 1240),
    "N_Growth": ("팝업 · 성장 보너스(컬렉션)", growth_d("c"), 1440, 900), "N_Synergy": ("팝업 · 성장 보너스(시너지)", growth_d("s"), 1440, 900),
    "N_GrowthM": ("팝업 · 성장 보너스 · 모바일", growth_m(), 390, 1060),
    "N_Equipment": ("영웅 · 장비 · 데스크톱", equipment_d(), 1440, 960), "N_EquipmentM": ("영웅 · 장비 · 모바일", equipment_m(), 390, 860),
    "N_Contents": ("콘텐츠 · 데스크톱", contents_d(), 1440, 820), "N_ContentsM": ("콘텐츠 · 모바일", contents_m(), 390, 900),
    "N_Dungeon": ("팝업 · 골드 던전 · 데스크톱", dungeon_d(), 1440, 820), "N_DungeonM": ("팝업 · 골드 던전 · 모바일", dungeon_m(), 390, 900),
    "N_DailyBoss": ("팝업 · 일일보스 · 데스크톱", dailyboss_d(), 1440, 820), "N_DailyBossM": ("팝업 · 일일보스 · 모바일", dailyboss_m(), 390, 900),
    "N_Ranking": ("팝업 · 랭킹 · 데스크톱", ranking_d(), 1440, 820), "N_RankingM": ("팝업 · 랭킹 · 모바일", ranking_m(), 390, 900),
    "N_Pvp": ("PvP 대전 · 데스크톱", pvp_d(), 1440, 860), "N_PvpM": ("PvP 대전 · 모바일", pvp_m(), 390, 1100),
    "N_Settings": ("팝업 · 설정 · 데스크톱", settings_d(), 1440, 760), "N_SettingsM": ("팝업 · 설정 · 모바일", settings_m(), 390, 844),
    "N_PatchNotes": ("팝업 · 패치노트", patch_d(), 1440, 760), "N_Welcome": ("팝업 · 도움말(2.0 안내)", welcome_d(), 1440, 760),
}
