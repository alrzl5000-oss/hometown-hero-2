# 2.0 design directions (시안) — 파밍 / 보스전, 3 looks.
import json
FONT_B = "/_blob/c461ab3907d4a3bf3c7c3053aeb53f6c"
FONT_R = "/_blob/04c0def786fd77a3a8d1c0e973aa1cf9"
SP = {"ssr_tank": "/_blob/bf7e28d816e5ab4125e66cc568f997d0", "n_tank": "/_blob/12472556f0b67d1578dff8d41b79e8e3",
      "sr_dps": "/_blob/67b1a0a205b3541e76013bf658e051de", "n_sup": "/_blob/12c098071b410c7e1f3337dc57d9441e",
      "xxr": "/_blob/1cd922aa54bdbfcfabfc7fbfa37c9def", "r_dps": "/_blob/c0963b2ac82fece89ed1e1d807496bda",
      "xr_asn": "/_blob/aba5f89060eae8e43c4c2d087fac123c", "hr": "/_blob/52f09a8a22dc6800087a7c069da0682f"}
MOB = {"mongrel": "/_blob/dd8cf9c234137c2a138d63003a6d7363", "shroom": "/_blob/7624f79a0fc864d131ce1c0f97a13bd7",
       "golem": "/_blob/e60a948d9f7c73cfe23cde4807f71326", "bat": "/_blob/0b54a712952421f30ea0cc33a8269405",
       "spirit": "/_blob/5980f4be2ecfd549a5e815a545d0279f", "ice": "/_blob/ae38ef56b0675654dce5b90001c6048d",
       "wolf": "/_blob/3abf50e75c00a8483d2d8980f6848583"}
BG = {"field": "/_blob/f38acccd3150eda79cc153dd69c3e8d2", "dungeon": "/_blob/c75107ee5f26b6f8064cfa40be4307f1",
      "town": "/_blob/ff997e528b2685297e72753e9a0f9de4"}
RAR = {"N": "#a3a0b0", "R": "#4f8ff7", "SR": "#a66cf2", "SSR": "#f5a623", "XR": "#ff4fae", "HR": "#ff5252", "XXR": "#36d6e6", "EX": "#ffd166"}

# 5인 팀 — 균형진(앞열 2 / 중열 2 / 뒷열 1), 2.0 formation.js 그대로
TEAM = [
    dict(sp="ssr_tank", name="유부남 박주환", rar="SSR", cls="🛡 탱커", el="🔥", row="앞열", hp=82, mp=40, star=0),
    dict(sp="n_tank", name="박주환", rar="EX", cls="🛡 탱커", el="💧", row="앞열", hp=64, mp=75, star=2),
    dict(sp="sr_dps", name="분노한김유창", rar="SR", cls="⚔ 딜러", el="🔥", row="중열", hp=91, mp=55, star=0),
    dict(sp="n_sup", name="이재훈", rar="EX", cls="✨ 서포터", el="🌪", row="중열", hp=100, mp=90, star=1),
    dict(sp="xxr", name="MINSU-DARKMAN", rar="XXR", cls="🗡 암살자", el="🌪", row="뒷열", hp=100, mp=100, star=0),
]
# 씬 안 좌표: 뒷열이 왼쪽, 앞열이 몬스터 쪽(오른쪽)
POS = [(470, 150), (440, 255), (325, 125), (300, 230), (170, 180)]
FIELD = [  # 2.0 farming.js FIELD_SPECIES 5종 (잡몹은 속성 없음)
    ("mongrel", "🐺", "들개 무리", 28), ("shroom", "🍄", "독버섯 괴물", 24), ("golem", "🪨", "돌골렘 조각", 20),
    ("bat", "🦇", "박쥐떼", 16), ("spirit", "🌿", "숲의 정령", 12)]
MOBS_ON = [("mongrel", 690, 170, 160, 80), ("shroom", 790, 95, 144, 55), ("golem", 840, 230, 128, 100), ("bat", 960, 60, 144, 35),
           ("mongrel", 980, 175, 160, 20), ("spirit", 1080, 120, 112, 90), ("shroom", 1100, 245, 144, 70), ("bat", 1180, 190, 144, 100)]


