# 2.0 디자인 시스템 "Nocturne" — 시안 B(다크)를 세련되게 다듬은 최종 테마
import json
from v2b import SP, MOB, RAR, TEAM, FIELD, BGT, TIERS, STAGE, MAXST, SCENE, POS, MOBS_ON, MPOS, MMOBS

FONT_B = "/_blob/c461ab3907d4a3bf3c7c3053aeb53f6c"   # Galmuri11 Bold — 전투 숫자/스테이지 번호에만
RARC = {"N": "#9AA3B8", "R": "#4F8FF7", "SR": "#A66CF2", "SSR": "#F5B83D", "XR": "#FF5FB4", "HR": "#FF5A5A", "XXR": "#3FE0EE", "EX": "#F7C35F"}

CSS = """
@font-face{font-family:'Galmuri11';src:url('%s') format('woff2');font-weight:700;font-display:block}
:root{
  --bg:#07090f; --s1:#0e1320; --s2:#141b2b; --s3:#1b2438; --s4:#232e46;
  --st:rgba(255,255,255,.07); --st2:rgba(255,255,255,.13); --hi:rgba(255,255,255,.06);
  --t1:#eef2ff; --t2:#a8b1c9; --t3:#6f7893;
  --p1:#7c5cff; --p2:#4f8bff; --mint:#34e3b0; --gold:#f7c35f; --red:#ff5c7a; --sky:#6cc6ff;
  --r:14px; --r2:10px;
}
*{box-sizing:border-box}
a{text-decoration:none;color:inherit}
body{margin:0;background:var(--bg);color:var(--t1);font-family:'IBM Plex Sans KR','Noto Sans KR',sans-serif;font-size:13px;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.app{position:relative;width:100%%;overflow:hidden;background:radial-gradient(1200px 500px at 70%% -10%%,#1a2346 0%%,transparent 60%%),radial-gradient(900px 400px at 0%% 0%%,#1d1535 0%%,transparent 55%%),var(--bg)}
.num{font-family:'Galmuri11',monospace;font-weight:700;letter-spacing:0}
.h1{font-size:22px;font-weight:700;letter-spacing:-.02em}
.h2{font-size:17px;font-weight:700;letter-spacing:-.02em}
.h3{font-size:14px;font-weight:700}
.t2{color:var(--t2)} .t3{color:var(--t3)} .gold{color:var(--gold)} .mint{color:var(--mint)} .red{color:var(--red)} .sky{color:var(--sky)}
.card{background:linear-gradient(180deg,var(--s2),var(--s1));border:1px solid var(--st);border-radius:var(--r);box-shadow:inset 0 1px 0 var(--hi),0 12px 32px rgba(0,0,0,.35)}
.card.pad{padding:16px}
.well{background:rgba(0,0,0,.22);border:1px solid var(--st);border-radius:var(--r2)}
.sec{display:flex;align-items:center;justify-content:space-between;gap:10px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:40px;padding:0 16px;border-radius:12px;font:inherit;font-weight:700;font-size:13.5px;color:var(--t1);border:1px solid var(--st2);background:var(--s3);cursor:pointer;white-space:nowrap;box-shadow:inset 0 1px 0 var(--hi)}
.btn.sm{height:32px;padding:0 12px;font-size:12.5px;border-radius:10px}
.btn.lg{height:52px;padding:0 22px;font-size:16px;border-radius:14px}
.btn.pri{border:none;background:linear-gradient(135deg,#8a6bff 0%%,#5b7cff 55%%,#3fa2ff 100%%);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 8px 24px rgba(92,110,255,.45)}
.btn.gold{border:none;color:#2a1b00;background:linear-gradient(135deg,#ffe08a,#f5b33d);box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 8px 24px rgba(245,179,61,.35)}
.btn.ghost{background:transparent}
.btn.danger{color:var(--red);border-color:rgba(255,92,122,.35);background:rgba(255,92,122,.08)}
.ibtn{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:12px;border:1px solid var(--st2);background:var(--s2);color:var(--t2);cursor:pointer}
.chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:999px;border:1px solid var(--st2);background:rgba(255,255,255,.03);font-size:12px;color:var(--t2);white-space:nowrap}
.chip.on{color:#fff;border-color:rgba(124,92,255,.6);background:rgba(124,92,255,.18)}
.chip.pos{color:var(--mint);border-color:rgba(52,227,176,.35);background:rgba(52,227,176,.08)}
.seg{display:inline-flex;padding:4px;gap:4px;border-radius:12px;background:rgba(0,0,0,.3);border:1px solid var(--st)}
.seg > span{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 14px;border-radius:9px;font-size:12.5px;font-weight:600;color:var(--t2)}
.seg > span.on{background:var(--s4);color:#fff;box-shadow:inset 0 1px 0 var(--hi),0 2px 8px rgba(0,0,0,.4)}
.seg.full{display:flex} .seg.full > span{flex:1}
.bar{height:6px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
.bar > i{display:block;height:100%%;border-radius:99px}
.hp{background:linear-gradient(90deg,#34e3b0,#7ff0c8)} .mp{background:linear-gradient(90deg,#4f8bff,#8fb4ff)} .xp{background:linear-gradient(90deg,#8a6bff,#3fa2ff)}
.bhp{background:linear-gradient(90deg,#ff5c7a,#ff9a6b)}
.row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--st);font-size:13px}
.row:last-child{border-bottom:none}
.row b{font-weight:700}
.badge{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;font-size:11px;font-weight:800;color:#0b0e17;background:var(--c)}
.notice{border-radius:12px;padding:10px 12px;font-size:12px;line-height:1.6;border:1px solid rgba(247,195,95,.28);background:rgba(247,195,95,.07);color:#f3dca6}
.notice.mint{border-color:rgba(52,227,176,.28);background:rgba(52,227,176,.07);color:#b9f5df}
.tip{font-size:12px;line-height:1.65;color:var(--t2)}
.sp{image-rendering:pixelated;display:block}
.scene{position:relative;overflow:hidden;image-rendering:pixelated;background-size:cover;background-position:center bottom}
.scene:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,9,15,.35),transparent 30%%,transparent 70%%,rgba(7,9,15,.55));pointer-events:none}
.glass{background:rgba(10,14,26,.62);backdrop-filter:blur(10px);border:1px solid var(--st2);border-radius:12px}
.dmg{position:absolute;z-index:3;font-family:'Galmuri11',monospace;font-weight:700;text-shadow:0 2px 0 #000,0 0 10px rgba(0,0,0,.6);white-space:nowrap}
.hex{width:42px;height:48px;clip-path:polygon(50%% 0,100%% 25%%,100%% 75%%,50%% 100%%,0 75%%,0 25%%);display:flex;align-items:center;justify-content:center;font-family:'Galmuri11',monospace;font-weight:700;font-size:13px;flex:0 0 auto}
.hs{overflow-x:auto;scrollbar-width:none}
.scrim{position:absolute;inset:0;background:rgba(3,5,10,.72);backdrop-filter:blur(3px);z-index:20}
.modal{position:absolute;left:50%%;transform:translateX(-50%%);z-index:21;background:linear-gradient(180deg,#151c2e,#0e1320);border:1px solid var(--st2);border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 var(--hi);padding:22px;display:flex;flex-direction:column;gap:14px}
.modal > *{flex-shrink:0}
.sheet{position:absolute;left:0;right:0;bottom:0;z-index:21;background:linear-gradient(180deg,#151c2e,#0e1320);border-top:1px solid var(--st2);border-radius:22px 22px 0 0;box-shadow:0 -20px 60px rgba(0,0,0,.6);padding:10px 16px 24px;display:flex;flex-direction:column;gap:12px}
.sheet > *{flex-shrink:0}
.grab{width:40px;height:4px;border-radius:9px;background:rgba(255,255,255,.2);margin:0 auto 4px}
.x{position:absolute;top:16px;right:16px}
.ring{border-radius:16px;padding:2px;background:linear-gradient(160deg,var(--c),rgba(255,255,255,.04) 60%%)}
.ring > div{border-radius:14px;background:radial-gradient(circle at 50%% 35%%,color-mix(in srgb,var(--c) 30%%,#141b2b),#0e1320 75%%);overflow:hidden}
""" % FONT_B

