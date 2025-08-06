from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

# Create router for security endpoints
router = APIRouter()

# Simple user database, any onne will work I just wanted to have some kind of security because I'm using MIMIC data. 
users = {
    "admin": {"id": 1, "username": "admin", "password": "password", "email": "admin@example.com"},
    "user": {"id": 2, "username": "user", "password": "123456", "email": "user@example.com"},
    "demo": {"id": 3, "username": "demo", "password": "demo", "email": "demo@example.com"}
}

# This is the model that should be submitted with a login api call. 
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: dict

# Authentication endpoints
@router.post("/login", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    # Simple login endpoint
    
    # Check if user exists and password matches
    user = users.get(login_data.username)
    if not user or user["password"] != login_data.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    
    # Simple token - just use the username for this demo
    token = f"token_{user['username']}"
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"]
        }
    }