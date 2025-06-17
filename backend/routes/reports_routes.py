"""
TAAXDOG Automated Tax Report Routes
API endpoints for generating comprehensive tax reports and ATO-compliant documentation.
"""

from flask import Blueprint, request, jsonify, send_file
import asyncio
import logging
from datetime import datetime, timedelta
import io
import os
import sys
import os

# Add parent directory to path for cross-module imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

try:
    from automated_reports import AutomatedReportGenerator, ReportType, OutputFormat
    from subscription_manager import subscription_manager, FeatureAccess
    from utils.auth_middleware import require_auth
    from utils.validators import validate_json
except ImportError:
    # Fallback for development mode
    class AutomatedReportGenerator: pass
    class ReportType: pass
    class OutputFormat: pass
    subscription_manager = None
    class FeatureAccess: pass
    def require_auth(func): return func
    def validate_json(*args): return lambda func: func

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

reports_bp = Blueprint('reports', __name__)

# Initialize report generator
report_generator = AutomatedReportGenerator()

@reports_bp.route('/api/reports/generate', methods=['POST'])
@require_auth
def generate_tax_report():
    """Generate comprehensive tax report"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['report_type', 'tax_year']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        report_type_str = data['report_type']
        tax_year = data['tax_year']
        output_format = data.get('output_format', 'pdf')
        
        # Validate report type
        try:
            report_type = ReportType(report_type_str)
        except ValueError:
            return jsonify({
                'success': False,
                'error': f'Invalid report type: {report_type_str}'
            }), 400
        
        # Validate output format
        try:
            output_fmt = OutputFormat(output_format)
        except ValueError:
            return jsonify({
                'success': False,
                'error': f'Invalid output format: {output_format}'
            }), 400
        
        # Check feature access
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Business reports require advanced features
            if report_type in [ReportType.BUSINESS_ACTIVITY_STATEMENT, ReportType.AUDIT_PREPARATION]:
                has_access = loop.run_until_complete(
                    subscription_manager.check_feature_access(user_id, FeatureAccess.ADVANCED_REPORTS)
                )
                
                if not has_access:
                    return jsonify({
                        'success': False,
                        'error': 'Business subscription required for advanced reports',
                        'upgrade_required': True
                    }), 403
            else:
                # Basic reports require premium
                has_access = loop.run_until_complete(
                    subscription_manager.check_feature_access(user_id, FeatureAccess.AUTOMATED_REPORTS)
                )
                
                if not has_access:
                    return jsonify({
                        'success': False,
                        'error': 'Premium subscription required for automated reports',
                        'upgrade_required': True
                    }), 403
            
            # Generate the report
            result = loop.run_until_complete(
                report_generator.generate_comprehensive_tax_report(
                    user_id=user_id,
                    report_type=report_type,
                    tax_year=tax_year,
                    output_format=output_fmt
                )
            )
            
            if not result.get('success'):
                return jsonify(result), 500
            
            return jsonify(result)
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error generating report for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to generate report'
        }), 500

@reports_bp.route('/api/reports/download/<report_id>', methods=['GET'])
@require_auth
def download_report(report_id):
    """Download a generated report"""
    try:
        user_id = request.user_id
        
        # Get report metadata from database
        # This would typically be stored when the report is generated
        # For now, we'll generate a new report
        
        # In a real implementation, you'd fetch the stored report file
        # Here we'll return an error for now since we need to implement file storage
        return jsonify({
            'success': False,
            'error': 'Report download not yet implemented - use generate endpoint'
        }), 501
        
    except Exception as e:
        logger.error(f"Error downloading report {report_id} for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to download report'
        }), 500

@reports_bp.route('/api/reports/list', methods=['GET'])
@require_auth
def list_user_reports():
    """List all reports generated by the user"""
    try:
        user_id = request.user_id
        
        # Get reports from database
        # This would fetch stored report metadata
        # For now, return empty list
        
        return jsonify({
            'success': True,
            'reports': [],
            'message': 'Report history not yet implemented'
        })
        
    except Exception as e:
        logger.error(f"Error listing reports for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to list reports'
        }), 500

@reports_bp.route('/api/reports/preview', methods=['POST'])
@require_auth
def preview_report_data():
    """Preview report data without generating full report"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['tax_year']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        tax_year = data['tax_year']
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Collect tax data for preview
            report_data = loop.run_until_complete(
                report_generator._collect_tax_data(user_id, tax_year)
            )
            
            if not report_data:
                return jsonify({
                    'success': False,
                    'error': 'No data available for the specified tax year'
                }), 404
            
            # Return summary data
            preview = {
                'tax_year': tax_year,
                'total_income': report_data.total_income,
                'total_deductions': report_data.total_deductions,
                'total_expenses': report_data.total_expenses,
                'gst_collected': report_data.gst_collected,
                'gst_paid': report_data.gst_paid,
                'net_gst': report_data.net_gst,
                'transaction_count': len(report_data.transactions),
                'receipt_count': len(report_data.receipts),
                'compliance_score': report_data.compliance_score,
                'audit_risks': report_data.audit_risks,
                'categories': report_data.categories
            }
            
            return jsonify({
                'success': True,
                'preview': preview
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error generating report preview for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to generate preview'
        }), 500

