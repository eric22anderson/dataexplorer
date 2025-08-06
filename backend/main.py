from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from security import router as security_router
from chat import router as chat_router

# I used FASTAPI for my api server, it's the easiest to use in my oppinion. 
app = FastAPI(
    title="dataexplorer API",
    description="A simple API for authentication and chat functionality",
    version="1.0.0"
)

# Configure CORS (I always run into CORS issues when developing with React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# I like to keep my routes organized, so I have separate routers for security and chat functionality
app.include_router(security_router, prefix="/api", tags=["Authentication"])
app.include_router(chat_router, prefix="/api", tags=["Chat"])



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3001, reload=True)
