from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timedelta, date
import time
from typing import Optional

from app.db import get_db
from app.auth import get_current_user
from app.permissions import require_permission
from app import models


router = APIRouter(prefix="/v1/reports", tags=["Reports"])

CACHE_TTL_SECONDS = 60
_REPORT_CACHE = {}


def _cache_get(key: str):
    entry = _REPORT_CACHE.get(key)
    if not entry:
        return None
    ts, data = entry
    if time.time() - ts > CACHE_TTL_SECONDS:
        _REPORT_CACHE.pop(key, None)
        return None
    return data


def _cache_set(key: str, data):
    _REPORT_CACHE[key] = (time.time(), data)


def _parse_date_range(from_str: Optional[str], to_str: Optional[str]):
    if not from_str and not to_str:
        return None, None
    try:
        start_date = datetime.fromisoformat(from_str).date() if from_str else None
        end_date = datetime.fromisoformat(to_str).date() if to_str else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="`from` cannot be after `to`.")
    start_dt = datetime.combine(start_date, datetime.min.time()) if start_date else None
    end_dt = datetime.combine(end_date, datetime.max.time()) if end_date else None
    return start_dt, end_dt


def _apply_date_filter(query, column, start_dt, end_dt):
    if start_dt:
        query = query.filter(column >= start_dt)
    if end_dt:
        query = query.filter(column <= end_dt)
    return query


def _is_recruiter(user):
    return (user.get("role") or "").lower() == "recruiter"


def _candidate_scope(query, user, db: Session):
    if not _is_recruiter(user):
        return query
    candidate_ids = (
        db.query(models.CandidateSubmission.candidate_id)
        .filter(models.CandidateSubmission.recruiter_id == user.get("id"))
        .subquery()
    )
    return query.filter(models.Candidate.id.in_(candidate_ids))


def _job_scope(query, user):
    if not _is_recruiter(user):
        return query
    return query.join(models.job_recruiters).filter(
        models.job_recruiters.c.recruiter_id == user.get("id")
    )


def _interview_scope(query, user):
    if not _is_recruiter(user):
        return query
    return query.join(
        models.CandidateSubmission,
        models.CandidateSubmission.id == models.Interview.submission_id,
    ).filter(models.CandidateSubmission.recruiter_id == user.get("id"))


def _format_trend(rows):
    return [
        {"date": r[0].isoformat() if isinstance(r[0], date) else str(r[0]), "count": r[1]}
        for r in rows
    ]


