# 전투(파밍) / 층보스전 / 팀 편성 / 배경 / 디자인 시스템 — Jade 테마
from ds import *
from v2b import TIERS, BGT

DPS = ["21,402", "18,930", "38,115", "9,880", "57,778"]
STATS = [("3,120", "41,800", "2,904"), ("2,640", "38,210", "2,560"), ("6,880", "22,140", "1,310"), ("2,210", "24,900", "1,480"), ("9,420", "19,880", "1,050")]
W = 1440


def unit(u, x, y, s=96, cast=None):
    c = f'<div style="position:absolute;top:-24px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;background:linear-gradient(135deg,#8a6bff,#3fa2ff);white-space:nowrap;box-shadow:0 4px 14px rgba(92,110,255,.5);">{cast}</div>' if cast else ""
    return f'''<div style="position:absolute;z-index:2;left:{x}%;top:{y}px;width:{s}px;">{c}<img class="sp" src="{SP[u['sp']]}" alt="{u['name']}" style="width:{s}px;height:{s}px;filter:drop-shadow(0 6px 4px rgba(0,0,0,.5));">
<div style="width:{int(s * .7)}px;margin:0 auto;display:flex;flex-direction:column;gap:2px;">{bar(u['hp'], 'hp', 5)}{bar(u['mp'], 'mp', 4)}</div></div>'''


def mob(k, x, y, w, hp=None):
    hb = f'<div style="width:46px;margin:3px auto 0;">{bar(hp, "bhp", 4)}</div>' if hp is not None else ""
    return f'<div style="position:absolute;z-index:2;left:{x}%;top:{y}px;width:{w}px;"><img class="sp" src="{MOB[k]}" alt="" style="width:{w}px;filter:drop-shadow(0 6px 4px rgba(0,0,0,.5));">{hb}</div>'


def pct(x): return round(x / 12.8, 2)


def farm_scene_d(h=440):
    units = "".join(unit(u, pct(x), y) for u, (x, y) in zip(TEAM, POS))
    mobs = "".join(mob(k, pct(x), y, w, hp) for k, x, y, w, hp in MOBS_ON)
    return f'''<div class="scene card" style="height:{h}px;background-image:url('{SCENE}');border-radius:18px;">
  {mobs}{units}
  <div class="dmg" style="left:57%;top:150px;font-size:18px;color:#fff;">-12,480</div>
  <div class="dmg" style="left:66%;top:210px;font-size:25px;color:#ffd166;">-38,211!</div>
  <div class="dmg" style="left:79%;top:150px;font-size:13px;color:var(--sky);">+1 처치</div>
  <div class="dmg" style="left:46%;top:118px;font-size:13px;color:var(--mint);">+2,108 G · +31 EXP</div>
  <div class="glass" style="position:absolute;z-index:4;left:16px;top:16px;padding:10px 14px;">
    <div style="display:flex;align-items:baseline;gap:8px;"><span class="num" style="font-size:20px;">STAGE {STAGE}</span><span class="t2" style="font-size:12px;">용암 동굴 · 파밍 중</span></div>
    <div class="t3" style="font-size:11.5px;margin-top:3px;">최고 기록 {MAXST}층 · 잡몹 5종 혼합 출현</div>
  </div>
  <div class="glass" style="position:absolute;z-index:4;right:16px;top:16px;padding:10px 14px;text-align:right;">
    <div class="t3" style="font-size:11px;">누적 처치</div><div><span class="num" style="font-size:22px;">12,840</span> <span class="t2" style="font-size:12px;">마리</span></div>
  </div>
  <a class="btn sm" style="position:absolute;z-index:4;right:16px;bottom:16px;background:rgba(10,14,26,.7);backdrop-filter:blur(8px);">{ic("spark",15)} 받는 버프 9개</a>
</div>'''


def team_cards_d():
    out = ""
    for u, d, (a, h_, df) in zip(TEAM, DPS, STATS):
        out += f'''<div class="well" style="flex:1;min-width:0;padding:12px;display:flex;flex-direction:column;align-items:center;gap:6px;">
  <div class="sec" style="width:100%;">{rarity_badge(u['rar'], u['star'])}<span class="t3" style="font-size:11px;">{u['row']}</span></div>
  {portrait(u['sp'], u['rar'], 72)}
  <div style="font-size:13px;font-weight:700;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{u['name']}</div>
  <div class="t2" style="font-size:11.5px;display:flex;gap:8px;">{cls(u['cls'])}{el(u['el'], 12, True)}<span>Lv.35</span></div>
  <div style="width:100%;display:flex;flex-direction:column;gap:3px;">{bar(u['hp'], 'hp')}{bar(u['mp'], 'mp', 4)}</div>
  <div class="t3" style="font-size:10.5px;">공 {a} · 체 {h_} · 방 {df}</div>
  <div style="font-size:12.5px;font-weight:700;" class="gold">DPS {d}</div></div>'''
    return out


def bonus_chips():
    return f'''<div style="display:flex;flex-wrap:wrap;gap:8px;"><span class="chip pos">{ic("layers",13)} 이재훈 계보 2세트 · 공격력 +12%</span><span class="chip pos">{ic("doc",13)} 컬렉션 102/102 · 공·체·방 +45.9%</span><span class="chip pos">{ic("star",13)} EX 별 ★3 · +15%</span><span class="chip">{ic("zap",13)} 어빌리티 프리셋 2</span><a href="N_Growth.dc.html" class="chip on">성장 보너스 전체 보기 {ic("chev",13)}</a></div>'''


