from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


BATCH = Path(__file__).resolve().parents[1]
RAW = BATCH / "raw-candidates"
REVIEWS = BATCH / "semantic-reviews"

NAMES = {
    "A01": "camp before",
    "A02": "camp repaired",
    "A03": "mage",
    "A04": "companion",
    "A05": "common monster",
    "A06": "two-phase boss",
    "A07": "guardian-light",
    "A08": "star-path",
    "A09": "ink-echo",
    "A10": "明 meaning magic",
    "A11": "花 meaning magic",
    "A12": "林 meaning magic",
    "A13": "星 meaning magic",
    "A14": "spellbook",
    "A15": "treasure box",
    "A16": "world portal",
}


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", size)
    except OSError:
        return ImageFont.load_default()


def preview(path: Path, size: tuple[int, int], sprite: bool) -> Image.Image:
    with Image.open(path) as opened:
        image = opened.convert("RGBA")
    image.thumbnail((size[0] - 24, size[1] - 24), Image.Resampling.LANCZOS)
    if sprite:
        canvas = Image.new("RGBA", size, "#071C2A")
        draw = ImageDraw.Draw(canvas)
        draw.rectangle((size[0] // 2, 0, size[0], size[1]), fill="#F8F4EE")
    else:
        canvas = Image.new("RGBA", size, "#071C2A")
    canvas.alpha_composite(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    return canvas.convert("RGB")


def build(families: list[str], index: int) -> Path:
    cell_w, cell_h = 600, 360
    sheet = Image.new("RGB", (cell_w * 2, cell_h * len(families)), "#071C2A")
    draw = ImageDraw.Draw(sheet)
    heading = font(20)
    detail = font(16)
    for row, family in enumerate(families):
        for column, candidate in enumerate(("C01", "C02")):
            candidate_id = f"{family}-{candidate}"
            x, y = column * cell_w, row * cell_h
            draw.rounded_rectangle((x + 8, y + 8, x + cell_w - 8, y + cell_h - 8), radius=18, fill="#0E343B", outline="#72DFE8", width=2)
            image = preview(RAW / f"{candidate_id}.png", (540, 280), family not in ("A01", "A02"))
            sheet.paste(image, (x + 30, y + 25))
            draw.text((x + 26, y + 312), f"{candidate_id}  {NAMES[family]}", fill="#FFF7DF", font=heading)
            if family not in ("A01", "A02"):
                draw.text((x + 390, y + 334), "dark / light", fill="#7EE8C7", font=detail)
    output = REVIEWS / f"ALL-CANDIDATES-AUDITION-{index:02}.webp"
    sheet.save(output, "WEBP", quality=94, method=6)
    return output


def build_small(families: list[str], index: int) -> Path:
    cell_w, cell_h = 600, 250
    sheet = Image.new("RGB", (cell_w * 2, cell_h * len(families)), "#071C2A")
    draw = ImageDraw.Draw(sheet)
    heading = font(19)
    detail = font(15)
    for row, family in enumerate(families):
        for column, candidate in enumerate(("C01", "C02")):
            candidate_id = f"{family}-{candidate}"
            x, y = column * cell_w, row * cell_h
            draw.rounded_rectangle((x + 8, y + 8, x + cell_w - 8, y + cell_h - 8), radius=18, fill="#0E343B", outline="#7EE8C7", width=2)
            with Image.open(RAW / f"{candidate_id}.png") as opened:
                source = opened.convert("RGBA")
            cursor = x + 28
            baseline = y + 202
            for size in (48, 72, 112, 176):
                if family in ("A01", "A02"):
                    target_h = max(1, round(size * source.height / source.width))
                    reduced = source.resize((size, target_h), Image.Resampling.LANCZOS)
                else:
                    reduced = source.resize((size, size), Image.Resampling.LANCZOS)
                sheet.paste(reduced.convert("RGB"), (cursor, baseline - reduced.height), reduced.getchannel("A"))
                draw.text((cursor, y + 207), str(size), fill="#FFF7DF", font=detail)
                cursor += size + 22
            draw.text((x + 24, y + 22), f"{candidate_id}  {NAMES[family]}", fill="#FFF7DF", font=heading)
    output = REVIEWS / f"SMALL-SIZE-AUDITION-{index:02}.webp"
    sheet.save(output, "WEBP", quality=94, method=6)
    return output


def main() -> None:
    expected = [RAW / f"A{family:02}-C{candidate:02}.png" for family in range(1, 17) for candidate in range(1, 3)]
    missing = [path.name for path in expected if not path.exists()]
    if missing:
        raise SystemExit(f"Missing candidates: {missing}")
    REVIEWS.mkdir(parents=True, exist_ok=True)
    print(build([f"A{index:02}" for index in range(1, 9)], 1))
    print(build([f"A{index:02}" for index in range(9, 17)], 2))
    for index, start in enumerate((1, 5, 9, 13), start=1):
        print(build_small([f"A{family:02}" for family in range(start, start + 4)], index))


if __name__ == "__main__":
    main()
