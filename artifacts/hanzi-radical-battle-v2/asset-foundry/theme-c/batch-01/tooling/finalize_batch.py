from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


BATCH = Path(__file__).resolve().parents[1]
RAW = BATCH / "raw-candidates"
SELECTED = BATCH / "SELECTED"
THUMBNAILS = BATCH / "thumbnails"
REVIEWS = BATCH / "semantic-reviews"

FAMILY_NAMES = {
    "A01": "camp before",
    "A02": "camp repaired",
    "A03": "mage",
    "A04": "companion",
    "A05": "common monster",
    "A06": "two-phase boss",
    "A07": "guardian-light motif",
    "A08": "star-path motif",
    "A09": "ink-echo motif",
    "A10": "明 meaning magic",
    "A11": "花 meaning magic",
    "A12": "林 meaning magic",
    "A13": "星 meaning magic",
    "A14": "spellbook motif",
    "A15": "treasure-box motif",
    "A16": "world portal motif",
}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def contain(image: Image.Image, box: tuple[int, int], background: tuple[int, int, int, int]) -> Image.Image:
    source = image.convert("RGBA")
    source.thumbnail(box, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", box, background)
    x = (box[0] - source.width) // 2
    y = (box[1] - source.height) // 2
    canvas.alpha_composite(source, (x, y))
    return canvas


def main() -> None:
    selection_path = REVIEWS / "SELECTION.json"
    technical_path = REVIEWS / "TECHNICAL-REVIEW.json"
    visual_path = REVIEWS / "VISUAL-SEMANTIC-REVIEW.json"
    integration_path = REVIEWS / "INTEGRATION-REVIEW.json"
    for required in (selection_path, technical_path, visual_path, integration_path, BATCH / "prompt-pack.md"):
        if not required.exists():
            raise SystemExit(f"Missing required artifact: {required}")

    selection = read_json(selection_path)
    technical = read_json(technical_path)
    visual = read_json(visual_path)
    integration = read_json(integration_path)
    technical_by_id = {item["candidateId"]: item for item in technical["candidates"]}
    decisions = selection.get("families", [])
    if [item.get("familyId") for item in decisions] != list(FAMILY_NAMES):
        raise SystemExit("SELECTION.json must list A01 through A16 in order")
    if visual.get("verdict") != "ASSET_CANDIDATE_ACCEPTED":
        raise SystemExit("Visual semantic reviewer did not accept the batch")
    if integration.get("verdict") != "ASSET_CANDIDATE_ACCEPTED":
        raise SystemExit("Integration reviewer did not accept the batch")

    SELECTED.mkdir(parents=True, exist_ok=True)
    THUMBNAILS.mkdir(parents=True, exist_ok=True)
    selected_inventory = []
    rejected_inventory = []
    for decision in decisions:
        family = decision["familyId"]
        selected_id = decision["selectedCandidateId"]
        if not selected_id.startswith(f"{family}-"):
            raise SystemExit(f"Selection mismatch for {family}: {selected_id}")
        record = technical_by_id.get(selected_id)
        if not record or not record.get("technicalPass"):
            raise SystemExit(f"Selected candidate is not technical-pass: {selected_id}")
        source = RAW / f"{selected_id}.png"
        destination = SELECTED / source.name
        shutil.copy2(source, destination)
        with Image.open(destination) as image:
            for size in (48, 72, 112, 176):
                if family in ("A01", "A02"):
                    target_height = max(1, round(size * image.height / image.width))
                    thumb = image.convert("RGB").resize((size, target_height), Image.Resampling.LANCZOS)
                else:
                    thumb = image.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
                thumb_path = THUMBNAILS / f"{selected_id}-{size}.png"
                thumb.save(thumb_path, optimize=True)
        selected_inventory.append({
            "familyId": family,
            "family": FAMILY_NAMES[family],
            "candidateId": selected_id,
            "path": destination.relative_to(BATCH).as_posix(),
            "sha256": sha256(destination),
            "selectionRationale": decision["selectionRationale"],
            "regenerationRounds": decision.get("regenerationRounds", 0),
        })
        rejected_id = f"{family}-C02" if selected_id.endswith("C01") else f"{family}-C01"
        rejected_path = RAW / f"{rejected_id}.png"
        rejected_inventory.append({
            "familyId": family,
            "candidateId": rejected_id,
            "path": rejected_path.relative_to(BATCH).as_posix(),
            "sha256": sha256(rejected_path),
            "reason": decision["rejectedCandidateReason"],
            "retention": "RETAINED_UNTIL_READINESS_ZIP_AND_CLEANUP_CAN_RUN",
        })

    cell_w, cell_h = 420, 360
    sheet = Image.new("RGB", (cell_w * 4, cell_h * 4), "#071C2A")
    draw = ImageDraw.Draw(sheet)
    try:
        font_path = r"C:\Windows\Fonts\msyh.ttc"
        title_font = ImageFont.truetype(font_path, 22)
        detail_font = ImageFont.truetype(font_path, 17)
    except OSError:
        title_font = ImageFont.load_default()
        detail_font = ImageFont.load_default()
    for index, item in enumerate(selected_inventory):
        row, column = divmod(index, 4)
        x, y = column * cell_w, row * cell_h
        draw.rounded_rectangle((x + 8, y + 8, x + cell_w - 8, y + cell_h - 8), radius=20, fill="#0E343B", outline="#72DFE8", width=2)
        with Image.open(BATCH / item["path"]) as image:
            preview = contain(image, (360, 270), (7, 28, 42, 255))
        sheet.paste(preview.convert("RGB"), (x + 30, y + 28))
        draw.text((x + 24, y + 306), f"{item['familyId']}  {item['family']}", fill="#FFF7DF", font=title_font)
        draw.text((x + 24, y + 334), item["candidateId"], fill="#7EE8C7", font=detail_font)
    contact_sheet = BATCH / "contact-sheet.webp"
    sheet.save(contact_sheet, "WEBP", quality=92, method=6)

    all_candidate_inventory = []
    selected_ids = {item["candidateId"] for item in selected_inventory}
    for record in technical["candidates"]:
        all_candidate_inventory.append({
            "candidateId": record["candidateId"],
            "familyId": record["familyId"],
            "path": record["path"],
            "sha256": record["sha256"],
            "technicalPass": record["technicalPass"],
            "selected": record["candidateId"] in selected_ids,
        })

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    manifest = {
        "schemaVersion": 1,
        "recordType": "THEME_C_ASSET_BATCH_MANIFEST",
        "batchId": "THEME_C_BATCH_01",
        "generatedAtUtc": now,
        "authorizationId": "HUMAN_AUTHORIZED_STEP07_FINAL_CLOSURE_SKILL_CLEANUP_ASSET_FOUNDRY_01",
        "technicalLaneStatus": "STOPPED_NO_MACHINE_PASS",
        "continuationBasis": "Artifact-only Theme C foundry is explicitly allowed when the unrelated STEP07 technical lane stops.",
        "truthSource": {
            "selectedTheme": "C",
            "acceptedFamilies": ["themeC", "mage", "companion", "commonMonster", "boss", "camp", "abilityCards", "meaningMagic"],
            "meaningMagicScope": ["明", "花", "林", "星"],
        },
        "promptPack": {"path": "prompt-pack.md", "sha256": sha256(BATCH / "prompt-pack.md"), "promptCount": 32},
        "generationTool": "OpenAI built-in imagegen",
        "postProcessing": [
            "deterministic dimension normalization only",
            "official imagegen remove_chroma_key.py for sprite alpha",
            "no semantic repainting and no runtime integration",
        ],
        "imageGenerationPerformed": True,
        "generationAttempts": 33,
        "candidateCount": len(all_candidate_inventory),
        "selectedCount": len(selected_inventory),
        "familyCount": len(FAMILY_NAMES),
        "regenerationRounds": max(item["regenerationRounds"] for item in selected_inventory),
        "regeneratedFamilies": [item["familyId"] for item in selected_inventory if item["regenerationRounds"] > 0],
        "candidates": all_candidate_inventory,
        "selected": selected_inventory,
        "reviews": [
            {"role": "technical", "path": "semantic-reviews/TECHNICAL-REVIEW.json", "verdict": technical["verdict"]},
            {"role": "visual-semantic", "path": "semantic-reviews/VISUAL-SEMANTIC-REVIEW.json", "verdict": visual["verdict"]},
            {"role": "integration", "path": "semantic-reviews/INTEGRATION-REVIEW.json", "verdict": integration["verdict"]},
            {"role": "selection-reconciliation", "path": "semantic-reviews/SELECTION.json", "verdict": selection["verdict"]},
        ],
        "nonSevereReviewerPreferenceDifferences": selection["reviewerPreferenceDifferences"],
        "contactSheet": {"path": "contact-sheet.webp", "sha256": sha256(contact_sheet)},
        "runtimeIntegrationPerformed": False,
        "runtimeSourceMutation": False,
        "status": "THEME_C_ASSET_BATCH_01_MACHINE_SELECTED_NOT_INTEGRATED",
    }
    write_json(BATCH / "ASSET-BATCH-MANIFEST.json", manifest)
    write_json(BATCH / "rejected-index.json", {
        "schemaVersion": 1,
        "recordType": "THEME_C_REJECTED_CANDIDATE_INDEX",
        "generatedAtUtc": now,
        "rejectedCount": len(rejected_inventory),
        "candidates": rejected_inventory,
        "rawDeletionPerformed": False,
        "reasonNotDeleted": "The STEP07 technical lane stopped before readiness packaging and cleanup; raw candidate evidence is retained.",
    })
    verdict = {
        "schemaVersion": 1,
        "recordType": "THEME_C_MACHINE_ASSET_VERDICT",
        "generatedAtUtc": now,
        "familyCount": len(FAMILY_NAMES),
        "candidateCount": len(all_candidate_inventory),
        "selectedCount": len(selected_inventory),
        "reviewerVerdicts": {
            "technical": technical["verdict"],
            "visualSemantic": visual["verdict"],
            "integration": integration["verdict"],
        },
        "severeReviewerConflicts": [],
        "nonSevereReviewerPreferenceDifferenceCount": len(selection["reviewerPreferenceDifferences"]),
        "selectionPolicy": selection["selectionPolicy"],
        "runtimeIntegrationPerformed": False,
        "step07MachinePassClaimed": False,
        "verdict": "ASSET_CANDIDATE_ACCEPTED",
        "status": "THEME_C_ASSET_BATCH_01_MACHINE_SELECTED_NOT_INTEGRATED",
    }
    write_json(BATCH / "MACHINE-ASSET-VERDICT.json", verdict)
    print(BATCH / "ASSET-BATCH-MANIFEST.json")
    print(BATCH / "MACHINE-ASSET-VERDICT.json")


if __name__ == "__main__":
    main()
