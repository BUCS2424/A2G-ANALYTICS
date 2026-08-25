from pydantic import BaseModel


class UnlockRequest(BaseModel):
    password: str
