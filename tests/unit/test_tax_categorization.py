"""
Unit Tests for Australian Tax Categorization
===========================================

Tests merchant categorization, occupation-specific rules, confidence scoring,
and Australian tax compliance logic.
"""

import pytest
import unittest
from unittest.mock import Mock, patch
from decimal import Decimal

from backend.australian_tax_categorizer import (
    AustralianTaxCategorizer,
    TaxCategory,
    CategorizationResult,
    ConfidenceLevel,
    DeductibilityLevel,
    categorize_receipt
)


class TestMerchantCategorization(unittest.TestCase):
    """Test merchant-based categorization logic"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.categorizer = AustralianTaxCategorizer()
    
    def test_officeworks_categorization(self):
        """Test Officeworks → D5 (Office supplies) categorization"""
        result = self.categorizer.categorize_transaction(
            merchant_name="OFFICEWORKS",
            amount=50.00,
            description="Office supplies"
        )
        
        self.assertEqual(result.category, TaxCategory.D5)
        self.assertGreater(result.confidence, 0.5)
        self.assertTrue(result.requires_verification)
        self.assertIn("work-related purpose", result.reasoning.lower())
    
    def test_fuel_station_categorization(self):
        """Test fuel stations → D1 (Car expenses) categorization"""
        fuel_merchants = ["SHELL", "BP", "CALTEX", "7-ELEVEN", "AMPOL"]
        
        for merchant in fuel_merchants:
            with self.subTest(merchant=merchant):
                result = self.categorizer.categorize_transaction(
                    merchant_name=merchant,
                    amount=67.80,
                    description="Fuel purchase"
                )
                
                self.assertEqual(result.category, TaxCategory.D1)
                self.assertGreater(result.confidence, 0.5)
                self.assertTrue(result.requires_verification)
                self.assertIn("logbook", result.suggested_evidence)
    
    def test_bunnings_categorization(self):
        """Test Bunnings → D6/D5 (Tools/Equipment) categorization"""
        result = self.categorizer.categorize_transaction(
            merchant_name="BUNNINGS WAREHOUSE",
            amount=89.50,
            description="Hardware purchase"
        )
        
        # Should be categorized as tools/equipment (depends on occupation)
        self.assertIn(result.category, [TaxCategory.D5, TaxCategory.D6])
        self.assertTrue(result.requires_verification)
        self.assertIn("occupation", result.reasoning.lower())
    
    def test_restaurant_categorization(self):
        """Test restaurants → D2 (Travel/Meals) or Personal categorization"""
        result = self.categorizer.categorize_transaction(
            merchant_name="THE COFFEE CLUB",
            amount=35.50,
            description="Business lunch"
        )
        
        # Default should be D2 with verification required
        self.assertEqual(result.category, TaxCategory.D2)
        self.assertEqual(result.deductibility, DeductibilityLevel.PARTIAL_50.value)
        self.assertTrue(result.requires_verification)
        self.assertIn("business purpose", result.suggested_evidence)
    
    def test_grocery_store_categorization(self):
        """Test grocery stores → Personal categorization"""
        grocery_merchants = ["WOOLWORTHS", "COLES", "ALDI", "IGA"]
        
        for merchant in grocery_merchants:
            with self.subTest(merchant=merchant):
                result = self.categorizer.categorize_transaction(
                    merchant_name=merchant,
                    amount=85.90,
                    description="Grocery shopping"
                )
                
                self.assertEqual(result.category, TaxCategory.PERSONAL)
                self.assertGreater(result.confidence, 0.7)
                self.assertEqual(result.deductibility, DeductibilityLevel.NONE.value)
    
    def test_technology_store_categorization(self):
        """Test technology stores → D5/D6 (Equipment) categorization"""
        tech_merchants = ["JB HI-FI", "HARVEY NORMAN", "APPLE STORE"]
        
        for merchant in tech_merchants:
            with self.subTest(merchant=merchant):
                result = self.categorizer.categorize_transaction(
                    merchant_name=merchant,
                    amount=299.00,
                    description="Computer equipment"
                )
                
                self.assertIn(result.category, [TaxCategory.D5, TaxCategory.D6])
                self.assertTrue(result.requires_verification)
                self.assertIn("work-related", result.reasoning.lower())
    
    def test_unknown_merchant_categorization(self):
        """Test unknown merchants → Personal with low confidence"""
        result = self.categorizer.categorize_transaction(
            merchant_name="UNKNOWN MERCHANT XYZ",
            amount=45.00,
            description="Unknown purchase"
        )
        
        self.assertEqual(result.category, TaxCategory.PERSONAL)
        self.assertLess(result.confidence, 0.5)
        self.assertTrue(result.requires_verification)
    
    def test_case_insensitive_matching(self):
        """Test that merchant matching is case-insensitive"""
        variations = ["officeworks", "OFFICEWORKS", "OfficeWorks", "OFFICE WORKS"]
        
        for variation in variations:
            with self.subTest(merchant=variation):
                result = self.categorizer.categorize_transaction(
                    merchant_name=variation,
                    amount=25.00
                )
                
                self.assertEqual(result.category, TaxCategory.D5)


class TestOccupationSpecificRules(unittest.TestCase):
    """Test occupation-specific categorization rules"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.categorizer = AustralianTaxCategorizer()
    
    def test_teacher_specific_rules(self):
        """Test teacher-specific categorization rules"""
        teacher_profile = {
            "personalInfo": {
                "occupation": "Teacher",
                "industry": "Education",
                "entity_type": "INDIVIDUAL"
            }
        }
        
        # Test classroom supplies
        result = self.categorizer.categorize_transaction(
            merchant_name="OFFICEWORKS",
            amount=45.00,
            description="Classroom supplies",
            user_profile=teacher_profile
        )
        
        # Should have higher confidence for teachers
        self.assertEqual(result.category, TaxCategory.D5)
        self.assertGreater(result.confidence, 0.7)
    
    def test_tradesperson_specific_rules(self):
        """Test tradesperson-specific categorization rules"""
        tradesperson_profile = {
            "personalInfo": {
                "occupation": "Electrician",
                "industry": "Construction",
                "entity_type": "INDIVIDUAL"
            }
        }
        
        # Test tools purchase
        result = self.categorizer.categorize_transaction(
            merchant_name="BUNNINGS",
            amount=150.00,
            description="Tools and equipment",
            user_profile=tradesperson_profile
        )
        
        # Should be D6 (Tools) with high confidence for tradespeople
        self.assertEqual(result.category, TaxCategory.D6)
        self.assertGreater(result.confidence, 0.8)
    
    def test_it_professional_rules(self):
        """Test IT professional-specific categorization rules"""
        it_profile = {
            "personalInfo": {
                "occupation": "Software Developer",
                "industry": "Information Technology",
                "entity_type": "INDIVIDUAL"
            }
        }
        
        # Test software/hardware purchase
        result = self.categorizer.categorize_transaction(
            merchant_name="JB HI-FI",
            amount=599.00,
            description="Computer monitor",
            user_profile=it_profile
        )
        
        # Should be D5/D6 with higher confidence for IT professionals
        self.assertIn(result.category, [TaxCategory.D5, TaxCategory.D6])
        self.assertGreater(result.confidence, 0.7)
    
    def test_healthcare_worker_rules(self):
        """Test healthcare worker-specific categorization rules"""
        healthcare_profile = {
            "personalInfo": {
                "occupation": "Nurse",
                "industry": "Healthcare",
                "entity_type": "INDIVIDUAL"
            }
        }
        
        # Test uniform/protective equipment
        result = self.categorizer.categorize_transaction(
            merchant_name="MEDICAL SUPPLIES STORE",
            amount=85.00,
            description="Protective equipment",
            user_profile=healthcare_profile
        )
        
        # Should consider D3 (Clothing) for healthcare uniforms
        self.assertEqual(result.category, TaxCategory.D3)
    
    def test_sales_professional_rules(self):
        """Test sales professional-specific categorization rules"""
        sales_profile = {
            "personalInfo": {
                "occupation": "Sales Representative",
                "industry": "Sales",
                "entity_type": "INDIVIDUAL"
            }
        }
        
        # Test travel/meals
        result = self.categorizer.categorize_transaction(
            merchant_name="QANTAS",
            amount=450.00,
            description="Business flight",
            user_profile=sales_profile
        )
        
        # Should be D2 with higher confidence for sales professionals
        self.assertEqual(result.category, TaxCategory.D2)
        self.assertGreater(result.confidence, 0.8)


