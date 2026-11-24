"""
우리동네 영웅 키우기 2.0 — 캐릭터 도트 스프라이트 생성기 (Pillow만 사용, 유료 이미지 API 없음)

64×64 격자에 사람 캐릭터를 픽셀 단위로 그린 뒤 NEAREST로 9배(576×576) 확대한다.
민수님이 승인한 스타일(얼굴: 눈썹·흰자·눈동자·코·볼터치·입 / 상체 엠블럼 / 직업별 무기 /
등급별 오라·반짝이·어깨갑)을 그대로 재현한다.

- 직업(class)  → 무기: tanker=검+방패, dealer=검, ranged=활, assassin=단검, support=지팡이
- 속성(element) → 옷 색 + 포인트(엠블럼/무기 장식) 색
- 등급(rarity) → SSR 이상 어깨갑·장갑, XR 이상 오라 원판 + 반짝이(등급이 높을수록 많이)
- 캐릭터 id 해시 → 피부톤 / 머리색 (같은 id는 항상 같은 결과)

사용법: python3 scripts/generate_full_roster.py  (scripts/roster.json 필요)
"""
import hashlib
from PIL import Image, ImageDraw

GRID = 64
SCALE = 9
O = 3  # 전체 세로 오프셋

SKINS = [  # (밝은 면, 기본, 코/그늘, 목/어두운 면)
    ((240, 205, 170), (228, 193, 158), (222, 187, 152), (230, 195, 160)),
    ((195, 150, 115), (183, 138, 103), (177, 132, 97), (185, 140, 105)),
    ((140, 100, 80), (128, 88, 68), (122, 82, 62), (130, 90, 70)),
    ((250, 222, 196), (238, 208, 180), (230, 198, 168), (240, 210, 182)),
]
HAIRS = [(40, 35, 40), (90, 65, 50), (80, 110, 180), (230, 220, 190), (150, 90, 170), (60, 40, 30), (170, 60, 50), (200, 140, 60)]
ELEMENT = {  # 옷 기본 / 포인트(밝은)
    "fire": ((186, 71, 61), (255, 150, 60)),
    "water": ((77, 132, 197), (120, 200, 255)),
    "wind": ((94, 184, 129), (140, 230, 150)),
    None: ((130, 120, 150), (220, 210, 240)),
}
SLEEVE = {"tanker": (110, 110, 120), "dealer": (150, 115, 85), "ranged": (120, 95, 70), "assassin": (60, 55, 70), "support": (110, 110, 120)}
RARITY_TIER = {  # 어깨갑, 오라, 반짝이 수
    "N": (False, False, 0), "R": (False, False, 0), "SR": (False, False, 0), "SSR": (True, False, 0),
    "XR": (True, True, 4), "HR": (True, True, 6), "XXR": (True, True, 9), "EX": (True, True, 5),
}


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3])


def _h(s):
    return int(hashlib.md5(s.encode()).hexdigest(), 16)


def rect(d, x0, y0, x1, y1, c):
    d.rectangle([x0, y0 + O, x1, y1 + O], fill=c)


def draw_aura(d, accent, sparkles):
    d.ellipse([1, 1 + O - 2, 62, 62 + O - 2], fill=accent + (18,))
    spots = [(9, 13), (52, 22), (5, 38), (56, 46), (14, 56), (48, 58), (30, 2), (2, 24), (60, 34)]
    for x, y in spots[:sparkles]:
        d.rectangle([x - 2, y - 1, x + 2, y + 1], fill=accent + (255,))
        d.rectangle([x - 1, y - 2, x + 1, y + 2], fill=accent + (255,))
        d.point((x, y), fill=(255, 255, 255, 230))


def draw_shield(d, accent):
    rim, fill = (110, 110, 120, 255), (130, 130, 140, 255)
    d.ellipse([6, 23 + O, 18, 46 + O], fill=rim)
    d.ellipse([8, 25 + O, 16, 44 + O], fill=fill)
    d.ellipse([9, 30 + O, 15, 38 + O], fill=accent + (255,))


def draw_sword(d, accent):
    rect(d, 48, 13, 49, 40, (215, 215, 225, 255))
    rect(d, 44, 40, 52, 44, accent + (255,))
    rect(d, 47, 44, 49, 51, (90, 60, 40, 255))


def draw_dagger(d, accent):
    rect(d, 47, 30, 48, 40, (215, 215, 225, 255))
    rect(d, 45, 40, 50, 41, accent + (255,))
    rect(d, 47, 42, 48, 46, (60, 40, 30, 255))


def draw_bow(d, accent):
    wood = (150, 105, 60, 255)
    for y in range(12, 51):
        t = abs(y - 31) / 19
        x = 52 - int(4 * (1 - t * t))
        rect(d, x, y, x + 1, y, wood)
    rect(d, 47, 13, 47, 49, (235, 235, 240, 255))  # 시위
    rect(d, 50, 30, 52, 32, accent + (255,))


def draw_staff(d, accent):
    rect(d, 13, 14, 15, 48, (175, 135, 95, 255))
    rect(d, 16, 14, 17, 48, (150, 110, 70, 255))
    d.ellipse([9, -1 + O, 21, 11 + O], fill=accent + (230,))
    d.ellipse([12, 2 + O, 18, 8 + O], fill=(255, 255, 255, 180))


