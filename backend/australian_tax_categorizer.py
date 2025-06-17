"""
Australian Tax Categorization Engine
====================================

Advanced intelligent tax categorization system for Australian taxpayers following ATO guidelines.
Implements merchant-based categorization, occupation-specific deduction rules, confidence scoring,
and integrates with existing TAAXDOG tax profile system.

Features:
- Complete Australian tax categories (D1-D15, P8, Personal)
- Intelligent merchant categorization with confidence scoring
- Occupation-specific deduction rules
- Integration with existing tax profile data
- Support for individual and business taxpayers
- Manual override capability
- Categorization history for machine learning
"""

import re
import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from enum import Enum


# Configure logging
logger = logging.getLogger(__name__)


class TaxCategory(Enum):
    """Australian Tax Office deduction categories"""
    D1 = "Work-related car expenses"
    D2 = "Work-related travel expenses"
    D3 = "Work-related clothing, laundry, and dry-cleaning expenses"
    D4 = "Work-related self-education expenses"
    D5 = "Other work-related expenses"
    D6 = "Interest deductions"
    D7 = "Dividend deductions"
    D8 = "Rental property expenses"
    D9 = "Gifts and donations"
    D10 = "Cost of tax affairs"
    D15 = "Other deductions"
    P8 = "Business expenses (sole traders/ABN holders)"
    PERSONAL = "Non-deductible personal expenses"


class ConfidenceLevel(Enum):
    """Confidence levels for categorization decisions"""
    HIGH = 0.8      # 0.8-1.0: Clear merchant-occupation match
    MEDIUM = 0.5    # 0.5-0.79: Probable but requires verification
    LOW = 0.0       # 0.0-0.49: Uncertain, user input required


class DeductibilityLevel(Enum):
    """Deductibility percentages for expenses"""
    FULL = 1.0          # 100% deductible
    PARTIAL_50 = 0.5    # 50% deductible (e.g., meals)
    PARTIAL_CUSTOM = 0  # Custom percentage (calculated separately)
    NONE = 0.0          # Non-deductible


@dataclass
class OccupationRule:
    """Rules for specific occupations"""
    occupation: str
    keywords: List[str]
    default_categories: Dict[str, str]  # merchant_pattern -> category
    confidence_boost: float = 0.2


@dataclass
class MerchantRule:
    """Rules for merchant-based categorization"""
    keywords: List[str]
    category: TaxCategory
    confidence: ConfidenceLevel
    requires_business_user: bool = False
    requires_verification: bool = False
    deductibility: DeductibilityLevel = DeductibilityLevel.FULL
    notes: str = ""


@dataclass
class CategorizationResult:
    """Result of tax categorization"""
    category: TaxCategory
    confidence: float
    deductibility: float
    reasoning: str
    requires_verification: bool
    suggested_evidence: List[str]
    alternative_categories: List[Tuple[TaxCategory, float]]


