"""
Extract current company, designation, and employment status from resume.
Handles various date formats and "Present" indicators.
"""

import re
from typing import Dict, List, Optional
from dateutil import parser as date_parser
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class CurrentPositionExtractor:
    """Extract current employment position with high accuracy."""
    
    CURRENT_INDICATORS = [
        'present', 'current', 'till date', 'ongoing', 'till now',
        'to date', 'to present', 'till present', 'now', 'currently'
    ]
    
    MONTH_ABBR = {
        'jan': 1, 'january': 1,
        'feb': 2, 'february': 2,
        'mar': 3, 'march': 3,
        'apr': 4, 'april': 4,
        'may': 5,
        'jun': 6, 'june': 6,
        'jul': 7, 'july': 7,
        'aug': 8, 'august': 8,
        'sep': 9, 'sept': 9, 'september': 9,
        'oct': 10, 'october': 10,
        'nov': 11, 'november': 11,
        'dec': 12, 'december': 12,
    }

    TITLE_NOISE_WORDS = {
        "worked",
        "working",
        "experience",
        "knowledge",
        "responsible",
        "responsibilities",
        "project",
        "projects",
        "ticket",
        "tickets",
        "clarification",
        "issues",
        "resolution",
        "candidate",
        "college",
        "university",
        "payroll",
        "involved",
        "support",
    }
    
    def extract_current_position(self, text: str) -> Dict:
        """
        Main method to extract current employment details.
        
        Returns:
            {
                'current_company': str or None,
                'current_designation': str or None,
                'start_date': str or None,
                'confidence': float
            }
        """
        # Find experience section
        experience_section = self._find_experience_section(text)
        
        if not experience_section:
            logger.debug("No experience section found")
            return self._empty_result()
        
        # Parse all work entries
        work_entries = self._parse_work_entries(experience_section)
        
        if not work_entries:
            logger.debug("No work entries parsed")
            return self._empty_result()
        
        # Find current position
        current_entry = self._identify_current_position(work_entries)
        
        if current_entry:
            return {
                'current_company': current_entry['company'],
                'current_designation': current_entry['designation'],
                'start_date': current_entry['start_date'],
                'confidence': current_entry['confidence']
            }
        
        logger.debug("No current position identified")
        return self._empty_result()
    
    def _find_experience_section(self, text: str) -> Optional[str]:
        """Locate the work experience section in resume."""
        section_patterns = [
            r'(?:work\s+experience|professional\s+experience|employment|experience|career\s+history)[\s\n:]+(.+?)(?=\n\s*(?:education|skills|projects|certifications|achievements|languages|\Z))',
        ]
        
        for pattern in section_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1)
        
        # If no explicit section, use first half (usually before education)
        # This is risky, so return None
        return None
    
    def _parse_work_entries(self, text: str) -> List[Dict]:
        """Parse individual work experience entries."""
        entries = []
        
        # Split by multiple newlines (entry separator)
        blocks = re.split(r'\n\s*\n', text)
        
        for block in blocks:
            entry = self._parse_single_entry(block)
            if entry:
                entries.append(entry)
        
        return entries
    
    def _parse_single_entry(self, block: str) -> Optional[Dict]:
        """Parse a single work experience block."""
        lines = [line.strip() for line in block.split('\n') if line.strip()]
        
        if len(lines) < 2:
            return None
        
        company = None
        designation = None
        start_date = None
        end_date = None
        is_current = False
        
        # Try to find dates first
        date_line = None
        date_line_idx = -1
        
        for idx, line in enumerate(lines):
            if self._contains_date(line):
                date_line = line
                date_line_idx = idx
                dates = self._extract_dates(line)
                if dates:
                    start_date = dates.get('start')
                    end_date = dates.get('end')
                    is_current = dates.get('is_current', False)
                break
        
        if not date_line or date_line_idx == -1:
            return None
        
        # Extract company and designation from lines before date
        # Pattern 1: Company | Location
        for i in range(max(0, date_line_idx - 2), date_line_idx):
            line = lines[i]
            
            if '|' in line:
                parts = line.split('|')
                if len(parts) >= 2:
                    potential_company = parts[0].strip()
                    if self._looks_like_company(potential_company):
                        company = potential_company
                        break
        
        # If company not found, check first non-date line
        if not company and date_line_idx > 0:
            for i in range(max(0, date_line_idx - 2), date_line_idx):
                line = lines[i]
                if self._looks_like_company(line):
                    company = line
                    break
        
        # Extract designation
        # Usually line after company or line before date
        for i in range(date_line_idx):
            line = lines[i]
            
            # Skip if this is company line
            if company and line == company:
                continue
            
            # Skip if this is date line
            if line == date_line:
                continue
            
            # Check if looks like designation
            if self._looks_like_job_title(line) and len(line) > 3:
                if not designation:
                    designation = line

        if not designation:
            for i in range(date_line_idx):
                line = lines[i]
                match = re.search(
                    r"\bas\s+(?:an?\s+)?([A-Za-z][A-Za-z/&\-\s]{2,60})\s+(?:from|at|in|for)\b",
                    line,
                    re.IGNORECASE,
                )
                if not match:
                    continue
                candidate_designation = match.group(1).strip()
                if self._looks_like_job_title(candidate_designation):
                    designation = candidate_designation
                    break
        
        if company and designation:
            return {
                'company': company,
                'designation': designation,
                'start_date': start_date,
                'end_date': end_date,
                'is_current': is_current,
                'confidence': 0.9 if is_current else 0.7,
                'raw_text': block
            }
        
        return None
    
    def _contains_date(self, text: str) -> bool:
        """Check if text contains date information."""
        date_patterns = [
            r'\d{4}',  # Year
            r'\d{1,2}[/-]\d{1,2}',  # MM/DD or DD/MM
            r'(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)',  # Month
            r'present|current|till\s+date|ongoing',  # Current indicators
        ]
        
        return any(re.search(p, text, re.IGNORECASE) for p in date_patterns)
    
    def _extract_dates(self, text: str) -> Dict:
        """
        Extract start and end dates from text.
        
        Examples:
        - "Oct 2024 - Present"
        - "Nov 2025 – Present"
        - "Sept 23 - Aug 24"
        - "2022 - 2025"
        - "Oct 2024 - " (ongoing)
        """
        text_lower = text.lower()
        
        # Check if current position
        is_current = any(
            indicator in text_lower 
            for indicator in self.CURRENT_INDICATORS
        )
        
        # Extract date range
        # Patterns to try
        patterns = [
            r'([a-z]+\s+\d{1,2}[,]?\s+\d{4}|\d{1,2}\s+[a-z]+\s+\d{4}|[a-z]+\s+\d{4}|\d{4})\s*[-–—to]\s*([a-z]+\s+\d{1,2}[,]?\s+\d{4}|\d{1,2}\s+[a-z]+\s+\d{4}|[a-z]+\s+\d{4}|\d{4}|present|current)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text_lower)
            if match:
                start = match.group(1).strip()
                end = match.group(2).strip()
                
                # Format dates
                start_formatted = self._format_date(start)
                end_formatted = self._format_date(end)
                
                return {
                    'start': start_formatted,
                    'end': end_formatted if end_formatted else end.title(),
                    'is_current': is_current or end.lower() in ['present', 'current']
                }
        
        return {}
    
    def _format_date(self, date_str: str) -> Optional[str]:
        """Format date string to consistent format."""
        if not date_str:
            return None
        
        date_str = date_str.strip()
        
        # Handle "Present" or "Current"
        if date_str.lower() in ['present', 'current', 'till date', 'ongoing']:
            return 'Present'
        
        # Try to parse date
        try:
            # Common formats: "Oct 2024", "October 2024", "2024-10"
            parsed = date_parser.parse(date_str)
            return parsed.strftime('%b %Y')  # "Oct 2024"
        except:
            # If parsing fails, return as-is with title case
            return date_str.title() if len(date_str) < 30 else None
    
    def _looks_like_company(self, text: str) -> bool:
        """Check if text looks like a company name."""
        company_suffixes = [
            'pvt', 'ltd', 'limited', 'inc', 'corp', 'llc', 
            'company', 'co', 'technologies', 'solutions', 'systems',
            'services', 'group', 'holdings', 'enterprises', 'b.v.',
            'infosys', 'tcs', 'accenture', 'cognizant', 'wipro', 'mindtree',
            'hashrate', 'moj', 'sharechat', 'akshu'
        ]
        
        text_lower = text.lower()
        
        # Check for company suffixes
        if any(suffix in text_lower for suffix in company_suffixes):
            return True
        
        # Check length and format
        words = text.split()
        if len(words) >= 2:
            # Multiple words usually indicate company
            return not all(word.lower() in self.CURRENT_INDICATORS for word in words)
        
        # Single word but capitalized and length > 3
        if len(words) == 1 and text[0].isupper() and len(text) > 3:
            return True
        
        return False
    
    def _looks_like_job_title(self, text: str) -> bool:
        """Check if text looks like a job title."""
        job_keywords = [
            'engineer', 'developer', 'manager', 'analyst', 'consultant',
            'architect', 'designer', 'specialist', 'coordinator', 'executive',
            'officer', 'assistant', 'associate', 'lead', 'senior', 'junior',
            'intern', 'trainee', 'director', 'head', 'chief', 'scientist',
            'programmer', 'coder', 'tester', 'qa', 'devops', 'admin',
            'executive', 'specialist', 'officer', 'moderation'
        ]
        
        raw = (text or "").strip()
        if len(raw) < 3 or len(raw) > 100:
            return False

        text_lower = raw.lower()
        if "@" in text_lower or "http://" in text_lower or "https://" in text_lower:
            return False
        if re.search(r"\b(19|20)\d{2}\b", text_lower):
            return False
        if re.search(r"\d{4,}", text_lower):
            return False
        if re.search(r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b", text_lower):
            return False

        words = [w for w in re.split(r"[\s,/|()\-]+", text_lower) if w]
        if not words or len(words) > 8:
            return False
        if any(word in self.TITLE_NOISE_WORDS for word in words):
            return False

        return any(kw in words for kw in job_keywords)
    
    def _identify_current_position(self, entries: List[Dict]) -> Optional[Dict]:
        """Identify current position from list of work entries."""
        # First priority: Entry marked as current
        for entry in entries:
            if entry.get('is_current'):
                return entry
        
        # Second priority: Entry with "Present" in end_date
        for entry in entries:
            end_date = entry.get('end_date', '').lower()
            if 'present' in end_date or 'current' in end_date:
                entry['is_current'] = True
                return entry
        
        # Third priority: Most recent entry (first in list, assuming reverse chronological)
        if entries:
            return entries[0]
        
        return None
    
    def _empty_result(self) -> Dict:
        """Return empty result structure."""
        return {
            'current_company': None,
            'current_designation': None,
            'start_date': None,
            'confidence': 0.0
        }