# ------------------------------------------------------------------ icons (stroke SVG, currentColor)
P = {
 "sword": '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/>',
 "map": '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
 "spark": '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="M19 3v4M17 5h4"/>',
 "users": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 6"/>',
 "trophy": '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4"/>',
 "zap": '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
 "gear": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 "help": '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
 "plus": '<path d="M12 5v14M5 12h14"/>',
 "chev": '<path d="m9 18 6-6-6-6"/>', "chevl": '<path d="m15 18-6-6 6-6"/>', "down": '<path d="m6 9 6 6 6-6"/>',
 "refresh": '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
 "crown": '<path d="m2 7 5 5 5-7 5 7 5-5-2 12H4z"/>',
 "shield": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
 "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 "ff": '<path d="m13 19 9-7-9-7zM2 19l9-7-9-7z"/>',
 "lock": '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 "star": '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
 "x": '<path d="M18 6 6 18M6 6l12 12"/>',
 "dice": '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/><circle cx="8.5" cy="15.5" r="1"/>',
 "layers": '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
 "chart": '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
 "bag": '<path d="M6 7h12l1 14H5z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
 "logout": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
 "trash": '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
 "doc": '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
 "target": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 "flame": '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-7 6-7 12 0 4 2 7 5 7z"/>',
 "drop": '<path d="M12 2s7 7.5 7 13a7 7 0 0 1-14 0c0-5.5 7-13 7-13z"/>',
 "wind": '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
 "bolt2": '<path d="M4 14 14 3v7h6L10 21v-7z"/>',
 "swap": '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
 "eye": '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 "gift": '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8S10 3 7.5 4.5 9 8 12 8zm0 0s2-5 4.5-3.5S15 8 12 8z"/>',
 "moon": '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
 "up": '<path d="m18 15-6-6-6 6"/>',
 "check": '<path d="M20 6 9 17l-5-5"/>',
}
def ic(name, s=18, c="currentColor", w=1.9):
    return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{P[name]}</svg>'