def css(t):
    return f"""
@font-face{{font-family:'Galmuri11';src:url('{FONT_B}') format('woff2');font-weight:700;font-display:block}}
@font-face{{font-family:'Galmuri11';src:url('{FONT_R}') format('woff2');font-weight:400;font-display:block}}
*{{box-sizing:border-box}}
body{{margin:0;background:{t['bg']};color:{t['text']};font-family:{t['body']};font-size:13px;-webkit-font-smoothing:antialiased}}
.pf{{font-family:'Galmuri11',monospace;font-weight:700}}
.px{{clip-path:polygon(0 4px,4px 4px,4px 0,calc(100% - 4px) 0,calc(100% - 4px) 4px,100% 4px,100% calc(100% - 4px),calc(100% - 4px) calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,4px calc(100% - 4px),0 calc(100% - 4px))}}
.sp{{image-rendering:pixelated;display:block}}
.panel{{{t['panel']}}}
.chip{{{t['chip']}}}
.btn{{display:flex;align-items:center;justify-content:center;gap:6px;font-family:'Galmuri11',monospace;font-weight:700;white-space:nowrap;border:none;cursor:pointer}}
.btn-main{{{t['btn']}}}
.btn-sub{{{t['btn2']}}}
.bar{{height:6px;background:{t['bartrack']};}}
.bar > i{{display:block;height:100%}}
.muted{{color:{t['muted']}}}
.acc{{color:{t['acc']}}}
.h{{font-family:'Galmuri11',monospace;font-weight:700;color:{t['head']}}}
.dmg{{position:absolute;font-family:'Galmuri11',monospace;font-weight:700;text-shadow:2px 2px 0 #000,-1px -1px 0 #000;white-space:nowrap}}
"""


def topbar(t):
    return f'''<header style="height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;{t['top']}">
  <div style="display:flex;align-items:center;gap:10px;">
    <span class="pf px" style="padding:5px 10px;font-size:13px;{t['lv']}">Lv.300</span>
    <span class="pf" style="font-size:15px;color:{t['head']};">GM백민수</span>
    <span class="chip" style="font-size:12px;padding:4px 10px;">스테이지 56</span>
  </div>
  <div style="display:flex;align-items:center;gap:8px;">
    <span class="chip" style="font-size:12px;padding:5px 10px;">💰 473억 7,067만</span>
    <span class="chip" style="font-size:12px;padding:5px 10px;">💎 5,837만</span>
    <span class="chip" style="font-size:12px;padding:5px 10px;">🔶 0</span>
    <button class="btn chip" aria-label="도움말" style="width:36px;height:30px;">❓</button>
    <button class="btn chip" aria-label="설정" style="width:36px;height:30px;">⚙️</button>
  </div>
</header>
<div style="padding:0 20px;{t['top2']}"><div class="bar" style="height:5px;"><i style="width:41%;background:{t['exp']};"></i></div><div class="muted" style="text-align:right;font-size:10px;padding:3px 0;">계정 경험치 27,679 / 66,423 (41%)</div></div>'''


def navbar(t, active="battle"):
    tabs = [("battle", "⚔️", "전투"), ("odyssey", "🗺️", "오디세이"), ("gacha", "🎰", "소환"), ("heroes", "📖", "영웅"), ("contents", "🏆", "콘텐츠"), ("ability", "⚡", "어빌리티")]
    items = "".join(f'<a href="#" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-decoration:none;{t["navon"] if k == active else ""}"><span style="font-size:22px;">{i}</span><span style="font-size:11px;color:{t["navtext"][0] if k == active else t["navtext"][1]};font-weight:{800 if k == active else 500};">{l}</span></a>' for k, i, l in tabs)
    return f'<nav style="position:absolute;left:0;right:0;bottom:0;height:70px;display:flex;padding:6px 140px;gap:6px;{t["nav"]}">{items}</nav>'


