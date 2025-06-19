"""
Route utilities for TAAXDOG backend.
Provides type-safe request handling and common route helper functions.
"""

from typing import Optional, Dict, Any, Union, List
from flask import request, g
from werkzeug.datastructures import FileStorage
import logging

# Import custom types
try:
    from utils.types import JSON, UserID, safe_get_user_id, safe_get_json
except ImportError:
    JSON = Dict[str, Any]
    UserID = str
    def safe_get_user_id(obj: Any, default: Optional[str] = None) -> Optional[str]:
        if hasattr(obj, 'user_id') and isinstance(obj.user_id, str):
            return obj.user_id
        return default
    
    def safe_get_json(obj: Any, default: Optional[JSON] = None) -> Optional[JSON]:
        try:
            if hasattr(obj, 'get_json') and callable(obj.get_json):
                return obj.get_json() or default
        except Exception:
            pass
        return default

logger = logging.getLogger(__name__)

def get_user_id() -> Optional[str]:
    """
    Safely extract user_id from request object.
    
    Returns:
        User ID if available, None otherwise
    """
    # Check request object first
    user_id = getattr(request, 'user_id', None)
    if user_id:
        return user_id
    
    # Check Flask g object
    user_id = getattr(g, 'user_id', None)
    if user_id:
        return user_id
    
    # Check headers as fallback
    user_id = request.headers.get('X-User-ID')
    if user_id:
        return user_id
    
    return None

def require_user_id() -> str:
    """
    Get user_id from request, raising error if not found.
    
    Returns:
        User ID string
        
    Raises:
        ValueError: If user_id is not found or invalid
    """
    user_id = get_user_id()
    if not user_id:
        raise ValueError("User ID is required but not found in request")
    return user_id

def get_json_data(required: bool = False) -> Optional[JSON]:
    """
    Safely extract JSON data from request.
    
    Args:
        required: If True, raises error when JSON is missing
        
    Returns:
        JSON data or None
        
    Raises:
        ValueError: If required=True and JSON is missing/invalid
    """
    try:
        data = request.get_json()
        if required and not data:
            raise ValueError("JSON data is required but not provided")
        return data
    except Exception as e:
        if required:
            raise ValueError(f"Invalid JSON data: {str(e)}")
        logger.warning(f"Failed to parse JSON data: {str(e)}")
        return None

def get_form_data() -> Dict[str, str]:
    """
    Safely extract form data from request.
    
    Returns:
        Form data as dictionary
    """
    try:
        return dict(request.form)
    except Exception as e:
        logger.warning(f"Failed to parse form data: {str(e)}")
        return {}

def get_file_upload(field_name: str) -> Optional[FileStorage]:
    """
    Safely extract file upload from request.
    
    Args:
        field_name: Name of the file field
        
    Returns:
        FileStorage object or None
    """
    try:
        if field_name in request.files:
            file = request.files[field_name]
            if file and file.filename:
                return file
    except Exception as e:
        logger.warning(f"Failed to get file upload '{field_name}': {str(e)}")
    
    return None

def get_query_param(param_name: str, default: Any = None, param_type: type = str) -> Any:
    """
    Safely extract query parameter with type conversion.
    
    Args:
        param_name: Name of the query parameter
        default: Default value if parameter is missing
        param_type: Type to convert parameter to
        
    Returns:
        Parameter value converted to specified type, or default
    """
    try:
        value = request.args.get(param_name, default)
        if value is not None and param_type != str:
            return param_type(value)
        return value
    except (ValueError, TypeError) as e:
        logger.warning(f"Failed to convert query param '{param_name}' to {param_type.__name__}: {str(e)}")
        return default

def get_header(header_name: str, default: Optional[str] = None) -> Optional[str]:
    """
    Safely extract header from request.
    
    Args:
        header_name: Name of the header
        default: Default value if header is missing
        
    Returns:
        Header value or default
    """
    try:
        return request.headers.get(header_name, default)
    except Exception as e:
        logger.warning(f"Failed to get header '{header_name}': {str(e)}")
        return default

def validate_required_fields(data: JSON, required_fields: List[str]) -> None:
    """
    Validate that required fields are present in data.
    
    Args:
        data: Data to validate
        required_fields: List of required field names
        
    Raises:
        ValueError: If any required field is missing
    """
    if not data:
        raise ValueError("Data is required")
    
    missing_fields = []
    for field in required_fields:
        if field not in data or data[field] is None:
            missing_fields.append(field)
    
    if missing_fields:
        raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")

def safe_float(value: Any, default: float = 0.0) -> float:
    """
    Safely convert value to float.
    
    Args:
        value: Value to convert
        default: Default value if conversion fails
        
    Returns:
        Float value or default
    """
    try:
        if value is None:
            return default
        return float(value)
    except (ValueError, TypeError):
        return default

def safe_int(value: Any, default: int = 0) -> int:
    """
    Safely convert value to int.
    
    Args:
        value: Value to convert
        default: Default value if conversion fails
        
    Returns:
        Integer value or default
    """
    try:
        if value is None:
            return default
        return int(value)
    except (ValueError, TypeError):
        return default

def format_api_response(success: bool, data: Any = None, error: Optional[str] = None, **kwargs: Any) -> JSON:
    """
    Format standardized API response.
    
    Args:
        success: Whether the operation was successful
        data: Response data (if success=True)
        error: Error message (if success=False)
        **kwargs: Additional response fields
        
    Returns:
        Formatted response dictionary
    """
    response: JSON = {
        "success": success,
        **kwargs
    }
    
    if success:
        if data is not None:
            response["data"] = data
    else:
        response["error"] = error or "An error occurred"
    
    return response

def create_error_response(message: str, code: Optional[str] = None, details: Optional[Any] = None) -> JSON:
    """
    Create standardized error response.
    
    Args:
        message: Error message
        code: Error code
        details: Additional error details
        
    Returns:
        Error response dictionary
    """
    response: JSON = {
        "success": False,
        "error": message
    }
    
    if code:
        response["error_code"] = code
    
    if details:
        response["details"] = details
    
    return response

def create_success_response(data: Any = None, message: Optional[str] = None) -> JSON:
    """
    Create standardized success response.
    
    Args:
        data: Response data
        message: Success message
        
    Returns:
        Success response dictionary
    """
    response: JSON = {
        "success": True
    }
    
    if data is not None:
        response["data"] = data
    
    if message:
        response["message"] = message
    
    return response