from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel

T = TypeVar("T")

class ErrorDetail(BaseModel):
    code: str
    message: str

class ResponseEnvelope(BaseModel, Generic[T]):
    data: Optional[T] = None
    error: Optional[ErrorDetail] = None

    @classmethod
    def success(cls, data: T) -> "ResponseEnvelope[T]":
        return cls(data=data, error=None)

    @classmethod
    def fail(cls, code: str, message: str) -> "ResponseEnvelope[Any]":
        return cls(data=None, error=ErrorDetail(code=code, message=message))