def unit(t, u, x, y, scale=96, label=True, cast=None):
    c = RAR[u["rar"]]
    star = f'<span style="color:#ffd166;">{"★" * u["star"]}</span>' if u["star"] else ""
    cst = f'<div class="pf" style="position:absolute;top:-26px;left:50%;transform:translateX(-50%);font-size:11px;padding:2px 7px;background:{t["acc"]};color:{t["accfg"]};white-space:nowrap;">{cast}</div>' if cast else ""
    return f'''<div style="position:absolute;left:{x/12.8:.2f}%;top:{y}px;width:{scale}px;">
  {cst}
  <img class="sp" src="{SP[u['sp']]}" alt="{u['name']}" style="width:{scale}px;height:{scale}px;filter:drop-shadow(0 4px 0 #0006);">
  <div style="width:70px;margin:0 auto;"><div class="bar" style="height:5px;border:1px solid #000;"><i style="width:{u['hp']}%;background:#5fd46e;"></i></div><div class="bar" style="height:4px;border:1px solid #000;border-top:none;"><i style="width:{u['mp']}%;background:#5d8cff;"></i></div></div>
</div>'''


def mob(key, x, y, w, hp, boss=False):
    return f'''<div style="position:absolute;left:{x/12.8:.2f}%;top:{y}px;width:{w}px;">
  <img class="sp" src="{MOB[key]}" alt="" style="width:{w}px;filter:drop-shadow(0 4px 0 #0006);">
  {'' if boss else f'<div class="bar" style="width:48px;margin:2px auto 0;height:4px;border:1px solid #000;"><i style="width:{hp}%;background:#e0473d;"></i></div>'}
</div>'''


def team_card(t, u, w=150):
    c = RAR[u["rar"]]
    star = f' <span style="color:#ffd166;">{"★" * u["star"]}</span>' if u["star"] else ""
    return f'''<div class="{t['cardcls']}" style="width:{w}px;{t['card'].replace('@c', c)}">
  <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;"><span class="pf" style="background:{c};color:#111;padding:1px 5px;">{u['rar']}{star}</span><span class="muted">{u['row']}</span></div>
  <img class="sp" src="{SP[u['sp']]}" alt="" style="width:64px;height:64px;margin:4px auto 2px;">
  <div style="font-size:12px;font-weight:800;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:{t['head']};">{u['name']}</div>
  <div class="muted" style="font-size:10.5px;text-align:center;">{u['cls']} · {u['el']}</div>
  <div class="bar" style="margin-top:6px;"><i style="width:{u['hp']}%;background:#5fd46e;"></i></div>
  <div class="bar" style="margin-top:2px;height:4px;"><i style="width:{u['mp']}%;background:#5d8cff;"></i></div>
</div>'''


def farm_scene(t, h=400):
    units = "".join(unit(t, u, x, y) for u, (x, y) in zip(TEAM, POS))
    mobs = "".join(mob(k, x, y, w, hp) for k, x, y, w, hp in MOBS_ON)
    fx = '''<div class="dmg" style="left:57.03%;top:140px;font-size:18px;color:#fff;">-12,480</div>
  <div class="dmg" style="left:66.41%;top:200px;font-size:24px;color:#ffd166;">-38,211!</div>
  <div class="dmg" style="left:78.91%;top:140px;font-size:14px;color:#9cf;">+1 처치</div>
  <div class="dmg" style="left:46.88%;top:110px;font-size:13px;color:#b7ffb0;">💰+2,108 ⭐+31</div>'''
    return f'''<div style="position:relative;height:{h}px;overflow:hidden;background:url('{t['scene']}') center bottom / cover;image-rendering:pixelated;">
  {mobs}{units}{fx}
  <div class="panel px" style="position:absolute;left:16px;top:14px;padding:8px 12px;">
    <div class="h" style="font-size:16px;">스테이지 56 <span class="muted" style="font-size:11px;font-family:inherit;">· 파밍 중 (최고 69층)</span></div>
    <div style="font-size:11px;margin-top:3px;" class="muted">진형 <b class="acc">균형진</b> 앞열 2 · 중열 2 · 뒷열 1</div>
  </div>
  <div class="panel px" style="position:absolute;right:16px;top:14px;padding:8px 12px;text-align:right;">
    <div class="muted" style="font-size:11px;">누적 처치</div><div class="h" style="font-size:22px;">12,840<span style="font-size:12px;"> 마리</span></div>
  </div>
</div>'''