@router.get("/candidates")
@require_permission("recruitment", "view_reports")
def candidate_reports(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cache_key = f"candidates:{current_user.get('id')}:{from_date}:{to_date}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    start_dt, end_dt = _parse_date_range(from_date, to_date)
    base_q = db.query(models.Candidate)
    base_q = _candidate_scope(base_q, current_user, db)
    base_q = _apply_date_filter(base_q, models.Candidate.created_at, start_dt, end_dt)

    total_candidates = base_q.count()

    status_rows = (
        base_q.with_entities(
            models.Candidate.status, func.count(models.Candidate.id)
        )
        .group_by(models.Candidate.status)
        .all()
    )
    candidates_by_status = [
        {"status": (s or "unknown"), "count": c} for s, c in status_rows
    ]

    source_rows = (
        base_q.with_entities(
            func.coalesce(models.Candidate.source, "Unknown").label("source"),
            func.count(models.Candidate.id),
        )
        .group_by("source")
        .all()
    )
    candidates_by_source = [
        {"source": s, "count": c} for s, c in source_rows
    ]

    trend_rows = (
        base_q.with_entities(
            func.date(models.Candidate.created_at).label("day"),
            func.count(models.Candidate.id),
        )
        .group_by("day")
        .order_by("day")
        .all()
    )

    data = {
        "total_candidates": total_candidates,
        "new_candidates": total_candidates,
        "candidates_by_status": candidates_by_status,
        "candidates_by_source": candidates_by_source,
        "trend": _format_trend(trend_rows),
        "range": {"from": from_date, "to": to_date},
    }
    _cache_set(cache_key, data)
    return data


@router.get("/jobs")
@require_permission("recruitment", "view_reports")
def job_reports(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cache_key = f"jobs:{current_user.get('id')}:{from_date}:{to_date}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    start_dt, end_dt = _parse_date_range(from_date, to_date)
    base_q = db.query(models.Job)
    base_q = _job_scope(base_q, current_user)
    base_q = _apply_date_filter(base_q, models.Job.created_at, start_dt, end_dt)

    total_jobs = base_q.count()

    active_jobs = base_q.filter(
        (models.Job.status == "active") | (models.Job.is_active == True)  # noqa: E712
    ).count()
    closed_jobs = base_q.filter(
        (models.Job.status == "closed") | (models.Job.is_active == False)  # noqa: E712
    ).count()

    dept_rows = (
        base_q.with_entities(
            func.coalesce(models.Job.department, "Unknown").label("department"),
            func.count(models.Job.id),
        )
        .group_by("department")
        .all()
    )
    jobs_by_department = [{"department": d, "count": c} for d, c in dept_rows]

    trend_rows = (
        base_q.with_entities(
            func.date(models.Job.created_at).label("day"),
            func.count(models.Job.id),
        )
        .group_by("day")
        .order_by("day")
        .all()
    )

    data = {
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "closed_jobs": closed_jobs,
        "jobs_by_department": jobs_by_department,
        "trend": _format_trend(trend_rows),
        "range": {"from": from_date, "to": to_date},
    }
    _cache_set(cache_key, data)
    return data


@router.get("/interviews")
@require_permission("recruitment", "view_reports")
def interview_reports(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cache_key = f"interviews:{current_user.get('id')}:{from_date}:{to_date}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    start_dt, end_dt = _parse_date_range(from_date, to_date)
    base_q = db.query(models.Interview)
    base_q = _interview_scope(base_q, current_user)

    date_col = func.coalesce(models.Interview.scheduled_at, models.Interview.created_at)
    base_q = _apply_date_filter(base_q, date_col, start_dt, end_dt)

    total_interviews = base_q.count()
    scheduled_count = base_q.filter(models.Interview.status == "scheduled").count()
    completed_count = base_q.filter(models.Interview.status == "completed").count()
    cancelled_count = base_q.filter(
        models.Interview.status.in_(["cancelled", "canceled"])
    ).count()
    no_show_count = base_q.filter(
        models.Interview.status.in_(["no_show", "no-show", "noshow"])
    ).count()

    no_show_rate = (no_show_count / total_interviews) if total_interviews else 0

    today = datetime.utcnow().date()
    scheduled_today = (
        base_q.filter(func.date(models.Interview.scheduled_at) == today).count()
    )

    trend_rows = (
        base_q.with_entities(
            func.date(date_col).label("day"),
            func.count(models.Interview.id),
        )
        .group_by("day")
        .order_by("day")
        .all()
    )

    data = {
        "total_interviews": total_interviews,
        "scheduled_count": scheduled_count,
        "scheduled_today": scheduled_today,
        "completed_count": completed_count,
        "cancelled_count": cancelled_count,
        "no_show_count": no_show_count,
        "no_show_rate": round(no_show_rate, 4),
        "trend": _format_trend(trend_rows),
        "range": {"from": from_date, "to": to_date},
    }
    _cache_set(cache_key, data)
    return data


@router.get("/recruiters")
@require_permission("recruitment", "view_reports")
def recruiter_reports(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cache_key = f"recruiters:{current_user.get('id')}:{from_date}:{to_date}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    start_dt, end_dt = _parse_date_range(from_date, to_date)

    recruiter_query = db.query(models.User).filter(models.User.role == "recruiter")
    if _is_recruiter(current_user):
        recruiter_query = recruiter_query.filter(models.User.id == current_user.get("id"))
    recruiters = recruiter_query.all()
    recruiter_ids = [r.id for r in recruiters]

    submissions_q = db.query(
        models.CandidateSubmission.recruiter_id,
        func.count(models.CandidateSubmission.id),
    ).filter(models.CandidateSubmission.recruiter_id.in_(recruiter_ids))
    submissions_q = _apply_date_filter(
        submissions_q, models.CandidateSubmission.created_at, start_dt, end_dt
    )
    submissions_q = submissions_q.group_by(models.CandidateSubmission.recruiter_id)
    submissions_map = {r: c for r, c in submissions_q.all()}

    interviews_q = (
        db.query(
            models.CandidateSubmission.recruiter_id,
            func.count(models.Interview.id),
        )
        .join(
            models.Interview,
            models.Interview.submission_id == models.CandidateSubmission.id,
        )
        .filter(models.CandidateSubmission.recruiter_id.in_(recruiter_ids))
    )
    interviews_q = _apply_date_filter(
        interviews_q, models.Interview.scheduled_at, start_dt, end_dt
    )
    interviews_q = interviews_q.group_by(models.CandidateSubmission.recruiter_id)
    interviews_map = {r: c for r, c in interviews_q.all()}

    hires_q = (
        db.query(
            models.CandidateSubmission.recruiter_id,
            func.count(models.CandidateSubmission.id),
        )
        .join(
            models.Candidate,
            models.Candidate.id == models.CandidateSubmission.candidate_id,
        )
        .filter(models.CandidateSubmission.recruiter_id.in_(recruiter_ids))
        .filter(models.Candidate.status.in_(["hired", "joined"]))
    )
    hires_q = _apply_date_filter(
        hires_q, models.CandidateSubmission.created_at, start_dt, end_dt
    )
    hires_q = hires_q.group_by(models.CandidateSubmission.recruiter_id)
    hires_map = {r: c for r, c in hires_q.all()}

    data = {
        "recruiters": [
            {
                "recruiter_id": r.id,
                "recruiter_name": r.full_name or r.username,
                "candidates_sourced": submissions_map.get(r.id, 0),
                "interviews_scheduled": interviews_map.get(r.id, 0),
                "hires_made": hires_map.get(r.id, 0),
            }
            for r in recruiters
        ],
        "range": {"from": from_date, "to": to_date},
    }
    _cache_set(cache_key, data)
    return data


def _build_simple_pdf(title: str, lines: list[str]) -> bytes:
    def esc(text: str) -> str:
        return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    content_lines = [f"({esc(title)}) Tj T*" ]
    for line in lines:
        content_lines.append(f"({esc(line)}) Tj T*")
    content_stream = "BT /F1 12 Tf 50 750 Td " + " ".join(content_lines) + " ET"

    objects = []
    objects.append("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj")
    objects.append("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj")
    objects.append(
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj"
    )
    objects.append("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj")
    objects.append(f"5 0 obj << /Length {len(content_stream)} >> stream {content_stream} endstream endobj")

    xref_positions = []
    pdf = "%PDF-1.4\n"
    for obj in objects:
        xref_positions.append(len(pdf))
        pdf += obj + "\n"

    xref_start = len(pdf)
    pdf += "xref\n0 6\n0000000000 65535 f \n"
    for pos in xref_positions:
        pdf += f"{pos:010d} 00000 n \n"
    pdf += "trailer << /Size 6 /Root 1 0 R >>\nstartxref\n"
    pdf += str(xref_start) + "\n%%EOF"
    return pdf.encode("latin1")


@router.get("/export")
@require_permission("recruitment", "view_reports")
def export_reports(
    report_type: str = Query(..., alias="type"),
    fmt: str = Query("csv", alias="format"),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    report_type = report_type.lower()
    fmt = fmt.lower()

    if report_type not in {"candidates", "jobs", "interviews", "recruiters"}:
        raise HTTPException(status_code=400, detail="Invalid report type.")

    if report_type == "candidates":
        data = candidate_reports(from_date, to_date, db, current_user)
        rows = [
            {"metric": "total_candidates", "value": data["total_candidates"]},
            {"metric": "new_candidates", "value": data["new_candidates"]},
        ]
        rows += [
            {"metric": f"status:{item['status']}", "value": item["count"]}
            for item in data["candidates_by_status"]
        ]
        rows += [
            {"metric": f"source:{item['source']}", "value": item["count"]}
            for item in data["candidates_by_source"]
        ]
    elif report_type == "jobs":
        data = job_reports(from_date, to_date, db, current_user)
        rows = [
            {"metric": "total_jobs", "value": data["total_jobs"]},
            {"metric": "active_jobs", "value": data["active_jobs"]},
            {"metric": "closed_jobs", "value": data["closed_jobs"]},
        ]
        rows += [
            {"metric": f"department:{item['department']}", "value": item["count"]}
            for item in data["jobs_by_department"]
        ]
    elif report_type == "interviews":
        data = interview_reports(from_date, to_date, db, current_user)
        rows = [
            {"metric": "total_interviews", "value": data["total_interviews"]},
            {"metric": "scheduled_count", "value": data["scheduled_count"]},
            {"metric": "scheduled_today", "value": data["scheduled_today"]},
            {"metric": "completed_count", "value": data["completed_count"]},
            {"metric": "cancelled_count", "value": data["cancelled_count"]},
            {"metric": "no_show_count", "value": data["no_show_count"]},
            {"metric": "no_show_rate", "value": data["no_show_rate"]},
        ]
    else:
        data = recruiter_reports(from_date, to_date, db, current_user)
        rows = [
            {
                "recruiter": r["recruiter_name"],
                "candidates_sourced": r["candidates_sourced"],
                "interviews_scheduled": r["interviews_scheduled"],
                "hires_made": r["hires_made"],
            }
            for r in data["recruiters"]
        ]

    if fmt == "csv":
        import pandas as pd
        from fastapi.responses import StreamingResponse
        from io import BytesIO

        df = pd.DataFrame(rows)
        output = BytesIO()
        df.to_csv(output, index=False)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={report_type}_report.csv"},
        )

    if fmt == "xlsx":
        import pandas as pd
        from fastapi.responses import StreamingResponse
        from io import BytesIO

        df = pd.DataFrame(rows)
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Report")
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={report_type}_report.xlsx"},
        )

    if fmt == "pdf":
        lines = []
        if rows:
            for row in rows:
                line = ", ".join([f"{k}={v}" for k, v in row.items()])
                lines.append(line)
        else:
            lines = ["No data found for the selected range."]
        pdf_bytes = _build_simple_pdf(f"{report_type.title()} Report", lines)
        from fastapi.responses import Response
        return Response(
            pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={report_type}_report.pdf"},
        )

    raise HTTPException(status_code=400, detail="Invalid export format.")
