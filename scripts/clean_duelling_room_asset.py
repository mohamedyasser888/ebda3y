"""Remove reference-image artifacts from the duelling room texture."""
from pathlib import Path

from math import cos, pi, sin

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "ttttttts.png"
OUTPUT = ROOT / "public" / "assets" / "backgrounds" / "duelling-room.png"


image = Image.open(SOURCE).convert("RGBA")
draw = ImageDraw.Draw(image)

# Replace the purple placeholder wizard with an arena medallion, retaining the
# circular shape, runes, and star that belong at the centre of the duelling ring.
cx, cy = 1022, 485
draw.ellipse((cx - 43, cy - 43, cx + 43, cy + 43), fill=(105, 89, 73, 255))
for radius, color, width in ((40, (158, 93, 168, 255), 2), (27, (147, 82, 160, 255), 2)):
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=color, width=width)

star = []
for index in range(10):
    radius = 29 if index % 2 == 0 else 12
    angle = -pi / 2 + index * pi / 5
    star.append((cx + cos(angle) * radius, cy + sin(angle) * radius))
draw.line(star + [star[0]], fill=(226, 191, 70, 255), width=3, joint='curve')

# The sparkle sits on a plain stone floor area. Cover it with a small stone tile
# patch and matching mortar seams rather than copying the sparkle into a new spot.
draw.rectangle((1240, 620, 1325, 698), fill=(79, 75, 76, 255))
draw.line((1240, 646, 1325, 646), fill=(47, 44, 48, 255), width=3)
draw.line((1240, 674, 1325, 674), fill=(47, 44, 48, 255), width=3)
draw.line((1280, 620, 1280, 646), fill=(47, 44, 48, 255), width=3)
draw.line((1260, 646, 1260, 674), fill=(47, 44, 48, 255), width=3)
draw.line((1305, 646, 1305, 674), fill=(47, 44, 48, 255), width=3)

image.save(OUTPUT)
print(f"saved {OUTPUT}")