class TestBusinessUserRules(unittest.TestCase):
    """Test business user categorization rules"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.categorizer = AustralianTaxCategorizer()
    
    def test_sole_trader_categorization(self):
        """Test sole trader (ABN holder) categorization"""
        sole_trader_profile = {
            "personalInfo": {
                "entity_type": "SOLE_TRADER",
                "abn": "53004085616"
            },
            "taxInfo": {
                "gst_registered": True
            }
        }
        
        result = self.categorizer.categorize_transaction(
            merchant_name="OFFICEWORKS",
            amount=75.00,
            description="Business supplies",
            user_profile=sole_trader_profile
        )
        
        # Sole traders should get P8 category for business expenses
        self.assertEqual(result.category, TaxCategory.P8)
        self.assertGreater(result.confidence, 0.8)
        self.assertEqual(result.deductibility, DeductibilityLevel.FULL.value)
    
    def test_company_employee_categorization(self):
        """Test company employee categorization"""
        employee_profile = {
            "personalInfo": {
                "entity_type": "INDIVIDUAL",
                "occupation": "Manager"
            },
            "taxInfo": {
                "abn": None,
                "income_sources": ["SALARY"]
            }
        }
        
        result = self.categorizer.categorize_transaction(
            merchant_name="SHELL",
            amount=65.00,
            description="Fuel",
            user_profile=employee_profile
        )
        
        # Employees should get work-related categories (D1-D15)
        self.assertEqual(result.category, TaxCategory.D1)
        self.assertTrue(result.requires_verification)
    
    def test_high_amount_business_expense(self):
        """Test high-amount business expense categorization"""
        business_profile = {
            "personalInfo": {
                "entity_type": "SOLE_TRADER",
                "abn": "53004085616"
            }
        }
        
        result = self.categorizer.categorize_transaction(
            merchant_name="HARVEY NORMAN",
            amount=2500.00,
            description="Business computer",
            user_profile=business_profile
        )
        
        # High-value business expenses should require additional evidence
        self.assertEqual(result.category, TaxCategory.P8)
        self.assertTrue(result.requires_verification)
        self.assertIn("high-value", result.suggested_evidence or [])


class TestConfidenceScoring(unittest.TestCase):
    """Test confidence scoring algorithm"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.categorizer = AustralianTaxCategorizer()
    
    def test_high_confidence_scenarios(self):
        """Test scenarios that should have high confidence"""
        # Known merchant + relevant user profile
        it_profile = {
            "personalInfo": {
                "occupation": "Software Developer",
                "industry": "Information Technology"
            }
        }
        
        result = self.categorizer.categorize_transaction(
            merchant_name="OFFICEWORKS",
            amount=50.00,
            description="Computer supplies",
            user_profile=it_profile
        )
        
        self.assertGreater(result.confidence, 0.7)
    
    def test_medium_confidence_scenarios(self):
        """Test scenarios that should have medium confidence"""
        # Known merchant but requires verification
        result = self.categorizer.categorize_transaction(
            merchant_name="BUNNINGS",
            amount=125.00,
            description="Hardware"
        )
        
        self.assertGreater(result.confidence, 0.4)
        self.assertLess(result.confidence, 0.8)
    
    def test_low_confidence_scenarios(self):
        """Test scenarios that should have low confidence"""
        # Unknown merchant, no user profile
        result = self.categorizer.categorize_transaction(
            merchant_name="UNKNOWN STORE ABC",
            amount=75.00,
            description="Unknown purchase"
        )
        
        self.assertLess(result.confidence, 0.5)
        self.assertTrue(result.requires_verification)
    
    def test_confidence_boost_with_profile(self):
        """Test that user profile boosts confidence"""
        # Without profile
        result_no_profile = self.categorizer.categorize_transaction(
            merchant_name="BUNNINGS",
            amount=50.00
        )
        
        # With relevant profile
        tradesperson_profile = {
            "personalInfo": {
                "occupation": "Carpenter",
                "industry": "Construction"
            }
        }
        
        result_with_profile = self.categorizer.categorize_transaction(
            merchant_name="BUNNINGS",
            amount=50.00,
            user_profile=tradesperson_profile
        )
        
        self.assertGreater(result_with_profile.confidence, result_no_profile.confidence)


