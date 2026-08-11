"""Prepare the supplied duelling-building reference for use as a world sprite."""
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "buildings" / "dueling" / "dueling-building-reference.png"
OUTPUT = ROOT / "public" / "assets" / "buildings" / "dueling" / "dueling-building.png"
TOP_PAD = 0


def is_background(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    is_grass = g > 45 and g > r * 1.2 and g > b * 1.15
    is_neutral_gray = 80 <= r <= 160 and abs(r - g) <= 10 and abs(g - b) <= 14
    return a > 0 and (is_grass or is_neutral_gray)


def remove_border_background(image: Image.Image) -> Image.Image:
    """Remove only background connected to an image edge, preserving interior detail."""
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    queue: deque[tuple[int, int]] = deque()
    seen: set[tuple[int, int]] = set()

    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))

    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not is_background(pixels[x, y]):
            continue
        seen.add((x, y))
        pixels[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                queue.append((nx, ny))
    return image


def add_roof_headroom(image: Image.Image) -> Image.Image:
    if TOP_PAD == 0:
        return image
    width, height = image.size
    canvas = Image.new("RGBA", (width, height + TOP_PAD), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    # Continue the two cropped slate roofs above the original reference frame.
    draw.polygon([(302, 5), (85, TOP_PAD), (514, TOP_PAD)], fill=(48, 54, 58, 255))
    draw.polygon([(704, 3), (608, TOP_PAD), (814, TOP_PAD)], fill=(58, 63, 66, 255))
    for y in range(22, TOP_PAD, 22):
        draw.line((max(90, 302 - (y * 1.25)), y, min(510, 302 + (y * 1.25)), y), fill=(25, 30, 34, 255), width=3)
        draw.line((max(610, 704 - (y * 0.53)), y, min(812, 704 + (y * 0.53)), y), fill=(30, 35, 38, 255), width=3)
    for x in range(120, 505, 28):
        draw.line((x, TOP_PAD - 12, x + 38, 18), fill=(88, 91, 89, 255), width=2)
    for x in range(630, 800, 23):
        draw.line((x, TOP_PAD - 10, 704, 8), fill=(94, 97, 94, 255), width=2)

    canvas.alpha_composite(image, (0, TOP_PAD))
    return canvas


source = Image.open(SOURCE)
add_roof_headroom(remove_border_background(source)).save(OUTPUT)
print(f"saved {OUTPUT}")
