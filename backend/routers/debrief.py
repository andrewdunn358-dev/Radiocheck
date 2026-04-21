"""
Debrief — Anonymous User Feedback System for Radio Check Beta Testing
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import io
import csv
import logging

router = APIRouter(prefix="/debrief", tags=["debrief"])

db = None

def set_db(database):
    global db
    db = database


# ============ MODELS ============

class DebriefSubmission(BaseModel):
    # Section 1 — About You (anonymous)
    service_branch: Optional[str] = None
    service_length: Optional[str] = None
    time_since_service: Optional[str] = None

    # Section 2 — First Impressions
    how_heard: Optional[str] = None
    ease_of_navigation: Optional[int] = Field(None, ge=1, le=5)
    first_impression: Optional[str] = None
    device_used: Optional[str] = None

    # Section 3 — AI Companions
    personas_used: Optional[List[str]] = None
    conversation_natural: Optional[int] = Field(None, ge=1, le=5)
    ai_understood: Optional[int] = Field(None, ge=1, le=5)
    ai_response_wrong: Optional[str] = None
    ai_response_wrong_detail: Optional[str] = None
    ai_felt_like_talking_to: Optional[str] = None
    how_felt_after: Optional[str] = None
    ai_personality_fit: Optional[int] = Field(None, ge=1, le=5)

    # Section 4 — Safety & Trust
    felt_safe: Optional[int] = Field(None, ge=1, le=5)
    felt_private: Optional[int] = Field(None, ge=1, le=5)
    crisis_overlay_experience: Optional[str] = None
    would_open_up: Optional[int] = Field(None, ge=1, le=5)
    trust_with_sensitive: Optional[int] = Field(None, ge=1, le=5)

    # Section 5 — Support & Resources
    explored_support_pages: Optional[str] = None
    resources_useful: Optional[int] = Field(None, ge=1, le=5)
    found_what_needed: Optional[str] = None
    would_use_again: Optional[str] = None
    would_recommend: Optional[int] = Field(None, ge=1, le=5)
    net_promoter: Optional[int] = Field(None, ge=0, le=10)

    # Section 6 — Open Feedback
    what_done_well: Optional[str] = None
    what_improve: Optional[str] = None
    missing_feature: Optional[str] = None
    anything_else: Optional[str] = None


# ============ ENDPOINTS ============

@router.post("/submit")
async def submit_debrief(submission: DebriefSubmission):
    """Submit anonymous feedback — no auth required"""
    try:
        data = submission.dict()
        data["submitted_at"] = datetime.now(timezone.utc).isoformat()
        data["id"] = f"debrief_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{id(data) % 10000:04d}"
        await db.debrief_submissions.insert_one(data)
        return {"message": "Thank you for your feedback", "id": data["id"]}
    except Exception as e:
        logging.error(f"Debrief submission error: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit feedback")


@router.get("/submissions")
async def get_debrief_submissions():
    """Get all submissions (admin only in production)"""
    try:
        submissions = await db.debrief_submissions.find({}, {"_id": 0}).sort("submitted_at", -1).to_list(1000)
        return {"submissions": submissions, "total": len(submissions)}
    except Exception as e:
        logging.error(f"Debrief fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch submissions")


@router.get("/summary")
async def get_debrief_summary():
    """Get summary statistics"""
    try:
        submissions = await db.debrief_submissions.find({}, {"_id": 0}).to_list(1000)
        total = len(submissions)
        if total == 0:
            return {"total": 0, "averages": {}, "distributions": {}}

        # Calculate averages for numeric fields
        numeric_fields = [
            "ease_of_navigation", "conversation_natural", "ai_understood",
            "ai_personality_fit", "felt_safe", "felt_private", "would_open_up",
            "trust_with_sensitive", "resources_useful", "would_recommend", "net_promoter"
        ]
        averages = {}
        for field in numeric_fields:
            values = [s[field] for s in submissions if s.get(field) is not None]
            averages[field] = round(sum(values) / len(values), 1) if values else None

        # Distributions
        distributions = {}
        categorical_fields = [
            "service_branch", "service_length", "time_since_service",
            "how_heard", "device_used", "would_use_again",
            "crisis_overlay_experience", "explored_support_pages"
        ]
        for field in categorical_fields:
            dist = {}
            for s in submissions:
                val = s.get(field)
                if val:
                    dist[val] = dist.get(val, 0) + 1
            if dist:
                distributions[field] = dist

        # Persona usage count
        persona_counts = {}
        for s in submissions:
            for p in (s.get("personas_used") or []):
                persona_counts[p] = persona_counts.get(p, 0) + 1
        distributions["personas_used"] = persona_counts

        return {
            "total": total,
            "averages": averages,
            "distributions": distributions
        }
    except Exception as e:
        logging.error(f"Debrief summary error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate summary")


@router.get("/export/csv")
async def export_debrief_csv():
    """Export all submissions as CSV"""
    from fastapi.responses import StreamingResponse

    try:
        submissions = await db.debrief_submissions.find({}, {"_id": 0}).sort("submitted_at", -1).to_list(1000)
        if not submissions:
            raise HTTPException(status_code=404, detail="No submissions to export")

        output = io.StringIO()
        fields = [
            "id", "submitted_at", "service_branch", "service_length", "time_since_service",
            "how_heard", "ease_of_navigation", "first_impression", "device_used",
            "personas_used", "conversation_natural", "ai_understood",
            "ai_response_wrong", "ai_response_wrong_detail", "ai_felt_like_talking_to",
            "how_felt_after", "ai_personality_fit",
            "felt_safe", "felt_private", "crisis_overlay_experience",
            "would_open_up", "trust_with_sensitive",
            "explored_support_pages", "resources_useful", "found_what_needed",
            "would_use_again", "would_recommend", "net_promoter",
            "what_done_well", "what_improve", "missing_feature", "anything_else"
        ]

        writer = csv.DictWriter(output, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        for s in submissions:
            row = {k: s.get(k, "") for k in fields}
            if isinstance(row.get("personas_used"), list):
                row["personas_used"] = ", ".join(row["personas_used"])
            writer.writerow(row)

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=debrief_export.csv"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Debrief CSV export error: {e}")
        raise HTTPException(status_code=500, detail="Failed to export CSV")


@router.get("/export/pdf")
async def export_debrief_pdf():
    """Export summary report as PDF"""
    from fastapi.responses import Response

    try:
        submissions = await db.debrief_submissions.find({}, {"_id": 0}).sort("submitted_at", -1).to_list(1000)
        total = len(submissions)

        # Calculate averages
        numeric_fields = {
            "ease_of_navigation": "Ease of Navigation",
            "conversation_natural": "Conversation Felt Natural",
            "ai_understood": "AI Understood Me",
            "ai_personality_fit": "AI Personality Fit",
            "felt_safe": "Felt Safe",
            "felt_private": "Felt Private",
            "would_open_up": "Would Open Up",
            "trust_with_sensitive": "Trust with Sensitive Topics",
            "resources_useful": "Resources Useful",
            "would_recommend": "Would Recommend",
        }
        averages = {}
        for field, label in numeric_fields.items():
            values = [s[field] for s in submissions if s.get(field) is not None]
            averages[label] = round(sum(values) / len(values), 1) if values else "N/A"

        nps_values = [s["net_promoter"] for s in submissions if s.get("net_promoter") is not None]
        nps_score = "N/A"
        if nps_values:
            promoters = sum(1 for v in nps_values if v >= 9) / len(nps_values) * 100
            detractors = sum(1 for v in nps_values if v <= 6) / len(nps_values) * 100
            nps_score = round(promoters - detractors)

        # Build averages rows
        avg_rows = ""
        for label, val in averages.items():
            max_val = 5
            bar_width = (float(val) / max_val * 100) if val != "N/A" else 0
            avg_rows += f"""<tr>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{label}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;">{val}/5</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">
                    <div style="background:#e2e8f0;border-radius:4px;height:16px;width:100%;">
                        <div style="background:#dc2626;border-radius:4px;height:16px;width:{bar_width}%;"></div>
                    </div>
                </td>
            </tr>"""

        # Collect free text responses
        text_fields = {
            "first_impression": "First Impressions",
            "how_felt_after": "How They Felt After Talking to AI",
            "ai_response_wrong_detail": "AI Responses That Felt Wrong",
            "what_done_well": "What Radio Check Did Well",
            "what_improve": "What Could Be Improved",
            "missing_feature": "Missing Features",
            "anything_else": "Additional Comments"
        }
        text_sections = ""
        for field, label in text_fields.items():
            responses = [s[field] for s in submissions if s.get(field) and s[field].strip()]
            if responses:
                items = "".join(f'<li style="margin-bottom:6px;padding:8px;background:#f8fafc;border-radius:4px;">{r}</li>' for r in responses)
                text_sections += f"""
                <h3 style="font-size:13pt;margin-top:20px;margin-bottom:8px;color:#1e293b;">{label} ({len(responses)} responses)</h3>
                <ul style="list-style:none;padding:0;margin:0;">{items}</ul>"""

        # Would use again distribution
        use_again_dist = {}
        for s in submissions:
            val = s.get("would_use_again")
            if val:
                use_again_dist[val] = use_again_dist.get(val, 0) + 1

        use_again_rows = ""
        for option, count in sorted(use_again_dist.items(), key=lambda x: -x[1]):
            pct = round(count / total * 100)
            use_again_rows += f"""<tr>
                <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">{option}</td>
                <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">{count}</td>
                <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">{pct}%</td>
            </tr>"""

        html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>
            @page {{ size: A4; margin: 20mm; }}
            body {{ font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt; line-height: 1.6; color: #1e293b; }}
            h1 {{ font-size: 22pt; color: #0f172a; border-bottom: 3px solid #dc2626; padding-bottom: 8px; }}
            h2 {{ font-size: 15pt; color: #0f172a; margin-top: 24px; border-bottom: 1px solid #dc2626; padding-bottom: 4px; }}
            table {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }}
            th {{ background: #0f172a; color: white; padding: 8px 12px; text-align: left; font-size: 9pt; text-transform: uppercase; }}
            .stat-box {{ display: inline-block; width: 22%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; margin: 4px; }}
            .stat-number {{ font-size: 28pt; font-weight: 700; color: #dc2626; }}
            .stat-label {{ font-size: 8.5pt; color: #64748b; text-transform: uppercase; }}
        </style></head><body>
        <h1>Debrief Report — Radio Check Beta Testing</h1>
        <p style="color:#64748b;">Generated: {datetime.now(timezone.utc).strftime('%d %B %Y at %H:%M UTC')} | Total Responses: {total}</p>

        <div style="margin:20px 0;">
            <div class="stat-box"><div class="stat-number">{total}</div><div class="stat-label">Responses</div></div>
            <div class="stat-box"><div class="stat-number">{averages.get('Felt Safe', 'N/A')}</div><div class="stat-label">Avg Safety Score</div></div>
            <div class="stat-box"><div class="stat-number">{averages.get('Would Recommend', 'N/A')}</div><div class="stat-label">Avg Recommend</div></div>
            <div class="stat-box"><div class="stat-number">{nps_score}</div><div class="stat-label">NPS Score</div></div>
        </div>

        <h2>Scores Summary (out of 5)</h2>
        <table>
            <tr><th>Metric</th><th style="text-align:center;">Average</th><th>Distribution</th></tr>
            {avg_rows}
        </table>

        <h2>Would Use Again</h2>
        <table>
            <tr><th>Response</th><th style="text-align:center;">Count</th><th style="text-align:center;">Percentage</th></tr>
            {use_again_rows}
        </table>

        <h2>Net Promoter Score</h2>
        <p>NPS: <strong>{nps_score}</strong> (based on {len(nps_values)} responses)</p>

        <h2>Free Text Responses</h2>
        {text_sections if text_sections else '<p style="color:#64748b;">No free text responses yet.</p>'}

        <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:9pt;color:#94a3b8;text-align:center;">
            Radio Check Debrief Report — Confidential
        </div>
        </body></html>"""

        from weasyprint import HTML as WeasyHTML
        pdf_bytes = WeasyHTML(string=html).write_pdf()

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=debrief_report.pdf"}
        )
    except Exception as e:
        logging.error(f"Debrief PDF export error: {e}")
        raise HTTPException(status_code=500, detail="Failed to export PDF")