class TestEvidenceRequirements(unittest.TestCase):
    """Test evidence requirement generation"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.categorizer = AustralianTaxCategorizer()
    
    def test_car_expense_evidence(self):
        """Test evidence requirements for car expenses (D1)"""
        result = self.categorizer.categorize_transaction(
            merchant_name="SHELL",
            amount=75.00
        )
        
        self.assertEqual(result.category, TaxCategory.D1)
        self.assertIn("logbook", result.suggested_evidence)
        self.assertIn("work travel", result.suggested_evidence)
    
    def test_travel_expense_evidence(self):
        """Test evidence requirements for travel expenses (D2)"""
        result = self.categorizer.categorize_transaction(
            merchant_name="QANTAS",
            amount=450.00
        )
        
        self.assertEqual(result.category, TaxCategory.D2)
        self.assertIn("business purpose", result.suggested_evidence)
        self.assertIn("travel diary", result.suggested_evidence)
    
    def test_clothing_expense_evidence(self):
        """Test evidence requirements for clothing expenses (D3)"""
        healthcare_profile = {
            "personalInfo": {
                "occupation": "Nurse",
                "industry": "Healthcare"
            }
        }
        
        result = self.categorizer.categorize_transaction(
            merchant_name="UNIFORM STORE",
            amount=120.00,
            description="Work uniform",
            user_profile=healthcare_profile
        )
        
        if result.category == TaxCategory.D3:
            self.assertIn("uniform", result.suggested_evidence)
            self.assertIn("employer", result.suggested_evidence)
    
    def test_high_amount_evidence(self):
        """Test additional evidence requirements for high amounts"""
        result = self.categorizer.categorize_transaction(
            merchant_name="HARVEY NORMAN",
            amount=1500.00,
            description="Business equipment"
        )
        
        # High amounts should require additional documentation
        self.assertGreater(len(result.suggested_evidence), 2)


class TestAlternativeCategories(unittest.TestCase):
    """Test alternative category suggestions"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.categorizer = AustralianTaxCategorizer()
    
    def test_uncertain_categorization_alternatives(self):
        """Test that uncertain categorizations provide alternatives"""
        result = self.categorizer.categorize_transaction(
            merchant_name="AMBIGUOUS STORE",
            amount=100.00,
            description="Could be personal or business"
        )
        
        if result.confidence < 0.7:
            self.assertGreater(len(result.alternative_categories), 0)
    
    def test_borderline_business_personal(self):
        """Test alternatives for borderline business/personal expenses"""
        result = self.categorizer.categorize_transaction(
            merchant_name="COFFEE SHOP",
            amount=25.00,
            description="Could be business meeting or personal"
        )
        
        # Should provide both business and personal alternatives
        categories = [alt[0] for alt in result.alternative_categories]
        self.assertTrue(
            TaxCategory.PERSONAL in categories or 
            TaxCategory.D2 in categories
        )


