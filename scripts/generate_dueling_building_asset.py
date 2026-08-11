from PIL import Image, ImageDraw, ImageFont
import os
import sys
import urllib.request
import subprocess

path = r'd:\ebda3y\potion-academy\public\assets\buildings\dueling\dueling-building.png'
os.makedirs(os.path.dirname(path), exist_ok=True)

w, h = 256, 208
img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Base walls
wall_boxes = [
    ((32, 96), (96, 184), (150, 130, 95)),
    ((96, 52), (160, 184), (165, 145, 110)),
    ((160, 72), (224, 184), (145, 115, 82)),
]
for top_left, bottom_right, color in wall_boxes:
    d.rectangle([top_left, bottom_right], fill=color)

# Roofs
roofs = [
    [(24, 96), (64, 40), (112, 96)],
    [(88, 60), (128, 12), (168, 60)],
    [(152, 80), (192, 40), (232, 80)],
]
for roof in roofs:
    d.polygon(roof, fill=(40, 56, 80))

# Clock tower details
clock_center = (128, 90)
clock_radius = 18
bbox = [clock_center[0]-clock_radius, clock_center[1]-clock_radius, clock_center[0]+clock_radius, clock_center[1]+clock_radius]
d.ellipse(bbox, fill=(220, 193, 145), outline=(44, 54, 70))
d.line((clock_center[0], clock_center[1]-4, clock_center[0], clock_center[1]-14), fill=(40, 40, 40), width=2)
d.line((clock_center[0]-6, clock_center[1], clock_center[0]+6, clock_center[1]), fill=(40, 40, 40), width=2)

d.rectangle((112, 142, 148, 184), fill=(58, 32, 18), outline=(20, 12, 8))
d.line((130, 142, 130, 184), fill=(20, 12, 8), width=3)
d.line((118, 154, 142, 154), fill=(82, 60, 35), width=2)

d.rectangle((118, 168, 122, 176), fill=(200, 180, 120))
d.rectangle((134, 168, 138, 176), fill=(200, 180, 120))

# Windows
for x in (44, 64, 84):
    d.rectangle((x, 116, x+10, 152), fill=(38, 70, 112), outline=(16, 24, 40))
    d.line((x+5, 116, x+5, 152), fill=(16, 24, 40), width=1)
for x in (172, 188):
    d.rectangle((x, 116, x+12, 156), fill=(90, 140, 120), outline=(18, 32, 44))
    d.line((x+6, 116, x+6, 156), fill=(18, 32, 44), width=1)

# Stone brick lines
for y in range(110, 180, 12):
    d.line((36, y, 92, y), fill=(120, 98, 74), width=1)
for y in range(76, 104, 8):
    d.line((100, y, 148, y), fill=(122, 102, 82), width=1)
for y in range(92, 148, 10):
    d.line((164, y, 224, y), fill=(110, 88, 68), width=1)

# Sign
sign_box = (100, 58, 156, 78)
d.rectangle(sign_box, fill=(78, 54, 34), outline=(28, 20, 12))
# Ensure we have a good Arabic font available; download Noto Naskh Arabic if missing
fonts_dir = os.path.join(os.path.dirname(path), '..', 'fonts')
fonts_dir = os.path.normpath(fonts_dir)
os.makedirs(fonts_dir, exist_ok=True)
font_path_candidates = [
    os.path.join(fonts_dir, 'NotoNaskhArabic-Regular.ttf'),
    os.path.join(fonts_dir, 'Amiri-Regular.ttf'),
]

def ensure_font(url, dest):
    if not os.path.exists(dest):
        try:
            print('Downloading font to', dest)
            urllib.request.urlretrieve(url, dest)
        except Exception as e:
            print('Failed to download font:', e)

# Try several reliable font raw URLs (Amiri and Noto fallbacks)
font_url_map = [
    ('https://github.com/google/fonts/raw/main/ofl/amiri/Amiri-Regular.ttf', os.path.join(fonts_dir, 'Amiri-Regular.ttf')),
    ('https://github.com/alif-type/amiri/raw/master/fonts/ttf/Amiri-Regular.ttf', font_path_candidates[1]),
    ('https://github.com/alif-type/amiri/raw/master/fonts/ttf/Amiri-Bold.ttf', os.path.join(fonts_dir, 'Amiri-Bold.ttf')),
    ('https://github.com/google/fonts/raw/main/ofl/notonaskharabic/NotoNaskhArabic-Regular.ttf', font_path_candidates[0]),
]
for url, dest in font_url_map:
    ensure_font(url, dest)

# Prefer the downloaded Amiri font if present, at a larger size for pixel-art legibility
font = None
amiri_path = os.path.join(fonts_dir, 'Amiri-Regular.ttf')
if os.path.exists(amiri_path):
    try:
        font = ImageFont.truetype(amiri_path, 20)
    except Exception:
        font = None
if font is None:
    for p in font_path_candidates:
        try:
            if os.path.exists(p):
                font = ImageFont.truetype(p, 18)
                break
        except Exception:
            font = None
if font is None:
    try:
        font = ImageFont.truetype('arialbd.ttf', 18)
    except Exception:
        try:
            font = ImageFont.truetype('arial.ttf', 18)
        except Exception:
            font = ImageFont.load_default()

# If downloads failed, try common Windows Arabic font locations before falling back
if font == ImageFont.load_default():
    possible_system_fonts = [
        r'C:\Windows\Fonts\arialbd.ttf',
        r'C:\Windows\Fonts\arial.ttf',
        r'C:\Windows\Fonts\Tahoma.ttf',
        r'C:\Windows\Fonts\Arabic Typesetting.ttf',
    ]
    for sp in possible_system_fonts:
        try:
            if os.path.exists(sp):
                font = ImageFont.truetype(sp, 18)
                break
        except Exception:
            continue

# Helper to draw bold/outlined centered text (simple stroke by offsetting)
def draw_centered_bold_text(draw_obj, box, lines, font, fill, stroke_fill=(30,20,10), stroke_width=2, line_spacing=2):
    x0, y0, x1, y1 = box
    center_x = (x0 + x1) / 2
    # measure total height
    sizes = []
    for l in lines:
        bbox = draw_obj.textbbox((0, 0), l, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        sizes.append((w, h))
    total_h = sum(h for (w,h) in sizes) + (len(lines)-1) * line_spacing
    start_y = y0 + ((y1 - y0) - total_h) / 2
    y = start_y
    for i, line in enumerate(lines):
        w, h = sizes[i]
        x = center_x - w/2
        # stroke: draw offsets
        for ox in range(-stroke_width, stroke_width+1):
            for oy in range(-stroke_width, stroke_width+1):
                if ox == 0 and oy == 0:
                    continue
                draw_obj.text((x+ox, y+oy), line, font=font, fill=stroke_fill)
        draw_obj.text((x, y), line, font=font, fill=fill)
        y += h + line_spacing

arabic_main = 'Dueling Club'
arabic_sub = ''

# Attempt to shape Arabic properly if reshaper and bidi are available.
def shape_arabic_line(s):
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display
        reshaped = arabic_reshaper.reshape(s)
        return get_display(reshaped)
    except Exception:
        return s

lines = [shape_arabic_line(arabic_main)]
# Draw a single centered English title; use bold look via stroke offsets
try:
    draw_centered_bold_text(d, sign_box, lines, font, fill=(244,208,63), stroke_fill=(40,28,12), stroke_width=2, line_spacing=4)
except Exception:
    draw_centered_bold_text(d, sign_box, lines, font, fill=(244,208,63), stroke_fill=(40,28,12), stroke_width=1, line_spacing=2)

img.save(path)
print('saved', path)
