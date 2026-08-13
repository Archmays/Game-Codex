from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "artifacts/hanzi-radical-battle-v2/v2-chapter-one/assets/raw-selected"
OUT = ROOT / "public/assets/hanzi-radical-battle/v2/theme-c/chapter-one"
OUT.mkdir(parents=True, exist_ok=True)


def crop_grid(source: str, cols: int, rows: int, names: list[str], target_size: tuple[int, int], quality: int = 84) -> None:
    image = Image.open(RAW / source).convert("RGB")
    cell_w, cell_h = image.width / cols, image.height / rows
    for index, name in enumerate(names):
        col, row = index % cols, index // cols
        margin_x = min(4, int(cell_w * 0.012))
        margin_y = min(4, int(cell_h * 0.012))
        left = round(col * cell_w) + margin_x
        top = round(row * cell_h) + margin_y
        right = round((col + 1) * cell_w) - margin_x
        bottom = round((row + 1) * cell_h) - margin_y
        cell = image.crop((left, top, right, bottom))
        cell.thumbnail(target_size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", target_size, (5, 22, 43))
        canvas.paste(cell, ((target_size[0] - cell.width) // 2, (target_size[1] - cell.height) // 2))
        canvas.save(OUT / f"{name}.webp", "WEBP", quality=quality, method=6)


worlds = ["region-glimmer-grove", "region-echo-garden", "region-wind-trail", "region-ink-king-core"]
creatures = [
    "hero-light-speaker", "hero-forest-speaker", "hero-ink-companion", "monster-slot-veil",
    "monster-hand-gust", "monster-distractor-hold", "monster-hint-fade", "monster-ink-shell",
    "monster-dual-route", "monster-mimic-flare", "monster-companion-path", "monster-scenery-shift",
    "boss-lantern-root", "boss-echo-bloom", "boss-wind-bell", "boss-ink-king-core",
]
meanings = [
    "meaning-qing-clear", "meaning-qing-sunny", "meaning-song", "meaning-he", "meaning-hai",
    "meaning-yang", "meaning-an", "meaning-shan", "meaning-ni", "meaning-ta",
    "meaning-hao", "meaning-chang", "meaning-jia", "meaning-miao", "meaning-cai",
    "meaning-yin", "meaning-zao", "meaning-bi", "meaning-chen", "meaning-guo",
    "meaning-tu", "meaning-yuan-round", "meaning-wen", "meaning-bi-close",
]
abilities = [
    "ability-guided-slot", "ability-path-window", "ability-intent-echo", "ability-root-guard", "ability-gentle-undo",
    "ability-wind-order", "ability-meaning-glimpse", "ability-word-echo", "ability-calm-field", "ability-enclosure-ribbon",
    "ability-shared-part", "ability-structure-lantern", "ability-recovery-leaf", "ability-word-lantern", "ability-next-shape",
    "ability-ink-shield", "ability-second-look", "ability-repair-preview",
]
repairs = ["repair-camp-lamp", "repair-garden-path", "repair-world-gate", "repair-magic-tree", "repair-little-bridge", "repair-spellbook-house", "repair-ink-companion-house", "repair-stargazing-platform", "chapter-one-restored"]

crop_grid("P01-worlds.png", 2, 2, worlds, (960, 540), 82)
crop_grid("P02-characters-creatures.png", 4, 4, creatures, (384, 384), 86)
crop_grid("P03-meaning-magic.png", 5, 5, meanings, (256, 256), 84)
crop_grid("P04-abilities.png", 5, 4, abilities, (192, 192), 86)
crop_grid("P05-repairs-ending.png", 3, 3, repairs, (384, 384), 86)

# The hub uses the same production Glimmer Grove art at a lighter thumbnail budget.
hub = Image.open(OUT / "region-glimmer-grove.webp").convert("RGB")
hub.thumbnail((720, 405), Image.Resampling.LANCZOS)
hub.save(OUT / "hub-ink-forest.webp", "WEBP", quality=78, method=6)

print(f"processed={len(worlds) + len(creatures) + len(meanings) + len(abilities) + len(repairs) + 1}")
