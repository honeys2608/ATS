"""
FastAPI routes for resume parsing endpoints.
"""

import os
import tempfile
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List

from .parser import ResumeParser
from .models import ResumeParseResponse
from .text_extractor import extract_text_from_file, clean_extracted_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["resume-parser"])


@router.post("/parse-resume", response_model=ResumeParseResponse)
async def parse_single_resume(file: UploadFile = File(...)) -> ResumeParseResponse:
    """
    Parse a single resume file (PDF, DOCX, DOC, or TXT).
    
    Returns structured candidate data with confidence scores.
    
    Supported formats:
    - PDF (.pdf)
    - Word Document (.docx)
    - Legacy Word (.doc)
    
    Max file size: 10MB
    
    Example response:
    ```json
    {
        "status": "success",
        "parsed_data": {
            "full_name": "Alok Sharan Singh",
            "email": "alokpvt04@gmail.com",
            "phone": "+91-8582003582",
            "current_company": "Moj (ShareChat)",
            "current_designation": "MODERATION Executive",
            "total_experience": "1 year",
            "skills": ["Content Moderation", "Chat Support"],
            ...
        },
        "metadata": {
            "name_confidence": 0.92,
            "overall_confidence": 0.85,
            "parsing_method": "top_lines+email+ner",
            "fields_extracted": ["full_name", "email", "phone", ...],
            "fields_failed": ["date_of_birth", ...],
            "warnings": []
        },
        "file_info": {
            "filename": "resume.pdf",
            "parsed_at": "2024-02-11T10:30:00.000000"
        }
    }
    ```
    """
    try:
        # Validate file
        allowed_extensions = {'.pdf', '.docx', '.doc', '.txt'}
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_ext}. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Read file
        content = await file.read()
        
        # Check file size (10MB limit)
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="File size exceeds 10MB limit"
            )
        
        if len(content) == 0:
            raise HTTPException(
                status_code=400,
                detail="File is empty"
            )
        
        # Save to temp file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_ext)
        try:
            temp_file.write(content)
            temp_file.close()
            
            # Extract text from file
            logger.info(f"Extracting text from {file.filename}")
            raw_text = extract_text_from_file(temp_file.name, file_ext)
            
            if not raw_text or len(raw_text.strip()) < 10:
                raise HTTPException(
                    status_code=400,
                    detail="Could not extract text from file. File may be corrupted or empty."
                )
            
            # Clean text
            raw_text = clean_extracted_text(raw_text)
            
            # Parse resume
            parser = ResumeParser()
            result = parser.parse(raw_text, file.filename)
            
            logger.info(f"Resume parsing completed: {result.status}")
            return result
        
        finally:
            # Cleanup temp file
            if os.path.exists(temp_file.name):
                try:
                    os.unlink(temp_file.name)
                except Exception as e:
                    logger.warning(f"Could not delete temp file: {e}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resume parsing error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Resume parsing failed: {str(e)}"
        )


@router.post("/parse-resumes/bulk")
async def parse_bulk_resumes(files: List[UploadFile] = File(...)):
    """
    Parse multiple resume files in bulk.
    
    Max files per request: 50
    
    Returns:
    ```json
    {
        "status": "completed",
        "total": 3,
        "successful": 2,
        "failed": 1,
        "results": [
            {
                "file_name": "resume1.pdf",
                "status": "success",
                "data": { ... }
            },
            {
                "file_name": "resume2.docx",
                "status": "success",
                "data": { ... }
            },
            {
                "file_name": "resume3.pdf",
                "status": "failed",
                "error": "Could not extract text from file"
            }
        ]
    }
    ```
    """
    try:
        if len(files) > 50:
            raise HTTPException(
                status_code=400,
                detail="Maximum 50 files per request"
            )
        
        if len(files) == 0:
            raise HTTPException(
                status_code=400,
                detail="No files provided"
            )
        
        results = []
        successful = 0
        failed = 0
        
        logger.info(f"Starting bulk parsing of {len(files)} files")
        
        for file in files:
            try:
                # Validate file
                file_ext = os.path.splitext(file.filename)[1].lower()
                allowed_extensions = {'.pdf', '.docx', '.doc', '.txt'}
                
                if file_ext not in allowed_extensions:
                    raise ValueError(f"Unsupported file type: {file_ext}")
                
                # Read file
                content = await file.read()
                
                if len(content) > 10 * 1024 * 1024:
                    raise ValueError("File size exceeds 10MB limit")
                
                if len(content) == 0:
                    raise ValueError("File is empty")
                
                # Save to temp file
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_ext)
                try:
                    temp_file.write(content)
                    temp_file.close()
                    
                    # Extract and parse
                    raw_text = extract_text_from_file(temp_file.name, file_ext)
                    raw_text = clean_extracted_text(raw_text)
                    
                    parser = ResumeParser()
                    result = parser.parse(raw_text, file.filename)
                    
                    results.append({
                        'file_name': file.filename,
                        'status': 'success',
                        'data': result.dict()
                    })
                    successful += 1
                
                finally:
                    if os.path.exists(temp_file.name):
                        try:
                            os.unlink(temp_file.name)
                        except:
                            pass
            
            except Exception as e:
                logger.error(f"Failed to parse {file.filename}: {e}")
                results.append({
                    'file_name': file.filename,
                    'status': 'failed',
                    'error': str(e)
                })
                failed += 1
        
        logger.info(f"Bulk parsing completed: {successful} success, {failed} failed")
        
        return {
            'status': 'completed',
            'total': len(files),
            'successful': successful,
            'failed': failed,
            'results': results
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk parsing error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Bulk parsing failed: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint for resume parser."""
    return {
        "status": "healthy",
        "service": "resume-parser",
        "version": "2.0.0"
    }