def draw_humanoid(cls, rarity, element, seed):
    im = Image.new("RGBA", (GRID, GRID), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, "RGBA")
    h = _h(seed)
    skin_l, skin, nose, neck = SKINS[h % len(SKINS)]
    hair = HAIRS[(h // 7) % len(HAIRS)]
    hair_hi = shade(hair, 1.3) if sum(hair) < 300 else shade(hair, 0.85)
    brow = shade(hair, 0.75)
    outfit, accent = ELEMENT.get(element, ELEMENT[None])
    sleeve = SLEEVE.get(cls, SLEEVE["dealer"])
    armored, aura, sparkles = RARITY_TIER.get(rarity, RARITY_TIER["N"])

    if aura:
        draw_aura(d, accent, sparkles)
    if cls == "support":
        draw_staff(d, accent)
    if cls == "tanker":
        draw_shield(d, accent)

    # 머리카락
    rect(d, 21, 0, 43, 1, hair); rect(d, 19, 2, 45, 14, hair)
    rect(d, 23, 3, 26, 6, hair_hi); rect(d, 37, 3, 40, 6, hair_hi)
    # 얼굴
    rect(d, 24, 8, 40, 9, skin_l)
    rect(d, 24, 10, 29, 11, brow); rect(d, 35, 10, 40, 11, brow); rect(d, 30, 10, 34, 10, skin_l); rect(d, 30, 11, 34, 11, skin)
    rect(d, 24, 12, 40, 12, skin); rect(d, 24, 12, 24, 12, skin_l); rect(d, 40, 12, 40, 12, skin_l)
    rect(d, 21, 15, 43, 22, skin); rect(d, 24, 13, 40, 14, skin)
    for ex in (24, 35):  # 흰자 + 눈동자
        rect(d, ex, 13, ex + 5, 16, (250, 250, 250))
        rect(d, ex + 1, 14, ex + 4, 16, (30, 24, 34))
    rect(d, 31, 16, 33, 18, nose)
    d.rectangle([22, 16 + O, 24, 16 + O], fill=(255, 150, 150, 160)); d.rectangle([40, 16 + O, 42, 16 + O], fill=(255, 150, 150, 160))
    d.rectangle([21, 17 + O, 25, 18 + O], fill=(255, 150, 150, 160)); d.rectangle([39, 17 + O, 43, 18 + O], fill=(255, 150, 150, 160))
    rect(d, 29, 19, 35, 21, (150, 70, 70))
    # 턱선 정리
    for (x0, x1, y) in [(21, 21, 19), (43, 43, 19), (21, 22, 20), (42, 43, 20), (21, 24, 21), (40, 43, 21), (21, 27, 22), (37, 43, 22)]:
        d.rectangle([x0, y + O, x1, y + O], fill=(0, 0, 0, 0))
    rect(d, 28, 22, 36, 22, skin)
    # 목/상체
    rect(d, 28, 23, 36, 25, neck if cls != "support" else skin)
    rect(d, 21, 24, 27, 25, outfit); rect(d, 37, 24, 43, 25, outfit)
    rect(d, 23, 26, 41, 30, outfit)
    rect(d, 23, 31, 41, 36, shade(outfit, 0.86))
    rect(d, 23, 37, 41, 38, shade(outfit, 0.72))
    rect(d, 23, 39, 41, 42, shade(accent, 0.9) if rarity in ("N", "R", "SR") else shade(outfit, 0.62))
    rect(d, 22, 43, 42, 43, shade(outfit, 0.72))
    rect(d, 30, 28, 34, 32, accent)  # 엠블럼
    # 팔
    arm_l = 19 if cls == "tanker" else 15
    if armored:
        metal, gold = (215, 215, 225), (225, 195, 100)
        rect(d, arm_l, 26, 22, 38, metal); rect(d, arm_l, 26, arm_l + 1, 38, gold); rect(d, 21, 26, 22, 38, gold)
        rect(d, 42, 26, 45, 38, metal); rect(d, 42, 26, 42, 38, gold); rect(d, 45, 26, 45, 38, gold)
        rect(d, 17, 24, 22, 25, gold); rect(d, 42, 24, 47, 25, gold)
        rect(d, arm_l + 1, 39, 21, 42, accent); rect(d, 43, 39, 44, 42, accent)
    else:
        rect(d, arm_l, 26, 22, 40, sleeve); rect(d, 42, 26, 45, 40, sleeve)
    rect(d, arm_l, 41 if not armored else 43, 21, 46, skin_l)
    rect(d, 43, 41 if not armored else 43, 46, 46, skin_l)
    # 다리/신발
    pants = sleeve if not armored else shade(accent, 0.8)
    rect(d, 24, 44, 31, 48, pants); rect(d, 33, 44, 40, 48, pants)
    boots = shade(pants, 0.75)
    rect(d, 24, 49, 31, 53, boots); rect(d, 33, 49, 40, 53, boots)
    rect(d, 23, 54, 31, 58, (20, 16, 24)); rect(d, 33, 54, 41, 58, (20, 16, 24))
    # 오른손 무기
    if cls in ("tanker", "dealer"):
        draw_sword(d, accent)
    elif cls == "ranged":
        draw_bow(d, accent)
    elif cls == "assassin":
        draw_dagger(d, accent)
    return im


def render(cls, rarity, element, seed, scale=SCALE):
    return draw_humanoid(cls, rarity, element, seed).resize((GRID * scale, GRID * scale), Image.NEAREST)


if __name__ == "__main__":
    import os
    os.makedirs("art_samples", exist_ok=True)
    for i, (c, r, e) in enumerate([("tanker", "N", "water"), ("support", "SSR", "fire"), ("dealer", "XR", "wind"), ("assassin", "XXR", "wind"), ("ranged", "SR", "fire")]):
        render(c, r, e, f"sample{i}").save(f"art_samples/sample_{c}_{r}.png")
    print("samples written to art_samples/")
