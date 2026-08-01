import os
import sys
from pathlib import Path

# Add backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

# Important: ensure Vercel uses the right database URL
# and disables realtime/redis since it's not supported in serverless
os.environ["REALTIME_ENABLED"] = "false"

from app.main import app
