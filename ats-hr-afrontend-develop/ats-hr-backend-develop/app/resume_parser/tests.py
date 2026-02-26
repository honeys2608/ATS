"""
Comprehensive test suite for resume parser.
Tests with realistic resume data and edge cases.
"""

import re
import pytest
from .parser import ResumeParser
from .name_extractor import NameExtractor
from .position_extractor import CurrentPositionExtractor


class TestNameExtractor:
    """Test name extraction with 6 strategies."""
    
    @pytest.fixture
    def extractor(self):
        return NameExtractor()
    
    def test_strategy_top_lines_simple(self, extractor):
        """Test: Simple name at top of resume"""
        text = "Alok Sharan Singh\nalokpvt04@gmail.com\n+91-8582003582"
        result = extractor.extract_name(text)
        
        assert result['name'] == "Alok Sharan Singh"
        assert result['confidence'] >= 0.85
        assert 'top_lines' in result['method']
    
    def test_strategy_top_lines_all_caps(self, extractor):
        """Test: ALL CAPS name extraction"""
        text = "AKASH ANANDA REDEKAR\nakashredekar166@gmail.com"
        result = extractor.extract_name(text)
        
        # Should extract correctly and title case it
        assert "AKASH" in result['name'].upper()
        assert result['confidence'] >= 0.85
    
    def test_strategy_email_derivation(self, extractor):
        """Test: Derive name from email"""
        text = """
        Company Information:
        akashredekar166@gmail.com
        Phone: +91-123456789
        """
        result = extractor.extract_name(text)
        
        # Email strategy should kick in with reasonable confidence
        assert "Akash" in result['name'] or "akash" in result['name'].lower()
        assert result['confidence'] >= 0.5
    
    def test_single_name_with_email(self, extractor):
        """Test: Single name (Honey) derived from email"""
        text = """
        Name: Honey
        Email: honeypkb2620@gmail.com
        Phone: +91-9876543210
        """
        result = extractor.extract_name(text)
        
        assert "Honey" in result['name']
        assert result['confidence'] >= 0.6
    
    def test_name_with_initial(self, extractor):
        """Test: Name with initial (Soujanya K)"""
        text = """
        SOUJANYA K
        Email: soujanyakrishnappa2004@gmail.com
        """
        result = extractor.extract_name(text)
        
        assert "Soujanya" in result['name']
        assert result['confidence'] >= 0.7
    
    def test_reject_job_title_as_name(self, extractor):
        """Test: Should NOT extract job title as name"""
        false_positives = [
            "Software Engineer",
            "Experience in developing WebDynpro components",
            "ELV – BMS ENGINEER",
            "Senior Manager - Operations",
            "Strong Knowledge",
            "Tickets / Issues resolution / clarification of queries raised by user.",
        ]
        
        for text in false_positives:
            is_name = extractor._is_likely_name(text)
            assert not is_name, f"Incorrectly identified '{text}' as name"
    
    def test_accept_valid_names(self, extractor):
        """Test: Should identify valid names"""
        valid_names = [
            "Alok Sharan Singh",
            "AKASH ANANDA REDEKAR",
            "Honey",
            "Soujanya K",
            "Mohammed Irfan M",
        ]
        
        for name in valid_names:
            is_name = extractor._is_likely_name(name)
            assert is_name, f"Failed to identify '{name}' as valid name"