def species_list(t):
    rows = "".join(f'''<div style="display:flex;align-items:center;gap:8px;padding:5px 0;"><img class="sp" src="{MOB[k]}" alt="" style="width:34px;height:24px;object-fit:contain;"><span style="flex:1;font-size:12px;">{n}</span><div class="bar" style="width:90px;"><i style="width:{p*3}%;background:{t['acc']};"></i></div><span class="pf" style="width:34px;text-align:right;font-size:11px;">{p}%</span></div>''' for k, i, n, p in FIELD)
    return f'''<div class="panel px" style="padding:14px;">
  <div style="display:flex;justify-content:space-between;align-items:baseline;"><span class="h" style="font-size:14px;">출현 몬스터</span><span class="muted" style="font-size:11px;">잡몹은 속성 없음</span></div>
  <div style="margin-top:6px;">{rows}</div></div>'''


def rate_panel(t):
    cells = [("⚔️ 분당 처치", "38마리"), ("💰 분당 골드", "1,284,300"), ("⭐ 분당 경험치", "1,178"), ("💎 다이아 (처치당)", "20% · 2,478개")]
    c = "".join(f'<div style="flex:1;min-width:0;"><div class="muted" style="font-size:11px;">{a}</div><div class="h" style="font-size:15px;margin-top:3px;white-space:nowrap;">{b}</div></div>' for a, b in cells)
    return f'''<div class="panel px" style="padding:14px;">
  <div style="display:flex;justify-content:space-between;"><span class="h" style="font-size:14px;">📊 파밍 수익 (최근 1분)</span><button class="btn btn-sub px" style="height:26px;font-size:11px;padding:0 10px;">🔄 다시 측정</button></div>
  <div style="display:flex;gap:14px;margin-top:10px;">{c}</div>
  <div class="muted" style="font-size:11px;margin-top:10px;">오프라인 중에도 최대 8시간까지 쌓여요</div></div>'''


def boss_preview(t):
    return f'''<div class="panel px" style="padding:14px;display:flex;gap:14px;align-items:center;">
  <img class="sp" src="{MOB['ice']}" alt="얼음 거인" style="width:88px;height:68px;object-fit:contain;">
  <div style="flex:1;">
    <div class="muted" style="font-size:11px;">56층 층보스</div>
    <div class="h" style="font-size:17px;">얼음 거인 <span style="font-size:12px;color:{t['info']};">💧 수속성</span></div>
    <div style="font-size:11.5px;margin-top:4px;"><b style="color:{t['good']};">🌪 풍속성 영웅 피해 ×1.25</b> · <span style="color:{t['bad']};">🔥 화속성 ×0.85</span></div>
    <div class="muted" style="font-size:11px;margin-top:2px;">보조 스킬: 비늘 강화 (피해 2회 막는 보호막)</div>
  </div>
  <button class="btn btn-main px" style="height:52px;padding:0 22px;font-size:16px;">👑 보스 도전</button>
</div>'''


def bonus_strip(t):
    chips = ["🧩 균형진 · 팀 편성", "🔗 이재훈 계보 2세트 · 공격력 +12%", "🗂 컬렉션 · 공/체/방 +45.9%", "⭐ EX 별 보너스 · +15%", "⚡ 어빌리티 프리셋 2"]
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + "".join(f'<span class="chip" style="font-size:11.5px;padding:6px 10px;">{c}</span>' for c in chips) + '</div>'


