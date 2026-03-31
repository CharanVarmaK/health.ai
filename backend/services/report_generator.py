"""
Health Report Generator
-----------------------
Generates styled HTML reports (downloadable as PDF via browser print).
Uses ReportLab for server-side PDF if available.
"""
import os
import json
from datetime import datetime, timezone
from pathlib import Path
from loguru import logger

REPORTS_DIR = Path("reports")
REPORTS_DIR.mkdir(exist_ok=True)


def _safe_list(val) -> list:
    if isinstance(val, list): return val
    if isinstance(val, str):
        try: return json.loads(val)
        except: return [val] if val else []
    return []


def generate_html_report(user, profile, appointments=None, metrics_only=False) -> str:
    """Generate a complete styled HTML health report string."""
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%d %B %Y, %I:%M %p IST")
    report_id = f"HAI-{int(now.timestamp())}"

    conditions  = _safe_list(profile.conditions)
    allergies   = _safe_list(profile.allergies)
    medications = _safe_list(profile.current_medications)
    family_hx   = _safe_list(profile.family_history)

    def metric_row(label, value, status="normal"):
        colors = {"normal": "#16a37a", "caution": "#f59e0b", "alert": "#ef4444"}
        color = colors.get(status, "#16a37a")
        return f"""<tr>
          <td>{label}</td>
          <td><strong>{value or "—"}</strong></td>
          <td style="color:{color}">{"✅ Normal" if status=="normal" else "⚠️ Monitor" if status=="caution" else "🔴 Alert"}</td>
        </tr>"""

    appt_rows = ""
    if appointments:
        for a in appointments[:5]:
            appt_rows += f"<tr><td>{a.doctor_name}</td><td>{a.specialty}</td><td>{a.hospital_name}</td><td>{a.appointment_date} {a.appointment_time}</td><td>{a.status}</td></tr>"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>HealthAI Health Report — {profile.display_name}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f8fffe; color: #0f2318; font-size: 14px; }}
  .page {{ max-width: 820px; margin: 0 auto; padding: 40px 36px; }}
  .header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #16a37a; }}
  .logo {{ display: flex; align-items: center; gap: 12px; }}
  .logo-mark {{ width: 40px; height: 40px; background: #16a37a; border-radius: 10px; display: flex; align-items: center; justify-content: center; }}
  .logo-mark svg {{ width: 22px; height: 22px; fill: white; }}
  .logo-name {{ font-size: 22px; font-weight: 700; color: #0f2318; }}
  .logo-sub  {{ font-size: 11px; color: #5f8f79; }}
  .report-meta {{ text-align: right; font-size: 12px; color: #5f8f79; line-height: 1.6; }}
  .report-id   {{ font-family: monospace; font-weight: 600; color: #16a37a; }}
  h2 {{ font-size: 15px; font-weight: 700; color: #16a37a; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #d1fae5; }}
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 4px; }}
  th {{ background: #f0fdf9; color: #0d6e53; font-size: 12px; font-weight: 600; padding: 8px 10px; text-align: left; border: 1px solid #d1fae5; }}
  td {{ padding: 8px 10px; border: 1px solid #e5f7f0; font-size: 13px; color: #0f2318; vertical-align: top; }}
  tr:nth-child(even) td {{ background: #f8fffe; }}
  .tags {{ display: flex; flex-wrap: wrap; gap: 5px; }}
  .tag {{ background: #d1fae5; color: #0d6e53; padding: 2px 9px; border-radius: 10px; font-size: 11px; font-weight: 500; }}
  .tag-red   {{ background: #fee2e2; color: #991b1b; }}
  .tag-amber {{ background: #fef3c7; color: #78350f; }}
  .disclaimer {{ margin-top: 36px; padding: 14px 16px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; font-size: 12px; color: #78350f; line-height: 1.6; }}
  .footer {{ margin-top: 24px; text-align: center; font-size: 11px; color: #9ca3af; padding-top: 16px; border-top: 1px solid #e5e7eb; }}
  @media print {{
    body {{ background: white; }}
    .no-print {{ display: none; }}
  }}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo">
      <div class="logo-mark"><svg viewBox="0 0 24 24"><path d="M12 2L13.5 8.5L20 7L15.5 12L20 17L13.5 15.5L12 22L10.5 15.5L4 17L8.5 12L4 7L10.5 8.5L12 2Z"/></svg></div>
      <div><div class="logo-name">HealthAI</div><div class="logo-sub">Health Report</div></div>
    </div>
    <div class="report-meta">
      <div>Generated: {date_str}</div>
      <div>Report ID: <span class="report-id">{report_id}</span></div>
    </div>
  </div>

  <h2>Patient Information</h2>
  <table>
    <tr><th>Name</th><th>Age / Gender</th><th>Blood Group</th><th>Location</th></tr>
    <tr>
      <td><strong>{profile.full_name or profile.display_name}</strong></td>
      <td>{profile.age or "—"} / {profile.gender or "—"}</td>
      <td><strong>{profile.blood_group or "—"}</strong></td>
      <td>{profile.city or "Hyderabad"}, {profile.state or "Telangana"}</td>
    </tr>
  </table>

  <table style="margin-top:8px">
    <tr>
      <th>Height</th><th>Weight</th><th>DOB</th><th>Phone</th>
    </tr>
    <tr>
      <td>{profile.height_cm or "—"}</td>
      <td>{profile.weight_kg or "—"}</td>
      <td>{profile.date_of_birth or "—"}</td>
      <td>{profile.phone or "—"}</td>
    </tr>
  </table>

  <h2>Current Health Metrics</h2>
  <table>
    <tr><th>Metric</th><th>Value</th><th>Status</th></tr>
    {metric_row("Blood Pressure", profile.blood_pressure, "caution" if profile.blood_pressure else "normal")}
    {metric_row("Heart Rate",     profile.heart_rate)}
    {metric_row("Temperature",    profile.temperature)}
    {metric_row("SpO₂",           profile.spo2)}
    {metric_row("Blood Glucose",  profile.blood_glucose)}
    {metric_row("Cholesterol",    profile.cholesterol)}
  </table>

  <h2>Medical History</h2>
  <table>
    <tr><th>Existing Conditions</th><td>
      <div class="tags">{' '.join(f'<span class="tag tag-amber">{c}</span>' for c in conditions) or "None reported"}</div>
    </td></tr>
    <tr><th>Known Allergies</th><td>
      <div class="tags">{' '.join(f'<span class="tag tag-red">{a}</span>' for a in allergies) or "None reported"}</div>
    </td></tr>
    <tr><th>Current Medications</th><td>
      <div class="tags">{' '.join(f'<span class="tag">{m}</span>' for m in medications) or "None"}</div>
    </td></tr>
    <tr><th>Family History</th><td>
      <div class="tags">{' '.join(f'<span class="tag tag-amber">{f}</span>' for f in family_hx) or "None reported"}</div>
    </td></tr>
    <tr><th>Emergency Contact</th><td>
      {profile.emergency_contact_name or "—"} — {profile.emergency_contact_phone or "—"}
    </td></tr>
  </table>

  {"<h2>Upcoming Appointments</h2><table><tr><th>Doctor</th><th>Specialty</th><th>Hospital</th><th>Date & Time</th><th>Status</th></tr>" + appt_rows + "</table>" if appt_rows else ""}

  <div class="disclaimer">
    <strong>⚕️ Medical Disclaimer:</strong> This report is generated by HealthAI for informational purposes only.
    It does not constitute a medical diagnosis or replace professional medical advice.
    Always consult a qualified healthcare provider before making any medical decisions.
    In case of emergency, call <strong>108 (Ambulance)</strong> immediately.
  </div>

  <div class="footer">
    HealthAI © {now.year} &nbsp;|&nbsp; Report ID: {report_id} &nbsp;|&nbsp;
    This document is confidential and intended solely for the named patient.
  </div>
</div>
</body>
</html>"""
    return html


async def save_report_file(user_id: int, content: str, report_type: str) -> str:
    """Save report HTML to disk. Returns relative file path."""
    filename = f"report_{user_id}_{report_type}_{int(datetime.now().timestamp())}.html"
    path = REPORTS_DIR / filename
    path.write_text(content, encoding="utf-8")
    return str(path)
