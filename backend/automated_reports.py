"""
TAAXDOG Automated Tax Report Generation
Advanced system for generating comprehensive tax reports and ATO-compliant documentation.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import pandas as pd
import io
import base64
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
import xlsxwriter
from firebase_config import db
from basiq_api import get_user_transactions
from australian_tax_categorizer import categorize_transaction, TaxCategory

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ReportType(Enum):
    INDIVIDUAL_TAX_RETURN = "individual_tax_return"
    BUSINESS_ACTIVITY_STATEMENT = "business_activity_statement"
    EXPENSE_SUMMARY = "expense_summary"
    DEDUCTION_ANALYSIS = "deduction_analysis"
    QUARTERLY_SUMMARY = "quarterly_summary"
    ANNUAL_SUMMARY = "annual_summary"
    AUDIT_PREPARATION = "audit_preparation"
    CAPITAL_GAINS = "capital_gains"
    DEPRECIATION_SCHEDULE = "depreciation_schedule"

class OutputFormat(Enum):
    PDF = "pdf"
    EXCEL = "xlsx"
    CSV = "csv"
    JSON = "json"
    XML = "xml"

@dataclass
class TaxReportData:
    user_id: str
    report_type: ReportType
    tax_year: str
    total_income: float
    total_deductions: float
    total_expenses: float
    gst_collected: float
    gst_paid: float
    net_gst: float
    categories: Dict[str, float]
    transactions: List[Dict]
    receipts: List[Dict]
    compliance_score: float
    audit_risks: List[str]
    generated_at: datetime

@dataclass
class ReportMetadata:
    title: str
    description: str
    tax_year: str
    generated_date: str
    user_name: str
    business_name: Optional[str]
    abn: Optional[str]
    report_id: str

class AutomatedReportGenerator:
    """Advanced tax report generation system"""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom report styles"""
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            spaceAfter=30,
            textColor=colors.HexColor('#2c3e50'),
            alignment=1  # Center
        ))
        
        self.styles.add(ParagraphStyle(
            name='CustomHeading',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceBefore=20,
            spaceAfter=12,
            textColor=colors.HexColor('#34495e')
        ))
        
        self.styles.add(ParagraphStyle(
            name='CustomBody',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=12
        ))
    
    async def generate_comprehensive_tax_report(
        self, 
        user_id: str, 
        report_type: ReportType,
        tax_year: str,
        output_format: OutputFormat = OutputFormat.PDF
    ) -> Dict[str, Any]:
        """Generate comprehensive tax report"""
        try:
            # Collect and process data
            report_data = await self._collect_tax_data(user_id, tax_year)
            
            if not report_data:
                return {
                    'success': False,
                    'error': 'No data available for report generation'
                }
            
            # Generate report based on type and format
            if output_format == OutputFormat.PDF:
                result = await self._generate_pdf_report(report_data, report_type)
            elif output_format == OutputFormat.EXCEL:
                result = await self._generate_excel_report(report_data, report_type)
            elif output_format == OutputFormat.CSV:
                result = await self._generate_csv_report(report_data, report_type)
            elif output_format == OutputFormat.JSON:
                result = await self._generate_json_report(report_data, report_type)
            else:
                return {
                    'success': False,
                    'error': f'Unsupported output format: {output_format.value}'
                }
            
            # Store report metadata
            await self._store_report_metadata(user_id, report_type, tax_year, result)
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating tax report for user {user_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _collect_tax_data(self, user_id: str, tax_year: str) -> Optional[TaxReportData]:
        """Collect comprehensive tax data for the user"""
        try:
            # Define tax year dates (Australian financial year: July 1 - June 30)
            start_date = datetime(int(tax_year), 7, 1)
            end_date = datetime(int(tax_year) + 1, 6, 30)
            
            # Get transactions for the tax year
            filter_str = f"transaction.postDate.gte={start_date.isoformat()}&transaction.postDate.lte={end_date.isoformat()}"
            transactions_result = get_user_transactions(user_id, filter_str)
            
            if not transactions_result.get('success'):
                return None
            
            transactions = transactions_result.get('transactions', {}).get('data', [])
            
            # Get user profile and tax profile
            user_profile = None
            tax_profile = None
            
            if db:
                user_ref = db.collection('users').document(user_id)
                user_doc = user_ref.get()
                if user_doc.exists:
                    user_profile = user_doc.to_dict()
                
                tax_profile_ref = db.collection('taxProfiles').where('userId', '==', user_id).get()
                if tax_profile_ref:
                    tax_profile = tax_profile_ref[0].to_dict()
                
                # Get receipts for the tax year
                receipts_ref = db.collection('receipts').where('userId', '==', user_id)
                receipts = [doc.to_dict() for doc in receipts_ref.get()]
            
            # Process transactions and categorize
            categorized_data = self._categorize_transactions(transactions, tax_profile)
            
            # Calculate totals
            total_income = sum(
                abs(float(t.get('amount', 0))) for t in transactions 
                if t.get('direction') == 'credit'
            )
            
            total_expenses = sum(
                abs(float(t.get('amount', 0))) for t in transactions 
                if t.get('direction') == 'debit'
            )
            
            total_deductions = categorized_data['total_deductions']
            
            # Calculate GST (if applicable)
            gst_data = self._calculate_gst(transactions, tax_profile)
            
            # Assess compliance
            compliance_score, audit_risks = self._assess_compliance(transactions, receipts or [])
            
            return TaxReportData(
                user_id=user_id,
                report_type=ReportType.INDIVIDUAL_TAX_RETURN,
                tax_year=tax_year,
                total_income=total_income,
                total_deductions=total_deductions,
                total_expenses=total_expenses,
                gst_collected=gst_data['collected'],
                gst_paid=gst_data['paid'],
                net_gst=gst_data['net'],
                categories=categorized_data['categories'],
                transactions=transactions,
                receipts=receipts or [],
                compliance_score=compliance_score,
                audit_risks=audit_risks,
                generated_at=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error collecting tax data for user {user_id}: {e}")
            return None
    
    def _categorize_transactions(self, transactions: List[Dict], tax_profile: Optional[Dict]) -> Dict[str, Any]:
        """Categorize transactions for tax purposes"""
        categories = {}
        total_deductions = 0
        
        for transaction in transactions:
            if transaction.get('direction') == 'debit':
                amount = abs(float(transaction.get('amount', 0)))
                
                # Use the categorization system
                categorization = categorize_transaction(transaction, tax_profile)
                category_name = categorization.category.value
                
                if category_name not in categories:
                    categories[category_name] = {
                        'total': 0,
                        'deductible': 0,
                        'transactions': []
                    }
                
                categories[category_name]['total'] += amount
                categories[category_name]['transactions'].append(transaction)
                
                # Calculate deductible amount
                if categorization.category != TaxCategory.PERSONAL:
                    deductible_amount = amount * categorization.deductibility
                    categories[category_name]['deductible'] += deductible_amount
                    total_deductions += deductible_amount
        
        return {
            'categories': categories,
            'total_deductions': total_deductions
        }
    
    def _calculate_gst(self, transactions: List[Dict], tax_profile: Optional[Dict]) -> Dict[str, float]:
        """Calculate GST collected and paid"""
        gst_collected = 0
        gst_paid = 0
        
        # Check if user is registered for GST
        if tax_profile and tax_profile.get('personalInfo', {}).get('abn'):
            for transaction in transactions:
                amount = abs(float(transaction.get('amount', 0)))
                
                # Simple GST calculation (10% of eligible transactions)
                if transaction.get('direction') == 'credit':
                    # Income - GST collected
                    gst_collected += amount * 0.1
                elif transaction.get('direction') == 'debit':
                    # Business expenses - GST paid
                    categorization = categorize_transaction(transaction, tax_profile)
                    if categorization.category != TaxCategory.PERSONAL:
                        gst_paid += amount * 0.1
        
        return {
            'collected': gst_collected,
            'paid': gst_paid,
            'net': gst_collected - gst_paid
        }
    
    def _assess_compliance(self, transactions: List[Dict], receipts: List[Dict]) -> Tuple[float, List[str]]:
        """Assess tax compliance and identify risks"""
        compliance_score = 100
        audit_risks = []
        
        # Check receipt coverage
        business_transactions = [
            t for t in transactions 
            if t.get('direction') == 'debit' and abs(float(t.get('amount', 0))) > 50
        ]
        
        receipt_coverage = len(receipts) / len(business_transactions) if business_transactions else 1
        
        if receipt_coverage < 0.7:
            compliance_score -= 20
            audit_risks.append("Low receipt coverage for business expenses")
        
        # Check for large cash transactions
        large_cash_count = 0
        for transaction in transactions:
            amount = abs(float(transaction.get('amount', 0)))
            description = transaction.get('description', '').lower()
            
            if amount > 10000 and 'cash' in description:
                large_cash_count += 1
                compliance_score -= 10
        
        if large_cash_count > 0:
            audit_risks.append(f"{large_cash_count} large cash transactions detected")
        
        # Check for round number transactions
        round_transactions = [
            t for t in transactions 
            if abs(float(t.get('amount', 0))) % 100 == 0 and abs(float(t.get('amount', 0))) > 100
        ]
        
        if len(round_transactions) > len(transactions) * 0.2:
            compliance_score -= 10
            audit_risks.append("High percentage of round-number transactions")
        
        return max(0, compliance_score), audit_risks
    
    async def _generate_pdf_report(self, report_data: TaxReportData, report_type: ReportType) -> Dict[str, Any]:
        """Generate PDF report"""
        try:
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, 
                                  rightMargin=72, leftMargin=72,
                                  topMargin=72, bottomMargin=18)
            
            story = []
            
            # Title
            title = self._get_report_title(report_type)
            story.append(Paragraph(title, self.styles['CustomTitle']))
            story.append(Spacer(1, 12))
            
            # Report metadata
            metadata = self._generate_report_metadata(report_data)
            story.extend(self._create_metadata_section(metadata))
            
            # Executive summary
            story.extend(self._create_executive_summary(report_data))
            
            # Income summary
            story.extend(self._create_income_section(report_data))
            
            # Deductions summary
            story.extend(self._create_deductions_section(report_data))
            
            # Category breakdown
            story.extend(self._create_category_breakdown(report_data))
            
            # GST summary (if applicable)
            if report_data.gst_collected > 0 or report_data.gst_paid > 0:
                story.extend(self._create_gst_section(report_data))
            
            # Compliance assessment
            story.extend(self._create_compliance_section(report_data))
            
            # Transaction details (new page)
            story.append(PageBreak())
            story.extend(self._create_transaction_details(report_data))
            
            # Build PDF
            doc.build(story)
            buffer.seek(0)
            
            # Convert to base64 for transmission
            pdf_data = buffer.getvalue()
            pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')
            
            return {
                'success': True,
                'format': 'pdf',
                'data': pdf_base64,
                'filename': f"tax_report_{report_data.tax_year}_{datetime.now().strftime('%Y%m%d')}.pdf",
                'size': len(pdf_data)
            }
            
        except Exception as e:
            logger.error(f"Error generating PDF report: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _generate_excel_report(self, report_data: TaxReportData, report_type: ReportType) -> Dict[str, Any]:
        """Generate Excel report with multiple worksheets"""
        try:
            buffer = io.BytesIO()
            workbook = xlsxwriter.Workbook(buffer, {'in_memory': True})
            
            # Define formats
            title_format = workbook.add_format({
                'bold': True,
                'font_size': 16,
                'align': 'center',
                'valign': 'vcenter',
                'bg_color': '#366092',
                'font_color': 'white'
            })
            
            header_format = workbook.add_format({
                'bold': True,
                'bg_color': '#D7E4BC',
                'border': 1
            })
            
            currency_format = workbook.add_format({
                'num_format': '$#,##0.00',
                'border': 1
            })
            
            # Summary worksheet
            summary_ws = workbook.add_worksheet('Summary')
            self._create_excel_summary(summary_ws, report_data, title_format, header_format, currency_format)
            
            # Income worksheet
            income_ws = workbook.add_worksheet('Income')
            self._create_excel_income(income_ws, report_data, header_format, currency_format)
            
            # Deductions worksheet
            deductions_ws = workbook.add_worksheet('Deductions')
            self._create_excel_deductions(deductions_ws, report_data, header_format, currency_format)
            
            # Transactions worksheet
            transactions_ws = workbook.add_worksheet('All Transactions')
            self._create_excel_transactions(transactions_ws, report_data, header_format, currency_format)
            
            # GST worksheet (if applicable)
            if report_data.gst_collected > 0 or report_data.gst_paid > 0:
                gst_ws = workbook.add_worksheet('GST Summary')
                self._create_excel_gst(gst_ws, report_data, header_format, currency_format)
            
            workbook.close()
            buffer.seek(0)
            
            # Convert to base64
            excel_data = buffer.getvalue()
            excel_base64 = base64.b64encode(excel_data).decode('utf-8')
            
            return {
                'success': True,
                'format': 'xlsx',
                'data': excel_base64,
                'filename': f"tax_report_{report_data.tax_year}_{datetime.now().strftime('%Y%m%d')}.xlsx",
                'size': len(excel_data)
            }
            
        except Exception as e:
            logger.error(f"Error generating Excel report: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _generate_csv_report(self, report_data: TaxReportData, report_type: ReportType) -> Dict[str, Any]:
        """Generate CSV report"""
        try:
            # Create DataFrame from transactions
            df = pd.DataFrame(report_data.transactions)
            
            # Add categorization
            df['tax_category'] = df.apply(
                lambda row: categorize_transaction(row.to_dict(), None).category.value, 
                axis=1
            )
            
            # Convert to CSV
            csv_buffer = io.StringIO()
            df.to_csv(csv_buffer, index=False)
            csv_data = csv_buffer.getvalue()
            
            # Convert to base64
            csv_base64 = base64.b64encode(csv_data.encode('utf-8')).decode('utf-8')
            
            return {
                'success': True,
                'format': 'csv',
                'data': csv_base64,
                'filename': f"transactions_{report_data.tax_year}_{datetime.now().strftime('%Y%m%d')}.csv",
                'size': len(csv_data)
            }
            
        except Exception as e:
            logger.error(f"Error generating CSV report: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _generate_json_report(self, report_data: TaxReportData, report_type: ReportType) -> Dict[str, Any]:
        """Generate JSON report"""
        try:
            report_dict = {
                'metadata': {
                    'user_id': report_data.user_id,
                    'report_type': report_type.value,
                    'tax_year': report_data.tax_year,
                    'generated_at': report_data.generated_at.isoformat()
                },
                'summary': {
                    'total_income': report_data.total_income,
                    'total_deductions': report_data.total_deductions,
                    'total_expenses': report_data.total_expenses,
                    'compliance_score': report_data.compliance_score
                },
                'gst': {
                    'collected': report_data.gst_collected,
                    'paid': report_data.gst_paid,
                    'net': report_data.net_gst
                },
                'categories': report_data.categories,
                'transactions': report_data.transactions,
                'receipts': report_data.receipts,
                'audit_risks': report_data.audit_risks
            }
            
            json_data = json.dumps(report_dict, indent=2, default=str)
            json_base64 = base64.b64encode(json_data.encode('utf-8')).decode('utf-8')
            
            return {
                'success': True,
                'format': 'json',
                'data': json_base64,
                'filename': f"tax_report_{report_data.tax_year}_{datetime.now().strftime('%Y%m%d')}.json",
                'size': len(json_data)
            }
            
        except Exception as e:
            logger.error(f"Error generating JSON report: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _get_report_title(self, report_type: ReportType) -> str:
        """Get report title based on type"""
        titles = {
            ReportType.INDIVIDUAL_TAX_RETURN: "Individual Tax Return Summary",
            ReportType.BUSINESS_ACTIVITY_STATEMENT: "Business Activity Statement",
            ReportType.EXPENSE_SUMMARY: "Expense Summary Report",
            ReportType.DEDUCTION_ANALYSIS: "Tax Deduction Analysis",
            ReportType.QUARTERLY_SUMMARY: "Quarterly Financial Summary",
            ReportType.ANNUAL_SUMMARY: "Annual Financial Summary",
            ReportType.AUDIT_PREPARATION: "Audit Preparation Report",
            ReportType.CAPITAL_GAINS: "Capital Gains Report",
            ReportType.DEPRECIATION_SCHEDULE: "Depreciation Schedule"
        }
        return titles.get(report_type, "Tax Report")
    
    def _generate_report_metadata(self, report_data: TaxReportData) -> ReportMetadata:
        """Generate report metadata"""
        return ReportMetadata(
            title=self._get_report_title(report_data.report_type),
            description=f"Comprehensive tax report for financial year {report_data.tax_year}",
            tax_year=report_data.tax_year,
            generated_date=report_data.generated_at.strftime('%d %B %Y'),
            user_name="Tax Payer",  # Get from user profile
            business_name=None,
            abn=None,
            report_id=f"TR{report_data.tax_year}{datetime.now().strftime('%m%d%H%M')}"
        )
    
    def _create_metadata_section(self, metadata: ReportMetadata) -> List:
        """Create metadata section for PDF"""
        elements = []
        
        elements.append(Paragraph(f"<b>Report ID:</b> {metadata.report_id}", self.styles['CustomBody']))
        elements.append(Paragraph(f"<b>Tax Year:</b> {metadata.tax_year}", self.styles['CustomBody']))
        elements.append(Paragraph(f"<b>Generated:</b> {metadata.generated_date}", self.styles['CustomBody']))
        elements.append(Spacer(1, 12))
        
        return elements
    
    def _create_executive_summary(self, report_data: TaxReportData) -> List:
        """Create executive summary section"""
        elements = []
        
        elements.append(Paragraph("Executive Summary", self.styles['CustomHeading']))
        
        # Summary table
        data = [
            ['Metric', 'Amount (AUD)'],
            ['Total Income', f"${report_data.total_income:,.2f}"],
            ['Total Deductions', f"${report_data.total_deductions:,.2f}"],
            ['Total Expenses', f"${report_data.total_expenses:,.2f}"],
            ['Taxable Income', f"${report_data.total_income - report_data.total_deductions:,.2f}"],
            ['Compliance Score', f"{report_data.compliance_score:.1f}%"]
        ]
        
        if report_data.net_gst != 0:
            data.append(['Net GST Position', f"${report_data.net_gst:,.2f}"])
        
        table = Table(data, colWidths=[3*inch, 2*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(table)
        elements.append(Spacer(1, 12))
        
        return elements
    
    def _create_income_section(self, report_data: TaxReportData) -> List:
        """Create income section"""
        elements = []
        
        elements.append(Paragraph("Income Summary", self.styles['CustomHeading']))
        
        # Income transactions
        income_transactions = [
            t for t in report_data.transactions 
            if t.get('direction') == 'credit'
        ]
        
        if income_transactions:
            elements.append(Paragraph(f"Total income transactions: {len(income_transactions)}", self.styles['CustomBody']))
            elements.append(Paragraph(f"Total income amount: ${report_data.total_income:,.2f}", self.styles['CustomBody']))
        else:
            elements.append(Paragraph("No income transactions found for this period.", self.styles['CustomBody']))
        
        elements.append(Spacer(1, 12))
        
        return elements
    
    def _create_deductions_section(self, report_data: TaxReportData) -> List:
        """Create deductions section"""
        elements = []
        
        elements.append(Paragraph("Tax Deductions Summary", self.styles['CustomHeading']))
        
        if report_data.total_deductions > 0:
            elements.append(Paragraph(f"Total deductible amount: ${report_data.total_deductions:,.2f}", self.styles['CustomBody']))
            
            # Top deduction categories
            sorted_categories = sorted(
                [(cat, data['deductible']) for cat, data in report_data.categories.items() if data['deductible'] > 0],
                key=lambda x: x[1],
                reverse=True
            )
            
            if sorted_categories:
                elements.append(Paragraph("Top deduction categories:", self.styles['CustomBody']))
                for i, (category, amount) in enumerate(sorted_categories[:5], 1):
                    elements.append(Paragraph(f"{i}. {category}: ${amount:,.2f}", self.styles['CustomBody']))
        else:
            elements.append(Paragraph("No tax deductions identified for this period.", self.styles['CustomBody']))
        
        elements.append(Spacer(1, 12))
        
        return elements
    
    def _create_category_breakdown(self, report_data: TaxReportData) -> List:
        """Create category breakdown section"""
        elements = []
        
        elements.append(Paragraph("Expense Category Breakdown", self.styles['CustomHeading']))
        
        if report_data.categories:
            # Create table data
            data = [['Category', 'Total Spent', 'Deductible Amount', 'Transaction Count']]
            
            for category, cat_data in sorted(report_data.categories.items(), key=lambda x: x[1]['total'], reverse=True):
                data.append([
                    category,
                    f"${cat_data['total']:,.2f}",
                    f"${cat_data['deductible']:,.2f}",
                    str(len(cat_data['transactions']))
                ])
            
            table = Table(data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            elements.append(table)
        else:
            elements.append(Paragraph("No categorized expenses found.", self.styles['CustomBody']))
        
        elements.append(Spacer(1, 12))
        
        return elements
    
    def _create_gst_section(self, report_data: TaxReportData) -> List:
        """Create GST section"""
        elements = []
        
        elements.append(Paragraph("GST Summary", self.styles['CustomHeading']))
        
        data = [
            ['GST Component', 'Amount (AUD)'],
            ['GST Collected on Sales', f"${report_data.gst_collected:,.2f}"],
            ['GST Paid on Purchases', f"${report_data.gst_paid:,.2f}"],
            ['Net GST Position', f"${report_data.net_gst:,.2f}"]
        ]
        
        table = Table(data, colWidths=[3*inch, 2*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(table)
        elements.append(Spacer(1, 12))
        
        return elements
    
    def _create_compliance_section(self, report_data: TaxReportData) -> List:
        """Create compliance assessment section"""
        elements = []
        
        elements.append(Paragraph("Compliance Assessment", self.styles['CustomHeading']))
        elements.append(Paragraph(f"Compliance Score: {report_data.compliance_score:.1f}%", self.styles['CustomBody']))
        
        if report_data.audit_risks:
            elements.append(Paragraph("Potential Audit Risks:", self.styles['CustomBody']))
            for risk in report_data.audit_risks:
                elements.append(Paragraph(f"• {risk}", self.styles['CustomBody']))
        else:
            elements.append(Paragraph("No significant audit risks identified.", self.styles['CustomBody']))
        
        elements.append(Spacer(1, 12))
        
        return elements
    
    def _create_transaction_details(self, report_data: TaxReportData) -> List:
        """Create transaction details section"""
        elements = []
        
        elements.append(Paragraph("Transaction Details", self.styles['CustomHeading']))
        
        # Show first 50 transactions in PDF to avoid huge documents
        display_transactions = report_data.transactions[:50]
        
        if display_transactions:
            data = [['Date', 'Description', 'Amount', 'Type', 'Category']]
            
            for transaction in display_transactions:
                date_str = transaction.get('postDate', '')[:10]  # YYYY-MM-DD
                description = transaction.get('description', '')[:30]  # Truncate long descriptions
                amount = f"${abs(float(transaction.get('amount', 0))):,.2f}"
                tx_type = transaction.get('direction', 'unknown')
                category = categorize_transaction(transaction, None).category.value
                
                data.append([date_str, description, amount, tx_type, category])
            
            table = Table(data, colWidths=[1*inch, 2.5*inch, 1*inch, 0.8*inch, 1.2*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('FONTSIZE', (0, 1), (-1, -1), 8)
            ]))
            
            elements.append(table)
            
            if len(report_data.transactions) > 50:
                elements.append(Spacer(1, 12))
                elements.append(Paragraph(f"Showing first 50 of {len(report_data.transactions)} transactions. Full details available in Excel export.", self.styles['CustomBody']))
        
        return elements
    
    def _create_excel_summary(self, worksheet, report_data, title_format, header_format, currency_format):
        """Create Excel summary worksheet"""
        worksheet.merge_range('A1:E1', f'Tax Report Summary - {report_data.tax_year}', title_format)
        
        row = 3
        worksheet.write(row, 0, 'Metric', header_format)
        worksheet.write(row, 1, 'Amount (AUD)', header_format)
        
        row += 1
        worksheet.write(row, 0, 'Total Income')
        worksheet.write(row, 1, report_data.total_income, currency_format)
        
        row += 1
        worksheet.write(row, 0, 'Total Deductions')
        worksheet.write(row, 1, report_data.total_deductions, currency_format)
        
        row += 1
        worksheet.write(row, 0, 'Total Expenses')
        worksheet.write(row, 1, report_data.total_expenses, currency_format)
        
        row += 1
        worksheet.write(row, 0, 'Taxable Income')
        worksheet.write(row, 1, report_data.total_income - report_data.total_deductions, currency_format)
        
        row += 1
        worksheet.write(row, 0, 'Compliance Score')
        worksheet.write(row, 1, f"{report_data.compliance_score:.1f}%")
    
    def _create_excel_income(self, worksheet, report_data, header_format, currency_format):
        """Create Excel income worksheet"""
        worksheet.write(0, 0, 'Date', header_format)
        worksheet.write(0, 1, 'Description', header_format)
        worksheet.write(0, 2, 'Amount', header_format)
        worksheet.write(0, 3, 'Account', header_format)
        
        row = 1
        for transaction in report_data.transactions:
            if transaction.get('direction') == 'credit':
                worksheet.write(row, 0, transaction.get('postDate', ''))
                worksheet.write(row, 1, transaction.get('description', ''))
                worksheet.write(row, 2, abs(float(transaction.get('amount', 0))), currency_format)
                worksheet.write(row, 3, transaction.get('account', {}).get('displayName', ''))
                row += 1
    
    def _create_excel_deductions(self, worksheet, report_data, header_format, currency_format):
        """Create Excel deductions worksheet"""
        worksheet.write(0, 0, 'Category', header_format)
        worksheet.write(0, 1, 'Total Spent', header_format)
        worksheet.write(0, 2, 'Deductible Amount', header_format)
        worksheet.write(0, 3, 'Transaction Count', header_format)
        
        row = 1
        for category, cat_data in report_data.categories.items():
            if cat_data['deductible'] > 0:
                worksheet.write(row, 0, category)
                worksheet.write(row, 1, cat_data['total'], currency_format)
                worksheet.write(row, 2, cat_data['deductible'], currency_format)
                worksheet.write(row, 3, len(cat_data['transactions']))
                row += 1
    
    def _create_excel_transactions(self, worksheet, report_data, header_format, currency_format):
        """Create Excel all transactions worksheet"""
        headers = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Account']
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, header_format)
        
        row = 1
        for transaction in report_data.transactions:
            worksheet.write(row, 0, transaction.get('postDate', ''))
            worksheet.write(row, 1, transaction.get('description', ''))
            worksheet.write(row, 2, abs(float(transaction.get('amount', 0))), currency_format)
            worksheet.write(row, 3, transaction.get('direction', ''))
            worksheet.write(row, 4, categorize_transaction(transaction, None).category.value)
            worksheet.write(row, 5, transaction.get('account', {}).get('displayName', ''))
            row += 1
    
    def _create_excel_gst(self, worksheet, report_data, header_format, currency_format):
        """Create Excel GST worksheet"""
        worksheet.write(0, 0, 'GST Component', header_format)
        worksheet.write(0, 1, 'Amount (AUD)', header_format)
        
        worksheet.write(1, 0, 'GST Collected on Sales')
        worksheet.write(1, 1, report_data.gst_collected, currency_format)
        
        worksheet.write(2, 0, 'GST Paid on Purchases')
        worksheet.write(2, 1, report_data.gst_paid, currency_format)
        
        worksheet.write(3, 0, 'Net GST Position')
        worksheet.write(3, 1, report_data.net_gst, currency_format)
    
    async def _store_report_metadata(self, user_id: str, report_type: ReportType, tax_year: str, result: Dict[str, Any]) -> None:
        """Store report metadata in Firebase"""
        try:
            if not db or not result.get('success'):
                return
            
            metadata = {
                'user_id': user_id,
                'report_type': report_type.value,
                'tax_year': tax_year,
                'format': result.get('format'),
                'filename': result.get('filename'),
                'size': result.get('size'),
                'generated_at': datetime.now().isoformat(),
                'download_count': 0
            }
            
            db.collection('reports').add(metadata)
            
        except Exception as e:
            logger.error(f"Error storing report metadata: {e}")

# Singleton instance
automated_report_generator = AutomatedReportGenerator() 