class TestCurrentPositionExtractor:
    """Test current position extraction."""
    
    @pytest.fixture
    def extractor(self):
        return CurrentPositionExtractor()
    
    def test_extract_current_position_present_keyword(self, extractor):
        """Test: Extract current role with 'Present' keyword"""
        text = """
        Work Experience
        
        Moj (ShareChat) | Bengaluru, Karnataka
        MODERATION Executive
        Oct 2024 - Present
        
        Previous Company
        Senior Developer
        2022 - 2024
        """
        
        result = extractor.extract_current_position(text)
        
        assert result['current_company'] == "Moj (ShareChat)"
        assert "MODERATION" in result['current_designation']
        assert result['confidence'] >= 0.7
    
    def test_extract_multiple_positions(self, extractor):
        """Test: Extract most recent (current) from multiple positions"""
        text = """
        Work Experience
        
        Hashrate Communications Pvt. Ltd. | Ghansoli
        ELV - BMS Engineer
        Oct 2024 - Present
        
        Previous Company Ltd
        Software Developer
        2023 - Sep 2024
        
        Old Company
        Junior Developer
        2021 - 2023
        """
        
        result = extractor.extract_current_position(text)
        
        assert "Hashrate" in result['current_company']
        assert "BMS" in result['current_designation']
        assert result['confidence'] >= 0.7
    
    def test_no_current_position(self, extractor):
        """Test: Resume with no current employment"""
        text = """
        Work Experience
        
        Previous Company
        Senior Developer
        2022 - 2024
        
        Another Company
        Junior Developer
        2021 - 2022
        """
        
        result = extractor.extract_current_position(text)
        
        # Should return None or still extract latest position
        # depending on implementation
        assert result['confidence'] == 0.0 or result['current_company'] is not None
    
    def test_date_parsing_various_formats(self, extractor):
        """Test: Parse various date formats"""
        test_cases = [
            ("Oct 2024 - Present", ("Oct 2024", "Present", True)),
            ("November 2025 – Present", ("Nov 2025", "Present", True)),
            ("Sept 23 - Aug 24", ("Sept 23", "Aug 24", False)),
            ("2022 - 2024", ("2022", "2024", False)),
        ]
        
        for date_str, expected in test_cases:
            result = extractor._extract_dates(date_str)
            
            if result:
                assert result.get('is_current') == expected[2], \
                    f"Failed for: {date_str}, is_current mismatch"


class TestResumeParser:
    """Integration tests for complete parser."""
    
    @pytest.fixture
    def parser(self):
        return ResumeParser()
    
    def test_parse_complete_resume_alok(self, parser):
        """Test: Parse complete Alok Sharan Singh resume data"""
        text = """
        ALOK SHARAN SINGH
        alokpvt04@gmail.com
        +91-8582003582
        
        Professional Summary
        Content moderation and customer support professional with 1 year of experience.
        
        Work Experience
        
        Moj (ShareChat) | Bengaluru, Karnataka
        MODERATION Executive
        Oct 2024 - Present
        - Moderate user-generated content
        - Support chat operations
        - Experience with Google Sheets and data entry
        
        Education
        
        Bachelor of Commerce (B.Com)
        Delhi University
        2022 - 2023
        
        Skills
        Content Moderation, Chat Support, Google Sheets, Data Entry
        """
        
        result = parser.parse(text, "alok_resume.pdf")
        
        assert result.status in ['success', 'partial']
        assert result.parsed_data.full_name == "Alok Sharan Singh"
        assert result.parsed_data.email == "alokpvt04@gmail.com"
        assert result.parsed_data.phone == "+91-8582003582"
        assert "Moj" in result.parsed_data.current_company or result.parsed_data.current_company is None
        assert result.metadata.name_confidence >= 0.85
    
    def test_parse_resume_akash(self, parser):
        """Test: Parse Akash Ananda Redekar resume"""
        text = """
        AKASH ANANDA REDEKAR
        akashredekar166@gmail.com
        +918147852318
        
        Work Experience
        
        Hashrate Communications Pvt. Ltd. | Ghansoli, Navi Mumbai
        ELV - BMS Engineer – Data Center & Infrastructure
        Oct 2024 - Present
        2 years experience
        
        Top Skills
        ABAP, ALV, Adobe Forms, BADI
        
        Education
        B.Tech (Electrical Engineering)
        Mumbai Institute of Technology
        2020 - 2024
        """
        
        result = parser.parse(text, "AkashAnandRedekar.pdf")
        
        assert result.status in ['success', 'partial']
        assert "AKASH" in result.parsed_data.full_name.upper()
        assert result.parsed_data.total_experience in ["2 years", "2y 0m"]
        assert result.metadata.name_confidence >= 0.80
    
    def test_parse_resume_honey(self, parser):
        """Test: Parse Honey (single name) resume"""
        text = """
        Honey
        honeypkb2620@gmail.com
        
        Current Position
        Software Engineer at Akshu Technologies Solutions B.V.
        
        Experience: 2+ years
        
        Skills: Python, JavaScript, React, SQL
        """
        
        result = parser.parse(text, "honey_resume.docx")
        
        assert result.status in ['success', 'partial']
        assert "Honey" in result.parsed_data.full_name
        assert result.parsed_data.email == "honeypkb2620@gmail.com"
    
    def test_parse_with_missing_fields(self, parser):
        """Test: Parse resume with missing fields"""
        text = """
        John Doe
        jane@example.com
        """
        
        result = parser.parse(text, "minimal_resume.pdf")
        
        # Should still succeed but with partial confidence
        assert result.parsed_data.full_name == "John Doe"
        assert result.parsed_data.email == "jane@example.com"
        assert result.parsed_data.current_company is None
        assert len(result.metadata.fields_failed) > 0

    def test_reject_sentence_as_name_designation_and_location(self, parser):
        """Regression: do not parse sentence text as identity/title/location."""
        text = """
        Strong Knowledge
        chalapathi1056@gmail.com
        +91 9972851443

        Worked for S V Arts and Science Degree College at Chittoor
        as an Accounts Executive from Sep-2017 to Feb-2021.

        and allocating to offshore on priority basis
        Bengaluru
        """

        result = parser.parse(text, "regression_resume.pdf")
        parsed = result.parsed_data

        assert parsed.full_name != "Strong Knowledge"
        if parsed.current_designation:
            assert "worked for" not in parsed.current_designation.lower()
            assert "college" not in parsed.current_designation.lower()
        if parsed.current_location:
            assert "allocating" not in parsed.current_location.lower()