class TestIntegrationWithProfile(unittest.TestCase):
    """Test integration with user tax profiles"""
    
    def test_categorize_receipt_function(self):
        """Test the convenience categorize_receipt function"""
        receipt_data = {
            "merchant_name": "OFFICEWORKS",
            "total_amount": 85.50,
            "date": "2024-01-15",
            "description": "Office supplies"
        }
        
        user_profile = {
            "personalInfo": {
                "occupation": "Accountant",
                "entity_type": "INDIVIDUAL"
            }
        }
        
        result = categorize_receipt(receipt_data, user_profile)
        
        self.assertIsInstance(result, CategorizationResult)
        self.assertEqual(result.category, TaxCategory.D5)
        self.assertGreater(result.confidence, 0.5)
    
    def test_multiple_income_sources(self):
        """Test categorization with multiple income sources"""
        mixed_profile = {
            "personalInfo": {
                "entity_type": "INDIVIDUAL",
                "occupation": "Consultant"
            },
            "taxInfo": {
                "abn": "53004085616",
                "income_sources": ["SALARY", "BUSINESS"],
                "gst_registered": True
            }
        }
        
        result = self.categorizer.categorize_transaction(
            merchant_name="OFFICEWORKS",
            amount=95.00,
            user_profile=mixed_profile
        )
        
        # Should consider business use for mixed income
        self.assertIn(result.category, [TaxCategory.P8, TaxCategory.D5])


if __name__ == '__main__':
    unittest.main() 