@reports_bp.route('/api/reports/available-types', methods=['GET'])
@require_auth
def get_available_report_types():
    """Get available report types based on user subscription"""
    try:
        user_id = request.user_id
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Check user's feature access
            has_premium = loop.run_until_complete(
                subscription_manager.check_feature_access(user_id, FeatureAccess.AUTOMATED_REPORTS)
            )
            
            has_business = loop.run_until_complete(
                subscription_manager.check_feature_access(user_id, FeatureAccess.ADVANCED_REPORTS)
            )
            
            available_types = []
            
            if has_premium:
                available_types.extend([
                    {
                        'type': ReportType.INDIVIDUAL_TAX_RETURN.value,
                        'name': 'Individual Tax Return',
                        'description': 'Comprehensive individual tax return report',
                        'tier': 'premium'
                    },
                    {
                        'type': ReportType.EXPENSE_SUMMARY.value,
                        'name': 'Expense Summary',
                        'description': 'Detailed breakdown of all expenses',
                        'tier': 'premium'
                    },
                    {
                        'type': ReportType.DEDUCTION_ANALYSIS.value,
                        'name': 'Deduction Analysis',
                        'description': 'Analysis of potential tax deductions',
                        'tier': 'premium'
                    }
                ])
            
            if has_business:
                available_types.extend([
                    {
                        'type': ReportType.BUSINESS_ACTIVITY_STATEMENT.value,
                        'name': 'Business Activity Statement (BAS)',
                        'description': 'Quarterly BAS report for GST-registered businesses',
                        'tier': 'business'
                    },
                    {
                        'type': ReportType.AUDIT_PREPARATION.value,
                        'name': 'Audit Preparation',
                        'description': 'Comprehensive audit preparation documentation',
                        'tier': 'business'
                    },
                    {
                        'type': ReportType.QUARTERLY_SUMMARY.value,
                        'name': 'Quarterly Summary',
                        'description': 'Quarterly financial summary',
                        'tier': 'business'
                    },
                    {
                        'type': ReportType.ANNUAL_SUMMARY.value,
                        'name': 'Annual Summary',
                        'description': 'Annual financial summary',
                        'tier': 'business'
                    }
                ])
            
            # Basic reports (always available)
            available_types.append({
                'type': ReportType.EXPENSE_SUMMARY.value,
                'name': 'Basic Expense Summary',
                'description': 'Basic expense summary (limited features)',
                'tier': 'free'
            })
            
            return jsonify({
                'success': True,
                'report_types': available_types,
                'output_formats': [fmt.value for fmt in OutputFormat]
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting available report types for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get available report types'
        }), 500

@reports_bp.route('/api/reports/schedule', methods=['POST'])
@require_auth
def schedule_automated_report():
    """Schedule automated report generation"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['report_type', 'frequency', 'email']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Check feature access
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            has_access = loop.run_until_complete(
                subscription_manager.check_feature_access(user_id, FeatureAccess.AUTOMATED_REPORTS)
            )
            
            if not has_access:
                return jsonify({
                    'success': False,
                    'error': 'Premium subscription required for automated report scheduling',
                    'upgrade_required': True
                }), 403
            
            # Store scheduled report configuration
            # This would typically be stored in the database for a cron job to process
            # For now, just return success
            
            return jsonify({
                'success': True,
                'message': 'Report scheduling not yet implemented',
                'schedule_id': f"schedule_{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error scheduling report for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to schedule report'
        }), 500 