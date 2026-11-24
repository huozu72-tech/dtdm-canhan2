import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

APP_SECRET_KEY = os.getenv("APP_SECRET_KEY", "dev-only-change-in-env")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://dathang_user:change_me@127.0.0.1:5432/dathang_db")
APP_HOST = os.getenv("APP_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("APP_PORT", "8000"))
DEFAULT_ADMIN_NAME = os.getenv("DEFAULT_ADMIN_NAME", "Quản Trị Viên")
DEFAULT_ADMIN_PHONE = os.getenv("DEFAULT_ADMIN_PHONE", "0900000000")
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "ChangeMeAdmin@123")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
