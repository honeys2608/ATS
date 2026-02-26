from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, Optional

from app.resume_parser import parse_resume
from app.resume_parser.scorer import score_candidate_match
from app.task_queue import TaskStatus, task_queue


def run_resume_pipeline(file_path: str, job_payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    parsed = parse_resume(file_path) or {"success": False, "data": {}}
    if not parsed.get("success"):
        return {
            "status": "failed",
            "parsed": parsed.get("data", {}),
            "match_score": None,
            "error": "Failed to parse resume",
            "completed_at": datetime.utcnow().isoformat(),
        }

    parsed_data = parsed.get("data", {})
    match = None
    if job_payload:
        match = score_candidate_match(parsed_data, job_payload)

    return {
        "status": "completed",
        "parsed": parsed_data,
        "match_score": match,
        "completed_at": datetime.utcnow().isoformat(),
        "file_name": os.path.basename(file_path),
        "parser_version": parsed_data.get("parser_version"),
    }


async def run_resume_pipeline_task(task_id: str, file_path: str, job_payload: Optional[Dict[str, Any]] = None) -> None:
    try:
        task_queue.update_task_progress(task_id, 5, TaskStatus.PROCESSING)
        result = run_resume_pipeline(file_path=file_path, job_payload=job_payload or {})
        task_queue.update_task_progress(task_id, 95, TaskStatus.PROCESSING)
        if result.get("status") == "completed":
            task_queue.complete_task(task_id, result)
        else:
            task_queue.fail_task(task_id, result.get("error") or "Pipeline failed")
    except Exception as exc:
        task_queue.fail_task(task_id, str(exc))
    finally:
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass

