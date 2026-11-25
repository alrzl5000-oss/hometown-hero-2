# 2.0 추가 보스 도트 — Pillow로 직접 찍은 픽셀 그리드(유료 이미지 생성 서비스 사용 안 함)
import sys
from PIL import Image
OUT = sys.argv[1] if len(sys.argv) > 1 else "./"
K = (24, 18, 28, 255)
def render(rows, pal, name):
    w = max(len(r) for r in rows); h = len(rows)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ".": im.putpixel((x, y), pal[c])
    im.save(OUT + name + ".png")

# 독의 여왕 거미 (wind)
render([
"......k........k......",
".....k.k......k.k.....",
"....k...kkkkkk...k....",
"...k...kPPPPPPk...k...",
"..k...kPPyPPyPPk...k..",
".k..kkPPPPPPPPPPkk..k.",
"k..k.kPPgPPPPgPPk.k..k",
"..k..kPPPggggPPPk..k..",
".k..kPPPPPPPPPPPPk..k.",
"k..k.kPPPPPPPPPPk.k..k",
"..k...kkPPPPPPkk...k..",
".k......kkkkkk......k.",
"k......k......k......k",
], {"k": K, "P": (92, 52, 120, 255), "y": (190, 255, 90, 255), "g": (130, 220, 80, 255)}, "boss_spider_queen")

# 어둠의 암살자 (fire)
render([
".......kkkk.......",
"......kDDDDk......",
".....kDDDDDDk.....",
".....kDrDDrDk.....",
".....kDDDDDDk.....",
"..kk..kDDDDk..kk..",
".kSSk.kDDDDk.kSSk.",
"..kSSkDDDDDDkSSk..",
"...kkDDDDDDDDkk...",
".....kDDmmDDk.....",
".....kDDDDDDk.....",
"....kDDk..kDDk....",
"....kDk....kDk....",
"....kkk....kkk....",
], {"k": K, "D": (46, 40, 64, 255), "r": (255, 70, 70, 255), "S": (200, 210, 230, 255), "m": (120, 30, 40, 255)}, "boss_shadow_assassin")

# 강철 수호자 (wind)
render([
"......kkkkkkkk......",
".....kIIIIIIIIk.....",
"....kIIIccIIIIIk....",
"....kIIcyycIIIIk....",
"....kIIIccIIIIIk....",
"..kkkIIIIIIIIIIkkk..",
".kIIkIIiIIIIiIIkIIk.",
".kIIkIIIIIIIIIIkIIk.",
".kIIkIIiIIIIiIIkIIk.",
"..kk.kIIIIIIIIk.kk..",
".....kIIk..kIIk.....",
"....kIIIk..kIIIk....",
"....kkkkk..kkkkk....",
], {"k": K, "I": (150, 160, 175, 255), "i": (100, 110, 125, 255), "c": (60, 200, 120, 255), "y": (200, 255, 140, 255)}, "boss_iron_guardian")

# 폭풍의 와이번 (water)
render([
"k.................k...",
"kk......kkk......kk...",
"kWk....kBBBk....kWk...",
"kWWk..kBBBBBk..kWWk...",
".kWWkkBBBBBBBkkWWk....",
"..kWWBBByBBBBBWWk.....",
"...kBBBBBBBBBBBk..kk..",
"....kBBbbbbBBBBkkkBBk.",
".....kBBBBBBBBBBBBBk..",
"......kBBk..kBBkkkk...",
"......kkk....kkk......",
], {"k": K, "W": (90, 150, 220, 255), "B": (40, 90, 150, 255), "b": (150, 210, 240, 255), "y": (255, 240, 120, 255)}, "boss_storm_wyvern")

# --- 오디세이 테마 보스 -------------------------------------------------------
# 동굴의 키클롭스
render([
".......kkkkkk.......",
"......kSSSSSSk......",
".....kSSkkkkSSk.....",
".....kSkwwrwkSk.....",
".....kSkwwwwkSk.....",
".....kSSkkkkSSk.....",
"....kSSSSmmSSSSk....",
"..kkSSSSSSSSSSSSkk..",
".kSSkSSSSSSSSSSkSSk.",
".kSSkLLLLLLLLLLkSSk.",
"..kk.kSSSSSSSSk.kk..",
".....kSSk..kSSk.....",
"....kkkkk..kkkkk....",
], {"k": K, "S": (170, 140, 110, 255), "w": (250, 250, 240, 255), "r": (220, 40, 40, 255), "m": (90, 40, 40, 255), "L": (110, 80, 50, 255)}, "boss_cyclops")
# 대지를 뒤흔드는 거인
render([
"......kkkkkkk......",
".....kRRRRRRRk.....",
".....kRyRRRyRk.....",
".....kRRRRRRRk.....",
"..kkkkRRmmmRRkkkk..",
".kRRRRRRRRRRRRRRRk.",
"kRRRkRRgRRRgRRkRRRk",
"kRRk.kRRRRRRRk.kRRk",
"kkk..kRRgRgRRk..kkk",
".....kRRRRRRRk.....",
"....kRRRk.kRRRk....",
"....kkkkk.kkkkk....",
], {"k": K, "R": (120, 100, 80, 255), "y": (255, 200, 60, 255), "m": (60, 40, 30, 255), "g": (80, 140, 60, 255)}, "boss_giant")
# 저주의 마녀 키르케
render([
"........kk........",
".......kPPk.......",
"......kPPPPk......",
".....kPPPPPPk.....",
"...kkkkkkkkkkkk...",
"....kFFFFFFFFk....",
"....kFgFFFFgFk....",
".....kFFmmFFk.....",
"....kPPPPPPPPk..y.",
"...kPPPPPPPPPPk.k.",
"..kPPPPyPPPPPPPkk.",
"..kPPPPPPPPPPPPk..",
".kPPPPPPPPPPPPPPk.",
".kkkkkkkkkkkkkkkk.",
], {"k": K, "P": (110, 50, 140, 255), "F": (235, 200, 180, 255), "g": (120, 255, 120, 255), "m": (150, 40, 80, 255), "y": (190, 255, 90, 255)}, "boss_circe")
# 심연의 세이렌
render([
"....kkkkkk..........",
"...kHHHHHHk.........",
"..kHHFFFFHHk........",
"..kHFbFFbFHk........",
"..kHFFFFFFHk........",
"..kHHFmmFHHk........",
"..kHkFFFFkHk........",
"...kTTTTTTk.........",
"....kTTTTTTk........",
".....kTTTTTTkk...kk.",
"......kTTTTTTTk.kTk.",
".......kkTTTTTTkTTk.",
".........kkkkkkkkk..",
], {"k": K, "H": (60, 200, 190, 255), "F": (230, 220, 210, 255), "b": (40, 80, 160, 255), "m": (180, 60, 90, 255), "T": (40, 130, 160, 255)}, "boss_siren")
# 태양의 수호자 헬리오스
render([
"...y...y...y...y...",
"....y..kkkkk..y....",
"..y..kkGGGGGkk..y..",
"....kGGGGGGGGGk....",
"yy..kGGkGGGkGGk..yy",
"....kGGGGGGGGGk....",
"..y..kGGGmGGGk..y..",
"....kkkGGGGGkkk....",
"...kGGkkkkkkkGGk...",
"..kGGGkWWWWWkGGGk..",
"...kk.kWWWWWk.kk...",
"......kWWkWWk......",
"......kkk.kkk......",
], {"k": K, "G": (250, 190, 50, 255), "y": (255, 230, 120, 255), "m": (180, 80, 30, 255), "W": (240, 240, 230, 255)}, "boss_helios")
print("ok")