def team_panel_d():
    return f'''<div class="card pad" style="display:flex;flex-direction:column;gap:14px;">
  <div class="sec"><div><div class="h2">내 파밍 팀</div><div class="t3" style="font-size:12px;margin-top:2px;">5명 · 팀 예상 DPS <b class="mint">145,603</b></div></div>
    <div style="display:flex;gap:8px;"><a href="N_Formation.dc.html" class="btn">{ic("users",16)} 팀 편성</a><a href="N_Boss.dc.html" class="btn pri">{ic("crown",16)} 보스전</a></div></div>
  <div style="display:flex;gap:10px;">{team_cards_d()}</div>
  <div class="sec" style="flex-wrap:wrap;">
    <div style="display:flex;align-items:center;gap:10px;"><span class="t3" style="font-size:12px;">진형</span><div class="seg"><span class="on">균형진 2·2·1</span><span>공세진 1·1·3</span><span>철벽진 3·1·1</span></div></div>
    <div style="display:flex;align-items:center;gap:10px;"><span class="t3" style="font-size:12px;">배치 프리셋</span><div class="seg"><span>1</span><span class="on">2</span><span>3</span></div></div>
  </div>
  {bonus_chips()}
</div>'''


import os
STAGE_STYLE = {"v": os.environ.get("STAGE_STYLE", "blade")}  # hex | route | pills | blade — 테마별 스테이지 선택 모양


def stage_chips(compact=False):
    v = STAGE_STYLE["v"]
    if v == "route": return stage_route(compact)
    if v == "pills": return stage_pills(compact)
    if v == "blade": return stage_blade(compact)
    out = ""
    for n in range(50, 66):
        if n == STAGE: bg, fg = "linear-gradient(160deg,#ffe08a,#f5a623)", "#2a1b00"
        elif n <= MAXST: bg, fg = "linear-gradient(160deg,#25335a,#17213d)", "#9fc0ff"
        else: bg, fg = "#121725", "#3d465e"
        sz = "width:36px;height:42px;font-size:12px;" if compact else ""
        lock = f'<div style="position:absolute;bottom:-1px;left:50%;transform:translateX(-50%);color:#3d465e;">{ic("lock",10)}</div>' if n > MAXST + 1 else ""
        crown = f'<div style="position:absolute;top:-2px;right:-3px;color:var(--gold);">{ic("crown",12)}</div>' if n == MAXST + 1 else ""
        out += f'<div style="position:relative;padding:5px 3px;"><div class="hex" style="background:{bg};color:{fg};{sz}">{n}</div>{crown}{lock}</div>'
        if n == 60:
            out += '<div style="flex:0 0 auto;width:2px;margin:6px 8px;border-radius:2px;background:linear-gradient(#ff7a4d,#8a6bff);"></div>'
    return out


def _tier_flag(i, compact):
    rng, name = TIERS[i]
    return f'<div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:4px;margin:0 {6 if compact else 10}px;"><div style="width:{34 if compact else 46}px;height:{24 if compact else 30}px;border-radius:8px;background:url(\'{BGT[i]}\') center/cover;image-rendering:pixelated;box-shadow:0 0 0 2px var(--st2);"></div><span style="font-size:{9 if compact else 10}px;color:var(--t2);white-space:nowrap;">{name}</span></div>'


def stage_route(compact=False):
    # 길 위의 원형 메달 — 지나온 길은 진하게, 현재 층은 크게 빛나는 메달, 보스 층은 방패 문장
    s = 30 if compact else 38
    out = ""
    for n in range(50, 66):
        if n == 51: out += _tier_flag(5, compact)
        if n == 61: out += _tier_flag(6, compact)
        cur, done, boss = n == STAGE, n <= MAXST, n == MAXST + 1
        line = f'<div style="flex:0 0 auto;width:{8 if compact else 12}px;height:4px;border-radius:4px;background:{"var(--p1)" if done else "var(--st2)"};"></div>' if n > 50 else ""
        if cur:
            node = f'<div class="num" style="flex:0 0 auto;width:{s + 14}px;height:{s + 14}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:{14 if compact else 16}px;color:var(--on-p);background:var(--pg);box-shadow:0 0 0 4px var(--p-soft),0 0 22px var(--p-glow);">{n}</div>'
        elif boss:
            node = f'<div style="flex:0 0 auto;width:{s}px;height:{s}px;border-radius:12px;transform:rotate(45deg);display:flex;align-items:center;justify-content:center;background:var(--s3);box-shadow:inset 0 0 0 2px var(--gold);"><span style="transform:rotate(-45deg);color:var(--gold);">{ic("crown",14)}</span></div>'
        elif done:
            node = f'<div class="num" style="flex:0 0 auto;width:{s}px;height:{s}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:{11 if compact else 12}px;color:var(--t1);background:var(--s3);box-shadow:inset 0 0 0 2px var(--p1);">{n}</div>'
        else:
            node = f'<div style="flex:0 0 auto;width:{s}px;height:{s}px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--t3);background:var(--s2);box-shadow:inset 0 0 0 1px var(--st2);">{ic("lock",12)}</div>'
        out += line + node
    return out


def stage_pills(compact=False):
    # 둥근 숫자 알약 — 깨끗한 리스트형, 현재 층은 꽉 찬 색 + "현재" 라벨, 아래에 진행 바
    out = ""
    for n in range(50, 66):
        if n == 51: out += _tier_flag(5, compact)
        if n == 61: out += _tier_flag(6, compact)
        cur, done, boss = n == STAGE, n <= MAXST, n == MAXST + 1
        w, h = (40, 46) if compact else (52, 58)
        if cur:
            st = "background:var(--pg);color:var(--on-p);box-shadow:0 6px 16px var(--p-glow);"
            sub = '<span style="font-size:9px;font-weight:700;opacity:.9;">현재</span>'
        elif boss:
            st = "background:var(--s1);color:var(--gold);box-shadow:inset 0 0 0 2px var(--gold);"
            sub = f'<span>{ic("crown",11)}</span>'
        elif done:
            st = "background:var(--s1);color:var(--t1);box-shadow:inset 0 0 0 1px var(--st2);"
            sub = f'<span style="color:var(--mint);display:flex;">{ic("check",12)}</span>'
        else:
            st = "background:var(--s3);color:var(--t3);"
            sub = f'<span>{ic("lock",10)}</span>'
        out += f'<div style="flex:0 0 auto;width:{w}px;height:{h}px;margin:0 3px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-weight:700;font-size:{13 if compact else 15}px;{st}">{n}{sub}</div>'
    return out


