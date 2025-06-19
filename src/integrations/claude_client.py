import os
import json
import requests
import logging
import base64
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
import time
from dataclasses import dataclass

# Setup logging
logger = logging.getLogger(__name__)

@dataclass
class ClaudeResponse:
    """Structured response from Claude API"""
    success: bool
    content: str
    usage: Optional[Dict[str, int]] = None
    model: Optional[str] = None
    error: Optional[str] = None
    confidence: float = 0.0
    processing_time: float = 0.0

class ClaudeClientError(Exception):
    """Custom exception for Claude client errors"""
    pass

class ClaudeClient:
    """
    Comprehensive Claude 3.7 Sonnet client for TAAXDOG financial analysis.
    Provides receipt OCR, financial insights, tax categorization, and chatbot functionality.
    """
    
    def __init__(self):
        """Initialize Claude client with configuration"""
        self.api_key = os.getenv('CLAUDE_API_KEY')
        self.api_url = os.getenv('CLAUDE_API_URL', 'https://api.anthropic.com/v1/messages')
        self.model = os.getenv('CLAUDE_MODEL', 'claude-3-5-sonnet-20241022')
        self.max_tokens = int(os.getenv('CLAUDE_MAX_TOKENS', '4000'))
        self.temperature = float(os.getenv('CLAUDE_TEMPERATURE', '0.1'))
        
        if not self.api_key:
            raise ClaudeClientError("CLAUDE_API_KEY environment variable is required")
        
        # Validate API key format
        if not self.api_key.startswith('sk-ant-api'):
            logger.warning("Claude API key format may be incorrect")
        
        logger.info(f"Claude client initialized with model: {self.model}")

    def _make_api_call(self, messages: List[Dict], system_prompt: str = "", 
                       max_tokens: Optional[int] = None, temperature: Optional[float] = None) -> ClaudeResponse:
        """
        Make API call to Claude with comprehensive error handling
        
        Args:
            messages: List of message objects for the conversation
            system_prompt: System instruction for Claude
            max_tokens: Override default max tokens
            temperature: Override default temperature
            
        Returns:
            ClaudeResponse object with results and metadata
        """
        start_time = time.time()
        
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "max_tokens": max_tokens or self.max_tokens,
            "temperature": temperature or self.temperature,
            "messages": messages
        }
        
        if system_prompt:
            payload["system"] = system_prompt
        
        try:
            logger.info(f"Making Claude API call with {len(messages)} messages")
            response = requests.post(self.api_url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            processing_time = time.time() - start_time
            
            # Extract content from response
            content = ""
            if "content" in result and result["content"]:
                content = result["content"][0].get("text", "")
            
            # Extract usage information
            usage = result.get("usage", {})
            
            logger.info(f"Claude API call successful in {processing_time:.2f}s")
            
            return ClaudeResponse(
                success=True,
                content=content,
                usage=usage,
                model=result.get("model"),
                processing_time=processing_time,
                confidence=0.9  # High confidence for successful API calls
            )
            
        except requests.exceptions.Timeout:
            error_msg = "Claude API request timed out"
            logger.error(error_msg)
            return ClaudeResponse(success=False, content="", error=error_msg, processing_time=time.time() - start_time)
            
        except requests.exceptions.HTTPError as e:
            if response.status_code == 429:
                error_msg = "Claude API rate limit exceeded"
            elif response.status_code == 401:
                error_msg = "Claude API authentication failed - check API key"
            elif response.status_code == 400:
                error_msg = f"Claude API bad request: {response.text}"
            else:
                error_msg = f"Claude API HTTP error: {e}"
            
            logger.error(error_msg)
            return ClaudeResponse(success=False, content="", error=error_msg, processing_time=time.time() - start_time)
            
        except Exception as e:
            error_msg = f"Claude API unexpected error: {str(e)}"
            logger.error(error_msg)
            return ClaudeResponse(success=False, content="", error=error_msg, processing_time=time.time() - start_time)

    def analyze_receipt(self, image_data: Union[str, bytes], user_profile: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Analyze receipt using Claude for comprehensive data extraction and Australian tax categorization
        
        Args:
            image_data: Base64 encoded image data or raw bytes
            user_profile: User's tax profile for context
            
        Returns:
            Dict containing extracted receipt data with Australian tax compliance
        """
        try:
            # Ensure image_data is base64 string
            if isinstance(image_data, bytes):
                image_data = base64.b64encode(image_data).decode('utf-8')
            elif not isinstance(image_data, str):
                raise ClaudeClientError("Image data must be base64 string or bytes")
            
            system_prompt = """You are an expert Australian Tax Office (ATO) compliant receipt analyzer specializing in business expense extraction and tax categorization.

ANALYZE this receipt image and extract data into VALID JSON format ONLY:

REQUIRED JSON STRUCTURE:
{
  "merchant_name": "string - exact business name from receipt header",
  "abn": "string - 11-digit Australian Business Number if visible (format: XX XXX XXX XXX)",
  "date": "string - YYYY-MM-DD format (convert from DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY)",
  "time": "string - HH:MM format if visible",
  "total_amount": "number - final amount paid (decimal, no $ symbol)",
  "subtotal": "number - amount before GST if shown",
  "gst_amount": "number - GST/tax amount (extract or calculate)",
  "gst_rate": "number - GST percentage (usually 10.0 in Australia)",
  "payment_method": "string - cash, card, eftpos, contactless, etc.",
  "suggested_tax_category": "string - ATO category based on merchant/items",
  "business_expense_likelihood": "number - 0.0-1.0 probability this is work-related",
  "confidence_score": "number - 0.0-1.0 extraction confidence",
  "items": [
    {
      "name": "string - item description",
      "quantity": "number - quantity (default 1)",
      "price": "number - individual item price"
    }
  ]
}

AUSTRALIAN TAX CATEGORIES:
- D1: Car expenses (fuel stations: BP, Shell, Caltex, 7-Eleven, parking, tolls, automotive)
- D2: Travel expenses (hotels, flights: Qantas, Jetstar, Virgin, taxis, Uber, transport)
- D3: Work clothing (uniforms, safety equipment - work-specific only)
- D4: Education (university, TAFE, courses, textbooks, training materials)
- D5: Home office (Officeworks, office supplies, stationery, printer cartridges)
- D6: Equipment/tools (Bunnings, tools, work equipment, computers if work-related)
- D7: Phone/internet (Telstra, Optus, Vodafone, mobile/internet bills)
- D8: Professional development (conferences, seminars, certifications, training)
- D9: Memberships (professional associations, work-related gym/club fees)
- D10: Work insurance (professional indemnity, business insurance)
- D11: Bank fees (loan interest, investment costs, financial services)
- D12: Income protection insurance
- D13: Donations (charity, workplace giving, deductible gifts)
- D14: Investment expenses (financial planning, share trading fees)
- D15: Other work expenses
- P8: Personal services income expenses
- Personal: Supermarkets (Woolworths, Coles, ALDI), restaurants, personal shopping

GST CALCULATION RULES:
1. If GST explicitly shown: use exact amount
2. If only total: GST = total ÷ 11, subtotal = total - GST
3. Validate: subtotal + GST should equal total

BUSINESS LIKELIHOOD SCORING:
- D1-D15, P8 categories: 0.7-0.9
- Personal merchants: 0.1-0.3
- Uncertain: 0.5

Return ONLY valid JSON, no markdown, no explanations."""

            user_context = ""
            if user_profile:
                user_context = f"\nUser context: {json.dumps(user_profile)}"

            messages = [{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_data
                        }
                    },
                    {
                        "type": "text",
                        "text": f"Analyze this receipt for Australian tax purposes.{user_context}"
                    }
                ]
            }]
            
            response = self._make_api_call(messages, system_prompt)
            
            if not response.success:
                return {
                    "success": False,
                    "error": response.error,
                    "confidence": 0.0
                }
            
            # Parse JSON response
            try:
                extracted_data = json.loads(response.content)
                
                # Validate required fields
                required_fields = ['merchant_name', 'date', 'total_amount', 'suggested_tax_category']
                for field in required_fields:
                    if field not in extracted_data:
                        extracted_data[field] = ""
                
                # Ensure confidence score
                if 'confidence_score' not in extracted_data:
                    extracted_data['confidence_score'] = response.confidence
                
                # Return in expected format for TAAXDOG
                return {
                    "success": True,
                    "documents": [{
                        "data": extracted_data
                    }],
                    "extraction_method": "claude-3.7-sonnet",
                    "processing_metadata": {
                        "australian_tax_compliant": True,
                        "processing_time_ms": int(response.processing_time * 1000),
                        "model_used": self.model,
                        "usage": response.usage
                    }
                }
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Claude response as JSON: {e}")
                return {
                    "success": False,
                    "error": f"Invalid JSON response from Claude: {str(e)}",
                    "confidence": 0.0,
                    "raw_response": response.content[:500]  # First 500 chars for debugging
                }
                
        except Exception as e:
            logger.error(f"Error in Claude receipt analysis: {str(e)}")
            return {
                "success": False,
                "error": f"Receipt analysis failed: {str(e)}",
                "confidence": 0.0
            }

    def analyze_financial_data(self, transactions: List[Dict], user_profile: Dict) -> Dict[str, Any]:
        """
        Analyze financial data for comprehensive insights and recommendations
        
        Args:
            transactions: List of user transactions
            user_profile: User's financial profile and preferences
            
        Returns:
            Dict containing financial analysis and recommendations
        """
        try:
            system_prompt = """You are an expert Australian financial advisor specializing in personal finance optimization and tax compliance.

Analyze the provided financial data and generate comprehensive insights following this JSON structure:

{
  "spending_analysis": {
    "monthly_average": "number - average monthly spending",
    "top_categories": ["array of top 5 spending categories with amounts"],
    "trends": "string - description of spending trends",
    "seasonal_patterns": "string - identified seasonal spending patterns"
  },
  "tax_optimization": {
    "potential_deductions": "number - estimated annual deductions available",
    "deduction_categories": ["array of categories with deduction potential"],
    "compliance_score": "number - 0-100 tax compliance rating",
    "recommendations": ["array of specific tax optimization recommendations"]
  },
  "budget_recommendations": {
    "suggested_monthly_budget": "number - recommended total monthly budget",
    "category_allocations": {
      "housing": "number - % allocation",
      "food": "number - % allocation", 
      "transport": "number - % allocation",
      "entertainment": "number - % allocation",
      "savings": "number - % allocation"
    },
    "optimization_opportunities": ["array of budget optimization suggestions"]
  },
  "risk_assessment": {
    "financial_health_score": "number - 0-100 overall financial health",
    "cash_flow_risk": "string - low/medium/high",
    "spending_volatility": "number - spending consistency score",
    "alerts": ["array of financial risk alerts"]
  },
  "goals_suggestions": [
    {
      "goal_type": "string - emergency_fund/debt_reduction/investment/etc",
      "target_amount": "number - suggested target amount",
      "timeframe_months": "number - suggested timeframe",
      "monthly_contribution": "number - required monthly contribution",
      "priority": "string - high/medium/low"
    }
  ],
  "insights": ["array of key financial insights and patterns"],
  "action_items": ["array of immediate actionable recommendations"],
  "confidence_score": "number - 0.0-1.0 analysis confidence"
}

Focus on Australian financial context, ATO compliance, and practical actionable advice."""

            # Prepare transaction summary for analysis (limit data size)
            transaction_summary = self._prepare_transaction_summary(transactions)
            
            messages = [{
                "role": "user",
                "content": f"""Analyze this financial data for an Australian taxpayer:

TRANSACTIONS SUMMARY:
{json.dumps(transaction_summary, indent=2)}

USER PROFILE:
{json.dumps(user_profile, indent=2)}

Provide comprehensive financial analysis with Australian tax considerations."""
            }]
            
            response = self._make_api_call(messages, system_prompt, max_tokens=6000)
            
            if not response.success:
                return {
                    "success": False,
                    "error": response.error
                }
            
            try:
                analysis = json.loads(response.content)
                analysis["processing_metadata"] = {
                    "analysis_date": datetime.now().isoformat(),
                    "transactions_analyzed": len(transactions),
                    "model_used": self.model,
                    "processing_time_ms": int(response.processing_time * 1000)
                }
                
                return {
                    "success": True,
                    "analysis": analysis
                }
                
            except json.JSONDecodeError as e:
                return {
                    "success": False,
                    "error": f"Failed to parse financial analysis: {str(e)}",
                    "raw_response": response.content[:1000]
                }
                
        except Exception as e:
            logger.error(f"Error in financial data analysis: {str(e)}")
            return {
                "success": False,
                "error": f"Financial analysis failed: {str(e)}"
            }

    def categorize_expense(self, expense_data: Dict, user_profile: Dict) -> Dict[str, Any]:
        """
        Categorize individual expense for Australian tax compliance
        
        Args:
            expense_data: Transaction/expense details
            user_profile: User's tax profile
            
        Returns:
            Dict containing categorization results
        """
        try:
            system_prompt = """You are an Australian tax expert specializing in ATO expense categorization.

Categorize this expense according to Australian Tax Office guidelines:

CATEGORIES:
- D1: Car expenses (fuel, parking, tolls, car maintenance)
- D2: Travel expenses (accommodation, flights, transport)
- D3: Clothing expenses (work uniforms, safety equipment only)
- D4: Education expenses (courses, training, textbooks)
- D5: Home office expenses (office supplies, equipment)
- D6: Equipment and tools (work-related tools, computers)
- D7: Phone and internet (work-related portion)
- D8: Professional development (conferences, seminars)
- D9: Subscriptions and memberships (professional only)
- D10: Insurance (work-related)
- D11: Interest and bank fees (investment related)
- D12: Income protection insurance
- D13: Gifts and donations (deductible)
- D14: Investment expenses
- D15: Other work-related expenses
- P8: Personal services income
- Personal: Non-deductible personal expenses

Return JSON:
{
  "category": "string - assigned ATO category",
  "confidence": "number - 0.0-1.0 categorization confidence",
  "deductible_percentage": "number - 0-100 percentage deductible",
  "reasoning": "string - explanation for categorization",
  "requires_documentation": "boolean - whether receipts/logs required",
  "business_use_percentage": "number - 0-100 estimated business use",
  "compliance_notes": "string - any ATO compliance considerations"
}"""

            messages = [{
                "role": "user",
                "content": f"""Categorize this expense for Australian tax purposes:

EXPENSE DETAILS:
{json.dumps(expense_data, indent=2)}

USER PROFILE:
{json.dumps(user_profile, indent=2)}

Consider the user's occupation, business type, and expense context."""
            }]
            
            response = self._make_api_call(messages, system_prompt)
            
            if not response.success:
                return {
                    "success": False,
                    "error": response.error
                }
            
            try:
                categorization = json.loads(response.content)
                return {
                    "success": True,
                    "categorization": categorization
                }
                
            except json.JSONDecodeError as e:
                return {
                    "success": False,
                    "error": f"Failed to parse categorization: {str(e)}"
                }
                
        except Exception as e:
            logger.error(f"Error in expense categorization: {str(e)}")
            return {
                "success": False,
                "error": f"Expense categorization failed: {str(e)}"
            }

    def generate_financial_advice(self, context: Dict) -> Dict[str, Any]:
        """
        Generate conversational financial advice for chatbot interactions
        
        Args:
            context: Conversation context including user message and financial data
            
        Returns:
            Dict containing advice response
        """
        try:
            system_prompt = """You are Dobbie, a friendly Australian financial advisor chatbot for TAAXDOG. 

Personality:
- Warm, approachable, and professional
- Use Australian terminology and context
- Reference ATO guidelines when relevant
- Provide practical, actionable advice
- Ask clarifying questions when needed

Response Format:
- Start with empathy/acknowledgment
- Provide clear, structured advice
- Include specific action steps
- Mention any ATO compliance considerations
- End with encouragement or next steps

Keep responses conversational but informative, focusing on Australian tax and financial context."""

            user_message = context.get('user_message', '')
            financial_data = context.get('financial_data', {})
            user_profile = context.get('user_profile', {})
            
            messages = [{
                "role": "user", 
                "content": f"""User Question: {user_message}

Available Context:
- Financial Data: {json.dumps(financial_data) if financial_data else 'Not available'}
- User Profile: {json.dumps(user_profile) if user_profile else 'Not available'}

Provide helpful Australian financial advice."""
            }]
            
            response = self._make_api_call(messages, system_prompt, temperature=0.7)
            
            if not response.success:
                return {
                    "success": False,
                    "error": response.error,
                    "fallback_response": "I'm sorry, I'm having trouble processing your request right now. Please try again shortly."
                }
            
            return {
                "success": True,
                "response": response.content,
                "confidence": response.confidence,
                "processing_time": response.processing_time
            }
            
        except Exception as e:
            logger.error(f"Error generating financial advice: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "fallback_response": "I'm experiencing technical difficulties. Please try your question again."
            }

    def _prepare_transaction_summary(self, transactions: List[Dict]) -> Dict[str, Any]:
        """
        Prepare a summary of transactions for analysis (to reduce API payload size)
        
        Args:
            transactions: Full list of transactions
            
        Returns:
            Summarized transaction data
        """
        if not transactions:
            return {"total_transactions": 0, "summary": "No transactions available"}
        
        # Calculate summary statistics
        amounts = [float(t.get('amount', 0)) for t in transactions if t.get('amount')]
        
        summary = {
            "total_transactions": len(transactions),
            "date_range": {
                "earliest": min([t.get('date', '') for t in transactions if t.get('date')], default=''),
                "latest": max([t.get('date', '') for t in transactions if t.get('date')], default='')
            },
            "amount_stats": {
                "total": sum(amounts),
                "average": sum(amounts) / len(amounts) if amounts else 0,
                "largest": max(amounts) if amounts else 0,
                "smallest": min(amounts) if amounts else 0
            },
            "categories": {},
            "merchants": {},
            "recent_transactions": transactions[:10]  # Include 10 most recent for context
        }
        
        # Count by category
        for transaction in transactions:
            category = transaction.get('category', 'Unknown')
            summary["categories"][category] = summary["categories"].get(category, 0) + 1
        
        # Count by merchant
        for transaction in transactions:
            merchant = transaction.get('merchant', transaction.get('description', 'Unknown'))[:50]  # Truncate long names
            summary["merchants"][merchant] = summary["merchants"].get(merchant, 0) + 1
        
        # Keep only top 10 categories and merchants
        summary["categories"] = dict(sorted(summary["categories"].items(), key=lambda x: x[1], reverse=True)[:10])
        summary["merchants"] = dict(sorted(summary["merchants"].items(), key=lambda x: x[1], reverse=True)[:10])
        
        return summary

# Singleton instance for global use
claude_client = ClaudeClient() if os.getenv('CLAUDE_API_KEY') else None

def get_claude_client() -> Optional[ClaudeClient]:
    """Get the global Claude client instance"""
    global claude_client
    if claude_client is None and os.getenv('CLAUDE_API_KEY'):
        try:
            claude_client = ClaudeClient()
        except Exception as e:
            logger.error(f"Failed to initialize Claude client: {e}")
    return claude_client 