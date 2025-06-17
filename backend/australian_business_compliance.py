"""
Australian Business Compliance Module
=====================================

Comprehensive business compliance features for Australian businesses including:
- GST extraction and validation from receipts
- ABN verification using Australian Business Register
- Input tax credit calculations for business users
- BAS (Business Activity Statement) preparation data
- PAYG calculations for business reporting

Features:
- Real-time ABN validation via official ABR API
- Automatic GST extraction from receipts (10% Australian GST)
- Input tax credit eligibility determination
- BAS quarterly reporting data preparation
- Integration with existing tax categorization system
"""

import re
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any, Union
from dataclasses import dataclass, field
from enum import Enum
from decimal import Decimal, ROUND_HALF_UP


# Configure logging
logger = logging.getLogger(__name__)


class GSTType(Enum):
    """Types of GST treatment"""
    GST_FREE = "GST-free"
    INPUT_TAXED = "Input taxed"
    GST_INCLUSIVE = "GST inclusive"
    GST_EXCLUSIVE = "GST exclusive"
    NO_GST = "No GST"


class BusinessType(Enum):
    """Australian business entity types"""
    SOLE_TRADER = "Sole Trader"
    PARTNERSHIP = "Partnership"
    COMPANY = "Company"
    TRUST = "Trust"
    SUPER_FUND = "Superannuation Fund"
    OTHER = "Other"


class BASFrequency(Enum):
    """BAS reporting frequency"""
    QUARTERLY = "Quarterly"
    MONTHLY = "Monthly"
    ANNUALLY = "Annually"


@dataclass
class ABNDetails:
    """ABN verification result"""
    abn: str
    is_valid: bool
    entity_name: str
    entity_type: BusinessType
    status: str
    gst_registered: bool
    gst_from_date: Optional[str]
    gst_to_date: Optional[str]
    error_message: Optional[str] = None


@dataclass
class GSTExtraction:
    """GST extraction result from receipt"""
    total_amount: Decimal
    gst_amount: Decimal
    gst_free_amount: Decimal
    gst_inclusive_amount: Decimal
    gst_rate: Decimal = Decimal('0.10')  # 10% Australian GST
    extraction_confidence: float = 0.0
    extraction_method: str = ""
    requires_verification: bool = False


@dataclass
class InputTaxCredit:
    """Input tax credit calculation"""
    eligible_amount: Decimal
    gst_credit: Decimal
    business_use_percentage: Decimal
    creditable_percentage: Decimal
    reasoning: str
    evidence_required: List[str]
    category_code: str


@dataclass
class BASLineItem:
    """BAS statement line item"""
    line_code: str
    description: str
    amount: Decimal
    gst_amount: Decimal
    transaction_count: int
    period_start: datetime
    period_end: datetime


@dataclass
class BASQuarterData:
    """Complete BAS quarter preparation data"""
    period_start: datetime
    period_end: datetime
    sales_gst: Decimal = field(default_factory=lambda: Decimal('0'))
    purchases_gst: Decimal = field(default_factory=lambda: Decimal('0'))
    input_tax_credits: Decimal = field(default_factory=lambda: Decimal('0'))
    net_gst: Decimal = field(default_factory=lambda: Decimal('0'))
    payg_withholding: Decimal = field(default_factory=lambda: Decimal('0'))
    payg_instalment: Decimal = field(default_factory=lambda: Decimal('0'))
    total_refund_payable: Decimal = field(default_factory=lambda: Decimal('0'))
    line_items: List[BASLineItem] = field(default_factory=list)

    def __post_init__(self):
        if self.line_items is None:
            self.line_items = []


