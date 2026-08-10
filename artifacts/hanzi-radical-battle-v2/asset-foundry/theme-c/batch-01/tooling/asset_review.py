from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


BATCH = Path(__file__).resolve().parents[1]
RAW = BATCH / "raw-candidates"
REVIEWS = BATCH / "semantic-reviews"

FAMILIES = {
    "A01": ("camp before", "background", 1920, 1080),
    "A02": ("camp repaired", "background", 1920, 1080),
    "A03": ("mage", "sprite", 1024, 1024),
    "A04": ("companion", "sprite", 1024, 1024),
    "A05": ("common monster", "sprite", 1024, 1024),
    "A06": ("two-phase boss", "sprite", 1024, 1024),
    "A07": ("guardian-light icon/card motif", "sprite", 1024, 1024),
    "A08": ("star-path icon/card motif", "sprite", 1024, 1024),
    "A09": ("ink-echo icon/card motif", "sprite", 1024, 1024),
    "A10": ("Ming meaning magic", "sprite", 1024, 1024),
    "A11": ("Hua meaning magic", "sprite", 1024, 1024),
    "A12": ("Lin meaning magic", "sprite", 1024, 1024),
    "A13": ("Xing meaning magic", "sprite", 1024, 1024),
    "A14": ("spellbook motif", "sprite", 1024, 1024),
    "A15": ("treasure-box motif", "sprite", 1024, 1024),
    "A16": ("world portal motif", "sprite", 1024, 1024),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def ahash(image: Image.Image) -> str:
    gray = image.convert("RGB").resize((16, 16), Image.Resampling.LANCZOS).convert("L")
    pixels = list(gray.getdata())
    mean = sum(pixels) / len(pixels)
    bits = "".join("1" if value >= mean else "0" for value in pixels)
    return f"{int(bits, 2):064X}"


def technical_record(path: Path, family: str) -> dict:
    label, asset_type, expected_w, expected_h = FAMILIES[family]
    try:
        with Image.open(path) as opened:
            opened.verify()
        with Image.open(path) as opened:
            image = opened.convert("RGBA") if asset_type == "sprite" else opened.copy()
            width, height = opened.size
            mode = opened.mode
            checks: dict[str, object] = {
                "fileCorruption": False,
                "dimensions": {
                    "actual": [width, height],
                    "required": [expected_w, expected_h],
                    "pass": width >= expected_w and height >= expected_h
                    if asset_type == "background"
                    else width == expected_w and height == expected_h,
                },
                "mode": {
                    "actual": mode,
                    "required": "opaque RGB/RGBA" if asset_type == "background" else "RGBA with true alpha",
                },
            }
            if asset_type == "background":
                alpha = opened.getchannel("A") if "A" in opened.getbands() else None
                opaque = alpha is None or alpha.getextrema() == (255, 255)
                checks["alpha"] = {"opaque": opaque, "pass": opaque}
                checks["safeMargin"] = {
                    "pass": None,
                    "note": "Composition-safe overlay area requires semantic review.",
                }
            else:
                alpha = image.getchannel("A")
                alpha_min, alpha_max = alpha.getextrema()
                bbox = alpha.point(lambda value: 255 if value > 16 else 0).getbbox()
                if bbox:
                    left, top, right, bottom = bbox
                    margins = {
                        "left": left / width,
                        "top": top / height,
                        "right": (width - right) / width,
                        "bottom": (height - bottom) / height,
                    }
                    safe = all(value >= 0.12 for value in margins.values())
                else:
                    margins = None
                    safe = False
                magenta_pixels = sum(
                    1 for red, green, blue, alpha_value in image.getdata()
                    if alpha_value > 16 and red > 220 and blue > 220 and green < 50
                )
                checks["alpha"] = {
                    "extrema": [alpha_min, alpha_max],
                    "transparentPixelCount": sum(1 for value in alpha.getdata() if value == 0),
                    "pass": alpha_min == 0 and alpha_max == 255,
                }
                checks["safeMargin"] = {
                    "fractions": margins,
                    "threshold": 0.12,
                    "pass": safe,
                }
                checks["chromaRemnant"] = {
                    "magentaPixelCount": magenta_pixels,
                    "pass": magenta_pixels == 0,
                }
            hard_passes = []
            for key in ("dimensions", "alpha", "safeMargin", "chromaRemnant"):
                item = checks.get(key)
                if isinstance(item, dict) and item.get("pass") is not None:
                    hard_passes.append(bool(item["pass"]))
            return {
                "candidateId": path.stem,
                "familyId": family,
                "family": label,
                "assetType": asset_type,
                "path": path.relative_to(BATCH).as_posix(),
                "sha256": sha256(path),
                "perceptualHash16": ahash(image),
                "checks": checks,
                "technicalPass": all(hard_passes),
            }
    except Exception as error:  # pragma: no cover - evidence path
        return {
            "candidateId": path.stem,
            "familyId": family,
            "family": label,
            "assetType": asset_type,
            "path": path.relative_to(BATCH).as_posix(),
            "sha256": sha256(path) if path.exists() else None,
            "checks": {"fileCorruption": True},
            "technicalPass": False,
            "error": str(error),
        }


def main() -> None:
    REVIEWS.mkdir(parents=True, exist_ok=True)
    records: list[dict] = []
    missing: list[str] = []
    for family in FAMILIES:
        for candidate in ("C01", "C02"):
            path = RAW / f"{family}-{candidate}.png"
            if path.exists():
                records.append(technical_record(path, family))
            else:
                missing.append(path.name)

    exact_groups: dict[str, list[str]] = {}
    perceptual_groups: dict[str, list[str]] = {}
    for record in records:
        exact_groups.setdefault(record["sha256"], []).append(record["candidateId"])
        perceptual = record.get("perceptualHash16")
        if perceptual:
            perceptual_groups.setdefault(perceptual, []).append(record["candidateId"])
    exact_duplicates = [group for group in exact_groups.values() if len(group) > 1]
    perceptual_duplicates = [group for group in perceptual_groups.values() if len(group) > 1]
    near_duplicate_pairs = []
    for left_index, left in enumerate(records):
        left_hash = left.get("perceptualHash16")
        if not left_hash:
            continue
        for right in records[left_index + 1:]:
            right_hash = right.get("perceptualHash16")
            if not right_hash:
                continue
            distance = (int(left_hash, 16) ^ int(right_hash, 16)).bit_count()
            if distance <= 8:
                near_duplicate_pairs.append({
                    "candidates": [left["candidateId"], right["candidateId"]],
                    "hammingDistance256": distance,
                })
    duplicate_ids = {candidate for group in exact_duplicates for candidate in group}
    duplicate_ids.update(candidate for pair in near_duplicate_pairs for candidate in pair["candidates"])
    for record in records:
        record["checks"]["duplicateImage"] = {
            "exactDuplicate": record["candidateId"] in duplicate_ids,
            "pass": record["candidateId"] not in duplicate_ids,
        }
        record["technicalPass"] = record["technicalPass"] and record["candidateId"] not in duplicate_ids

    family_results = []
    for family, (label, asset_type, _, _) in FAMILIES.items():
        candidates = [record for record in records if record["familyId"] == family]
        passing = [record["candidateId"] for record in candidates if record["technicalPass"]]
        family_results.append({
            "familyId": family,
            "family": label,
            "assetType": asset_type,
            "candidateCount": len(candidates),
            "technicalPassingCandidates": passing,
            "verdict": "PASS_TO_SEMANTIC_REVIEW" if passing else "AUTO_REGENERATE",
        })

    report = {
        "schemaVersion": 1,
        "recordType": "THEME_C_ASSET_TECHNICAL_REVIEW",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "batch": "theme-c/batch-01",
        "expectedCandidateCount": 32,
        "actualCandidateCount": len(records),
        "missingCandidates": missing,
        "exactDuplicateGroups": exact_duplicates,
        "samePerceptualHashGroups": perceptual_duplicates,
        "nearDuplicatePairsAtOrBelow8Bits": near_duplicate_pairs,
        "candidates": records,
        "families": family_results,
        "verdict": "PASS_TO_SEMANTIC_REVIEW"
        if len(records) == 32 and not missing and all(item["verdict"] == "PASS_TO_SEMANTIC_REVIEW" for item in family_results)
        else "AUTO_REGENERATE",
    }
    output = REVIEWS / "TECHNICAL-REVIEW.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(output)
    print(report["verdict"])


if __name__ == "__main__":
    main()