# 재화 아이콘 (작은 채색 SVG)
COIN = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#f5b33d"/><circle cx="8" cy="8" r="4.6" fill="none" stroke="#ffe08a" stroke-width="1.4"/></svg>'
GEM = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6 5.5 2.5h5L13 6l-5 7.5z" fill="#57c8ff"/><path d="M3 6h10M5.5 2.5 8 6l2.5-3.5M8 6v7.5" stroke="#b9ecff" stroke-width=".9" fill="none"/></svg>'
STONE = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 14 8l-6 6.5L2 8z" fill="#ff9a3d"/><path d="M8 4 11 8l-3 3.5L5 8z" fill="#ffd29a"/></svg>'
EL = {"🔥": ("flame", "#ff7a4d", "화"), "💧": ("drop", "#4fb4ff", "수"), "🌪": ("wind", "#4fe3a1", "풍")}
def el(sym, s=13, label=False):
    n, c, l = EL[sym]
    return f'<span style="display:inline-flex;align-items:center;gap:3px;color:{c};">{ic(n, s, c, 2.2)}{l if label else ""}</span>'
CLS = {"🛡 탱커": ("shield", "탱커"), "⚔ 딜러": ("sword", "딜러"), "✨ 서포터": ("spark", "서포터"), "🗡 암살자": ("target", "암살자"), "🏹 원거리": ("target", "원거리")}
def cls(label, s=12):
    n, l = CLS[label]
    return f'<span style="display:inline-flex;align-items:center;gap:3px;">{ic(n, s)}{l}</span>'

