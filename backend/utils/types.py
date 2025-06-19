"""
Type definitions and aliases for TAAXDOG backend application.
Provides consistent type hints across the application.
"""

from typing import Dict, List, Any, Optional, Union, Tuple, Callable, TypeVar, Protocol
from datetime import datetime
from enum import Enum

# Basic type aliases
JSON = Dict[str, Any]
JSONList = List[JSON]
OptionalJSON = Optional[JSON]

# Common data structure types
UserData = Dict[str, Any]
TransactionData = Dict[str, Any]
ReceiptData = Dict[str, Any]
BankData = Dict[str, Any]
ErrorData = Dict[str, Any]

# API response types
APIResponse = Tuple[JSON, int]
APIResult = Union[JSON, Tuple[JSON, int]]

# Database types
DatabaseRow = Dict[str, Any]
DatabaseResult = List[DatabaseRow]

# File types
FileUpload = Any  # Flask file object
ImageData = Union[str, bytes]

# Numeric types
Amount = Union[int, float]
Percentage = float

# Date/Time types
DateString = str
DateTimeString = str
Timestamp = Union[datetime, str, int, float]

# ID types
UserID = str
TransactionID = str
ReceiptID = str
AccountID = str
ConnectionID = str

# Function types
T = TypeVar('T')
ProcessorFunction = Callable[[Any], T]
ValidatorFunction = Callable[[Any], bool]
ErrorHandler = Callable[[Exception], Any]

# Protocol for objects with required attributes
class HasUserID(Protocol):
    user_id: str

class HasTimestamp(Protocol):
    timestamp: datetime

class HasAmount(Protocol):
    amount: Amount

# Request-like object protocol
class RequestLike(Protocol):
    def get_json(self) -> Optional[JSON]: ...
    @property
    def args(self) -> Dict[str, Any]: ...
    @property
    def headers(self) -> Dict[str, str]: ...
    @property
    def files(self) -> Dict[str, Any]: ...
    @property
    def form(self) -> Dict[str, Any]: ...

# Extended Request type for Flask requests with custom attributes
class ExtendedRequest(RequestLike, Protocol):
    user_id: Optional[str]
    correlation_id: Optional[str]

# Service status types
class ServiceStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

# Configuration types
ConfigValue = Union[str, int, float, bool, None]
ConfigDict = Dict[str, ConfigValue]

# ML/Analytics types
Features = Dict[str, float]
Prediction = Dict[str, Any]
ModelResult = Tuple[bool, Any]

# Basiq specific types
BasiqUserID = str
BasiqConnectionID = str
BasiqAccountID = str
BasiqTransactionID = str

# OCR/Receipt processing types
OCRResult = Dict[str, Any]
ProcessingResult = Dict[str, Any]

# Notification types
NotificationData = Dict[str, Any]
NotificationChannel = str

# Subscription types
SubscriptionData = Dict[str, Any]
PlanFeatures = Dict[str, Any]

# Team collaboration types
TeamData = Dict[str, Any]
TeamMemberData = Dict[str, Any]

# Report types
ReportData = Dict[str, Any]
ReportMetadata = Dict[str, Any]

# Error handling types
ErrorContext = Dict[str, Any]
ErrorCode = str
ErrorMessage = str

# Type guards and utilities
def is_valid_user_id(value: Any) -> bool:
    """Type guard for user ID validation."""
    return isinstance(value, str) and len(value) > 0

def is_valid_amount(value: Any) -> bool:
    """Type guard for amount validation."""
    return isinstance(value, (int, float)) and value >= 0

def safe_get_user_id(obj: Any, default: Optional[str] = None) -> Optional[str]:
    """Safely extract user_id from object."""
    if hasattr(obj, 'user_id') and isinstance(obj.user_id, str):
        return obj.user_id
    return default

def safe_get_json(obj: Any, default: Optional[JSON] = None) -> Optional[JSON]:
    """Safely extract JSON data from request-like object."""
    try:
        if hasattr(obj, 'get_json') and callable(obj.get_json):
            return obj.get_json() or default
    except Exception:
        pass
    return default 