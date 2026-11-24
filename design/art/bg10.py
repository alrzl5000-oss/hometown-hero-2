# 2.0 파밍 배경 10단계 — 10스테이지마다 교체, 갈수록 어둡고 무섭게 (Pillow 절차 생성, 유료 API 없음)
from PIL import Image, ImageDraw
import random, math
OUT = "/tmp/claude-0/-home-claude/025c504b-4bb5-5716-9fa6-a39e1e42418b/scratchpad/v2art/"
W, H, S = 320, 110, 4
HZ = 68  # 지평선

def band(d, y0, y1, c0, c1):
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0 - 1)
        d.line([(0, y), (W, y)], fill=tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3)))

def hills(d, base, amp, col, seed, step=1):
    r = random.Random(seed); ph = r.random() * 6
    for x in range(0, W, step):
        h = int(amp * (0.55 + 0.45 * math.sin(x / 23 + ph) * math.sin(x / 57 + ph * 2)))
        d.line([(x, base - h), (x, base)], fill=col)

def trees(d, base, col, seed, n=18, hmin=10, hmax=22, dead=False):
    r = random.Random(seed)
    for _ in range(n):
        x = r.randrange(W); h = r.randrange(hmin, hmax)
        d.rectangle([x, base - h // 3, x + 1, base], fill=col)
        if dead:
            for k in range(3):
                yy = base - h // 3 - k * 3
                d.line([(x, yy), (x - 3 - k, yy - 3)], fill=col); d.line([(x + 1, yy), (x + 4 + k, yy - 4)], fill=col)
        else:
            for k in range(h // 2):
                w = (h // 2 - k) // 2 + 1
                d.line([(x - w, base - h // 3 - k), (x + w + 1, base - h // 3 - k)], fill=col)

def ruins(d, base, col, seed, broken=True):
    r = random.Random(seed); x = 0
    while x < W:
        w = r.randrange(10, 26); h = r.randrange(14, 34)
        d.rectangle([x, base - h, x + w, base], fill=col)
        for k in range(0, w, 4): d.rectangle([x + k, base - h - 3, x + k + 1, base - h], fill=col)
        if broken: d.polygon([(x + w // 2, base - h), (x + w, base - h + 6), (x + w, base - h)], fill=(0, 0, 0))
        for wy in range(base - h + 6, base - 4, 8): d.rectangle([x + w // 2 - 1, wy, x + w // 2 + 1, wy + 3], fill=(0, 0, 0))
        x += w + r.randrange(6, 22)

def particles(d, kind, seed, n=40):
    r = random.Random(seed)
    for _ in range(n):
        x, y = r.randrange(W), r.randrange(H)
        if kind == "firefly": d.point((x, r.randrange(40, H)), fill=(240, 255, 150))
        elif kind == "ember": d.rectangle([x, y, x, y + 1], fill=r.choice([(255, 140, 40), (255, 200, 80), (220, 60, 30)]))
        elif kind == "ash": d.point((x, y), fill=(120, 110, 120))
        elif kind == "rain": d.line([(x, y), (x - 2, y + 5)], fill=(140, 150, 190))
        elif kind == "spark": d.point((x, y), fill=r.choice([(200, 120, 255), (255, 80, 200)]))
        elif kind == "star": d.point((x, r.randrange(0, 40)), fill=(255, 250, 220))

def fog(im, col, alpha, y0=50):
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    r = random.Random(alpha)
    for _ in range(26):
        x = r.randrange(-30, W); y = r.randrange(y0, H); w = r.randrange(30, 80)
        od.rectangle([x, y, x + w, y + 3], fill=col + (alpha,))
    im.paste(Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB"))

def moon(d, x, y, r, col):
    d.ellipse([x - r, y - r, x + r, y + r], fill=col)

def ground_path(d, col, edge):
    d.polygon([(0, H), (140, HZ + 4), (180, HZ + 4), (W, H)], fill=col)
    d.line([(140, HZ + 4), (0, H)], fill=edge); d.line([(180, HZ + 4), (W, H)], fill=edge)

def eyes(d, seed, n, col):
    r = random.Random(seed)
    for _ in range(n):
        x, y = r.randrange(10, W - 10), r.randrange(HZ - 26, HZ - 4)
        d.point((x, y), fill=col); d.point((x + 3, y), fill=col)

TIERS = [
    ("1–10", "마을 외곽 들판", "낮"),
    ("11–20", "푸른 숲", "오후"),
    ("21–30", "독버섯 늪", "해질녘"),
    ("31–40", "무너진 성채", "저녁"),
    ("41–50", "지하 던전", "횃불"),
    ("51–60", "용암 동굴", "불길"),
    ("61–70", "저주받은 묘지", "한밤 안개"),
    ("71–80", "핏빛 폐허", "붉은 달"),
    ("81–90", "심연의 균열", "보랏빛 공허"),
    ("91–100+", "마왕성", "최종"),
]

def make(i):
    im = Image.new("RGB", (W, H)); d = ImageDraw.Draw(im)
    if i == 0:
        band(d, 0, HZ, (110, 180, 245), (190, 225, 250))
        for cx, cy in [(40, 14), (150, 9), (250, 18)]:
            d.rectangle([cx, cy + 2, cx + 22, cy + 6], fill=(250, 252, 255)); d.rectangle([cx + 4, cy, cx + 16, cy + 4], fill=(250, 252, 255))
        hills(d, HZ, 22, (120, 170, 140), 1); band(d, HZ, H, (104, 176, 82), (70, 130, 60))
        ground_path(d, (196, 168, 110), (170, 140, 90)); particles(d, "firefly", 1, 10)
    elif i == 1:
        band(d, 0, HZ, (140, 190, 220), (230, 210, 160))
        hills(d, HZ, 26, (70, 120, 90), 2); trees(d, HZ, (40, 90, 60), 2, 26, 14, 30)
        band(d, HZ, H, (70, 130, 60), (40, 90, 40)); ground_path(d, (150, 120, 80), (110, 90, 60))
    elif i == 2:
        band(d, 0, HZ, (120, 90, 140), (240, 150, 110))
        hills(d, HZ, 18, (70, 70, 90), 3); trees(d, HZ, (50, 50, 60), 3, 14, 12, 24)
        band(d, HZ, H, (70, 90, 60), (40, 55, 40))
        r = random.Random(3)
        for _ in range(9):
            x = r.randrange(W); y = r.randrange(HZ + 6, H - 4)
            d.rectangle([x, y, x + 1, y + 4], fill=(230, 220, 200)); d.rectangle([x - 3, y - 2, x + 4, y], fill=r.choice([(190, 60, 160), (220, 90, 60)]))
        for _ in range(6):
            x = r.randrange(W); y = r.randrange(HZ + 4, H); d.rectangle([x, y, x + 24, y + 3], fill=(60, 110, 70))
        fog(im, (150, 220, 140), 40, 70)
    elif i == 3:
        band(d, 0, HZ, (50, 50, 90), (160, 110, 120)); particles(d, "star", 4, 20)
        moon(d, 270, 18, 7, (240, 230, 200)); ruins(d, HZ, (40, 36, 56), 4)
        band(d, HZ, H, (70, 66, 74), (40, 38, 46)); ground_path(d, (90, 84, 90), (60, 56, 64))
    elif i == 4:
        band(d, 0, 72, (24, 20, 40), (44, 34, 70))
        for y in range(0, 72, 8):
            off = 0 if (y // 8) % 2 == 0 else 8
            for x in range(-off, W, 16):
                d.rectangle([x, y, x + 15, y + 7], outline=(30, 26, 50)); d.line([(x + 1, y + 1), (x + 14, y + 1)], fill=(58, 48, 90))
        for tx in (60, 160, 260):
            d.rectangle([tx, 26, tx + 3, 40], fill=(90, 70, 50))
            for rr, c in [(12, (90, 50, 120)), (8, (170, 90, 160)), (4, (255, 170, 90)), (2, (255, 240, 180))]:
                d.ellipse([tx + 1 - rr, 22 - rr, tx + 2 + rr, 22 + rr], fill=c)
        band(d, 72, H, (40, 34, 56), (22, 18, 32))
        for x in range(0, W, 20): d.line([(x, 72), (x - 30, H)], fill=(52, 44, 72))
    elif i == 5:
        band(d, 0, HZ, (40, 12, 10), (120, 40, 20))
        r = random.Random(6)
        for x in range(0, W, 12):  # 종유석
            h = r.randrange(6, 22); d.polygon([(x, 0), (x + 10, 0), (x + 5, h)], fill=(30, 14, 12))
        hills(d, HZ, 24, (50, 20, 16), 6)
        band(d, HZ, H, (40, 16, 12), (20, 8, 8))
        for k in range(5):
            y = HZ + 8 + k * 8; x0 = r.randrange(-40, 120)
            d.rectangle([x0, y, x0 + r.randrange(60, 200), y + 2], fill=(255, 110, 30)); d.rectangle([x0 + 10, y + 1, x0 + 70, y + 1], fill=(255, 220, 90))
        particles(d, "ember", 6, 70)
    elif i == 6:
        band(d, 0, HZ, (14, 18, 34), (40, 50, 70)); particles(d, "star", 7, 30)
        moon(d, 60, 20, 9, (210, 220, 235)); d.ellipse([56, 13, 68, 25], fill=(14, 18, 34))
        trees(d, HZ, (16, 18, 26), 7, 10, 18, 34, dead=True)
        band(d, HZ, H, (34, 40, 46), (16, 18, 24))
        r = random.Random(7)
        for _ in range(14):  # 묘비
            x = r.randrange(W); y = r.randrange(HZ + 2, H - 8); hh = r.randrange(6, 10)
            d.rectangle([x, y, x + 5, y + hh], fill=(90, 96, 106)); d.rectangle([x + 1, y - 1, x + 4, y], fill=(90, 96, 106))
            if r.random() < .4: d.rectangle([x + 2, y + 1, x + 3, y + 5], fill=(60, 64, 72)); d.rectangle([x + 1, y + 2, x + 4, y + 2], fill=(60, 64, 72))
        fog(im, (170, 190, 210), 55, 55); eyes(d, 7, 3, (200, 255, 120))
    elif i == 7:
        band(d, 0, HZ, (40, 6, 10), (130, 30, 30))
        moon(d, 250, 22, 14, (200, 40, 40)); moon(d, 250, 22, 11, (240, 70, 60))
        ruins(d, HZ, (24, 6, 8), 8)
        trees(d, HZ, (20, 4, 6), 8, 8, 18, 30, dead=True)
        band(d, HZ, H, (50, 14, 16), (20, 4, 6)); ground_path(d, (70, 20, 22), (40, 8, 10))
        particles(d, "ash", 8, 60); eyes(d, 8, 5, (255, 60, 60))
    elif i == 8:
        band(d, 0, HZ, (10, 4, 22), (50, 12, 70))
        r = random.Random(9)
        for k in range(4):  # 공간 균열
            x = r.randrange(20, W - 20); y = r.randrange(5, 50); pts = [(x, y)]
            for s in range(6): x += r.randrange(-6, 7); y += 4; pts.append((x, y))
            d.line(pts, fill=(255, 120, 255), width=1); d.line([(p[0] + 1, p[1]) for p in pts], fill=(140, 40, 200))
        for k in range(6):  # 떠 있는 바위
            x = r.randrange(W); y = r.randrange(20, 60); w = r.randrange(8, 20)
            d.polygon([(x, y), (x + w, y), (x + w // 2, y + w // 2 + 3)], fill=(30, 16, 44)); d.line([(x, y), (x + w, y)], fill=(120, 70, 170))
        band(d, HZ, H, (24, 8, 36), (6, 2, 12))
        for x in range(0, W, 6): d.line([(x, HZ), (x + r.randrange(-3, 4), HZ + r.randrange(3, 10))], fill=(70, 20, 100))
        particles(d, "spark", 9, 70); eyes(d, 9, 6, (255, 80, 220))
    else:
        band(d, 0, HZ, (6, 0, 4), (60, 4, 10))
        moon(d, 160, 14, 10, (120, 0, 10)); moon(d, 160, 14, 6, (200, 20, 30))
        # 마왕성 실루엣
        c = (10, 2, 6)
        d.rectangle([100, 30, 220, HZ], fill=c)
        for tx, th in [(100, 18), (130, 30), (160, 44), (190, 30), (220, 18)]:
            d.rectangle([tx - 6, HZ - th - 24, tx + 6, HZ], fill=c); d.polygon([(tx - 8, HZ - th - 24), (tx + 8, HZ - th - 24), (tx, HZ - th - 38)], fill=c)
        r = random.Random(10)
        for _ in range(22): x = r.randrange(104, 216); y = r.randrange(34, HZ - 4); d.rectangle([x, y, x + 1, y + 2], fill=(255, 40, 40))
        trees(d, HZ, (14, 2, 6), 10, 12, 18, 34, dead=True)
        band(d, HZ, H, (40, 4, 8), (8, 0, 2))
        for k in range(4):
            y = HZ + 10 + k * 9; x0 = r.randrange(-40, 160); d.rectangle([x0, y, x0 + r.randrange(60, 160), y + 1], fill=(170, 20, 30))
        particles(d, "ember", 10, 50); eyes(d, 10, 10, (255, 30, 30))
    im.resize((W * S, H * S), Image.NEAREST).save(OUT + f"bgt{i + 1:02d}.png")
    return im

ims = [make(i) for i in range(10)]
sheet = Image.new("RGB", (W * 2 * 5 + 40, H * 2 * 2 + 30), (12, 10, 20))
for i, im in enumerate(ims):
    sheet.paste(im.resize((W * 2, H * 2), Image.NEAREST), ((i % 5) * (W * 2 + 10), (i // 5) * (H * 2 + 30)))
sheet.save(OUT + "_bg10.png")
print("ok")
