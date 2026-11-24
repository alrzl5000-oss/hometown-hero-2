# 1.0과 확실히 다른 테마 3종 — 색 · 버튼 모양 · 스테이지 선택 모양까지 전부 다르게
# 기존 화면 생성 코드(ds/n_battle/n_screens)는 그대로 두고, 테마별 CSS 덮어쓰기 + 색 문자열 치환으로 입힌다.

BASE_COLORS = ["#8a6bff", "#5b7cff", "#3fa2ff", "rgba(124,92,255", "rgba(79,139,255", "rgba(92,110,255", "#b9a8ff", "#1a2346", "#1d1535", "#0c1120", "#080b14", "rgba(14,19,32,", "rgba(12,16,28,", "#141b2b", "#151c2e"]

THEMES = {
  # ---------------------------------------------------------------- A: 따뜻한 대장간 (어두운 갈색 + 주황, 두툼한 3D 버튼, 길 위 메달 스테이지)
  "A": dict(name="Ember · 대장간", stage="route", map={
      "#8a6bff": "#ff7a3d", "#5b7cff": "#ff9a3d", "#3fa2ff": "#ffc04d", "rgba(124,92,255": "rgba(255,122,61", "rgba(79,139,255": "rgba(255,170,70",
      "rgba(92,110,255": "rgba(255,122,61", "#b9a8ff": "#ffc08a", "#1a2346": "#3b1c0e", "#1d1535": "#2a170c", "#0c1120": "#1c1512", "#080b14": "#130f0c",
      "rgba(14,19,32,": "rgba(28,21,18,", "rgba(12,16,28,": "rgba(26,20,16,", "#141b2b": "#2a201a", "#151c2e": "#241c17"},
    css="""
:root{--bg:#120e0b;--s1:#1b1512;--s2:#231b16;--s3:#2e241d;--s4:#3a2d24;--st:rgba(255,214,170,.08);--st2:rgba(255,214,170,.15);--hi:rgba(255,230,200,.07);
 --t1:#fdf4ea;--t2:#cdb9a5;--t3:#8f7a68;--p1:#ff7a3d;--p2:#ffb347;--mint:#8fe07a;--gold:#ffd166;--red:#ff5d5d;--sky:#7fd3ff;
 --pg:linear-gradient(180deg,#ffb347,#ff7a3d);--on-p:#2b1200;--p-soft:rgba(255,122,61,.25);--p-glow:rgba(255,122,61,.55)}
.card{border-radius:18px;background:linear-gradient(180deg,#241c17,#1b1512);border:1px solid rgba(255,214,170,.1)}
.btn{border-radius:12px;background:#33281f;border:1px solid rgba(255,214,170,.14);box-shadow:inset 0 1px 0 rgba(255,230,200,.08),0 3px 0 #120d0a}
.btn.pri{color:#2b1200;background:linear-gradient(180deg,#ffb347,#ff7a3d);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 4px 0 #b2481c,0 10px 24px rgba(255,122,61,.35)}
.btn.lg{border-radius:14px}
.seg{border-radius:14px;background:#140f0c}
.seg > span.on{background:linear-gradient(180deg,#ffb347,#ff7a3d);color:#2b1200}
.chip{border-radius:10px}
.chip.on{color:#ffd9b8;border-color:rgba(255,122,61,.55);background:rgba(255,122,61,.16)}
.xp{background:linear-gradient(90deg,#ff7a3d,#ffc04d)} .hp{background:linear-gradient(90deg,#8fe07a,#c4f28a)} .mp{background:linear-gradient(90deg,#4fb4ff,#9ad7ff)}
.notice{background:rgba(255,209,102,.08)}
"""),
  # ---------------------------------------------------------------- B: 밝은 하늘 (화이트 라이트 테마, 알약 버튼, 숫자 알약 스테이지)
  "B": dict(name="Daylight · 밝은 하늘", stage="pills", map={
      "#8a6bff": "#2563eb", "#5b7cff": "#2f6df6", "#3fa2ff": "#3b82f6", "rgba(124,92,255": "rgba(37,99,235", "rgba(79,139,255": "rgba(59,130,246",
      "rgba(92,110,255": "rgba(37,99,235", "#b9a8ff": "#2563eb", "#1a2346": "#dbe7ff", "#1d1535": "#e9f1ff", "#0c1120": "#ffffff", "#080b14": "#f6f8fc",
      "rgba(14,19,32,": "rgba(255,255,255,", "rgba(12,16,28,": "rgba(255,255,255,", "#141b2b": "#e7edf7", "#151c2e": "#ffffff", "rgba(7,9,15,.4)": "rgba(255,255,255,.7)"},
    css="""
:root{--bg:#eef2f8;--s1:#ffffff;--s2:#ffffff;--s3:#f1f4f9;--s4:#e5ebf4;--st:rgba(15,23,42,.08);--st2:rgba(15,23,42,.13);--hi:rgba(255,255,255,.9);
 --t1:#0f172a;--t2:#475569;--t3:#94a3b8;--p1:#2563eb;--p2:#3b82f6;--mint:#059669;--gold:#d97706;--red:#e11d48;--sky:#0284c7;
 --pg:#2563eb;--on-p:#ffffff;--p-soft:rgba(37,99,235,.15);--p-glow:rgba(37,99,235,.35)}
body{color:var(--t1)}
.app{background:radial-gradient(1200px 500px at 70% -10%,#dbe7ff 0%,transparent 60%),linear-gradient(180deg,#f5f8fc,#eaf0f8)}
.card{background:#fff;border:1px solid rgba(15,23,42,.07);border-radius:20px;box-shadow:0 1px 2px rgba(15,23,42,.05),0 10px 30px rgba(15,23,42,.07)}
.well{background:#f6f8fb;border:1px solid rgba(15,23,42,.06)}
.btn{border-radius:999px;background:#fff;color:#0f172a;border:1px solid rgba(15,23,42,.12);box-shadow:0 1px 2px rgba(15,23,42,.06)}
.btn.pri{border-radius:999px;background:#2563eb;color:#fff;border:none;box-shadow:0 8px 20px rgba(37,99,235,.3)}
.btn.gold{border-radius:999px;background:#f59e0b;color:#fff}
.btn.sm,.btn.lg{border-radius:999px}
.ibtn{background:#fff;color:#475569;border-color:rgba(15,23,42,.12);border-radius:999px}
.seg{background:#eef2f7;border-color:transparent;border-radius:999px}
.seg > span{border-radius:999px;color:#64748b}
.seg > span.on{background:#fff;color:#0f172a;box-shadow:0 1px 3px rgba(15,23,42,.15)}
.chip{background:#fff;border-color:rgba(15,23,42,.12);color:#475569}
.chip.on{color:#1d4ed8;border-color:rgba(37,99,235,.35);background:#eff5ff}
.chip.pos{color:#047857;border-color:rgba(5,150,105,.3);background:#ecfdf5}
.bar{background:#e2e8f0}
.xp{background:#2563eb} .hp{background:#10b981} .mp{background:#60a5fa} .bhp{background:linear-gradient(90deg,#f43f5e,#fb923c)}
.notice{background:#fff7e6;border-color:#fde3b0;color:#92400e}
.notice.mint{background:#ecfdf5;border-color:#bbf0d6;color:#065f46}
.glass{background:rgba(255,255,255,.88);border-color:rgba(15,23,42,.08);color:#0f172a}
.row{border-bottom-color:rgba(15,23,42,.07)}
aside a[style*="inset 0 0 0 1px"]{background:#2563eb !important;box-shadow:0 8px 18px rgba(37,99,235,.3) !important;color:#fff !important}
nav a[style*="160deg"]{background:#2563eb !important;color:#fff !important}
.ring > div{background:radial-gradient(circle at 50% 35%,color-mix(in srgb,var(--c) 22%,#ffffff),#e8eef7 80%)}
.scene a.btn{background:rgba(255,255,255,.92) !important;color:#0f172a !important}
"""),
  # ---------------------------------------------------------------- C: 비취 밤 (짙은 초록 + 라임, 비스듬히 잘린 버튼·카드, 칼날 타일 스테이지)
  "C": dict(name="Jade · 비취 밤", stage="blade", map={
      "#8a6bff": "#22c55e", "#5b7cff": "#4ade80", "#3fa2ff": "#a3e635", "rgba(124,92,255": "rgba(34,197,94", "rgba(79,139,255": "rgba(163,230,53",
      "rgba(92,110,255": "rgba(34,197,94", "rgba(138,107,255": "rgba(34,197,94", "rgba(63,224,238": "rgba(163,230,53", "#b9a8ff": "#86efac", "#1a2346": "#0f3b2a", "#1d1535": "#0b2a24", "#0c1120": "#0a1814", "#080b14": "#06110e",
      "rgba(14,19,32,": "rgba(10,24,20,", "rgba(12,16,28,": "rgba(9,22,18,", "#141b2b": "#12241f", "#151c2e": "#10221d"},
    css="""
:root{--bg:#06100d;--s1:#0b1915;--s2:#10221d;--s3:#163029;--s4:#1e3d34;--st:rgba(170,255,210,.08);--st2:rgba(170,255,210,.15);--hi:rgba(200,255,230,.06);
 --t1:#ecfff6;--t2:#a3c9ba;--t3:#5f8a7b;--p1:#22c55e;--p2:#a3e635;--mint:#a3e635;--gold:#facc15;--red:#fb7185;--sky:#67e8f9;
 --pg:linear-gradient(120deg,#22c55e,#a3e635);--on-p:#052e16;--p-soft:rgba(34,197,94,.22);--p-glow:rgba(163,230,53,.45)}
.card{border-radius:0;clip-path:polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px);background:linear-gradient(160deg,#122a23,#0b1915)}
.well{border-radius:0;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.btn{border-radius:0;clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%);padding:0 22px;background:#183a30;border:none}
.btn.pri{color:#052e16;background:linear-gradient(120deg,#22c55e,#a3e635);box-shadow:none}
.btn.gold{background:linear-gradient(120deg,#facc15,#fde047)}
.ibtn{border-radius:0;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.seg{border-radius:0;background:#081511}
.seg > span{border-radius:0;clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)}
.seg > span.on{background:linear-gradient(120deg,#22c55e,#a3e635);color:#052e16}
.chip{border-radius:0;clip-path:polygon(7px 0,100% 0,calc(100% - 7px) 100%,0 100%);padding:0 14px}
.chip.on{color:#d9ffb0;border-color:rgba(163,230,53,.5);background:rgba(163,230,53,.14)}
.bar{border-radius:0} .bar > i{border-radius:0}
.xp{background:linear-gradient(90deg,#22c55e,#a3e635)} .hp{background:#a3e635} .mp{background:#67e8f9}
.notice{border-radius:0}
.ring{border-radius:0;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)} .ring > div{border-radius:0}
"""),
}


def apply_theme(html, key):
    t = THEMES[key]
    for a, b in t["map"].items():
        html = html.replace(a, b)
    return html.replace("</style>\n</helmet>", t["css"] + "\n</style>\n</helmet>", 1)