def boss_scene(t, h=430):
    units = "".join(unit(t, u, x, y, cast=("필살기!" if i == 4 else None)) for i, (u, (x, y)) in enumerate(zip(TEAM, POS)))
    return f'''<div style="position:relative;height:{h}px;overflow:hidden;background:url('{t['scene']}') center bottom / cover;image-rendering:pixelated;">
  <div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent 40%,#3a6fb033 100%);"></div>
  {mob('ice', 820, 70, 260, 0, boss=True)}
  {units}
  <div class="dmg" style="left:60.16%;top:120px;font-size:26px;color:#7be08a;">-184,220 효과적!</div>
  <div class="dmg" style="left:68.75%;top:220px;font-size:16px;color:#ffb0a0;">-21,004 (약함)</div>
  <div class="dmg" style="left:66%;top:290px;font-size:15px;color:#9cf;">🛡 보호막 1회 남음</div>
  <div class="panel px" style="position:absolute;left:16px;top:12px;width:min(560px,60%);padding:10px 14px;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;"><span class="h" style="font-size:16px;">56층 층보스 · 얼음 거인</span><span style="font-size:12px;color:#7cc8ff;">💧 수속성</span></div>
    <div class="bar" style="height:12px;margin-top:6px;border:1px solid #000;"><i style="width:63%;background:linear-gradient(90deg,#e0473d,#f4874a);"></i></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:3px;"><span>679,851 / 1,079,129</span><span style="color:#9cf;">마나 ▮▮▮▮▯ — 「비늘 강화」 준비 중</span></div>
  </div>
  <div style="position:absolute;right:16px;top:14px;display:flex;gap:6px;"><span class="chip pf" style="padding:6px 10px;font-size:12px;">▶ x1</span><span class="chip pf" style="padding:6px 10px;font-size:12px;opacity:.6;">x2</span><span class="chip pf" style="padding:6px 10px;font-size:12px;">자동 ON</span></div>
</div>'''


def battle_log(t):
    G, B_, I, Y, R = t["good"], t["text"], t["info"], t["warn"], t["bad"]
    lines = [(G, "MINSU-DARKMAN 필살기 — 184,220 (풍→수 효과적 ×1.25)"), (B_, "분노한김유창 평타 — 21,004 (화→수 약함 ×0.85)"),
             (I, "얼음 거인 「비늘 강화」 — 피해 2회 차단 보호막"), (Y, "이재훈 「응원」 — 팀 공격력 +18% (6초)"),
             (R, "얼음 거인 평타 → 박주환 -8,412")]
    return '<div class="panel px" style="padding:12px 14px;"><div class="h" style="font-size:13px;margin-bottom:6px;">전투 기록</div>' + "".join(f'<div style="font-size:11.5px;padding:3px 0;color:{c};">{s}</div>' for c, s in lines) + '</div>'


def element_card(t):
    return f'''<div class="panel px" style="padding:12px 14px;"><div class="h" style="font-size:13px;">속성 상성</div>
  <div class="pf" style="font-size:15px;margin-top:6px;">🔥 화 ▶ 🌪 풍 ▶ 💧 수 ▶ 🔥 화</div>
  <div class="muted" style="font-size:11px;margin-top:4px;">유리 ×1.25 · 불리 ×0.85 · 층보스·PvP에만 적용</div></div>'''


def doc(title, body, h):
    return f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap">
<style>
@@CSS@@
</style>
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{json.dumps({"$preview": {"width": 1280, "height": h}})}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{}};
  }}
}}
</script>
</body>
</html>
'''


def build(t):
    """returns {name: html}"""
    team = "".join(team_card(t, u, w=t.get("cardw", 150)) for u in TEAM)
    lay = t["layout"]
    if lay == "stack":     # A: 씬 → 아래 2열
        farm = f'''{topbar(t)}{farm_scene(t)}
<div style="max-width:1200px;margin:0 auto;padding:16px 0 96px;display:flex;flex-direction:column;gap:14px;">
  <div style="display:flex;justify-content:space-between;align-items:center;"><span class="h" style="font-size:15px;">파밍 팀 (5명)</span><button class="btn btn-sub px" style="height:32px;padding:0 14px;font-size:12px;">🧩 팀 편성</button></div>
  <div style="display:flex;gap:12px;justify-content:space-between;">{team}</div>
  {bonus_strip(t)}
  {boss_preview(t)}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">{rate_panel(t)}{species_list(t)}</div>
