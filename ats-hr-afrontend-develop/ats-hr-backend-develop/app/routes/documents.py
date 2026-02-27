from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Response,Form
from urllib.parse import quote

from sqlalchemy.orm import Session
import os
from datetime import datetime
from typing import List
from fastapi.responses import FileResponse
from app.db import get_db
from app import models, schemas
from app.auth import get_current_user
from app.permissions import require_permission
from urllib.parse import quote
import os
router = APIRouter(prefix="/v1/documents", tags=["Documents"])

# Storage Configuration
UPLOAD_ROOT = "uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB limit
ALLOWED_EXT = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"}

# Required documents for checklist
REQUIRED_DOCUMENTS = {
    "aadhar": "Aadhar Card",
    "pan": "PAN Card",
    "resume": "Resume",
    "photo": "Photo",
    "bank_passbook": "Bank Passbook"
}


# ============================================================
# HELPER — restrict employee access to own documents only
# ============================================================
def ensure_employee_owns_profile(current_user, employee):
    if current_user["role"] == "employee":
        if employee.user_id != current_user["id"]:
            raise HTTPException(403, "You can access only your own documents")


def _get_upload_policy(db: Session):
    rows = (
        db.query(models.SystemSettings)
        .filter(models.SystemSettings.config_key.in_(["uploads.max_file_size_mb", "uploads.allowed_extensions"]))
        .all()
    )
    max_mb = 10
    allowed = set(ALLOWED_EXT)
    for row in rows:
        key = row.config_key or f"{row.module_name}.{row.setting_key}"
        value = row.value_json if row.value_json is not None else row.setting_value
        if key == "uploads.max_file_size_mb":
            try:
                max_mb = int(value or 10)
            except Exception:
                max_mb = 10
        if key == "uploads.allowed_extensions" and isinstance(value, list):
            parsed = {str(v).lower().strip() for v in value if str(v).strip()}
            if parsed:
                allowed = parsed
    return max_mb, allowed


# ===================================================================
# 1️⃣ UPLOAD DOCUMENT (Secured + validated + size-limit)
# ===================================================================
@router.post(
    "/employees/{employee_id}",
    response_model=schemas.DocumentUploadResponse,
)
def upload_document(
    employee_id: str,
    category: str = Form(...),   # ✅ IMPORTANT
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    # Validate Employee
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(404, "Employee not found")

    # EMPLOYEE CAN UPLOAD ONLY THEIR OWN DOCUMENTS
    if current_user["role"] == "employee":
        ensure_employee_owns_profile(current_user, employee)
    else:
        # Admin / HR need create permission
        require_permission("documents", "create")(current_user)

    # Validate file extension
    max_mb, allowed_ext = _get_upload_policy(db)
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(400, "Unsupported file type")

    # Read file contents
    contents = file.file.read()
    if len(contents) > max_mb * 1024 * 1024:
        raise HTTPException(400, f"File exceeds {max_mb}MB limit")

    # Prepare upload folder
    folder = os.path.join(UPLOAD_ROOT, "employees", employee_id)
    os.makedirs(folder, exist_ok=True)

    # Unique file name
    stored_name = f"{datetime.utcnow().timestamp()}_{file.filename}"
    storage_path = os.path.join(folder, stored_name)

    with open(storage_path, "wb") as f:
        f.write(contents)

    # Save DB entry
    doc = models.Document(
        employee_id=employee_id,
        category=category,
        filename=file.filename,
        storage_path=storage_path,
        file_size=len(contents),
        mime_type=file.content_type,
        uploaded_by=current_user["id"],
    )

    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Audit log
    audit = models.DocumentAudit(
        document_id=doc.id,
        user_id=current_user["id"],
        action="upload",
    )
    db.add(audit)
    db.commit()

    return {
        "id": doc.id,
        "filename": doc.filename,
        "category": doc.category,
        "uploaded_at": doc.uploaded_at,
    }


# ===================================================================
# 2️⃣ LIST DOCUMENTS OF AN EMPLOYEE
# ===================================================================
@router.get(
    "/employees/{employee_id}",
    response_model=List[schemas.DocumentResponse],
)
def list_documents(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(404, "Employee not found")

    # Employee can view only their own documents
    if current_user["role"] == "employee":
        ensure_employee_owns_profile(current_user, employee)

    docs = db.query(models.Document).filter(models.Document.employee_id == employee_id).all()
    return docs


# ===================================================================
# 3️⃣ DOWNLOAD DOCUMENT (with Audit Trail)
# ===================================================================
@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    db: Session = Depends(get_db),
):
    doc = db.query(models.Document).filter(
        models.Document.id == document_id
    ).first()

    if not doc:
        raise HTTPException(404, "Document not found")

    if not os.path.exists(doc.storage_path):
        raise HTTPException(404, "Stored file is missing")

    return FileResponse(
        path=doc.storage_path,
        filename=doc.filename,
        media_type=doc.mime_type,   # ✅ auto detect (pdf / img / docx)
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(doc.filename)}"
        }
    )

# ===================================================================
# 4️⃣ DELETE DOCUMENT (Admin / HR only)
# ===================================================================
@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    # ✅ FIRST get document
    doc = db.query(models.Document).filter(
        models.Document.id == document_id
    ).first()

    if not doc:
        raise HTTPException(404, "Document not found")

    # ✅ THEN get employee from document
    employee = db.query(models.Employee).filter(
        models.Employee.id == doc.employee_id
    ).first()

    # 🔐 Employee can delete only own document (if you allow)
    if current_user["role"] == "employee":
        ensure_employee_owns_profile(current_user, employee)
    else:
        # Admin / HR permission
        require_permission("documents", "delete")(current_user)

    # ✅ Delete file from disk
    if os.path.exists(doc.storage_path):
        os.remove(doc.storage_path)

    # Audit log
    audit = models.DocumentAudit(
        document_id=document_id,
        user_id=current_user["id"],
        action="delete",
    )
    db.add(audit)

    db.delete(doc)
    db.commit()

    return {"message": "Document deleted successfully"}


# ===================================================================
# 5️⃣ DOCUMENT CHECKLIST – Completed / Pending
# ===================================================================
@router.get("/employees/{employee_id}/checklist")
def document_checklist(
    employee_id: str,
    db: Session = Depends(get_db),
):

    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(404, "Employee not found")

    uploaded_docs = db.query(models.Document).filter(
        models.Document.employee_id == employee_id
    ).all()

    uploaded_map = {
    doc.category: {
        "filename": doc.filename,
        "id": doc.id
    }
    for doc in uploaded_docs
}

    checklist = []
    for key, label in REQUIRED_DOCUMENTS.items():
        checklist.append({
            "category": key,
            "document_name": label,
            "status": "completed" if key in uploaded_map else "pending",
            "file_name": uploaded_map.get(key, {}).get("filename"),
            "document_id": uploaded_map.get(key, {}).get("id"),
    })



    # Auto-update onboarding status
    all_done = all(key in uploaded_map for key in REQUIRED_DOCUMENTS)

    employee.status = "document_verified" if all_done else "pending_documents"
    db.commit()

    return {
        "employee_id": employee_id,
        "onboarding_status": employee.status,
        "required_documents": len(REQUIRED_DOCUMENTS),
        "uploaded_documents": len(uploaded_docs),
        "checklist": checklist,
    }
