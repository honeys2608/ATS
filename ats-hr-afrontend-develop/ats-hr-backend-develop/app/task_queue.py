"""
Task Queue for Background Processing
Handles asynchronous resume processing and other long-running tasks
"""

import asyncio
import uuid
import json
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum


class TaskStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Task:
    id: str
    task_type: str
    status: TaskStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress: int = 0
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    

class TaskQueue:
    def __init__(self):
        self.tasks: Dict[str, Task] = {}
        self.processing = False
        
    def create_task(self, task_type: str, metadata: Dict[str, Any] = None) -> str:
        """Create a new task and return its ID"""
        task_id = str(uuid.uuid4())
        task = Task(
            id=task_id,
            task_type=task_type,
            status=TaskStatus.PENDING,
            created_at=datetime.utcnow(),
            metadata=metadata or {}
        )
        self.tasks[task_id] = task
        return task_id
        
    def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID"""
        return self.tasks.get(task_id)
        
    def update_task_progress(self, task_id: str, progress: int, status: TaskStatus = None):
        """Update task progress and status"""
        if task_id in self.tasks:
            self.tasks[task_id].progress = progress
            if status:
                self.tasks[task_id].status = status
                if status == TaskStatus.PROCESSING and not self.tasks[task_id].started_at:
                    self.tasks[task_id].started_at = datetime.utcnow()
                elif status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                    self.tasks[task_id].completed_at = datetime.utcnow()
                    
    def complete_task(self, task_id: str, result: Dict[str, Any]):
        """Mark task as completed with result"""
        if task_id in self.tasks:
            self.tasks[task_id].status = TaskStatus.COMPLETED
            self.tasks[task_id].progress = 100
            self.tasks[task_id].result = result
            self.tasks[task_id].completed_at = datetime.utcnow()
            
    def fail_task(self, task_id: str, error: str):
        """Mark task as failed with error"""
        if task_id in self.tasks:
            self.tasks[task_id].status = TaskStatus.FAILED
            self.tasks[task_id].error = error
            self.tasks[task_id].completed_at = datetime.utcnow()
            
    def to_dict(self, task: Task) -> Dict[str, Any]:
        """Convert task to dictionary for JSON serialization"""
        return {
            "id": task.id,
            "task_type": task.task_type,
            "status": task.status.value,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "progress": task.progress,
            "result": task.result,
            "error": task.error,
            "metadata": task.metadata
        }


# Global task queue instance
task_queue = TaskQueue()


async def process_bulk_resume_upload_task(task_id: str, files_data: list, duplicate_option: str, user_id: str, db_session):
    """
    Background task to process bulk resume upload
    """
    from app.routes.candidates import handle_resume_files_processing
    
    try:
        task_queue.update_task_progress(task_id, 0, TaskStatus.PROCESSING)
        
        # Process files in background
        result = await handle_resume_files_processing(
            files_data, duplicate_option, user_id, db_session, 
            progress_callback=lambda progress: task_queue.update_task_progress(task_id, progress)
        )
        
        task_queue.complete_task(task_id, result)
        
    except Exception as e:
        task_queue.fail_task(task_id, str(e))


def get_task_status(task_id: str) -> Dict[str, Any]:
    """Get task status for API response"""
    task = task_queue.get_task(task_id)
    if not task:
        return {"error": "Task not found"}
    return task_queue.to_dict(task)