from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
import os
from datetime import datetime
from app.db import get_db
from app import models, schemas

router = APIRouter(prefix="/v1/chat", tags=["Chat"])


# ---------------- SEND MESSAGE (text/file) ----------------
@router.post("/send", response_model=schemas.ChatMessageResponse)
async def send_chat(
    sender_id: str = Form(...),
    receiver_id: str = Form(...),
    message: str = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db)
):

    file_url = None
    file_type = None

    if file:
        folder = "uploads/chat"
        os.makedirs(folder, exist_ok=True)

        file_path = f"{folder}/{datetime.utcnow().timestamp()}_{file.filename}"

        with open(file_path, "wb") as f:
            f.write(await file.read())

        file_url = file_path
        file_type = file.content_type

    msg = models.ChatMessage(
        sender_id=sender_id,
        receiver_id=receiver_id,
        message=message,
        file_url=file_url,
        file_type=file_type
    )

    db.add(msg)
    db.commit()
    db.refresh(msg)

    return msg


# ---------------- GET CHAT HISTORY ----------------
@router.get("/{user1}/{user2}", response_model=list[schemas.ChatMessageResponse])
def get_chat(user1: str, user2: str, db: Session = Depends(get_db)):

    msgs = db.query(models.ChatMessage).filter(
        ((models.ChatMessage.sender_id == user1) & (models.ChatMessage.receiver_id == user2)) |
        ((models.ChatMessage.sender_id == user2) & (models.ChatMessage.receiver_id == user1))
    ).order_by(models.ChatMessage.created_at.asc()).all()

    return msgs