class AustralianBusinessCompliance:
    """
    Comprehensive Australian business compliance system
    """
    
    def __init__(self, abr_api_key: Optional[str] = None):
        """Initialize with optional ABR API key for real-time verification"""
        self.abr_api_key = abr_api_key
        self.abr_base_url = "https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx"
        self.gst_rate = Decimal('0.10')  # 10% Australian GST
        
    # ABN Verification Methods
    
    def verify_abn(self, abn: str) -> ABNDetails:
        """
        Verify ABN using Australian Business Register API
        
        Args:
            abn: Australian Business Number (11 digits)
            
        Returns:
            ABNDetails with verification result
        """
        # Clean and validate ABN format
        cleaned_abn = self._clean_abn(abn)
        
        if not self._is_valid_abn_format(cleaned_abn):
            return ABNDetails(
                abn=abn,
                is_valid=False,
                entity_name="",
                entity_type=BusinessType.OTHER,
                status="Invalid format",
                gst_registered=False,
                gst_from_date=None,
                gst_to_date=None,
                error_message="Invalid ABN format"
            )
        
        # Verify checksum
        if not self._verify_abn_checksum(cleaned_abn):
            return ABNDetails(
                abn=abn,
                is_valid=False,
                entity_name="",
                entity_type=BusinessType.OTHER,
                status="Invalid checksum",
                gst_registered=False,
                gst_from_date=None,
                gst_to_date=None,
                error_message="ABN checksum validation failed"
            )
        
        # Try API lookup if key provided
        if self.abr_api_key:
            try:
                return self._lookup_abn_api(cleaned_abn)
            except Exception as e:
                logger.warning(f"ABR API lookup failed: {e}")
        
        # Fallback to basic validation
        return ABNDetails(
            abn=cleaned_abn,
            is_valid=True,
            entity_name="Unknown Entity",
            entity_type=BusinessType.OTHER,
            status="Format valid (API not available)",
            gst_registered=False,
            gst_from_date=None,
            gst_to_date=None
        )
    
    def _clean_abn(self, abn: str) -> str:
        """Clean ABN by removing spaces and non-digits"""
        return re.sub(r'[^\d]', '', abn)
    
    def _is_valid_abn_format(self, abn: str) -> bool:
        """Check if ABN has correct format (11 digits)"""
        return len(abn) == 11 and abn.isdigit()
    
    def _verify_abn_checksum(self, abn: str) -> bool:
        """Verify ABN using official checksum algorithm"""
        if len(abn) != 11:
            return False
        
        # ABN checksum weights
        weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
        
        # Subtract 1 from first digit
        digits = [int(abn[0]) - 1] + [int(d) for d in abn[1:]]
        
        # Calculate weighted sum
        total = sum(digit * weight for digit, weight in zip(digits, weights))
        
        # Check if divisible by 89
        return total % 89 == 0
    
    def _lookup_abn_api(self, abn: str) -> ABNDetails:
        """Lookup ABN details via ABR web service"""
        url = f"{self.abr_base_url}/ABRXMLSearchByABN"
        
        params = {
            'searchString': abn,
            'includeHistoricalDetails': 'Y',
            'authenticationGuid': self.abr_api_key
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        # Parse XML response (simplified - would need proper XML parsing)
        # This is a basic implementation - full implementation would use xml.etree.ElementTree
        content = response.text
        
        is_valid = 'entityStatus' in content and 'Active' in content
        entity_name = self._extract_xml_value(content, 'organisationName', 'Unknown Entity')
        entity_type = self._determine_entity_type(content)
        gst_registered = 'GST' in content
        
        return ABNDetails(
            abn=abn,
            is_valid=is_valid,
            entity_name=entity_name,
            entity_type=entity_type,
            status="Active" if is_valid else "Inactive",
            gst_registered=gst_registered,
            gst_from_date=self._extract_xml_value(content, 'effectiveFromDate'),
            gst_to_date=self._extract_xml_value(content, 'effectiveToDate')
        )
    
    def _extract_xml_value(self, xml_content: str, tag: str, default: str = "") -> Optional[str]:
        """Extract value from XML content (basic implementation)"""
        pattern = f'<{tag}[^>]*>([^<]*)</{tag}>'
        match = re.search(pattern, xml_content, re.IGNORECASE)
        return match.group(1) if match else (default if default else None)
    
    def _determine_entity_type(self, xml_content: str) -> BusinessType:
        """Determine business entity type from ABR response"""
        if 'Sole Trader' in xml_content or 'Individual' in xml_content:
            return BusinessType.SOLE_TRADER
        elif 'Partnership' in xml_content:
            return BusinessType.PARTNERSHIP
        elif 'Company' in xml_content or 'Pty' in xml_content:
            return BusinessType.COMPANY
        elif 'Trust' in xml_content:
            return BusinessType.TRUST
        elif 'Superannuation' in xml_content:
            return BusinessType.SUPER_FUND
        else:
            return BusinessType.OTHER
    
    # GST Extraction Methods
    
    def extract_gst_from_receipt(self, receipt_data: Dict) -> GSTExtraction:
        """
        Extract GST information from receipt data
        
        Args:
            receipt_data: Receipt data from OCR processing
            
        Returns:
            GSTExtraction with GST breakdown
        """
        total_amount = Decimal(str(receipt_data.get('total_amount', 0)))
        
        # Try to find explicit GST amount in receipt
        gst_amount = self._find_explicit_gst(receipt_data)
        
        if gst_amount and gst_amount > 0:
            # GST explicitly stated
            gst_inclusive_amount = total_amount
            gst_free_amount = Decimal('0')
            confidence = 0.9
            method = "explicit_gst_amount"
        else:
            # Calculate GST based on business rules
            gst_calculation = self._calculate_gst_from_total(total_amount, receipt_data)
            gst_amount = gst_calculation['gst_amount']
            gst_inclusive_amount = gst_calculation['gst_inclusive']
            gst_free_amount = gst_calculation['gst_free']
            confidence = gst_calculation['confidence']
            method = gst_calculation['method']
        
        return GSTExtraction(
            total_amount=total_amount,
            gst_amount=gst_amount,
            gst_free_amount=gst_free_amount,
            gst_inclusive_amount=gst_inclusive_amount,
            gst_rate=self.gst_rate,
            extraction_confidence=confidence,
            extraction_method=method,
            requires_verification=confidence < 0.8
        )
    
    def _find_explicit_gst(self, receipt_data: Dict) -> Optional[Decimal]:
        """Find explicitly stated GST amount in receipt"""
        # Check various fields for GST amount
        gst_fields = ['gst', 'gst_amount', 'tax', 'tax_amount', 'vat']
        
        for field in gst_fields:
            if field in receipt_data:
                try:
                    return Decimal(str(receipt_data[field]))
                except (ValueError, TypeError):
                    continue
        
        # Try to parse from line items
        line_items = receipt_data.get('line_items', [])
        if isinstance(line_items, list):
            for item in line_items:
                if isinstance(item, dict):
                    description = item.get('description', '').lower()
                    if 'gst' in description or 'tax' in description:
                        try:
                            return Decimal(str(item.get('amount', 0)))
                        except (ValueError, TypeError):
                            continue
        
        # Try to parse from raw text
        raw_text = receipt_data.get('raw_text', '')
        if raw_text:
            gst_patterns = [
                r'gst[:\s]*\$?(\d+\.?\d*)',
                r'tax[:\s]*\$?(\d+\.?\d*)',
                r'(\d+\.?\d*)[:\s]*gst',
                r'(\d+\.?\d*)[:\s]*tax'
            ]
            
            for pattern in gst_patterns:
                matches = re.findall(pattern, raw_text.lower())
                if matches:
                    try:
                        return Decimal(matches[0])
                    except (ValueError, TypeError):
                        continue
        
        return None
    
    def _calculate_gst_from_total(self, total_amount: Decimal, receipt_data: Dict) -> Dict:
        """Calculate GST from total amount using business logic"""
        merchant_name = receipt_data.get('merchant_name', '').lower()
        
        # GST-free merchants (basic food, medical, education, etc.)
        gst_free_merchants = [
            'woolworths', 'coles', 'aldi', 'iga', 'foodworks',  # Groceries (basic food)
            'chemist warehouse', 'pharmacy', 'medical centre',  # Medical
            'university', 'tafe', 'school'  # Education
        ]
        
        is_likely_gst_free = any(merchant in merchant_name for merchant in gst_free_merchants)
        
        if is_likely_gst_free:
            return {
                'gst_amount': Decimal('0'),
                'gst_inclusive': Decimal('0'),
                'gst_free': total_amount,
                'confidence': 0.7,
                'method': 'merchant_gst_free_rules'
            }
        
        # Default: assume GST inclusive
        gst_amount = (total_amount / Decimal('11')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        return {
            'gst_amount': gst_amount,
            'gst_inclusive': total_amount,
            'gst_free': Decimal('0'),
            'confidence': 0.6,
            'method': 'calculated_10_percent'
        }
    
    # Input Tax Credit Methods
    
    def calculate_input_tax_credit(self, 
                                 gst_extraction: GSTExtraction,
                                 categorization_result,
                                 user_profile: Dict) -> InputTaxCredit:
        """
        Calculate input tax credit eligibility and amount
        
        Args:
            gst_extraction: GST extraction result
            categorization_result: Tax categorization result
            user_profile: User's business profile
            
        Returns:
            InputTaxCredit calculation
        """
        # Check if user is GST registered
        abn = user_profile.get('personalInfo', {}).get('abn', '')
        is_gst_registered = user_profile.get('tax_settings', {}).get('gst_registered', False)
        
        if not abn or not is_gst_registered:
            return InputTaxCredit(
                eligible_amount=Decimal('0'),
                gst_credit=Decimal('0'),
                business_use_percentage=Decimal('0'),
                creditable_percentage=Decimal('0'),
                reasoning="Not GST registered or no ABN",
                evidence_required=[],
                category_code="NOT_ELIGIBLE"
            )
        
        # Determine business use percentage
        business_use = self._determine_business_use_percentage(categorization_result, user_profile)
        
        # Determine creditable percentage
        creditable_percentage = self._determine_creditable_percentage(
            categorization_result.category.name,
            gst_extraction
        )
        
        # Calculate credit
        eligible_amount = gst_extraction.gst_inclusive_amount * business_use
        gst_credit = gst_extraction.gst_amount * business_use * creditable_percentage
        
        # Generate reasoning
        reasoning = self._generate_itc_reasoning(
            categorization_result,
            business_use,
            creditable_percentage,
            is_gst_registered
        )
        
        # Evidence requirements
        evidence_required = self._get_itc_evidence_requirements(
            categorization_result.category.name,
            business_use,
            eligible_amount
        )
        
        return InputTaxCredit(
            eligible_amount=eligible_amount,
            gst_credit=gst_credit,
            business_use_percentage=business_use,
            creditable_percentage=creditable_percentage,
            reasoning=reasoning,
            evidence_required=evidence_required,
            category_code=categorization_result.category.name
        )
    
    def _determine_business_use_percentage(self, categorization_result, user_profile: Dict) -> Decimal:
        """Determine business use percentage for expense"""
        category = categorization_result.category.name
        
        # Business categories are 100% business use
        if category == 'P8':
            return Decimal('1.0')
        
        # Work-related categories
        work_categories = ['D1', 'D2', 'D3', 'D4', 'D5']
        if category in work_categories:
            # Check if user is sole trader (work = business)
            if user_profile.get('personalInfo', {}).get('entity_type') == 'SOLE_TRADER':
                return Decimal('1.0')
            else:
                return Decimal('0.0')  # Employee can't claim ITC
        
        # Personal expenses
        return Decimal('0.0')
    
    def _determine_creditable_percentage(self, category: str, gst_extraction: GSTExtraction) -> Decimal:
        """Determine what percentage of GST is creditable"""
        
        # Non-creditable categories
        non_creditable = ['D9', 'D6', 'D7']  # Donations, Interest, Dividends
        if category in non_creditable:
            return Decimal('0.0')
        
        # Entertainment expenses (50% creditable)
        if category == 'D2':  # Travel expenses including meals
            return Decimal('0.5')
        
        # Most business expenses are 100% creditable
        business_categories = ['P8', 'D1', 'D3', 'D4', 'D5', 'D10']
        if category in business_categories:
            return Decimal('1.0')
        
        return Decimal('0.0')
    
    def _generate_itc_reasoning(self, categorization_result, business_use: Decimal, 
                              creditable_percentage: Decimal, is_gst_registered: bool) -> str:
        """Generate reasoning for ITC calculation"""
        
        if not is_gst_registered:
            return "Not eligible: Business not registered for GST"
        
        if business_use == 0:
            return "Not eligible: Personal expense or employee expense"
        
        if creditable_percentage == 0:
            return f"Not eligible: {categorization_result.category.value} is not creditable"
        
        if creditable_percentage < 1:
            return f"Partially creditable: {int(creditable_percentage * 100)}% of GST can be claimed"
        
        return f"Fully creditable: Business expense, {int(business_use * 100)}% business use"
    
    def _get_itc_evidence_requirements(self, category: str, business_use: Decimal, 
                                     eligible_amount: Decimal) -> List[str]:
        """Get evidence requirements for input tax credit"""
        
        evidence = []
        
        if business_use > 0:
            evidence.extend([
                "Tax invoice showing GST amount",
                "Business purpose documentation",
                "GST registration status"
            ])
        
        if eligible_amount > 82.50:  # ATO threshold for simplified tax invoices
            evidence.append("Detailed tax invoice required (over $82.50)")
        
        if category == 'D1':
            evidence.append("Vehicle logbook for business travel")
        elif category == 'D2':
            evidence.append("Travel diary and business purpose")
        elif category == 'P8':
            evidence.append("Business activity records")
        
        return evidence
    
    # BAS Preparation Methods
    
    def prepare_bas_quarter_data(self, 
                               transactions: List[Dict],
                               receipts: List[Dict],
                               user_profile: Dict,
                               quarter_start: datetime,
                               quarter_end: datetime) -> BASQuarterData:
        """
        Prepare BAS quarter data from transactions and receipts
        
        Args:
            transactions: Banking transactions for the period
            receipts: Receipt data for the period
            user_profile: User's business profile
            quarter_start: Start of BAS quarter
            quarter_end: End of BAS quarter
            
        Returns:
            BASQuarterData with all calculations
        """
        
        bas_data = BASQuarterData(
            period_start=quarter_start,
            period_end=quarter_end
        )
        
        # Process receipts for purchases/input tax credits
        for receipt in receipts:
            receipt_date = self._parse_receipt_date(receipt)
            if quarter_start <= receipt_date <= quarter_end:
                self._add_purchase_to_bas(receipt, bas_data, user_profile)
        
        # Process transactions for sales and other items
        for transaction in transactions:
            transaction_date = self._parse_transaction_date(transaction)
            if quarter_start <= transaction_date <= quarter_end:
                self._add_transaction_to_bas(transaction, bas_data, user_profile)
        
        # Calculate net GST
        bas_data.net_gst = bas_data.sales_gst - bas_data.input_tax_credits
        
        # Calculate total refund/payable
        bas_data.total_refund_payable = (
            bas_data.net_gst + 
            bas_data.payg_withholding + 
            bas_data.payg_instalment
        )
        
        return bas_data
    
    def _parse_receipt_date(self, receipt: Dict) -> datetime:
        """Parse receipt date"""
        date_str = receipt.get('date', '')
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except:
            return datetime.now()
    
    def _parse_transaction_date(self, transaction: Dict) -> datetime:
        """Parse transaction date"""
        date_str = transaction.get('postDate', transaction.get('date', ''))
        try:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except:
            return datetime.now()
    
    def _add_purchase_to_bas(self, receipt: Dict, bas_data: BASQuarterData, user_profile: Dict):
        """Add purchase receipt to BAS data"""
        from .australian_tax_categorizer import categorize_receipt
        
        # Categorize the receipt
        categorization = categorize_receipt(receipt, user_profile)
        
        # Extract GST
        gst_extraction = self.extract_gst_from_receipt(receipt)
        
        # Calculate input tax credit
        itc = self.calculate_input_tax_credit(gst_extraction, categorization, user_profile)
        
        # Add to BAS totals
        bas_data.purchases_gst += gst_extraction.gst_amount
        bas_data.input_tax_credits += itc.gst_credit
        
        # Create line item
        line_item = BASLineItem(
            line_code=self._get_bas_line_code(categorization.category.name, "purchase"),
            description=f"{receipt.get('merchant_name', 'Unknown')} - {categorization.category.value}",
            amount=gst_extraction.total_amount,
            gst_amount=itc.gst_credit,
            transaction_count=1,
            period_start=bas_data.period_start,
            period_end=bas_data.period_end
        )
        
        bas_data.line_items.append(line_item)
    
    def _add_transaction_to_bas(self, transaction: Dict, bas_data: BASQuarterData, user_profile: Dict):
        """Add transaction to BAS data"""
        amount = abs(float(transaction.get('amount', 0)))
        
        # Determine if it's income (credit) or expense (debit)
        if float(transaction.get('amount', 0)) > 0:
            # Income - add to sales GST
            gst_amount = Decimal(str(amount)) * self.gst_rate / Decimal('1.1')
            bas_data.sales_gst += gst_amount
            
            line_item = BASLineItem(
                line_code="G1",  # Sales subject to GST
                description=f"Sales - {transaction.get('description', 'Unknown')}",
                amount=Decimal(str(amount)),
                gst_amount=gst_amount,
                transaction_count=1,
                period_start=bas_data.period_start,
                period_end=bas_data.period_end
            )
            bas_data.line_items.append(line_item)
    
    def _get_bas_line_code(self, category: str, transaction_type: str) -> str:
        """Get BAS line code for category and transaction type"""
        
        if transaction_type == "purchase":
            # Input tax credit lines
            return "1C"  # GST on purchases
        else:
            # Sales lines
            if category == "P8":
                return "G1"  # Sales subject to GST
            else:
                return "G2"  # GST-free sales
    
    def generate_bas_summary(self, bas_data: BASQuarterData) -> Dict[str, Any]:
        """Generate BAS summary for reporting"""
        
        return {
            "period": {
                "start": bas_data.period_start.strftime('%Y-%m-%d'),
                "end": bas_data.period_end.strftime('%Y-%m-%d'),
                "quarter": f"Q{((bas_data.period_start.month - 1) // 3) + 1} {bas_data.period_start.year}"
            },
            "gst_summary": {
                "sales_gst": float(bas_data.sales_gst),
                "input_tax_credits": float(bas_data.input_tax_credits),
                "net_gst": float(bas_data.net_gst)
            },
            "payg_summary": {
                "withholding": float(bas_data.payg_withholding),
                "instalment": float(bas_data.payg_instalment)
            },
            "total_refund_payable": float(bas_data.total_refund_payable),
            "line_items_count": len(bas_data.line_items),
            "transactions_processed": sum(item.transaction_count for item in bas_data.line_items)
        }


# Convenience functions for integration
def verify_business_abn(abn: str, api_key: Optional[str] = None) -> ABNDetails:
    """Verify ABN - convenience function"""
    compliance = AustralianBusinessCompliance(api_key)
    return compliance.verify_abn(abn)


def extract_receipt_gst(receipt_data: Dict) -> GSTExtraction:
    """Extract GST from receipt - convenience function"""
    compliance = AustralianBusinessCompliance()
    return compliance.extract_gst_from_receipt(receipt_data)


def calculate_input_tax_credit(receipt_data: Dict, user_profile: Dict) -> InputTaxCredit:
    """Calculate input tax credit - convenience function"""
    from .australian_tax_categorizer import categorize_receipt
    
    compliance = AustralianBusinessCompliance()
    categorization = categorize_receipt(receipt_data, user_profile)
    gst_extraction = compliance.extract_gst_from_receipt(receipt_data)
    
    return compliance.calculate_input_tax_credit(gst_extraction, categorization, user_profile)


# Export for use in other modules
__all__ = [
    "AustralianBusinessCompliance",
    "ABNDetails",
    "GSTExtraction", 
    "InputTaxCredit",
    "BASQuarterData",
    "BASLineItem",
    "GSTType",
    "BusinessType",
    "BASFrequency",
    "verify_business_abn",
    "extract_receipt_gst",
    "calculate_input_tax_credit"
] 