</div>'''
        boss = f'''{topbar(t)}{boss_scene(t)}
<div style="max-width:1200px;margin:0 auto;padding:16px 0 96px;display:flex;flex-direction:column;gap:14px;">
  <div style="display:flex;gap:12px;justify-content:space-between;">{team}</div>
  <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;">{battle_log(t)}{element_card(t)}</div>
</div>'''
    elif lay == "side":    # B: 씬 + 오른쪽 사이드바
        farm = f'''{topbar(t)}
<div style="display:grid;grid-template-columns:1fr 400px;gap:16px;padding:16px 20px 96px;">
  <div style="display:flex;flex-direction:column;gap:14px;">
    <div class="px" style="overflow:hidden;border:2px solid {t['line']};">{farm_scene(t, 420)}</div>
    <div style="display:flex;gap:10px;">{team}</div>
    {bonus_strip(t)}
  </div>
  <div style="display:flex;flex-direction:column;gap:14px;">{boss_preview(t).replace('display:flex;gap:14px;align-items:center;', 'display:flex;flex-wrap:wrap;gap:12px;align-items:center;')}{rate_panel(t)}{species_list(t)}</div>
</div>'''
        boss = f'''{topbar(t)}
<div style="display:grid;grid-template-columns:1fr 400px;gap:16px;padding:16px 20px 96px;">
  <div style="display:flex;flex-direction:column;gap:14px;">
    <div class="px" style="overflow:hidden;border:2px solid {t['line']};">{boss_scene(t, 440)}</div>
    <div style="display:flex;gap:10px;">{team}</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:14px;">{element_card(t)}{battle_log(t)}</div>
</div>'''
    else:                  # C: 풀블리드 씬 + 씬 위 도크
        dock = f'<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 20px;display:flex;gap:10px;justify-content:center;background:linear-gradient(180deg,transparent,#0b0a18e6 35%);">{team}</div>'
        farm = f'''{topbar(t)}
<div style="position:relative;">{farm_scene(t, 600)}{dock}</div>
<div style="max-width:1200px;margin:0 auto;padding:16px 0 96px;display:flex;flex-direction:column;gap:14px;">
  {bonus_strip(t)}
  {boss_preview(t)}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">{rate_panel(t)}{species_list(t)}</div>
</div>'''
        boss = f'''{topbar(t)}
