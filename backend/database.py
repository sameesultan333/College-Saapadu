# backend/app/database.py

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

# Was a hardcoded connection string (including a plaintext password) committed
# to source -- see CLAUDE.md section 19. Set DATABASE_URL in backend/.env
# instead (see .env.example); .env is gitignored, so changing DB per
# environment (or rotating the password) never touches this file.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to backend/.env "
        "(see backend/.env.example)."
    )

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base = declarative_base()
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()