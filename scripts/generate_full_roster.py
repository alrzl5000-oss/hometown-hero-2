"""
102명 전체 로스터 도트 생성 — scripts/roster.json(서버 ROSTER 덤프)을 읽어
art_characters/<id>_<rarity>.png(576×576)와 등급별 QA 시트 art_characters/_sheet_<rarity>.png를 만든다.

roster.json 다시 만들기:
  node -e 'import("./server/data/characters.js").then(m=>require("fs").writeFileSync("scripts/roster.json",JSON.stringify(m.ROSTER.map(c=>({id:c.id,name:c.name,class:c.class,rarity:c.rarity,element:c.element})))))'
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
from pixel_sprite_gen import render

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "art_characters")
os.makedirs(OUT, exist_ok=True)
roster = json.load(open(os.path.join(ROOT, "scripts", "roster.json"), encoding="utf-8"))

by_rarity = {}
for c in roster:
    im = render(c["class"], c["rarity"], c.get("element"), c["id"])
    im.save(os.path.join(OUT, f"{c['id']}_{c['rarity']}.png"))
    by_rarity.setdefault(c["rarity"], []).append((c, im))

try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", 14)
except Exception:
    font = ImageFont.load_default()
for rar, items in by_rarity.items():
    cols = 8; cell = 150; rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell, rows * (cell + 24)), (24, 22, 36, 255))
    d = ImageDraw.Draw(sheet)
    for i, (c, im) in enumerate(items):
        x, y = (i % cols) * cell, (i // cols) * (cell + 24)
        t = im.resize((cell - 10, cell - 10), Image.NEAREST)
        sheet.paste(t, (x + 5, y + 5), t)
        d.text((x + 6, y + cell - 4), f"{c['id']} {c['name']}"[:14], fill=(230, 230, 240), font=font)
    sheet.save(os.path.join(OUT, f"_sheet_{rar}.png"))
print(f"{len(roster)}명 생성 완료 → {OUT}")