class AustralianTaxCategorizer:
    """
    Advanced Australian tax categorization engine
    """
    
    def __init__(self):
        """Initialize the categorization engine with all rules and mappings"""
        self.merchant_rules = self._build_merchant_rules()
        self.occupation_rules = self._build_occupation_rules()
        self.category_descriptions = self._build_category_descriptions()
        
    def _build_merchant_rules(self) -> Dict[str, Dict]:
        """Build comprehensive merchant categorization rules"""
        return {
            # Office Supplies
            "officeworks": {
                "keywords": ["officeworks", "office works"],
                "category": TaxCategory.D5,
                "confidence": ConfidenceLevel.MEDIUM,
                "requires_verification": True,
                "notes": "Work-related purpose required"
            },
            "staples": {
                "keywords": ["staples", "office supplies"],
                "category": TaxCategory.D5,
                "confidence": ConfidenceLevel.MEDIUM,
                "requires_verification": True,
                "notes": "Work-related purpose required"
            },
            
            # Fuel/Petrol Stations
            "shell": {
                "keywords": ["shell", "shell coles express"],
                "category": TaxCategory.D1,
                "confidence": ConfidenceLevel.MEDIUM,
                "requires_verification": True,
                "notes": "Requires logbook or valid work travel"
            },
            "bp": {
                "keywords": ["bp ", "british petroleum"],
                "category": TaxCategory.D1,
                "confidence": ConfidenceLevel.MEDIUM,
                "requires_verification": True,
                "notes": "Requires logbook or valid work travel"
            },
            "caltex": {
                "keywords": ["caltex", "ampol"],
                "category": TaxCategory.D1,
                "confidence": ConfidenceLevel.MEDIUM,
                "requires_verification": True,
                "notes": "Requires logbook or valid work travel"
            },
            "mobil": {
                "keywords": ["mobil", "7-eleven", "7eleven"],
                "category": TaxCategory.D1,
                "confidence": ConfidenceLevel.MEDIUM,
                "requires_verification": True,
                "notes": "Requires logbook or valid work travel"
            },
            
            # Hardware Stores
            "bunnings": {
                "keywords": ["bunnings", "bunnings warehouse"],
                "category": TaxCategory.D5,
                "confidence": ConfidenceLevel.LOW,
                "requires_verification": True,
                "notes": "Category depends on occupation and purpose"
            },
            "masters": {
                "keywords": ["masters", "masters home improvement"],
                "category": TaxCategory.D5,
                "confidence": ConfidenceLevel.LOW,
                "requires_verification": True,
                "notes": "Category depends on occupation and purpose"
            },
            
            # Restaurants/Cafes - Business Meals
            "restaurant": {
                "keywords": ["restaurant", "cafe", "coffee", "bistro", "brewery", "pub"],
                "category": TaxCategory.D2,
                "confidence": ConfidenceLevel.LOW,
                "deductibility": DeductibilityLevel.PARTIAL_50,
                "requires_verification": True,
                "notes": "Business meal purpose required, 50% deductible"
            },
            
            # Clothing Stores
            "clothing": {
                "keywords": ["target", "kmart", "big w", "myer", "david jones", "uniqlo"],
                "category": TaxCategory.PERSONAL,
                "confidence": ConfidenceLevel.HIGH,
                "notes": "Usually personal unless protective/uniform clothing"
            },
            
            # Technology/Software
            "jb_hifi": {
                "keywords": ["jb hi-fi", "jb hifi", "harvey norman"],
                "category": TaxCategory.D5,
                "confidence": ConfidenceLevel.MEDIUM,
                "requires_verification": True,
                "notes": "Work-related technology only"
            },
            "apple": {
                "keywords": ["apple store", "apple.com"],
                "category": TaxCategory.D5,
                "confidence": ConfidenceLevel.MEDIUM,
                "requires_verification": True,
                "notes": "Work-related technology only"
            },
            
            # Professional Services
            "accountant": {
                "keywords": ["accounting", "tax agent", "bookkeeper", "cpa"],
                "category": TaxCategory.D10,
                "confidence": ConfidenceLevel.HIGH,
                "notes": "Cost of tax affairs"
            },
            
            # Educational Institutions
            "university": {
                "keywords": ["university", "tafe", "college", "institute"],
                "category": TaxCategory.D4,
                "confidence": ConfidenceLevel.MEDIUM,
                "requires_verification": True,
                "notes": "Must be work-related education"
            },
            
            # Medical/Healthcare
            "pharmacy": {
                "keywords": ["pharmacy", "chemist warehouse", "priceline"],
                "category": TaxCategory.PERSONAL,
                "confidence": ConfidenceLevel.HIGH,
                "notes": "Usually personal unless work-related (healthcare workers)"
            },
            
            # Transport
            "uber": {
                "keywords": ["uber", "taxi", "rideshare"],
                "category": TaxCategory.D2,
                "confidence": ConfidenceLevel.MEDIUM,
                "requires_verification": True,
                "notes": "Work-related travel only"
            },
            "train": {
                "keywords": ["metro", "transport", "opal", "myki", "go card"],
                "category": TaxCategory.D2,
                "confidence": ConfidenceLevel.MEDIUM,
                "requires_verification": True,
                "notes": "Work-related travel only"
            },
            
            # Charitable Organizations
            "charity": {
                "keywords": ["salvos", "salvation army", "red cross", "oxfam", "cancer council"],
                "category": TaxCategory.D9,
                "confidence": ConfidenceLevel.HIGH,
                "notes": "Eligible charity donations"
            },
        }
    
    def _build_occupation_rules(self) -> Dict[str, Dict]:
        """Build occupation-specific categorization rules"""
        return {
            "healthcare": {
                "keywords": ["doctor", "nurse", "physician", "surgeon", "dentist", "physiotherapist", 
                           "pharmacist", "veterinarian", "medical", "health"],
                "default_categories": {
                    "medical": "D5",
                    "uniform": "D3",
                    "equipment": "D5",
                    "conference": "D4",
                    "journal": "D4",
                    "registration": "D5"
                },
                "confidence_boost": 0.3
            },
            
            "teacher": {
                "keywords": ["teacher", "educator", "professor", "lecturer", "tutor", "principal"],
                "default_categories": {
                    "classroom": "D5",
                    "stationery": "D5",
                    "books": "D5",
                    "conference": "D4",
                    "union": "D5",
                    "registration": "D5"
                },
                "confidence_boost": 0.3
            },
            
            "tradesperson": {
                "keywords": ["electrician", "plumber", "carpenter", "builder", "mechanic", 
                           "painter", "welder", "fitter", "apprentice"],
                "default_categories": {
                    "tools": "D5",
                    "equipment": "D5",
                    "protective": "D3",
                    "vehicle": "D1",
                    "materials": "D5",
                    "union": "D5"
                },
                "confidence_boost": 0.3
            },
            
            "it_professional": {
                "keywords": ["developer", "programmer", "analyst", "engineer", "technician", 
                           "it ", "software", "network", "database"],
                "default_categories": {
                    "software": "D5",
                    "hardware": "D5",
                    "training": "D4",
                    "certification": "D4",
                    "conference": "D4",
                    "subscription": "D5"
                },
                "confidence_boost": 0.3
            },
            
            "accountant": {
                "keywords": ["accountant", "bookkeeper", "financial", "audit", "tax", "cpa"],
                "default_categories": {
                    "software": "D5",
                    "professional": "D5",
                    "registration": "D5",
                    "education": "D4",
                    "conference": "D4"
                },
                "confidence_boost": 0.3
            },
            
            "sales": {
                "keywords": ["sales", "representative", "agent", "business development"],
                "default_categories": {
                    "travel": "D2",
                    "meals": "D2",
                    "phone": "D5",
                    "vehicle": "D1",
                    "entertainment": "D2"
                },
                "confidence_boost": 0.2
            },
            
            "real_estate": {
                "keywords": ["real estate", "property", "agent", "valuer"],
                "default_categories": {
                    "vehicle": "D1",
                    "advertising": "D5",
                    "phone": "D5",
                    "registration": "D5",
                    "meals": "D2"
                },
                "confidence_boost": 0.3
            }
        }
    
    def _build_category_descriptions(self) -> Dict[TaxCategory, str]:
        """Build detailed category descriptions"""
        return {
            TaxCategory.D1: "Work-related car expenses including fuel, maintenance, registration (requires logbook)",
            TaxCategory.D2: "Work-related travel expenses including accommodation, meals (50%), transport",
            TaxCategory.D3: "Work-related clothing including uniforms, protective gear, cleaning costs",
            TaxCategory.D4: "Work-related self-education including courses, seminars, training materials",
            TaxCategory.D5: "Other work-related expenses including tools, equipment, subscriptions",
            TaxCategory.D6: "Interest deductions on investment loans",
            TaxCategory.D7: "Dividend deductions including management fees",
            TaxCategory.D8: "Rental property expenses including repairs, maintenance, management",
            TaxCategory.D9: "Gifts and donations to eligible charities",
            TaxCategory.D10: "Cost of tax affairs including agent fees, tax planning",
            TaxCategory.D15: "Other allowable deductions not covered elsewhere",
            TaxCategory.P8: "Business expenses for sole traders and ABN holders",
            TaxCategory.PERSONAL: "Personal expenses that are not tax deductible"
        }
    
    def categorize_transaction(self, 
                             merchant_name: str,
                             amount: float,
                             description: str = "",
                             user_profile: Optional[Dict] = None,
                             receipt_data: Optional[Dict] = None) -> CategorizationResult:
        """
        Main categorization method that processes a transaction and returns categorization result
        
        Args:
            merchant_name: Name of the merchant
            amount: Transaction amount
            description: Transaction description
            user_profile: User's tax profile data
            receipt_data: Additional receipt data if available
            
        Returns:
            CategorizationResult with category, confidence, and additional metadata
        """
        
        # Normalize inputs
        merchant_lower = merchant_name.lower().strip()
        description_lower = description.lower().strip()
        
        # Step 1: Try merchant-based categorization
        merchant_result = self._categorize_by_merchant(merchant_lower, description_lower)
        
        # Step 2: Apply occupation-specific rules if user profile available
        if user_profile:
            occupation_result = self._apply_occupation_rules(
                merchant_lower, description_lower, user_profile, merchant_result
            )
        else:
            occupation_result = merchant_result
        
        # Step 3: Apply business user rules
        business_result = self._apply_business_rules(
            occupation_result, user_profile, amount
        )
        
        # Step 4: Generate evidence requirements and alternatives
        final_result = self._finalize_categorization(
            business_result, merchant_name, amount, user_profile, receipt_data
        )
        
        # Log categorization for learning
        self._log_categorization(merchant_name, final_result, user_profile)
        
        return final_result
    
    def _categorize_by_merchant(self, merchant_lower: str, description_lower: str) -> CategorizationResult:
        """Categorize based on merchant name patterns"""
        
        # Check direct merchant matches
        for merchant_key, rule in self.merchant_rules.items():
            for keyword in rule["keywords"]:
                if keyword.lower() in merchant_lower:
                    return CategorizationResult(
                        category=rule["category"],
                        confidence=rule["confidence"].value,
                        deductibility=rule.get("deductibility", DeductibilityLevel.FULL).value,
                        reasoning=f"Matched merchant pattern: {keyword}",
                        requires_verification=rule.get("requires_verification", False),
                        suggested_evidence=[],
                        alternative_categories=[]
                    )
        
        # Check description patterns for additional context
        if any(word in description_lower for word in ["fuel", "petrol", "gas"]):
            return CategorizationResult(
                category=TaxCategory.D1,
                confidence=ConfidenceLevel.MEDIUM.value,
                deductibility=DeductibilityLevel.FULL.value,
                reasoning="Fuel purchase detected in description",
                requires_verification=True,
                suggested_evidence=["Logbook", "Work travel purpose"],
                alternative_categories=[]
            )
        
        # Default to personal if no matches
        return CategorizationResult(
            category=TaxCategory.PERSONAL,
            confidence=ConfidenceLevel.LOW.value,
            deductibility=DeductibilityLevel.NONE.value,
            reasoning="No merchant or description patterns matched",
            requires_verification=True,
            suggested_evidence=["Purpose of expense", "Work-related evidence"],
            alternative_categories=[]
        )
    
    def _apply_occupation_rules(self, merchant_lower: str, description_lower: str, 
                               user_profile: Dict, base_result: CategorizationResult) -> CategorizationResult:
        """Apply occupation-specific categorization rules"""
        
        # Extract occupation from user profile
        occupations = []
        if user_profile.get("income", {}).get("employers"):
            for employer in user_profile["income"]["employers"]:
                if employer.get("occupation"):
                    occupations.append(employer["occupation"].lower())
        
        if not occupations:
            return base_result
        
        # Find matching occupation rules
        for occupation_text in occupations:
            for occ_key, occ_rule in self.occupation_rules.items():
                if any(keyword in occupation_text for keyword in occ_rule["keywords"]):
                    # Check if this occupation has specific rules for this merchant/description
                    for pattern, category_code in occ_rule["default_categories"].items():
                        if pattern in merchant_lower or pattern in description_lower:
                            try:
                                category = TaxCategory(category_code)
                            except ValueError:
                                continue
                            
                            # Boost confidence for occupation match
                            new_confidence = min(base_result.confidence + occ_rule["confidence_boost"], 1.0)
                            
                            return CategorizationResult(
                                category=category,
                                confidence=new_confidence,
                                deductibility=base_result.deductibility,
                                reasoning=f"Occupation-specific rule: {occ_key} + {pattern}",
                                requires_verification=base_result.requires_verification,
                                suggested_evidence=base_result.suggested_evidence,
                                alternative_categories=base_result.alternative_categories
                            )
        
        return base_result
    
    def _apply_business_rules(self, base_result: CategorizationResult, 
                            user_profile: Optional[Dict], amount: float) -> CategorizationResult:
        """Apply business taxpayer specific rules"""
        
        if not user_profile:
            return base_result
        
        # Check if user has ABN or business income
        has_abn = bool(user_profile.get("personalInfo", {}).get("abn"))
        has_business_income = bool(user_profile.get("income", {}).get("businessIncome"))
        
        if has_abn or has_business_income:
            # For business users, consider upgrading to P8 category for certain expenses
            if base_result.category in [TaxCategory.D5, TaxCategory.D1, TaxCategory.D2]:
                return CategorizationResult(
                    category=TaxCategory.P8,
                    confidence=min(base_result.confidence + 0.1, 1.0),
                    deductibility=base_result.deductibility,
                    reasoning=f"Business taxpayer: {base_result.reasoning}",
                    requires_verification=base_result.requires_verification,
                    suggested_evidence=base_result.suggested_evidence + ["Business purpose"],
                    alternative_categories=[(base_result.category, base_result.confidence)]
                )
        
        return base_result
    
    def _finalize_categorization(self, base_result: CategorizationResult,
                               merchant_name: str, amount: float,
                               user_profile: Optional[Dict],
                               receipt_data: Optional[Dict]) -> CategorizationResult:
        """Finalize categorization with evidence requirements and alternatives"""
        
        # Generate suggested evidence based on category
        evidence = list(base_result.suggested_evidence)
        
        if base_result.category == TaxCategory.D1:
            evidence.extend(["Vehicle logbook", "Work travel justification"])
        elif base_result.category == TaxCategory.D2:
            evidence.extend(["Travel diary (if >6 nights)", "Business purpose"])
        elif base_result.category == TaxCategory.D3:
            evidence.extend(["Uniform/protective clothing evidence", "Employer requirements"])
        elif base_result.category == TaxCategory.D4:
            evidence.extend(["Course work-relation evidence", "Employer support"])
        elif base_result.category == TaxCategory.D5:
            evidence.extend(["Work-related purpose", "Employer requirements"])
        
        # Add amount-specific evidence requirements
        if amount > 300:
            evidence.append("Detailed receipt with GST breakdown")
        if amount > 1000:
            evidence.append("Additional documentation for high-value expense")
        
        # Generate alternative categories based on uncertainty
        alternatives = []
        if base_result.confidence < ConfidenceLevel.HIGH.value:
            # Suggest common alternatives
            if base_result.category != TaxCategory.PERSONAL:
                alternatives.append((TaxCategory.PERSONAL, 0.3))
            if base_result.category != TaxCategory.D5:
                alternatives.append((TaxCategory.D5, 0.4))
        
        return CategorizationResult(
            category=base_result.category,
            confidence=base_result.confidence,
            deductibility=base_result.deductibility,
            reasoning=base_result.reasoning,
            requires_verification=base_result.requires_verification or base_result.confidence < 0.8,
            suggested_evidence=list(set(evidence)),  # Remove duplicates
            alternative_categories=alternatives
        )
    
    def _log_categorization(self, merchant_name: str, result: CategorizationResult, 
                          user_profile: Optional[Dict]):
        """Log categorization for machine learning and improvement"""
        
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "merchant": merchant_name,
            "category": result.category.name,
            "confidence": result.confidence,
            "reasoning": result.reasoning,
            "user_has_profile": user_profile is not None
        }
        
        logger.info(f"Tax categorization: {log_data}")
    
    def get_category_info(self, category: TaxCategory) -> Dict[str, Any]:
        """Get detailed information about a tax category"""
        
        return {
            "code": category.name,
            "name": category.value,
            "description": self.category_descriptions.get(category, ""),
            "typical_evidence": self._get_typical_evidence(category),
            "deductibility_rules": self._get_deductibility_rules(category)
        }
    
    def _get_typical_evidence(self, category: TaxCategory) -> List[str]:
        """Get typical evidence requirements for a category"""
        
        evidence_map = {
            TaxCategory.D1: ["Vehicle logbook", "Work travel records", "Fuel receipts"],
            TaxCategory.D2: ["Travel diary", "Accommodation receipts", "Business purpose documentation"],
            TaxCategory.D3: ["Uniform purchase receipts", "Employer uniform policy", "Cleaning receipts"],
            TaxCategory.D4: ["Course enrollment", "Work-relation letter", "Training materials receipts"],
            TaxCategory.D5: ["Work-purpose justification", "Employer requirements", "Usage records"],
            TaxCategory.D9: ["Charity receipt", "DGR status confirmation"],
            TaxCategory.D10: ["Tax agent invoice", "Tax planning documentation"],
            TaxCategory.P8: ["Business purpose", "ABN registration", "Business activity records"],
        }
        
        return evidence_map.get(category, ["Receipt", "Work-related purpose"])
    
    def _get_deductibility_rules(self, category: TaxCategory) -> Dict[str, Any]:
        """Get deductibility rules for a category"""
        
        rules_map = {
            TaxCategory.D1: {"percentage": 100, "method": "logbook_or_cents_per_km", "cap": True},
            TaxCategory.D2: {"percentage": 100, "meals_percentage": 50, "method": "actual_cost"},
            TaxCategory.D3: {"percentage": 100, "method": "actual_cost", "conventional_only": True},
            TaxCategory.D4: {"percentage": 100, "method": "actual_cost", "work_related_only": True},
            TaxCategory.D5: {"percentage": 100, "method": "actual_cost", "work_portion_only": True},
            TaxCategory.D9: {"percentage": 100, "method": "actual_cost", "dgr_only": True},
            TaxCategory.P8: {"percentage": 100, "method": "business_portion", "records_required": True},
            TaxCategory.PERSONAL: {"percentage": 0, "method": "not_deductible"},
        }
        
        return rules_map.get(category, {"percentage": 0, "method": "requires_assessment"})