def stage_blade(compact=False):
    # 비스듬히 잘린 칼날 타일 — 날카로운 e스포츠 느낌
    out = ""
    for n in range(50, 66):
        if n == 51: out += _tier_flag(5, compact)
        if n == 61: out += _tier_flag(6, compact)
        cur, done, boss = n == STAGE, n <= MAXST, n == MAXST + 1
        w, h = (34, 40) if compact else (44, 50)
        cut = "clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%);"
        if cur: st = "background:var(--pg);color:var(--on-p);"
        elif boss: st = "background:var(--gold);color:#1a1400;"
        elif done: st = "background:var(--s4);color:var(--t1);"
        else: st = "background:var(--s2);color:var(--t3);"
        inner = ic("crown", 14) if boss else (ic("lock", 11) if not done and not cur else str(n))
        out += f'<div class="num" style="flex:0 0 auto;width:{w}px;height:{h}px;margin-right:-4px;display:flex;align-items:center;justify-content:center;font-size:{12 if compact else 14}px;{cut}{st}">{inner}</div>'
    return out


def stage_panel_d():
    info = [("구간", "51–60 용암 동굴", ""), ("잡몹 속성", "없음 — 파밍은 예측 가능하게", "t2"), ("잡몹 평균 체력 · 공격 · 방어", "719,419 · 20,115 · 3,110", ""),
            ("내 팀 예상 DPS", "145,603", "mint"), ("평균 처치 시간", "1.6초 / 마리", ""), ("파밍 난이도", "여유롭게 클리어", "mint"),
            ("층보스", "얼음 거인 · 수속성", "sky"), ("보스 체력 · 공격", "1,079,129 · 24,138", ""), ("보스 보조 스킬", "비늘 강화 — 피해 2회 차단", "")]
    rows = "".join(f'<div class="row"><span class="t2">{a}</span><b class="{c}">{b}</b></div>' for a, b, c in info)
    return f'''<div class="card pad">
  <div class="sec"><div><div class="h2">스테이지 이동</div><div class="t3" style="font-size:12px;margin-top:2px;">1~{MAXST}층은 눌러서 바로 이동 · {MAXST + 1}층부터는 층보스 승리로 열려요</div></div>
    <div style="display:flex;gap:6px;"><a class="btn sm">{ic("chevl",15)} 이전 층</a><a class="btn sm">다음 층 {ic("chev",15)}</a><a class="btn sm">{ic("up",15)} 최고 층으로</a></div></div>
  <div class="well hs" style="display:flex;align-items:center;margin-top:12px;padding:6px 8px;">{stage_chips()}</div>
  <div class="sec" style="font-size:11.5px;margin-top:6px;"><span style="color:#ff9a6b;">{ic("flame",12,"#ff9a6b")} 51–60 용암 동굴</span><span class="t3">61–70 저주받은 묘지 {ic("chev",12)}</span></div>
  <div style="margin-top:8px;">{rows}</div></div>'''


def boss_card_d():
    return f'''<div class="card pad" style="background:linear-gradient(160deg,rgba(79,139,255,.16),rgba(14,19,32,.9) 55%),var(--s1);">
  <div style="display:flex;gap:14px;align-items:center;"><div class="well" style="width:84px;height:72px;display:flex;align-items:center;justify-content:center;"><img class="sp" src="{MOB['ice']}" alt="얼음 거인" style="width:66px;"></div>
  <div style="flex:1;"><div class="t3" style="font-size:11.5px;">{STAGE}층 층보스 · 이기면 {STAGE + 1}층 열림</div><div class="h2" style="margin-top:2px;">얼음 거인 {el("💧",14,True)}</div></div></div>
  <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;"><span class="chip pos">{el("🌪",12)} 풍 영웅 피해 ×1.25</span><span class="chip" style="color:var(--red);border-color:rgba(255,92,122,.35);">{el("🔥",12)} 화 영웅 ×0.85</span></div>
  <div class="t3" style="font-size:11.5px;margin-top:8px;">내 팀 상성: 풍 2 · 화 2 · 수 1 → 예상 승률 <b class="mint">높음</b></div>
  <a href="N_Boss.dc.html" class="btn pri lg" style="width:100%;margin-top:14px;">{ic("crown",18)} 보스 도전</a></div>'''


def farm_status_d():
    rows = [("처치", "38마리"), ("골드", "1,284,300"), ("경험치", "1,178"), ("다이아", "처치당 20% · 2,478개")]
    return f'''<div class="card pad">
  <div class="sec"><div class="h3">최근 1분 파밍 현황</div><a class="btn sm ghost">{ic("refresh",14)} 다시 측정</a></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">{"".join(f'<div class="well" style="padding:10px 12px;"><div class="t3" style="font-size:11px;">{a}</div><div style="font-size:15px;font-weight:700;margin-top:3px;">{b}</div></div>' for a, b in rows)}</div>
  <div class="notice mint" style="margin-top:10px;">{ic("moon",13)} 자리 비운 2시간 14분 동안 <b>+1억 7,204만 골드 · 5,104마리</b> 처치 (최대 8시간 적립)</div></div>'''


