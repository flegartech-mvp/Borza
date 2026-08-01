import os
import sys
from pathlib import Path

# Add backend directory to Python path
# Path(__file__) = .../frontend/api/index.py
# parents[2] = repo root containing backend/
backend_dir = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(backend_dir))

# Disable realtime/redis since it's not supported in serverless
os.environ["REALTIME_ENABLED"] = "false"

from app.main import app