# ------------------------------------------------------------------ chrome
NAV = [("battle", "sword", "전투", "N_Farm"), ("odyssey", "map", "오디세이", "N_Odyssey"), ("gacha", "spark", "소환", "N_Gacha"),
       ("heroes", "users", "영웅", "N_Heroes"), ("contents", "trophy", "콘텐츠", "N_Contents"), ("ability", "zap", "어빌리티", "N_Ability")]

def topbar_d(title, sub=""):
    return f'''<header style="height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 28px 0 112px;border-bottom:1px solid var(--st);background:linear-gradient(180deg,rgba(14,19,32,.85),rgba(7,9,15,.4));position:relative;z-index:5;">
  <div><div class="h1">{title}</div>{f'<div class="t3" style="font-size:12px;margin-top:2px;">{sub}</div>' if sub else ''}</div>
  <div style="display:flex;align-items:center;gap:8px;">
    <span class="chip" style="height:34px;padding:0 12px;color:var(--t1);font-weight:600;">{COIN} 473억 7,067만<span class="t3" style="margin-left:2px;">{ic("plus",13)}</span></span>
    <span class="chip" style="height:34px;padding:0 12px;color:var(--t1);font-weight:600;">{GEM} 5,837만<span class="t3" style="margin-left:2px;">{ic("plus",13)}</span></span>
    <span class="chip" style="height:34px;padding:0 12px;color:var(--t1);font-weight:600;">{STONE} 0</span>
    <span style="width:1px;height:26px;background:var(--st2);margin:0 4px;"></span>
    <a href="N_Welcome.dc.html" class="ibtn" aria-label="도움말">{ic("help")}</a>
    <a href="N_Settings.dc.html" class="ibtn" aria-label="설정">{ic("gear")}</a>
  </div>
</header>'''

def rail_d(active):
    items = "".join(f'''<a href="{f}.dc.html" style="display:flex;flex-direction:column;align-items:center;gap:5px;padding:11px 0;border-radius:14px;text-decoration:none;color:{'#fff' if k == active else 'var(--t3)'};{'background:linear-gradient(160deg,rgba(124,92,255,.28),rgba(79,139,255,.12));box-shadow:inset 0 0 0 1px rgba(124,92,255,.45);' if k == active else ''}">{ic(i, 22)}<span style="font-size:11px;font-weight:{700 if k == active else 500};">{l}</span></a>''' for k, i, l, f in NAV)
    return f'''<aside style="position:absolute;left:0;top:0;bottom:0;width:88px;z-index:6;background:linear-gradient(180deg,#0c1120,#080b14);border-right:1px solid var(--st);display:flex;flex-direction:column;align-items:stretch;padding:14px 10px;gap:6px;">
  <div style="position:relative;width:56px;height:56px;margin:0 auto 4px;border-radius:50%;background:conic-gradient(#8a6bff 0 41%,rgba(255,255,255,.1) 41% 100%);padding:3px;">
    <div style="width:100%;height:100%;border-radius:50%;background:#141b2b;overflow:hidden;"><img class="sp" src="{SP['xr_asn']}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:50% 10%;transform:scale(1.6) translateY(8px);"></div>
    <span class="num" style="position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);font-size:10px;padding:1px 6px;border-radius:6px;background:linear-gradient(135deg,#ffe08a,#f5b33d);color:#2a1b00;">300</span>
  </div>
  <div style="text-align:center;font-size:11px;font-weight:700;margin:6px 0 10px;">GM백민수</div>
  {items}
</aside>'''