def species_d():
    rows = "".join(f'<div style="display:flex;align-items:center;gap:10px;padding:6px 0;"><div class="well" style="width:42px;height:32px;display:flex;align-items:center;justify-content:center;"><img class="sp" src="{MOB[k]}" alt="" style="width:30px;"></div><span style="flex:1;font-size:12.5px;">{n}</span><div style="width:90px;">{bar(p * 3, "xp", 5)}</div><span style="width:34px;text-align:right;font-weight:700;font-size:12px;">{p}%</span></div>' for k, i, n, p in FIELD)
    return f'<div class="card pad"><div class="sec"><div class="h3">출현 몬스터</div><span class="t3" style="font-size:11px;">속성 없음</span></div><div style="margin-top:6px;">{rows}</div></div>'


def ability_d():
    rows = "".join(f'<div class="row" style="padding:7px 0;"><span style="font-size:12.5px;">{l}</span><div class="seg" style="padding:3px;"><span class="{"on" if True else ""}" style="height:24px;padding:0 9px;">1</span><span style="height:24px;padding:0 9px;">2</span><span style="height:24px;padding:0 9px;">3</span><span style="height:24px;padding:0 9px;">끔</span></div></div>' for l in ["파밍", "층보스", "일일보스", "골드 던전", "다이아 던전", "경험치 던전", "PvP", "오디세이"])
    return f'<div class="card pad"><div class="h3">콘텐츠별 어빌리티 프리셋</div><div class="t3" style="font-size:11.5px;margin:3px 0 4px;">도전하는 순간 자동 전환, 끝나면 원래 프리셋으로 돌아와요</div>{rows}</div>'


def farm_d():
    inner = f'''<div style="display:grid;grid-template-columns:1fr 380px;gap:20px;">
  <div style="display:flex;flex-direction:column;gap:16px;min-width:0;">{farm_scene_d()}
    <div class="notice">{ic("gift",13)} 가난한 서버를 위해 재화 획득 수식을 간단하게 표기했어요. 지금 스테이지 다이아: <b>처치당 20% 확률로 2,478개</b></div>
    {team_panel_d()}{stage_panel_d()}</div>
  <div style="display:flex;flex-direction:column;gap:16px;">{boss_card_d()}{farm_status_d()}{species_d()}{ability_d()}</div></div>'''
    return screen_d("전투", "스테이지 56 · 용암 동굴", "battle", inner, 1760)


# ------------------------------------------------------------------ mobile farm
def m_unit(u, x, y, s=54, cast=None):
    c = f'<div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:99px;background:linear-gradient(135deg,#8a6bff,#3fa2ff);white-space:nowrap;">{cast}</div>' if cast else ""
    return f'<div style="position:absolute;z-index:2;left:{x}px;top:{y}px;width:{s}px;">{c}<img class="sp" src="{SP[u["sp"]]}" alt="" style="width:{s}px;height:{s}px;"><div style="width:38px;margin:0 auto;display:flex;flex-direction:column;gap:1px;">{bar(u["hp"], "hp", 3)}{bar(u["mp"], "mp", 3)}</div></div>'


def m_mob(k, x, y, w, hp=None):
    hb = f'<div style="width:28px;margin:1px auto 0;">{bar(hp, "bhp", 3)}</div>' if hp is not None else ""
    return f'<div style="position:absolute;z-index:2;left:{x}px;top:{y}px;width:{w}px;"><img class="sp" src="{MOB[k]}" alt="" style="width:{w}px;">{hb}</div>'


def acc(title, open_, inner, icon):
    return f'<div class="card" style="padding:12px 14px;"><div class="sec"><span class="h3" style="display:flex;align-items:center;gap:7px;">{ic(icon,15)} {title}</span><span class="t3">{ic("up" if open_ else "down",16)}</span></div>{inner if open_ else ""}</div>'


