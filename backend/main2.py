"""
Legacy entry point, kept so `python main2.py` still works.

All of main2.py's endpoints (/upload_image, /analyze_frame, /gemini, /weather,
/generate_route, /equipment_list, /ping) now live in app.py. This script just
starts the unified server on port 5000, the port main2.py used to use.
"""
import os

os.environ.setdefault("PORT", "5000")

from app import app, run, socketio  # noqa: E402,F401  (re-exported for gunicorn: main2:app)

if __name__ == "__main__":
    run()
