from fastapi import APIRouter

from app.api import college, health, intake, me

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(me.router)
api_router.include_router(intake.router)
api_router.include_router(college.router)