def farm_m():
    units = "".join(m_unit(u, x, y) for u, (x, y) in zip(TEAM, MPOS))
    mobs = "".join(m_mob(k, x, y, w, hp) for k, x, y, w, hp in MMOBS)
    mini = "".join(f'<div class="well" style="flex:1;min-width:0;padding:6px 3px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:3px;">{portrait(u["sp"], u["rar"], 38)}<div style="font-size:10px;font-weight:700;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{u["name"]}</div><div style="width:100%;display:flex;flex-direction:column;gap:2px;">{bar(u["hp"], "hp", 3)}{bar(u["mp"], "mp", 3)}</div><div class="gold" style="font-size:10px;font-weight:700;">{d}</div></div>' for u, d in zip(TEAM, ["21.4K", "18.9K", "38.1K", "9.9K", "57.8K"]))
    species = "".join(f'<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;"><img class="sp" src="{MOB[k]}" alt="" style="width:26px;"><span style="flex:1;">{n}</span><div style="width:60px;">{bar(p * 3, "xp", 4)}</div><b style="width:30px;text-align:right;">{p}%</b></div>' for k, i, n, p in FIELD)
    inner = f'''<div class="scene card" style="height:280px;background-image:url('{SCENE}');border-radius:16px;margin:-2px -2px 0;">
  {mobs}{units}
  <div class="dmg" style="left:228px;top:134px;font-size:13px;color:#ffd166;">-38,211!</div>
  <div class="glass" style="position:absolute;z-index:4;left:10px;top:10px;padding:6px 10px;"><div class="num" style="font-size:14px;">STAGE {STAGE}</div><div class="t3" style="font-size:10px;">용암 동굴 · 최고 {MAXST}층</div></div>
  <div class="glass" style="position:absolute;z-index:4;right:10px;top:10px;padding:6px 10px;text-align:right;"><div class="t3" style="font-size:10px;">누적 처치</div><div class="num" style="font-size:15px;">12,840</div></div>
  <a class="btn sm" style="position:absolute;z-index:4;right:10px;bottom:10px;height:28px;background:rgba(10,14,26,.75);">{ic("spark",13)} 버프 9</a>
</div>
<div style="display:flex;flex-direction:column;gap:10px;margin-top:12px;">
  <div style="display:flex;gap:8px;"><a href="N_FormationM.dc.html" class="btn" style="flex:1;height:48px;">{ic("users",16)} 팀 편성</a><a href="N_BossM.dc.html" class="btn pri" style="flex:1.4;height:48px;font-size:15px;">{ic("crown",17)} 보스 도전</a></div>
  <div class="card" style="padding:12px;"><div class="sec"><div><span class="h3">내 팀</span> <span class="t3" style="font-size:11px;">DPS <b class="mint">145.6K</b> · 균형진</span></div><div class="seg" style="padding:3px;"><span style="height:24px;padding:0 9px;">1</span><span class="on" style="height:24px;padding:0 9px;">2</span><span style="height:24px;padding:0 9px;">3</span></div></div>
    <div style="display:flex;gap:5px;margin-top:10px;">{mini}</div>
    <div class="hs" style="display:flex;gap:6px;margin-top:10px;"><span class="chip pos" style="flex:0 0 auto;">계보 2세트 +12%</span><span class="chip pos" style="flex:0 0 auto;">컬렉션 +45.9%</span><span class="chip pos" style="flex:0 0 auto;">EX ★ +15%</span><span class="chip" style="flex:0 0 auto;">어빌 프리셋 2</span></div></div>
  <div class="card" style="padding:12px;display:flex;gap:12px;align-items:center;background:linear-gradient(160deg,rgba(79,139,255,.16),rgba(14,19,32,.9) 60%),var(--s1);"><div class="well" style="width:56px;height:48px;display:flex;align-items:center;justify-content:center;"><img class="sp" src="{MOB['ice']}" alt="" style="width:42px;"></div><div style="flex:1;"><div class="h3">층보스 얼음 거인 {el("💧",12,True)}</div><div style="font-size:11.5px;margin-top:3px;"><span class="mint">풍 ×1.25</span> · <span class="red">화 ×0.85</span> · 보호막 스킬</div></div>{ic("chev",18)}</div>
  <div class="card" style="padding:12px 8px;"><div class="sec" style="padding:0 4px;"><span class="h3">스테이지 이동</span><span class="t3" style="font-size:11px;">1~{MAXST}층 자유 이동</span></div>
    <div class="hs" style="display:flex;align-items:center;margin-top:6px;">{stage_chips(True)}</div>
    <div style="display:flex;gap:6px;margin-top:8px;padding:0 4px;"><a class="btn sm" style="flex:1;">{ic("chevl",14)} 이전</a><a class="btn sm" style="flex:1;">다음 {ic("chev",14)}</a><a class="btn sm" style="flex:1.2;">{ic("up",14)} 최고 층</a></div></div>
  {acc("최근 1분 파밍 현황", True, '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;">' + "".join(f'<div class="well" style="padding:8px 10px;"><div class="t3" style="font-size:10.5px;">{a}</div><div style="font-weight:700;margin-top:2px;">{b}</div></div>' for a, b in [("처치", "38마리"), ("골드", "128만"), ("경험치", "1,178"), ("다이아", "20% · 2,478")]) + '</div><div class="notice mint" style="margin-top:8px;font-size:11px;">자리 비운 2시간 14분 동안 +1.7억 골드</div>', "chart")}
  {acc("출현 몬스터 5종", True, '<div style="margin-top:6px;">' + species + '</div>', "eye")}
  {acc("스테이지 정보", False, "", "doc")}
  {acc("콘텐츠별 어빌리티 프리셋", False, "", "zap")}
</div>'''
    return screen_m("battle", inner, 1500)


# ------------------------------------------------------------------ boss
def boss_scene(h, mobile=False):
    if mobile:
        units = "".join(m_unit(u, x, y, cast=("필살기!" if i == 4 else None)) for i, (u, (x, y)) in enumerate(zip(TEAM, [(150, 140), (136, 200), (92, 128), (80, 190), (20, 160)])))
        boss = m_mob("ice", 228, 110, 140)
        hud = f'''<div class="glass" style="position:absolute;z-index:4;left:10px;right:10px;top:10px;padding:8px 10px;"><div class="sec"><span style="font-weight:700;font-size:12.5px;">{STAGE}층 보스 · 얼음 거인</span>{el("💧",12,True)}</div><div style="margin-top:5px;">{bar(63, "bhp", 8)}</div><div class="sec t3" style="font-size:10px;margin-top:3px;"><span>679,851 / 1,079,129</span><span class="sky">「비늘 강화」 준비</span></div></div>
  <div class="dmg" style="left:196px;top:130px;font-size:15px;color:var(--mint);">-184,220 효과적!</div>
  <div style="position:absolute;z-index:4;right:10px;bottom:10px;display:flex;gap:4px;"><span class="chip" style="height:26px;background:rgba(10,14,26,.75);">{ic("clock",12)} 0:42</span><span class="chip" style="height:26px;background:rgba(10,14,26,.75);">x1</span><span class="chip" style="height:26px;background:rgba(10,14,26,.75);">{ic("ff",12)} 결과</span></div>'''
        return f'<div class="scene card" style="height:{h}px;background-image:url(\'{SCENE}\');border-radius:16px;">{boss}{units}{hud}</div>'
    units = "".join(unit(u, pct(x), y + 20, cast=("필살기!" if i == 4 else None)) for i, (u, (x, y)) in enumerate(zip(TEAM, POS)))
    return f'''<div class="scene card" style="height:{h}px;background-image:url('{SCENE}');border-radius:18px;">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 74% 50%,rgba(108,198,255,.25),transparent 55%);z-index:1;"></div>
  {mob('ice', 58, 100, 260)}{units}
  <div class="dmg" style="left:55%;top:150px;font-size:27px;color:var(--mint);">-184,220 효과적!</div>
  <div class="dmg" style="left:66%;top:270px;font-size:16px;color:#ffb0a0;">-21,004 약함</div>
  <div class="dmg" style="left:63%;top:350px;font-size:13px;color:var(--sky);">보호막 1회 남음</div>
  <div class="glass" style="position:absolute;z-index:4;left:16px;top:16px;width:min(560px,60%);padding:12px 14px;">
    <div class="sec"><span class="h3">{STAGE}층 층보스 · 얼음 거인</span>{el("💧",13,True)}</div>
    <div style="margin-top:8px;">{bar(63, "bhp", 10)}</div>
    <div class="sec t3" style="font-size:11px;margin-top:4px;"><span>679,851 / 1,079,129</span><span class="sky">마나 80% · 「비늘 강화」 준비 중</span></div></div>
  <div style="position:absolute;z-index:4;right:16px;top:16px;display:flex;gap:6px;"><span class="chip" style="height:32px;background:rgba(10,14,26,.75);">{ic("clock",14)} 0:42</span><div class="seg" style="background:rgba(10,14,26,.75);"><span class="on">x1</span><span>x2</span></div><a class="btn sm" style="background:rgba(10,14,26,.75);">{ic("ff",14)} 결과 바로 보기</a></div>
</div>'''