<div style="position:relative;">{boss_scene(t, 620)}{dock}</div>
<div style="max-width:1200px;margin:0 auto;padding:16px 0 96px;display:grid;grid-template-columns:2fr 1fr;gap:14px;">{battle_log(t)}{element_card(t)}</div>'''
    H_F, H_B = t["hf"], t["hb"]
    wrap = lambda inner, h: f'<div style="position:relative;width:100%;height:{h}px;overflow:hidden;background:{t["bg"]};">{inner}{navbar(t)}</div>'
    c = css(t)
    out = {}
    for nm, inner, h, ttl in [(f"V2{t['key']}Farm", farm, H_F, f"시안 {t['key']} · 파밍"), (f"V2{t['key']}Boss", boss, H_B, f"시안 {t['key']} · 보스전")]:
        out[nm] = (doc(ttl, wrap(inner, h), h).replace("@@CSS@@", c), h, ttl)
    return out


THEMES = [
    dict(key="A", name="모험 들판", layout="stack", hf=1340, hb=1010, scene=BG["field"],
         bg="#f3e9d2", text="#3b2a1a", head="#2a1b0e", muted="#7a6650", acc="#d9792b", accfg="#fff",
         body="'Galmuri11','Noto Sans KR',sans-serif",
         panel="background:#fff8e7;border:3px solid #3b2a1a;box-shadow:inset 0 -3px 0 #e4d3ad;",
         chip="background:#fff8e7;border:2px solid #3b2a1a;color:#3b2a1a;",
         btn="background:#e8833a;color:#fff;box-shadow:inset 0 3px 0 #ffb070,inset 0 -4px 0 #a9521c;",
         btn2="background:#fff8e7;color:#3b2a1a;border:2px solid #3b2a1a;",
         bartrack="#3b2a1a33", exp="linear-gradient(90deg,#7bc86c,#3e9bd8)",
         top="background:#5b3b22;border-bottom:4px solid #3b2a1a;color:#fff;", top2="background:#5b3b22;",
         lv="background:#ffd166;color:#3b2a1a;", nav="background:#5b3b22;border-top:4px solid #3b2a1a;",
         navon="background:#7a5233;", good="#2f8a2f", bad="#c0392b", info="#2a73b8", warn="#b8741a", navtext=("#fff3d6","#e2c9a3"),
         cardcls="px", card="background:#fff8e7;border:3px solid @c;padding:8px;box-shadow:inset 0 -3px 0 #e4d3ad;",
         line="#3b2a1a"),
    dict(key="B", name="다크 네온", layout="side", hf=1080, hb=900, scene=BG["dungeon"], cardw=118,
         bg="#0b0a14", text="#e8e6f5", head="#ffffff", muted="#8f8aa8", acc="#8f7cff", accfg="#fff",
         body="'Noto Sans KR',sans-serif",
         panel="background:linear-gradient(180deg,#1a1830ee,#121022ee);border:1px solid #3b3566;box-shadow:0 0 0 1px #00000080,0 8px 24px #00000066;",
         chip="background:#15132a;border:1px solid #3b3566;color:#d7d3f0;",
         btn="background:linear-gradient(180deg,#9a88ff,#6a55f0);color:#fff;box-shadow:0 0 18px #7d6bff88,inset 0 -3px 0 #4a36c8;",
         btn2="background:#15132a;color:#d7d3f0;border:1px solid #5a52a0;",
         bartrack="#ffffff18", exp="linear-gradient(90deg,#36d6e6,#8f7cff)",
         top="background:#100e1e;border-bottom:1px solid #2c2850;", top2="background:#100e1e;",
         lv="background:linear-gradient(180deg,#36d6e6,#2a8fd0);color:#041018;", nav="background:#100e1ef0;border-top:1px solid #2c2850;",
         navon="background:#211d40;box-shadow:inset 0 -2px 0 #8f7cff;", good="#7be08a", bad="#ff8a8a", info="#8fd0ff", warn="#ffd166", navtext=("#ffffff","#a9a4c4"),
         cardcls="",
         card="background:linear-gradient(180deg,#1a1830,#121022);border:1px solid @c;box-shadow:0 0 14px @c44;padding:8px;",
         line="#3b3566"),
    dict(key="C", name="우리동네 밤거리", layout="dock", hf=1290, hb=1010, scene=BG["town"],
         bg="#14122a", text="#f3ead8", head="#fff6e0", muted="#b3a8c8", acc="#ffb547", accfg="#2a1600",
         body="'Noto Sans KR',sans-serif",
         panel="background:#211d3d;border:2px solid #ffb54755;",
         chip="background:#2a2550;border:1px solid #4a4380;color:#f3ead8;border-radius:999px;",
         btn="background:#ffb547;color:#2a1600;box-shadow:inset 0 -4px 0 #c97a10,0 0 20px #ffb54766;",
         btn2="background:#2a2550;color:#f3ead8;border:1px solid #4a4380;",
         bartrack="#ffffff22", exp="linear-gradient(90deg,#ffb547,#ff6f91)",
         top="background:#1a1733;border-bottom:2px solid #ffb54733;", top2="background:#1a1733;",
         lv="background:#ffb547;color:#2a1600;", nav="background:#1a1733f2;border-top:2px solid #ffb54733;",
         navon="background:#2a2550;border-radius:10px;", good="#7be08a", bad="#ff8a8a", info="#8fd0ff", warn="#ffd166", navtext=("#fff6e0","#c3b8d8"),
         cardcls="",
         card="background:#211d3dcc;border:2px solid @c;border-radius:10px;padding:8px;backdrop-filter:blur(2px);",
         line="#ffb54755"),
]


def all_files():
    out = {}
    for t in THEMES:
        out.update(build(t))
    return out
