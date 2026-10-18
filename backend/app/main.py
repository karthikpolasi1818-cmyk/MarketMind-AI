from app.api.features import router as features_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.api.markets import router as markets_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "Phase 1 foundation for India and global stock-market analytics. "
        "Live market data and investment advice are not enabled."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(router, prefix="/api/v1")
app.include_router(markets_router, prefix="/api/v1/markets", tags=["markets"])


@app.get("/")
def root() -> dict:
    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "healthy",
        "service": "marketmind-api",
        "phase": 1,
    }

app.include_router(features_router, prefix="/api/v1")

from app.api.pro_features import router as pro_features_router

app.include_router(pro_features_router, prefix="/api/v1")