def battle_log(compact=False):
    L = [("mint", "MINSU-DARKMAN 필살기 → 184,220", "풍→수 ×1.25"), ("", "분노한김유창 평타 → 21,004", "화→수 ×0.85"), ("sky", "얼음 거인 「비늘 강화」", "피해 2회 차단"),
         ("gold", "이재훈 「응원」", "팀 공격력 +18% · 6초"), ("red", "얼음 거인 평타 → 박주환", "-8,412")]
    rows = "".join(f'<div class="row" style="padding:8px 0;font-size:{12 if compact else 12.5}px;"><span class="{c}">{a}</span><span class="t3" style="font-size:11px;">{b}</span></div>' for c, a, b in L)
    return f'<div class="card pad"><div class="h3">전투 기록</div><div style="margin-top:4px;">{rows}</div></div>'


def element_card():
    chain = f'<div style="display:flex;align-items:center;gap:8px;margin-top:10px;font-weight:700;">{el("🔥",16,True)}{ic("chev",14)}{el("🌪",16,True)}{ic("chev",14)}{el("💧",16,True)}{ic("chev",14)}{el("🔥",16,True)}</div>'
    return f'<div class="card pad"><div class="h3">속성 상성</div>{chain}<div class="t3" style="font-size:11.5px;margin-top:8px;">유리 ×1.25 · 불리 ×0.85 · 층보스·PvP에만 적용 (잡몹 제외)</div></div>'


def boss_d():
    cards = "".join(f'<div class="well" style="flex:1;min-width:0;padding:10px;display:flex;gap:10px;align-items:center;">{portrait(u["sp"], u["rar"], 48)}<div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{u["name"]}</div><div style="display:flex;flex-direction:column;gap:3px;margin-top:5px;">{bar(u["hp"], "hp")}{bar(u["mp"], "mp", 4)}</div></div></div>' for u in TEAM)
    inner = f'''<div style="display:grid;grid-template-columns:1fr 380px;gap:20px;">
  <div style="display:flex;flex-direction:column;gap:16px;min-width:0;">{boss_scene(480)}<div style="display:flex;gap:10px;">{cards}</div></div>
  <div style="display:flex;flex-direction:column;gap:16px;">{element_card()}{battle_log()}
    <div class="card pad"><div class="h3">승리 보상</div><div class="row"><span class="t2">다음 층 해금</span><b>{STAGE + 1}층</b></div><div class="row"><span class="t2">첫 클리어 보너스</span><b>{GEM} 20</b></div><div class="row"><span class="t2">패배 시</span><b>페널티 없음 · 그 층에서 계속 파밍</b></div></div></div></div>'''
    return screen_d("층보스전", f"스테이지 {STAGE} · 얼음 거인", "battle", inner, 960)


def boss_m():
    mini = "".join(f'<div class="well" style="flex:1;min-width:0;padding:5px 3px;display:flex;flex-direction:column;align-items:center;gap:3px;">{portrait(u["sp"], u["rar"], 34)}<div style="width:100%;display:flex;flex-direction:column;gap:2px;">{bar(u["hp"], "hp", 3)}{bar(u["mp"], "mp", 3)}</div></div>' for u in TEAM)
    inner = f'''{boss_scene(340, True)}<div style="display:flex;flex-direction:column;gap:10px;margin-top:12px;"><div style="display:flex;gap:5px;">{mini}</div>{element_card()}{battle_log(True)}</div>'''
    return screen_m("battle", inner, 940)


# ------------------------------------------------------------------ team formation
ROSTER_PICK = [("hr", "HR", "댄싱머신채영기"), ("xxr", "XXR", "MINSU-DARKMAN"), ("xr_asn", "XR", "백인백민수"), ("ssr_tank", "SSR", "유부남 박주환"), ("sr_dps", "SR", "분노한김유창"),
               ("r_dps", "R", "매산고조승현"), ("n_sup", "EX", "이재훈"), ("n_tank", "EX", "박주환"), ("xr_asn", "XR", "20대조청월"), ("sr_dps", "SR", "4번타자조승현"),
               ("ssr_tank", "SSR", "팔씨름박주환"), ("r_dps", "R", "좌파이재훈")]
