from __future__ import annotations

from typing import Any, Dict, List


RISK_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "INDETERMINATE": 3}


def calculate_risk(checks: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not checks:
        return {
            "overall_risk": "INDETERMINATE",
            "rule_ids": ["NO_CHECKS_AVAILABLE"],
            "recommendation": "request additional checks",
            "missing_checks": ["deepfake_liveness", "voice_spoofing", "document_tampering"],
            "explanation": "No detector results were available for classification.",
        }

    rule_ids: List[str] = []
    missing_checks: List[str] = []
    high_count = 0
    fail_count = 0
    review_count = 0
    unavailable_count = 0

    for check in checks:
        name = check.get("name") or "unknown_detector"
        status = str(check.get("status") or "UNAVAILABLE").upper()
        if status == "UNAVAILABLE":
            unavailable_count += 1
            missing_checks.append(name)
            rule_ids.append("UNAVAILABLE_CHECK_NOTED")
        elif status == "FAIL":
            fail_count += 1
            high_count += 1
            rule_ids.append(f"{name.upper()}_FAIL")
        elif status == "REVIEW":
            review_count += 1
            rule_ids.append(f"{name.upper()}_REVIEW")
        elif status == "PASS":
            continue

    if unavailable_count and fail_count == 0 and review_count == 0:
        overall_risk = "INDETERMINATE"
        recommendation = "request additional checks"
        explanation = "All available checks passed or were unavailable; insufficient evidence for a confident conclusion."
        rule_ids = ["UNAVAILABLE_CHECK_NOTED"]
    elif fail_count > 0 or high_count >= 2:
        overall_risk = "HIGH"
        recommendation = "refer for human review"
        explanation = "Multiple high-risk conditions or failed checks indicate elevated fraud risk."
    elif review_count > 0:
        overall_risk = "MEDIUM"
        recommendation = "request additional checks"
        explanation = "At least one detector needs review and no unambiguous low-risk signal is present."
    else:
        overall_risk = "LOW"
        recommendation = "continue verification"
        explanation = "All available checks passed and no material risk signals were triggered."

    return {
        "overall_risk": overall_risk,
        "rule_ids": list(dict.fromkeys(rule_ids)),
        "recommendation": recommendation,
        "missing_checks": list(dict.fromkeys(missing_checks)),
        "explanation": explanation,
        "individual_check_outcomes": checks,
    }
