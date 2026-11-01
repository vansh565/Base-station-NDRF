"""
Legacy prototype entry point, kept so `python image.py` still works.

Its features (equipment-aware Gemini answers and GPS-tagged frame analysis via
/analyze_frame with {"images": [...], "location": {...}}) are part of app.py.
The API key is read from the GOOGLE_API_KEY environment variable and is never
hard-coded.
"""
import os

os.environ.setdefault("PORT", "5000")

from app import app, run, socketio  # noqa: E402,F401

if __name__ == "__main__":
    run()