PICKED = {"유부남 박주환", "박주환", "분노한김유창", "이재훈", "MINSU-DARKMAN"}
STAR_MARK = '<span style="position:absolute;top:6px;left:6px;">' + ic("star", 12, "#34e3b0") + '</span>'


def formation_body(mobile=False):
    slot = lambda u: f'<div style="position:relative;">{portrait(u["sp"], u["rar"], 44 if mobile else 52)}<span style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--red);display:flex;align-items:center;justify-content:center;">{ic("x",11,"#fff",3)}</span></div>'
    rows = [("앞열", "방어력 +20%", TEAM[0:2]), ("중열", "공격력 +6% · 방어력 +8%", TEAM[2:4]), ("뒷열", "공격력 +15%", TEAM[4:5])]
    lines = "".join(f'<div class="well" style="display:flex;align-items:center;gap:12px;padding:10px 12px;"><div style="width:{60 if mobile else 92}px;"><div style="font-weight:700;">{r}</div><div class="t3" style="font-size:10.5px;">{b}</div></div><div style="display:flex;gap:10px;">{"".join(slot(u) for u in us)}</div></div>' for r, b, us in rows)
    n = 4 if mobile else 6
    grid = "".join(f'<div class="well" style="padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;{"outline:2px solid rgba(124,92,255,.7);" if name in PICKED else ""}">{portrait(s, r, 44 if mobile else 52)}<div style="font-size:10.5px;font-weight:700;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{name}</div>{rarity_badge(r)}{STAR_MARK if name in PICKED else ""}</div>' for s, r, name in ROSTER_PICK[: (8 if mobile else 12)])
    return f'''<div class="sec"><div><div class="h1" style="font-size:{19 if mobile else 22}px;">팀 편성</div><div class="t3" style="font-size:12px;margin-top:2px;">5 / 5명 · 고른 순서대로 앞열 → 중열 → 뒷열</div></div></div>
  <div class="seg full"><span class="on">균형진 2·2·1</span><span>공세진 1·1·3</span><span>철벽진 3·1·1</span></div>
  {lines}
  <div class="notice mint">{ic("layers",13)} 이 편성으로 발동: <b>이재훈 계보 2세트</b> 팀 공격력 +12% · 예상 DPS <b>145,603</b></div>
  <div class="sec"><div class="seg"><span>{"1" if mobile else "프리셋 1"}</span><span class="on">{"2" if mobile else "프리셋 2"}</span><span>{"3" if mobile else "프리셋 3"}</span></div><div style="display:flex;gap:6px;"><span class="chip">등급순 {ic("down",12)}</span><span class="chip">전체 직업 {ic("down",12)}</span></div></div>
  <div style="display:grid;grid-template-columns:repeat({n},1fr);gap:8px;">{grid}</div>
  <a class="btn pri lg" style="width:100%;">저장</a>'''


def formation_d():
    body = f'<div class="app" style="height:1080px;">{backdrop("N_Farm", 1080)}{modal(formation_body(), w=640, top=60, h=960)}</div>'
    return body


def formation_m():
    return f'<div class="app" style="height:1080px;">{backdrop("N_FarmM", 1080)}{sheet(formation_body(True), top=70)}</div>'


# ------------------------------------------------------------------ stage backgrounds
def backgrounds():
    cells = ""
    for i, ((rng, name), url) in enumerate(zip(TIERS, BGT)):
        cur = i == (STAGE - 1) // 10
        cells += f'''<div class="card" style="overflow:hidden;{'box-shadow:0 0 0 2px var(--gold),0 12px 32px rgba(0,0,0,.4);' if cur else ''}"><div class="scene" style="height:140px;background-image:url('{url}');">{'<span class="badge" style="--c:var(--gold);position:absolute;left:10px;top:10px;z-index:2;">지금 56층</span>' if cur else ''}</div>
  <div class="sec" style="padding:10px 12px;"><span class="h3">{name}</span><span class="num t3" style="font-size:11px;">{rng}</span></div></div>'''
    return f'''<div class="app" style="height:640px;padding:32px;"><div class="h1">스테이지 배경 — 10층마다 교체, 갈수록 무섭게</div>
  <div class="tip" style="margin-top:6px;max-width:900px;">들판에서 시작해 숲 → 늪 → 성채 → 던전 → 용암 → 묘지 → 핏빛 폐허 → 심연 → 마왕성 순으로 어두워져요. 새 구간에 처음 들어가면 구간 이름이 화면 가운데 크게 떠요. 100층 이후는 마왕성이 이어지고 색만 더 붉어져요.</div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-top:22px;">{cells}</div></div>'''


