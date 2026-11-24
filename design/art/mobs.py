# 2.0 field / boss monsters — hand-placed pixel grids rendered with Pillow (no paid APIs).
from PIL import Image
OUT = "/tmp/claude-0/-home-claude/025c504b-4bb5-5716-9fa6-a39e1e42418b/scratchpad/v2art/"
def render(rows, pal, name, scale=8):
    h = len(rows); w = max(len(r) for r in rows)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ".": im.putpixel((x, y), pal[c])
    im.save(OUT + name + "_px.png")
    im.resize((w * scale, h * scale), Image.NEAREST).save(OUT + name + ".png")

K = (28, 20, 30, 255)
# 들개 무리 (mongrel) — facing left
render([
"....................",
"..kk................",
".kBBk...............",
"kBBBBk..............",
"kBwkBBkkkkkkkk......",
"kBBBBBBBBBBBBBk..k..",
".kkBBBBBBBBBBBBkkBk.",
"..kBbBBBBBBBBBBBBk..",
"..kBBbbbbbBBBBBBk...",
"..kBBk.kBBk.kBBk....",
"..kBk..kBk..kBk.....",
"..kkk..kkk..kkk.....",
], {"k": K, "B": (150, 110, 72, 255), "b": (205, 170, 120, 255), "w": (250, 220, 90, 255)}, "mob_mongrel")
# 독버섯 괴물
render([
"......kkkkkk......",
"....kkRRRRRRkk....",
"...kRRwwRRRwwRk...",
"..kRRRwwRRRRRRRk..",
"..kRRRRRRRwwRRRk..",
".kRwwRRRRRRwwRRRk.",
".kkkkkkkkkkkkkkkk.",
"....kSSSSSSSSk....",
"....kSekSSekSk....",
"....kSkkSSkkSk....",
"....kSSSmmSSSk....",
"...kSSSSSSSSSSk...",
"...kkkk....kkkk...",
], {"k": K, "R": (170, 60, 150, 255), "w": (245, 210, 240, 255), "S": (238, 225, 200, 255), "e": (255, 255, 255, 255), "m": (120, 40, 60, 255)}, "mob_shroom")
# 돌골렘 조각
render([
".....kkkkk......",
"....kGGGGGk.....",
"...kGgGGGGGk....",
"..kGGGGkyGGGkk..",
"..kGGGGGGGGGGGk.",
".kGGmGGGGGGGgGk.",
".kGGGGGGGmGGGGk.",
".kgGGGGGGGGGGk..",
"..kkGGk..kGGk...",
"...kkkk..kkkk...",
], {"k": K, "G": (128, 122, 132, 255), "g": (92, 86, 98, 255), "y": (120, 230, 255, 255), "m": (96, 150, 80, 255)}, "mob_golem")
# 박쥐떼 (2마리)
render([
"k.........k.......",
"kk.......kk.......",
"kWk.kk..kWk.......",
"kWWkWWkkWWk.......",
".kWWWWWWWk....k..k",
"..kWrWrWk....kWkkW",
"...kWWWk.....kWWWW",
"....kkk.......kWrr",
"...............kkk",
], {"k": K, "W": (90, 70, 120, 255), "r": (255, 80, 90, 255)}, "mob_bat")
# 숲의 정령
render([
"......kk......",
".....kLLk.....",
"..kk.kLLk.kk..",
".kLLkkLLkkLLk.",
"..kLLLLLLLLk..",
"...kLwLLwLk...",
"...kLkLLkLk...",
"...kLLLLLLk...",
"....kLllLk....",
".....kLLk.....",
"......kk......",
], {"k": (20, 50, 30, 255), "L": (110, 210, 120, 255), "l": (60, 150, 80, 255), "w": (255, 255, 230, 255)}, "mob_spirit")
# 얼음 거인 (boss, water)
render([
"........kkkkkk........",
".......kIIIIIIk.......",
"......kIiIIIIiIk......",
"......kIbkIIbkIk......",
"......kIIIIIIIIk......",
"...kkkkIIiiiiIIkkkk...",
"..kIIIkkIIIIIIkkIIIk..",
".kIIiIIIIIIIIIIIIiIIk.",
".kIIIIkIIIIIIIIkIIIIk.",
".kIiIIkIIIiIIIIkIIiIk.",
".kIIIIkIIIIIIIIkIIIIk.",
"..kIIk.kIIIIIIk.kIIk..",
"..kCCk.kIIkkIIk.kCCk..",
"...kk..kIIk.kIIk.kk...",
".......kIIk.kIIk......",
"......kDDDk.kDDDk.....",
"......kkkkk.kkkkk.....",
], {"k": (20, 30, 60, 255), "I": (150, 210, 245, 255), "i": (230, 248, 255, 255), "b": (40, 90, 200, 255), "C": (200, 235, 255, 255), "D": (80, 120, 170, 255)}, "boss_icegiant", scale=10)
# 포효하는 늑대왕 (boss, fire)
render([
"...y.y.y..............",
"...yyyyy..............",
"..kkkkkkk.............",
".kFFFFFFFk............",
"kFFwkFFFFFkkkkkkkk....",
"kFFFFFFFFFFFFFFFFFkk..",
"kkFFFFFFFFFFFFFFFFFFk.",
"..kFrrFFFFFFFFFFFFFFkk",
"..kFFFFfffffFFFFFFFk.k",
"..kFFFffffffffFFFFk...",
"..kFFk..kFFk..kFFk....",
"..kFFk..kFFk..kFFk....",
"..kkk...kkk...kkk.....",
], {"k": (30, 12, 10, 255), "F": (196, 80, 40, 255), "f": (240, 170, 90, 255), "w": (255, 230, 80, 255), "r": (255, 255, 255, 255), "y": (255, 210, 60, 255)}, "boss_wolfking", scale=10)
print("ok")