class TestUtilityExtractors:
    """Test utility extractors."""
    
    def test_contact_extraction(self):
        """Test contact information extraction"""
        from .utility_extractors import ContactExtractor
        
        extractor = ContactExtractor()
        text = """
        John Doe
        john@example.com
        +91-9876543210
        Delhi, India
        """
        
        result = extractor.extract(text)
        
        assert result['email'] == "john@example.com"
        assert result['phone'] is not None
        assert "Delhi" in result['location']
    
    def test_skills_extraction(self):
        """Test skills extraction"""
        from .utility_extractors import SkillsExtractor
        
        extractor = SkillsExtractor()
        text = """
        Skills
        - Python, JavaScript, React
        - AWS, Docker, Kubernetes
        - MySQL, PostgreSQL
        """
        
        result = extractor.extract(text)
        
        assert len(result) > 0
        assert any('Python' in skill or 'python' in skill.lower() for skill in result)

    def test_skills_extraction_rejects_noise_tokens(self):
        """Regression: reject filler/date/location tokens and keep real skills."""
        from .utility_extractors import SkillsExtractor

        extractor = SkillsExtractor()
        text = """
        Skills
        Other, Identifying, Travel, Ensure, Time, 2017, and, public, Involvement, Smart
        SAP, SuccessFactors, Fiori, FieldGlass, ONB, CATS, Payroll, UAT, ADP, ESS, RMK, PMGK
        Attendance, Compensation, Workflow, Germany, Oman, India

        Experience
        Worked in Infosys at Bangalore as a FICO Consultant.
        """

        result = extractor.extract(text)
        normalized = {str(skill).strip().lower() for skill in result}

        assert "sap successfactors" in normalized
        assert "sap fiori" in normalized
        assert "fieldglass" in normalized
        assert "sap onb" in normalized
        assert "sap cats" in normalized
        assert "payroll processing" in normalized
        assert "sap ess/mss" in normalized
        assert "sap rmk" in normalized
        assert "pmgk" in normalized
        assert "attendance management" in normalized
        assert "compensation & benefits" in normalized
        assert "workflow management" in normalized
        assert "sap fico" in normalized

        assert "other" not in normalized
        assert "identifying" not in normalized
        assert "smart" not in normalized
        assert "germany" not in normalized
        assert "india" not in normalized
        assert all(not re.fullmatch(r"(19|20)\d{2}", skill.lower()) for skill in result)
    
    def test_experience_calculation(self):
        """Test experience calculation"""
        from .utility_extractors import ExperienceCalculator
        
        calculator = ExperienceCalculator()
        
        # Test explicit statement
        text1 = "I have 7 years of professional experience"
        result1 = calculator.calculate(text1)
        
        assert result1 is not None
        assert "7" in result1
        
        # Test Naukri format
        text2 = "Experience: 2y 3m"
        result2 = calculator.calculate(text2)
        
        assert result2 is not None
        assert ("2" in result2 and "3" in result2)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