# ------------------------------------------------------------------ design system board
def design_system():
    sw = [("배경", "#06100D"), ("표면 1", "#0B1915"), ("표면 2", "#10221D"), ("표면 3", "#163029"), ("기본 글자", "#ECFFF6"), ("보조 글자", "#A3C9BA"),
          ("주 색 (초록→라임)", "linear-gradient(120deg,#22c55e,#a3e635)"), ("라임 · 이득", "#A3E635"), ("골드 · 보상", "#FACC15"), ("레드 · 위험", "#FB7185"), ("시안 · 정보", "#67E8F9")]
    sws = "".join(f'<div><div style="height:56px;border-radius:12px;border:1px solid var(--st2);background:{c};"></div><div style="font-size:12px;font-weight:700;margin-top:6px;">{n}</div><div class="t3" style="font-size:11px;">{c if c.startswith("#") else "그라데이션"}</div></div>' for n, c in sw)
    rar = "".join(f'<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">{portrait(s, r, 56)}{rarity_badge(r)}</div>' for s, r in [("n_sup", "N"), ("r_dps", "R"), ("sr_dps", "SR"), ("ssr_tank", "SSR"), ("xr_asn", "XR"), ("hr", "HR"), ("xxr", "XXR")])
    icons = "".join(f'<div class="well" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--t1);">{ic(n,20)}</div>' for n in ["sword", "map", "spark", "users", "trophy", "zap", "crown", "shield", "target", "star", "lock", "clock", "refresh", "gift", "chart", "bag", "gear", "help"])
    return f'''<div class="app" style="height:840px;padding:36px;">
  <div class="h1" style="font-size:26px;">2.0 디자인 시스템 — Jade 비취 밤</div>
  <div class="tip" style="margin-top:6px;max-width:960px;">1.0의 보라·남색과 계단 테두리를 완전히 버리고, 짙은 초록 바탕 + 초록→라임 포인트 하나, 모서리를 비스듬히 자른 카드·버튼·탭·칩으로 통일했어요. 도트는 캐릭터·몬스터·배경과 전투 숫자에만 쓰고, UI 글자는 깔끔한 고딕(IBM Plex Sans KR)으로 바꿨어요. 아이콘은 이모지 대신 선 아이콘으로 통일했어요.</div>
  <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:20px;margin-top:24px;">
    <div class="card pad"><div class="h2">색</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-top:14px;">{sws}</div></div>
    <div class="card pad"><div class="h2">글자</div>
      <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px;"><div class="h1">페이지 제목 22 / Bold</div><div class="h2">섹션 제목 17 / Bold</div><div class="h3">카드 제목 14 / Bold</div><div>본문 13 / Regular — 설명과 표에 써요</div><div class="t3" style="font-size:11.5px;">보조 11.5 / 회색 — 부가 설명</div><div class="num" style="font-size:22px;">STAGE 56 · -38,211!</div><div class="t3" style="font-size:11.5px;">↑ 도트 숫자 (Galmuri) — 전투·스테이지 숫자 전용</div></div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px;">
    <div class="card pad"><div class="h2">버튼</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;align-items:center;"><a class="btn pri lg">{ic("crown",18)} 보스 도전</a><a class="btn pri">기본 버튼</a><a class="btn gold">{GEM} 10회 소환</a><a class="btn">{ic("users",16)} 보조 버튼</a><a class="btn ghost">투명 버튼</a><a class="btn danger">{ic("trash",15)} 위험</a><a class="btn sm">작은 버튼</a><a class="ibtn" aria-label="설정">{ic("gear")}</a></div>
      <div class="h3" style="margin-top:20px;">탭 · 칩</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;align-items:center;"><div class="seg"><span class="on">균형진</span><span>공세진</span><span>철벽진</span></div><span class="chip">기본 칩</span><span class="chip on">선택됨</span><span class="chip pos">{ic("layers",13)} 보너스 +12%</span></div>
      <div class="h3" style="margin-top:20px;">게이지</div>
      <div style="display:grid;grid-template-columns:70px 1fr;gap:8px 12px;align-items:center;margin-top:10px;font-size:12px;"><span class="t2">체력</span>{bar(72, "hp", 8)}<span class="t2">마나</span>{bar(55, "mp", 8)}<span class="t2">경험치</span>{bar(41, "xp", 8)}<span class="t2">보스 체력</span>{bar(63, "bhp", 8)}</div>
      <div class="h3" style="margin-top:20px;">안내 박스</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;"><div class="notice">{ic("zap",13)} 이 콘텐츠는 어빌리티 프리셋 1번이 자동 적용돼요</div><div class="notice mint">{ic("moon",13)} 자리 비운 동안 +1.7억 골드 적립</div></div></div>
    <div class="card pad"><div class="h2">등급 테두리</div><div style="display:flex;gap:14px;margin-top:14px;flex-wrap:wrap;">{rar}</div>
      <div class="h2" style="margin-top:24px;">아이콘</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">{icons}</div>
      <div class="h2" style="margin-top:24px;">속성 · 직업</div><div style="display:flex;gap:16px;margin-top:12px;font-size:13px;font-weight:700;">{el("🔥",16,True)}{el("🌪",16,True)}{el("💧",16,True)}<span class="t2" style="display:flex;gap:12px;font-weight:500;">{cls("🛡 탱커",14)}{cls("⚔ 딜러",14)}{cls("🗡 암살자",14)}{cls("✨ 서포터",14)}</span></div>
      <div class="h2" style="margin-top:24px;">재화</div><div style="display:flex;gap:8px;margin-top:12px;"><span class="chip" style="color:var(--t1);">{COIN} 골드</span><span class="chip" style="color:var(--t1);">{GEM} 다이아</span><span class="chip" style="color:var(--t1);">{STONE} 승급석</span></div></div>
  </div></div>'''


FILES = {
    "N_DesignSystem": ("2.0 디자인 시스템", design_system(), 1440, 840),
    "N_Farm": ("전투(파밍) · 데스크톱", farm_d(), 1440, 1760),
    "N_FarmM": ("전투(파밍) · 모바일", farm_m(), 390, 1500),
    "N_Boss": ("층보스전 · 데스크톱", boss_d(), 1440, 960),
    "N_BossM": ("층보스전 · 모바일", boss_m(), 390, 940),
    "N_Formation": ("팝업 · 팀 편성 · 데스크톱", formation_d(), 1440, 1080),
    "N_FormationM": ("팝업 · 팀 편성 · 모바일", formation_m(), 390, 1080),
    "N_Backgrounds": ("스테이지 배경 10단계", backgrounds(), 1440, 640),
}
