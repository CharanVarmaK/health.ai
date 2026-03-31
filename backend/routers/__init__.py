from routers.auth import router as auth_router
from routers.users import router as users_router
from routers.chat import router as chat_router
from routers.hospitals import router as hospitals_router
from routers.appointments import router as appointments_router
from routers.reminders import router as reminders_router
from routers.family import router as family_router
from routers.reports import router as reports_router

__all__ = [
    "auth_router","users_router","chat_router",
    "hospitals_router","appointments_router","reminders_router",
    "family_router","reports_router",
]
