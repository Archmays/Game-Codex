from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


BATCH = Path(__file__).resolve().parents[1]
REVIEWS = BATCH / "semantic-reviews"

# Visual semantics chooses the family identity. Integration may prefer another
# candidate only for relative small-size strength; every choice below is still
# independently integration-pass and technical-pass.
SELECTED = {
    "A01": "A01-C02",
    "A02": "A02-C01",
    "A03": "A03-C02",
    "A04": "A04-C01",
    "A05": "A05-C01",
    "A06": "A06-C01",
    "A07": "A07-C01",
    "A08": "A08-C02",
    "A09": "A09-C01",
    "A10": "A10-C01",
    "A11": "A11-C01",
    "A12": "A12-C01",
    "A13": "A13-C01",
    "A14": "A14-C01",
    "A15": "A15-C01",
    "A16": "A16-C01",
}


def read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def main() -> None:
    technical_path = REVIEWS / "TECHNICAL-REVIEW.json"
    visual_path = REVIEWS / "VISUAL-SEMANTIC-REVIEW.json"
    integration_path = REVIEWS / "INTEGRATION-REVIEW.json"
    technical = read(technical_path)
    visual = read(visual_path)
    integration = read(integration_path)
    if any(review.get("verdict") not in ("PASS_TO_SEMANTIC_REVIEW", "ASSET_CANDIDATE_ACCEPTED") for review in (technical, visual, integration)):
        raise SystemExit("All three reviewers must accept before selection")
    technical_by_id = {candidate["candidateId"]: candidate for candidate in technical["candidates"]}
    visual_by_family = {family["familyId"]: family for family in visual["families"]}
    integration_by_family = {family["familyId"]: family for family in integration["families"]}
    families = []
    preference_differences = []
    for family, selected_id in SELECTED.items():
        visual_family = visual_by_family[family]
        integration_family = integration_by_family[family]
        if visual_family["selectedCandidateId"] != selected_id:
            raise SystemExit(f"Visual selection mismatch for {family}")
        integration_candidate = next(item for item in integration_family["candidates"] if item["candidateId"] == selected_id)
        if integration_candidate["integrity"].startswith("FAIL") or not integration_candidate["cropSafety"].startswith("PASS"):
            raise SystemExit(f"Integration did not pass selected candidate {selected_id}")
        technical_candidate = technical_by_id[selected_id]
        if not technical_candidate["technicalPass"]:
            raise SystemExit(f"Technical review did not pass selected candidate {selected_id}")
        selected_assessment = next(item for item in visual_family["candidateAssessments"] if item["candidateId"] == selected_id)
        rejected_assessment = next(item for item in visual_family["candidateAssessments"] if item["candidateId"] != selected_id)
        if integration_family["selectedCandidateId"] != selected_id:
            preference_differences.append({
                "familyId": family,
                "visualSemanticSelection": selected_id,
                "integrationPreference": integration_family["selectedCandidateId"],
                "resolution": "VISUAL_SEMANTIC_SELECTION; BOTH_CANDIDATES_INTEGRATION_PASS",
            })
        families.append({
            "familyId": family,
            "selectedCandidateId": selected_id,
            "selectedSha256": technical_candidate["sha256"],
            "selectionRationale": visual_family["rationale"],
            "integrationDisposition": integration_candidate["disposition"],
            "rejectedCandidateId": rejected_assessment["candidateId"],
            "rejectedCandidateReason": rejected_assessment.get("rejectionReason") or rejected_assessment.get("observations"),
            "regenerationRounds": 1 if family == "A11" else 0,
        })
    result = {
        "schemaVersion": 1,
        "recordType": "THEME_C_MACHINE_SELECTION_RECONCILIATION",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "selectionPolicy": "Technical pass required; visual semantics decides identity among integration-pass alternatives.",
        "reviewEvidence": {
            "technical": {"path": "TECHNICAL-REVIEW.json", "sha256": sha(technical_path)},
            "visualSemantic": {"path": "VISUAL-SEMANTIC-REVIEW.json", "sha256": sha(visual_path)},
            "integration": {"path": "INTEGRATION-REVIEW.json", "sha256": sha(integration_path)},
        },
        "families": families,
        "reviewerPreferenceDifferences": preference_differences,
        "severeConflicts": [],
        "familiesNeedingRegeneration": [],
        "verdict": "ASSET_CANDIDATE_ACCEPTED",
    }
    output = REVIEWS / "SELECTION.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