def topbar_m(title=None):
    return f'''<header style="padding:10px 14px 8px;position:relative;z-index:5;background:linear-gradient(180deg,rgba(14,19,32,.95),rgba(14,19,32,.6));border-bottom:1px solid var(--st);">
  <div class="sec">
    <div style="display:flex;align-items:center;gap:9px;">
      <div style="position:relative;width:36px;height:36px;border-radius:50%;background:conic-gradient(#8a6bff 0 41%,rgba(255,255,255,.1) 41% 100%);padding:2px;"><div style="width:100%;height:100%;border-radius:50%;background:#141b2b;overflow:hidden;"><img class="sp" src="{SP['xr_asn']}" alt="" style="width:100%;height:100%;transform:scale(1.6) translateY(5px);"></div></div>
      <div><div style="font-size:13px;font-weight:700;">{title or "GM백민수"}</div><div class="t3" style="font-size:10.5px;">Lv.300 · 경험치 41%</div></div>
    </div>
    <div style="display:flex;gap:6px;"><a href="N_Welcome.dc.html" class="ibtn" style="width:34px;height:34px;" aria-label="도움말">{ic("help",17)}</a><a href="N_Settings.dc.html" class="ibtn" style="width:34px;height:34px;" aria-label="설정">{ic("gear",17)}</a></div>
  </div>
  <div style="display:flex;gap:6px;margin-top:9px;"><span class="chip" style="color:var(--t1);">{COIN}473억</span><span class="chip" style="color:var(--t1);">{GEM}5,837만</span><span class="chip" style="color:var(--t1);">{STONE}0</span></div>
</header>'''

def tabbar_m(active):
    items = "".join(f'''<a href="{f}M.dc.html" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-decoration:none;border-radius:14px;color:{'#fff' if k == active else 'var(--t3)'};{'background:linear-gradient(160deg,rgba(124,92,255,.3),rgba(79,139,255,.12));' if k == active else ''}">{ic(i, 21)}<span style="font-size:10px;font-weight:{700 if k == active else 500};">{l}</span></a>''' for k, i, l, f in NAV)
    return f'<nav style="position:absolute;left:10px;right:10px;bottom:12px;height:62px;z-index:8;display:flex;gap:2px;padding:5px;border-radius:20px;background:rgba(12,16,28,.92);backdrop-filter:blur(12px);border:1px solid var(--st2);box-shadow:0 10px 30px rgba(0,0,0,.5);">{items}</nav>'

def doc(title, body, w, h):
    dp = {"$preview": {"width": w, "height": h}}
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;700;900&display=swap">
<style>
{CSS}
</style>
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{json.dumps(dp)}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{}};
  }}
}}
</script>
</body>
</html>
'''

def screen_d(title, sub, active, inner, h):
    return f'<div class="app" style="height:{h}px;">{rail_d(active)}{topbar_d(title, sub)}<main style="padding:22px 28px 40px 112px;">{inner}</main></div>'

def screen_m(active, inner, h, title=None):
    return f'<div class="app" style="height:{h}px;">{topbar_m(title)}<main style="padding:12px 12px 100px;">{inner}</main>{tabbar_m(active)}</div>'

def backdrop(name, h):
    return f'<div style="position:absolute;inset:0;pointer-events:none;"><dc-import name="{name}" hint-size="100%,{h}px"></dc-import></div>'

def modal(inner, w=480, top=90, h=None):
    hh = f"max-height:{h}px;overflow:hidden;" if h else ""
    return f'<div class="scrim"></div><div class="modal" style="top:{top}px;width:{w}px;{hh}"><a class="ibtn x" style="width:34px;height:34px;" aria-label="닫기">{ic("x",16)}</a>{inner}</div>'

def sheet(inner, top=None):
    t = f"top:{top}px;" if top else ""
    return f'<div class="scrim"></div><div class="sheet" style="{t}"><div class="grab"></div>{inner}</div>'

# ------------------------------------------------------------------ shared bits
def portrait(sp, rar, s=64, extra=""):
    c = RARC[rar]
    return f'<div class="ring" style="--c:{c};width:{s + 4}px;{extra}"><div style="width:{s}px;height:{s}px;"><img class="sp" src="{SP[sp]}" alt="" style="width:100%;height:100%;"></div></div>'

def bar(pct, cls_, h=6):
    return f'<div class="bar" style="height:{h}px;"><i class="{cls_}" style="width:{pct}%;"></i></div>'

def rarity_badge(r, star=0):
    s = f' {"★" * star}' if star else ""
    return f'<span class="badge" style="--c:{RARC[r]};">{r}{s}</span>'