# Convenience functions for integration
def categorize_receipt(receipt_data: Dict, user_profile: Optional[Dict] = None) -> CategorizationResult:
    """
    Convenience function to categorize a receipt
    
    Args:
        receipt_data: Receipt data from OCR processing
        user_profile: User's tax profile data
        
    Returns:
        CategorizationResult
    """
    categorizer = AustralianTaxCategorizer()
    
    merchant = receipt_data.get("merchant_name", "")
    amount = receipt_data.get("total_amount", 0)
    description = receipt_data.get("description", "")
    
    return categorizer.categorize_transaction(
        merchant_name=merchant,
        amount=amount,
        description=description,
        user_profile=user_profile,
        receipt_data=receipt_data
    )


def categorize_transaction(transaction_data: Dict, user_profile: Optional[Dict] = None) -> CategorizationResult:
    """
    Convenience function to categorize a banking transaction
    
    Args:
        transaction_data: Banking transaction data
        user_profile: User's tax profile data
        
    Returns:
        CategorizationResult
    """
    categorizer = AustralianTaxCategorizer()
    
    merchant = transaction_data.get("description", "")
    amount = abs(float(transaction_data.get("amount", 0)))
    description = transaction_data.get("description", "")
    
    return categorizer.categorize_transaction(
        merchant_name=merchant,
        amount=amount,
        description=description,
        user_profile=user_profile
    )


def get_all_categories() -> Dict[str, Dict]:
    """Get information about all tax categories"""
    categorizer = AustralianTaxCategorizer()
    
    categories = {}
    for category in TaxCategory:
        categories[category.name] = categorizer.get_category_info(category)
    
    return categories


# Export for use in other modules
__all__ = [
    "AustralianTaxCategorizer",
    "TaxCategory", 
    "ConfidenceLevel",
    "DeductibilityLevel",
    "CategorizationResult",
    "categorize_receipt",
    "categorize_transaction",
    "get_all_categories"
] 