"""
NDRF Base Station: backend server.

A Flask + Socket.IO API behind the command-center UI in ../frontend:

* AI image analysis with Google Gemini (structured tactical report)
* AI assistant Q&A with intent routing (weather / equipment / route)
* Routing: OpenRouteService -> public OSRM -> straight-line estimate
* Weather + rule-based disaster risk (Open-Meteo, no key needed)
* Equipment inventory (JSON catalogue + Excel kit sheets)
* Live incident / SOS board, broadcast to every console in real time

Run locally:  python app.py   ->  http://localhost:10000
"""
from __future__ import annotations

import base64
import json
import logging
import mimetypes
import os
import re
import threading
import time
import uuid
from datetime import datetime, timezone
from io import BytesIO
from logging.handlers import RotatingFileHandler
from math import atan2, cos, radians, sin, sqrt
from pathlib import Path

import requests
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
from PIL import Image, UnidentifiedImageError

try:  # optional: load a local .env file during development
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
    load_dotenv()
except ImportError:
    pass

try:
    import google.generativeai as genai
except ImportError:  # the server still runs; AI features report "not configured"
    genai = None

try:
    import folium
except ImportError:
    folium = None

try:
    import pandas as pd
except ImportError:
    pd = None

VERSION = "3.0.0"
STARTED_AT = time.time()

# ==================== PATHS ====================
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
STATIC_DIR = ROOT_DIR / "static"
DATA_DIR = BASE_DIR / "data"
EQUIPMENT_JSON = FRONTEND_DIR / "data" / "equipment.json"
INCIDENTS_FILE = DATA_DIR / "incidents.json"
LOG_FILE = BASE_DIR / "base_station.log"

STATIC_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

# ==================== CONFIGURATION ====================
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
ORS_API_KEY = os.getenv("ORS_API_KEY")
GEMINI_MODELS = [
    m.strip()
    for m in os.getenv("GEMINI_MODELS", "gemini-3-flash-preview,gemini-2.5-flash,gemini-2.0-flash").split(",")
    if m.strip()
]
BASE_LOCATION = {
    "name": os.getenv("BASE_NAME", "NDRF Base · Dehradun"),
    "lat": float(os.getenv("BASE_LAT", "30.3165")),
    "lon": float(os.getenv("BASE_LON", "78.0322")),
}
DEMO_DESTINATION = {"name": "Rishikesh", "lat": 30.0869, "lon": 78.2676}
PORT = int(os.getenv("PORT", "10000"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
MAX_UPLOAD_MB = 10
HTTP_TIMEOUT = 12
USER_AGENT = f"NDRF-Base-Station/{VERSION}"

# ==================== LOGGING ====================
log = logging.getLogger("ndrf")
log.setLevel(logging.INFO)
_fmt = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
_console = logging.StreamHandler()
_console.setFormatter(_fmt)
log.addHandler(_console)
try:
    _file = RotatingFileHandler(LOG_FILE, maxBytes=1_000_000, backupCount=2, encoding="utf-8")
    _file.setFormatter(_fmt)
    log.addHandler(_file)
except OSError:  # read-only filesystem: console logging only
    pass

# ==================== FLASK APP ====================
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("text/javascript", ".js")  # Windows registry sometimes maps .js to text/plain

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
app.json.sort_keys = False

_origins = "*" if CORS_ORIGINS.strip() == "*" else [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]
CORS(app, origins=_origins)
socketio = SocketIO(
    app,
    cors_allowed_origins=_origins,
    async_mode=os.getenv("SOCKETIO_ASYNC_MODE", "threading"),
)


# ==================== HELPERS ====================
def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, l1, p2, l2 = map(radians, (lat1, lon1, lat2, lon2))
    a = sin((p2 - p1) / 2) ** 2 + cos(p1) * cos(p2) * sin((l2 - l1) / 2) ** 2
    return r * 2 * atan2(sqrt(a), sqrt(1 - a))


def as_float(value, lo: float, hi: float):
    """Parse a float within [lo, hi]; return None when missing or invalid."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return f if lo <= f <= hi else None


def clean_text(value, limit: int) -> str:
    return str(value or "").strip()[:limit]


def bad_request(message: str, status: int = 400):
    return jsonify({"success": False, "error": message}), status


# ==================== GEMINI ====================
class AIError(Exception):
    """An AI failure with a message that is safe to show to operators."""

    def __init__(self, message: str, status: int = 503):
        super().__init__(message)
        self.status = status


class GeminiClient:
    """Thin wrapper that tries each configured model until one answers."""

    def __init__(self, api_key: str | None, models: list[str]):
        self.models = models
        self.active_model: str | None = None
        self.enabled = bool(genai and api_key)
        if self.enabled:
            genai.configure(api_key=api_key)
            log.info("Gemini configured (models: %s)", ", ".join(models))
        else:
            log.warning("Gemini disabled: %s", "SDK missing" if not genai else "no GOOGLE_API_KEY set")

    def generate(self, contents, json_mode: bool = False) -> tuple[str, str]:
        if not self.enabled:
            raise AIError("AI is not configured on the server. Set GOOGLE_API_KEY.", 503)
        order = list(self.models)
        if self.active_model in order:
            order.remove(self.active_model)
            order.insert(0, self.active_model)
        config = {"response_mime_type": "application/json"} if json_mode else None
        last_error: Exception | None = None
        for name in order:
            try:
                model = genai.GenerativeModel(name, generation_config=config)
                response = model.generate_content(contents, request_options={"timeout": 90})
                try:
                    text = (response.text or "").strip()
                except ValueError:  # blocked by safety filters, no text part
                    raise AIError("The AI declined to answer this request.", 422)
                self.active_model = name
                return text, name
            except AIError:
                raise
            except Exception as exc:  # noqa: BLE001 - SDK raises many types
                msg = str(exc).lower()
                last_error = exc
                if "404" in msg or "not found" in msg or "not supported" in msg:
                    log.warning("Gemini model %s unavailable, trying next", name)
                    continue
                if "429" in msg or "quota" in msg or "resource exhausted" in msg:
                    raise AIError("AI quota reached. Please try again in a minute.", 429)
                if "api key" in msg or "permission" in msg or "403" in msg:
                    raise AIError("The server's AI key was rejected. Check GOOGLE_API_KEY.", 503)
                log.error("Gemini error (%s): %s", name, exc)
                raise AIError("AI service error. Please try again.", 502)
        log.error("No Gemini model available: %s", last_error)
        raise AIError("No configured AI model is available. Check GEMINI_MODELS.", 503)


gemini = GeminiClient(GEMINI_API_KEY, GEMINI_MODELS)


# ==================== EQUIPMENT ====================
_equipment_cache: dict = {"stamp": None, "items": []}
_equipment_lock = threading.Lock()


def _excel_sources() -> list[Path]:
    paths = sorted(DATA_DIR.glob("*.xlsx")) + sorted((BASE_DIR / "static").glob("*.xlsx"))
    paths += [ROOT_DIR / n for n in ("earthquake_kit.xlsx", "flood_kit.xlsx", "mfr_equipment.xlsx")]
    return [p for p in paths if p.exists() and not p.name.startswith("~$")]


def _load_excel_items(start_id: int) -> list[dict]:
    if pd is None:
        return []
    items: list[dict] = []
    for path in _excel_sources():
        try:
            sheets = pd.read_excel(path, sheet_name=None)
        except Exception as exc:  # noqa: BLE001 - missing openpyxl, corrupt file...
            log.error("Could not read %s: %s", path.name, exc)
            continue
        for sheet, df in sheets.items():
            if "Item Name" not in df.columns or "Quantity" not in df.columns:
                continue
            category = sheet if len(sheets) > 1 else path.stem.replace("_", " ").title()
            for row in df.to_dict(orient="records"):
                name = clean_text(row.get("Item Name"), 120)
                if not name or name.lower() == "nan":
                    continue
                try:
                    qty = int(float(row.get("Quantity") or 0))
                except (TypeError, ValueError):
                    qty = 0
                status = clean_text(row.get("Status"), 30) or "Available"
                items.append({
                    "id": start_id + len(items),
                    "name": name,
                    "quantity": qty,
                    "category": category,
                    "subcategory": "Deployment Kit",
                    "description": f"Part of the {category} ({path.name})",
                    "status": "Available" if status.lower() == "nan" else status,
                    "location": "Kit Store",
                    "source": path.name,
                })
    return items


def load_equipment() -> list[dict]:
    """Catalogue JSON + Excel kits, cached until any source file changes."""
    sources = [EQUIPMENT_JSON, *_excel_sources()]
    stamp = tuple((str(p), p.stat().st_mtime) for p in sources if p.exists())
    with _equipment_lock:
        if _equipment_cache["stamp"] == stamp:
            return _equipment_cache["items"]
        items: list[dict] = []
        try:
            items = json.loads(EQUIPMENT_JSON.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            log.error("Equipment catalogue unavailable: %s", exc)
        items = items + _load_excel_items(start_id=len(items) + 1)
        _equipment_cache.update(stamp=stamp, items=items)
        log.info("Equipment loaded: %d items", len(items))
        return items


def search_equipment(query: str = "", category: str = "") -> list[dict]:
    q = query.lower().strip()
    cat = category.lower().strip()
    out = []
    for item in load_equipment():
        if cat and item.get("category", "").lower() != cat:
            continue
        hay = " ".join(str(item.get(k, "")) for k in ("name", "category", "subcategory", "description")).lower()
        if q and not all(word in hay for word in q.split()):
            continue
        out.append(item)
    return out


def equipment_summary(items: list[dict]) -> list[dict]:
    cats: dict[str, dict] = {}
    for item in items:
        c = cats.setdefault(item.get("category", "General"), {"name": item.get("category", "General"), "items": 0, "units": 0})
        c["items"] += 1
        c["units"] += int(item.get("quantity") or 0)
    return sorted(cats.values(), key=lambda c: -c["items"])


# ==================== IMAGE ANALYSIS ====================
RISK_LEVELS = ("LOW", "MEDIUM", "HIGH", "CRITICAL")

ANALYSIS_PROMPT = """You are a senior incident commander of India's National Disaster Response Force (NDRF).
Analyse this field image (drone, CCTV or phone photo){location}.

Return ONLY a JSON object with exactly these keys:
{{
  "summary": "one sentence situation summary",
  "disaster_type": "earthquake | flood | fire | landslide | building collapse | cyclone | industrial | road accident | other | none",
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "risk_score": 0-100,
  "people_visible": integer estimate of people visible (0 if none),
  "observations": ["damage, blocked access, trapped people, fire, water..."],
  "hazards": ["secondary hazards for rescuers"],
  "immediate_actions": ["what must happen in the next 30 minutes"],
  "team": {{"personnel": integer, "units": ["specialised units, e.g. USAR, medical, water rescue"]}},
  "strategy": ["ordered rescue steps"],
  "equipment": ["specific tools and supplies"]
}}

Rules: at most 5 short, tactical items per list. Be direct, like a field commander.
If the image is not a disaster scene, say so in the summary and use risk_level LOW.
When suitable, prefer equipment from this base inventory: {inventory}."""


def prepare_image(raw: bytes) -> Image.Image:
    try:
        img = Image.open(BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("The file is not a readable image.") from exc
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img.thumbnail((1600, 1600))  # keeps the request small and fast
    return img


def decode_data_url(data: str) -> bytes:
    payload = data.split(",", 1)[1] if "," in data else data
    try:
        return base64.b64decode(payload, validate=False)
    except (ValueError, TypeError) as exc:
        raise ValueError("Invalid base64 image data.") from exc


def _as_list(value, limit: int = 6) -> list[str]:
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []
    return [clean_text(v, 300) for v in value if clean_text(v, 300)][:limit]


def _parse_json(text: str) -> dict | None:
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except ValueError:
        match = re.search(r"\{.*\}", text, re.S)
        if match:
            try:
                return json.loads(match.group(0))
            except ValueError:
                return None
    return None


def normalise_report(data: dict | None, raw_text: str) -> dict:
    if not data:
        level = next((lvl for lvl in reversed(RISK_LEVELS) if lvl in raw_text.upper()), "MEDIUM")
        return {
            "summary": raw_text[:600] or "No analysis returned.",
            "disaster_type": "unknown", "risk_level": level,
            "risk_score": {"LOW": 20, "MEDIUM": 50, "HIGH": 75, "CRITICAL": 95}[level],
            "people_visible": 0, "observations": [], "hazards": [], "immediate_actions": [],
            "team": {"personnel": 0, "units": []}, "strategy": [], "equipment": [],
        }
    level = str(data.get("risk_level", "")).upper().strip()
    try:
        score = max(0, min(100, int(float(data.get("risk_score", 0)))))
    except (TypeError, ValueError):
        score = 0
    if level not in RISK_LEVELS:
        level = "CRITICAL" if score >= 85 else "HIGH" if score >= 65 else "MEDIUM" if score >= 35 else "LOW"
    if not score:
        score = {"LOW": 20, "MEDIUM": 50, "HIGH": 75, "CRITICAL": 95}[level]
    team = data.get("team") if isinstance(data.get("team"), dict) else {}
    try:
        people = max(0, int(float(data.get("people_visible", 0))))
    except (TypeError, ValueError):
        people = 0
    try:
        personnel = max(0, int(float(team.get("personnel", 0))))
    except (TypeError, ValueError):
        personnel = 0
    return {
        "summary": clean_text(data.get("summary"), 600) or "Analysis complete.",
        "disaster_type": clean_text(data.get("disaster_type"), 40) or "unknown",
        "risk_level": level,
        "risk_score": score,
        "people_visible": people,
        "observations": _as_list(data.get("observations")),
        "hazards": _as_list(data.get("hazards")),
        "immediate_actions": _as_list(data.get("immediate_actions")),
        "team": {"personnel": personnel, "units": _as_list(team.get("units"))},
        "strategy": _as_list(data.get("strategy"), 8),
        "equipment": _as_list(data.get("equipment"), 8),
    }


def report_to_text(r: dict) -> str:
    """Plain-text version of a report, kept for API clients that expect `analysis` text."""
    def block(title, items):
        return f"{title}\n" + ("\n".join(f"- {i}" for i in items) if items else "- none reported")

    team = r["team"]
    team_lines = ([f"{team['personnel']} personnel"] if team["personnel"] else []) + team["units"]
    return "\n\n".join([
        f"📝 SUMMARY\n{r['summary']}",
        block("🔍 OBSERVATIONS", r["observations"]),
        block("☣️ HAZARDS", r["hazards"]),
        block("🚨 IMMEDIATE ACTIONS", r["immediate_actions"]),
        block("👥 TEAM REQUIRED", team_lines),
        block("🗺️ STRATEGY", r["strategy"]),
        block("📦 EQUIPMENT NEEDED", r["equipment"]),
        f"⚠️ RISK LEVEL: {r['risk_level']} ({r['risk_score']}/100)",
    ])


def analyse_image(raw: bytes, lat=None, lon=None) -> dict:
    img = prepare_image(raw)
    location = f" taken near GPS {lat:.5f}, {lon:.5f}" if lat is not None and lon is not None else ""
    inventory = ", ".join(sorted({i["name"] for i in load_equipment()})[:60]) or "standard NDRF kit"
    prompt = ANALYSIS_PROMPT.format(location=location, inventory=inventory)
    started = time.time()
    text, model_name = gemini.generate([img, prompt], json_mode=True)
    report = normalise_report(_parse_json(text), text)
    return {
        "success": True,
        "report": report,
        "analysis": report_to_text(report),
        "model": model_name,
        "elapsed_ms": int((time.time() - started) * 1000),
        "image": {"width": img.width, "height": img.height},
    }


# ==================== WEATHER ====================
def geocode(place: str) -> dict | None:
    place = clean_text(place, 120)
    if not place:
        return None
    try:
        r = requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": place, "count": 1, "language": "en"},
            timeout=HTTP_TIMEOUT,
        )
        res = (r.json() or {}).get("results") or []
        if res:
            g = res[0]
            label = ", ".join(x for x in (g.get("name"), g.get("admin1"), g.get("country")) if x)
            return {"name": label, "lat": g["latitude"], "lon": g["longitude"]}
    except (requests.RequestException, ValueError, KeyError) as exc:
        log.warning("Open-Meteo geocoding failed for %r: %s", place, exc)
    try:  # Nominatim also knows villages, landmarks and addresses
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": place, "format": "json", "limit": 1},
            headers={"User-Agent": USER_AGENT},
            timeout=HTTP_TIMEOUT,
        )
        res = r.json() or []
        if res:
            return {"name": res[0].get("display_name", place)[:120], "lat": float(res[0]["lat"]), "lon": float(res[0]["lon"])}
    except (requests.RequestException, ValueError, KeyError) as exc:
        log.warning("Nominatim geocoding failed for %r: %s", place, exc)
    return None


def assess_weather_risk(cur: dict) -> dict:
    """Same rule cascade as the dashboard's AI DECISION card."""
    rain = cur.get("precipitation") or 0
    wind = cur.get("wind_speed_10m") or 0
    gust = cur.get("wind_gusts_10m") or 0
    temp = cur.get("temperature_2m") or 0
    flags = []
    if rain > 5:
        level, score, advice = "HIGH", 90, "Flood risk: deploy boats and water rescue teams."
    elif wind > 40 or gust > 60:
        level, score, advice = "HIGH", 85, "High wind: ground the drones and secure the area."
    elif temp > 40:
        level, score, advice = "MEDIUM", 60, "Heat risk: activate medical and hydration units."
    elif rain > 1 or wind > 25:
        level, score, advice = "MEDIUM", 45, "Unsettled weather: brief teams and monitor closely."
    else:
        level, score, advice = "LOW", 20, "Safe conditions. Monitoring active."
    if wind > 30:
        flags.append("Drone flight not advised (limit 30 km/h)")
    if rain > 0:
        flags.append("Rain: slippery debris and low visibility")
    if temp < 5:
        flags.append("Cold exposure risk for survivors")
    return {"level": level, "score": score, "advice": advice, "flags": flags}


def get_weather(lat: float, lon: float, name: str = "") -> dict:
    r = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": lat, "longitude": lon, "timezone": "auto", "forecast_days": 3,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,"
                       "weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code",
        },
        timeout=HTTP_TIMEOUT,
    )
    r.raise_for_status()
    data = r.json()
    cur = data.get("current", {})
    daily = data.get("daily", {})
    days = [
        {
            "date": d,
            "t_max": daily.get("temperature_2m_max", [None])[i],
            "t_min": daily.get("temperature_2m_min", [None])[i],
            "rain": daily.get("precipitation_sum", [None])[i],
            "wind_max": daily.get("wind_speed_10m_max", [None])[i],
            "code": daily.get("weather_code", [None])[i],
        }
        for i, d in enumerate(daily.get("time", []))
    ]
    return {
        "success": True,
        "location": {"name": name or f"{lat:.3f}, {lon:.3f}", "lat": lat, "lon": lon},
        "current": {
            "temp": cur.get("temperature_2m"), "feels_like": cur.get("apparent_temperature"),
            "humidity": cur.get("relative_humidity_2m"), "rain": cur.get("precipitation"),
            "wind": cur.get("wind_speed_10m"), "gust": cur.get("wind_gusts_10m"),
            "wind_dir": cur.get("wind_direction_10m"), "cloud": cur.get("cloud_cover"),
            "code": cur.get("weather_code"), "time": cur.get("time"),
        },
        "daily": days,
        "risk": assess_weather_risk(cur),
    }


# ==================== ROUTING ====================
def _save_route_map(start: dict, end: dict, coords: list[list[float]]) -> str | None:
    """Write a Folium HTML map (used by the legacy UI's iframe)."""
    if folium is None:
        return None
    try:
        m = folium.Map(location=[(start["lat"] + end["lat"]) / 2, (start["lon"] + end["lon"]) / 2], zoom_start=12)
        folium.PolyLine(coords, color="#ff8c1a", weight=5, opacity=0.9, tooltip="Rescue route").add_to(m)
        folium.Marker([start["lat"], start["lon"]], popup="Base", icon=folium.Icon(color="green")).add_to(m)
        folium.Marker([end["lat"], end["lon"]], popup="Destination", icon=folium.Icon(color="red")).add_to(m)
        m.save(str(STATIC_DIR / "shortest_route_map.html"))
        return "/static/shortest_route_map.html"
    except Exception as exc:  # noqa: BLE001 - map file is optional
        log.warning("Could not save Folium map: %s", exc)
        return None


def _route_ors(start: dict, end: dict):
    r = requests.post(
        "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
        json={"coordinates": [[start["lon"], start["lat"]], [end["lon"], end["lat"]]]},
        headers={"Authorization": ORS_API_KEY, "Content-Type": "application/json"},
        timeout=HTTP_TIMEOUT,
    )
    feature = r.json()["features"][0]
    summary = feature.get("properties", {}).get("summary", {})
    coords = [[lat, lon] for lon, lat in feature["geometry"]["coordinates"]]
    return coords, summary.get("distance", 0) / 1000, summary.get("duration", 0) / 60


def _route_osrm(start: dict, end: dict):
    r = requests.get(
        f"https://router.project-osrm.org/route/v1/driving/{start['lon']},{start['lat']};{end['lon']},{end['lat']}",
        params={"overview": "full", "geometries": "geojson"},
        headers={"User-Agent": USER_AGENT},
        timeout=HTTP_TIMEOUT,
    )
    route = r.json()["routes"][0]
    coords = [[lat, lon] for lon, lat in route["geometry"]["coordinates"]]
    return coords, route["distance"] / 1000, route["duration"] / 60


def plan_route(start: dict, end: dict) -> dict:
    providers = ([("openrouteservice", _route_ors)] if ORS_API_KEY else []) + [("osrm", _route_osrm)]
    for name, fn in providers:
        try:
            coords, km, minutes = fn(start, end)
            if coords:
                break
        except (requests.RequestException, KeyError, IndexError, ValueError) as exc:
            log.warning("Routing via %s failed: %s", name, exc)
    else:
        name = "estimate"
        coords = [[start["lat"], start["lon"]], [end["lat"], end["lon"]]]
        km = haversine_km(start["lat"], start["lon"], end["lat"], end["lon"])
        minutes = km * 2.5  # rough road-speed estimate (~24 km/h) for disaster conditions
    return {
        "success": True,
        "provider": name,
        "distance_km": round(km, 2),
        "duration_min": round(minutes, 1),
        "start": start,
        "end": end,
        "coordinates": coords,
        "map_url": _save_route_map(start, end, coords),
    }


# ==================== INCIDENT BOARD ====================
INCIDENT_TYPES = ("earthquake", "flood", "fire", "landslide", "building collapse", "cyclone",
                  "road accident", "chemical", "medical", "missing person", "other")
INCIDENT_STATUSES = ("OPEN", "RESPONDING", "RESOLVED")


class IncidentStore:
    """Thread-safe in-memory incident list persisted to a JSON file."""

    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        self.items: list[dict] = []
        try:
            self.items = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            self.items = []

    def _save(self):
        try:
            self.path.write_text(json.dumps(self.items, indent=1), encoding="utf-8")
        except OSError as exc:
            log.warning("Could not persist incidents: %s", exc)

    def all(self) -> list[dict]:
        with self.lock:
            return sorted(self.items, key=lambda i: i["created_at"], reverse=True)

    def get(self, incident_id: str) -> dict | None:
        with self.lock:
            return next((i for i in self.items if i["id"] == incident_id), None)

    def create(self, data: dict, source: str = "manual") -> dict:
        now = utc_now()
        incident = {
            "id": "INC-" + uuid.uuid4().hex[:6].upper(),
            "title": clean_text(data.get("title"), 120),
            "type": data.get("type") if data.get("type") in INCIDENT_TYPES else "other",
            "severity": data.get("severity") if data.get("severity") in RISK_LEVELS else "MEDIUM",
            "status": "OPEN",
            "lat": as_float(data.get("lat"), -90, 90),
            "lon": as_float(data.get("lon"), -180, 180),
            "location_name": clean_text(data.get("location_name"), 160),
            "people_affected": max(0, int(as_float(data.get("people_affected"), 0, 1e6) or 0)),
            "team": clean_text(data.get("team"), 80),
            "notes": clean_text(data.get("notes"), 1000),
            "source": source,
            "created_at": now,
            "updated_at": now,
        }
        with self.lock:
            self.items.append(incident)
            self.items = self.items[-500:]
            self._save()
        return incident

    def update(self, incident_id: str, data: dict) -> dict | None:
        with self.lock:
            incident = next((i for i in self.items if i["id"] == incident_id), None)
            if not incident:
                return None
            if data.get("status") in INCIDENT_STATUSES:
                incident["status"] = data["status"]
            if data.get("severity") in RISK_LEVELS:
                incident["severity"] = data["severity"]
            for key, limit in (("team", 80), ("notes", 1000), ("title", 120)):
                if key in data:
                    incident[key] = clean_text(data[key], limit) or incident[key]
            incident["updated_at"] = utc_now()
            self._save()
            return dict(incident)

    def delete(self, incident_id: str) -> bool:
        with self.lock:
            before = len(self.items)
            self.items = [i for i in self.items if i["id"] != incident_id]
            if len(self.items) != before:
                self._save()
                return True
            return False


incidents = IncidentStore(INCIDENTS_FILE)


# ==================== ASSISTANT ====================
STATIC_RESPONSES = {
    "who are you": "I am Fateh, the NDRF base station assistant.",
    "your name": "My name is Fateh.",
    "what is ndrf": "NDRF is India's National Disaster Response Force, a specialised force for disaster response.",
    "help": "Ask me about weather, routes, equipment, drone safety, or any disaster-response procedure.",
    "drone": "Drones can operate safely in wind speeds up to about 30 km/h.",
}


def extract_place(query: str, keywords: tuple[str, ...]) -> str:
    q = query.lower()
    for kw in keywords:
        m = re.search(rf"{kw}\s+(?:in|at|for|of|to)?\s*([a-z0-9 ,.'-]+)", q)
        if m and m.group(1).strip(" .,?"):
            return m.group(1).strip(" .,?")
        m = re.search(rf"([a-z0-9 ,.'-]+?)\s+{kw}", q)
        if m and m.group(1).strip(" .,?") not in ("the", "what is the", "how is the"):
            return m.group(1).strip(" .,?")
    return ""


def assistant_reply(query: str) -> dict:
    q = clean_text(query, 500)
    ql = q.lower()
    if not q:
        return {"response": "Please ask a question.", "intent": "empty"}

    if any(k in ql for k in ("weather", "temperature", "forecast", "rain in")):
        place = extract_place(ql, ("weather", "temperature", "forecast"))
        geo = geocode(place) if place else {"name": BASE_LOCATION["name"], "lat": BASE_LOCATION["lat"], "lon": BASE_LOCATION["lon"]}
        if not geo:
            return {"response": f"I couldn't find a place called {place}.", "intent": "weather"}
        try:
            w = get_weather(geo["lat"], geo["lon"], geo["name"])
        except (requests.RequestException, ValueError):
            return {"response": "Weather service is unreachable right now.", "intent": "weather"}
        c = w["current"]
        text = (f"{w['location']['name']}: {c['temp']}°C, wind {c['wind']} km/h, rain {c['rain']} mm. "
                f"Risk {w['risk']['level']}: {w['risk']['advice']}")
        return {"response": text, "intent": "weather", "data": w}

    if any(k in ql for k in ("route to", "path to", "navigate to", "directions to")):
        place = re.split(r"(?:route|path|navigate|directions) to", ql, maxsplit=1)[-1].strip(" .?")
        geo = geocode(place)
        if not geo:
            return {"response": f"I couldn't locate {place}.", "intent": "route"}
        route = plan_route(BASE_LOCATION, geo)
        text = f"Route to {geo['name']}: {route['distance_km']} km, about {route['duration_min']:.0f} minutes."
        return {"response": text, "intent": "route", "data": route}

    for key, answer in STATIC_RESPONSES.items():
        if key in ql:
            return {"response": answer, "intent": "static"}

    context = ""
    if any(k in ql for k in ("equipment", "kit", "inventory", "available", "stock", "how many")):
        items = load_equipment()
        context = "Base inventory:\n" + "\n".join(
            f"- {i['name']} ({i['category']}): {i['quantity']} {i.get('status', '')}" for i in items[:140]
        )
    prompt = (
        "You are Fateh, the AI assistant at an NDRF (National Disaster Response Force, India) base station. "
        "Answer in at most 3 short sentences, practical and accurate. If unsure, say so.\n"
        f"{context}\nQuestion: {q}"
    )
    try:
        text, model_name = gemini.generate(prompt)
        return {"response": text or "I have no answer for that.", "intent": "ai", "model": model_name}
    except AIError as exc:
        return {"response": str(exc), "intent": "ai_error"}


# ==================== ROUTES: PAGES & HEALTH ====================
@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/static/<path:filename>")
def serve_static(filename):
    return send_from_directory(STATIC_DIR, filename)


def health_payload() -> dict:
    return {
        "status": "ok",
        "message": "NDRF Base Station API Running",
        "version": VERSION,
        "uptime_s": int(time.time() - STARTED_AT),
        "ai": {"enabled": gemini.enabled, "model": gemini.active_model or (GEMINI_MODELS[0] if GEMINI_MODELS else None)},
        "routing": "openrouteservice" if ORS_API_KEY else "osrm",
        "consoles": _presence["count"],
        "open_incidents": sum(1 for i in incidents.all() if i["status"] != "RESOLVED"),
    }


@app.route("/ping")
@app.route("/api/health")
def ping():
    return jsonify(health_payload())


@app.route("/api/config")
def config():
    return jsonify({"version": VERSION, "base": BASE_LOCATION, "ai_enabled": gemini.enabled,
                    "max_upload_mb": MAX_UPLOAD_MB, "incident_types": INCIDENT_TYPES})


# ==================== ROUTES: AI ====================
@app.route("/analyze_image", methods=["POST"])
@app.route("/upload_image", methods=["POST"])  # alias used by the old main2.py client
@app.route("/api/analyze", methods=["POST"])
def analyze_image_route():
    try:
        if "image" in request.files:
            file = request.files["image"]
            if not file or file.filename == "":
                return bad_request("No file selected.")
            raw = file.read()
            lat, lon = as_float(request.form.get("lat"), -90, 90), as_float(request.form.get("lon"), -180, 180)
        else:
            body = request.get_json(silent=True) or {}
            if not body.get("image"):
                return bad_request("No image provided. Send multipart field 'image' or JSON {image: dataURL}.")
            raw = decode_data_url(body["image"])
            lat, lon = as_float(body.get("lat"), -90, 90), as_float(body.get("lon"), -180, 180)
        if not raw:
            return bad_request("Empty image file.")
        result = analyse_image(raw, lat, lon)
        r = result["report"]
        log.info("Image analysed: %s risk, %d people, %d ms", r["risk_level"], r["people_visible"], result["elapsed_ms"])
        socketio.emit("analysis_completed", {"summary": r["summary"], "risk_level": r["risk_level"],
                                             "people_visible": r["people_visible"], "at": utc_now()})
        return jsonify(result)
    except ValueError as exc:
        return bad_request(str(exc))
    except AIError as exc:
        return bad_request(str(exc), exc.status)


@app.route("/analyze_frame", methods=["POST"])
def analyze_frame():
    body = request.get_json(silent=True) or {}
    images = body.get("images") or []
    if not isinstance(images, list) or not images:
        return bad_request("No image data received.")
    loc = body.get("location") or {}
    lat, lon = as_float(loc.get("latitude"), -90, 90), as_float(loc.get("longitude"), -180, 180)
    reports, texts = [], []
    for idx, data in enumerate(images[:5], start=1):
        try:
            result = analyse_image(decode_data_url(str(data)), lat, lon)
            reports.append(result["report"])
            texts.append(f"📸 IMAGE {idx}\n{result['analysis']}")
        except (ValueError, AIError) as exc:
            reports.append(None)
            texts.append(f"IMAGE {idx}: ⚠️ {exc}")
    return jsonify({"success": any(reports), "reports": reports, "response": ("\n\n" + "=" * 50 + "\n\n").join(texts)})


@app.route("/gemini", methods=["POST"])
@app.route("/api/assistant", methods=["POST"])
def assistant_route():
    body = request.get_json(silent=True) or {}
    query = body.get("query") or body.get("command") or ""
    if not str(query).strip():
        return jsonify({"response": "Please ask a question."}), 400
    return jsonify(assistant_reply(query))


@app.route("/voice_command", methods=["POST"])
def voice_command_route():
    body = request.get_json(silent=True) or {}
    command = clean_text(body.get("command"), 500)
    if not command:
        return bad_request("No command provided.")
    reply = assistant_reply(command)
    socketio.emit("assistant_response", {"text": reply["response"], "intent": reply.get("intent"), "audio": None})
    return jsonify({"success": True, "command": command, **reply})


# ==================== ROUTES: DATA ====================
@app.route("/api/weather")
@app.route("/weather", methods=["GET", "POST"])
def weather_route():
    params = {**request.args, **(request.get_json(silent=True) or {})}
    lat, lon = as_float(params.get("lat"), -90, 90), as_float(params.get("lon"), -180, 180)
    name = clean_text(params.get("name"), 120)
    city = clean_text(params.get("city"), 120)
    if city:
        geo = geocode(city)
        if not geo:
            return bad_request(f"Couldn't find '{city}'.", 404)
        lat, lon, name = geo["lat"], geo["lon"], geo["name"]
    if lat is None or lon is None:
        lat, lon, name = BASE_LOCATION["lat"], BASE_LOCATION["lon"], BASE_LOCATION["name"]
    try:
        data = get_weather(lat, lon, name)
    except (requests.RequestException, ValueError) as exc:
        log.warning("Weather fetch failed: %s", exc)
        return bad_request("Weather service unavailable.", 502)
    data["weather"] = (f"{data['location']['name']}: {data['current']['temp']}°C, "
                       f"wind {data['current']['wind']} km/h. {data['risk']['advice']}")
    return jsonify(data)


@app.route("/api/geocode")
def geocode_route():
    geo = geocode(request.args.get("q", ""))
    return jsonify({"success": True, **geo}) if geo else bad_request("Place not found.", 404)


@app.route("/generate_route", methods=["POST"])
@app.route("/api/route", methods=["POST"])
def route_route():
    body = request.get_json(silent=True) or {}
    start = {"name": BASE_LOCATION["name"], "lat": BASE_LOCATION["lat"], "lon": BASE_LOCATION["lon"]}
    s_lat, s_lon = as_float(body.get("start_lat"), -90, 90), as_float(body.get("start_lon"), -180, 180)
    if s_lat is not None and s_lon is not None:
        start = {"name": "Start", "lat": s_lat, "lon": s_lon}
    e_lat, e_lon = as_float(body.get("end_lat"), -90, 90), as_float(body.get("end_lon"), -180, 180)
    destination = clean_text(body.get("destination"), 160)
    if e_lat is not None and e_lon is not None:
        end = {"name": destination or "Destination", "lat": e_lat, "lon": e_lon}
    elif destination:
        end = geocode(destination)
        if not end:
            return bad_request(f"Couldn't find '{destination}'.", 404)
    else:
        end = dict(DEMO_DESTINATION)
    return jsonify(plan_route(start, end))


@app.route("/api/equipment")
def equipment_route():
    q = clean_text(request.args.get("q"), 80)
    category = clean_text(request.args.get("category"), 60)
    everything = load_equipment()
    items = search_equipment(q, category) if (q or category) else everything
    return jsonify({"success": True, "total": len(items), "items": items,
                    "categories": equipment_summary(everything)})


@app.route("/equipment_list")
def equipment_list_text():
    items = load_equipment()
    lines = ["=" * 60, "NDRF EQUIPMENT INVENTORY", "=" * 60]
    for cat in equipment_summary(items):
        lines.append(f"\n[{cat['name']}]")
        lines += [f"  - {i['name']} (Qty: {i['quantity']})" for i in items if i.get("category") == cat["name"]]
    lines += ["", "=" * 60, f"Total: {len(items)} items, {len(equipment_summary(items))} categories"]
    return jsonify({"equipment": "\n".join(lines)})


@app.route("/api/incidents", methods=["GET", "POST"])
def incidents_route():
    if request.method == "GET":
        return jsonify({"success": True, "incidents": incidents.all()})
    body = request.get_json(silent=True) or {}
    if not clean_text(body.get("title"), 120):
        return bad_request("Incident title is required.")
    incident = incidents.create(body, source=body.get("source") if body.get("source") in ("ai", "detection", "sos") else "manual")
    log.info("Incident created %s: %s (%s)", incident["id"], incident["title"], incident["severity"])
    socketio.emit("incident_created", incident)
    return jsonify({"success": True, "incident": incident}), 201


@app.route("/api/incidents/<incident_id>", methods=["PATCH", "DELETE"])
def incident_route(incident_id):
    if request.method == "DELETE":
        if not incidents.delete(incident_id):
            return bad_request("Incident not found.", 404)
        socketio.emit("incident_deleted", {"id": incident_id})
        return jsonify({"success": True})
    incident = incidents.update(incident_id, request.get_json(silent=True) or {})
    if not incident:
        return bad_request("Incident not found.", 404)
    socketio.emit("incident_updated", incident)
    return jsonify({"success": True, "incident": incident})


# ==================== ERROR HANDLERS ====================
@app.errorhandler(413)
def too_large(_):
    return bad_request(f"Image too large (max {MAX_UPLOAD_MB} MB).", 413)


@app.errorhandler(404)
def not_found(err):
    if request.path.startswith("/api/"):
        return bad_request("Endpoint not found.", 404)
    return err


@app.errorhandler(500)
def server_error(_):
    return bad_request("Internal server error.", 500)


# ==================== SOCKET.IO ====================
_presence = {"count": 0}
_presence_lock = threading.Lock()


def _broadcast_presence():
    socketio.emit("presence", {"consoles": _presence["count"]})


@socketio.on("connect")
def on_connect():
    with _presence_lock:
        _presence["count"] += 1
    socketio.emit("connected", {"message": "Connected to NDRF Base Station", "version": VERSION,
                                "server_time": utc_now()}, to=request.sid)
    _broadcast_presence()


@socketio.on("disconnect")
def on_disconnect(*_args):
    with _presence_lock:
        _presence["count"] = max(0, _presence["count"] - 1)
    _broadcast_presence()


@socketio.on("voice_command")
def on_voice_command(data):
    command = clean_text((data or {}).get("command"), 500)
    if not command:
        return
    sid = request.sid

    def work():
        reply = assistant_reply(command)
        socketio.emit("assistant_response", {"text": reply["response"], "intent": reply.get("intent"), "audio": None}, to=sid)

    socketio.start_background_task(work)


@socketio.on("request_equipment")
def on_request_equipment(*_args):
    socketio.emit("equipment_data", {"items": load_equipment()}, to=request.sid)


@socketio.on("sos")
def on_sos(data):
    data = data or {}
    incident = incidents.create({
        "title": clean_text(data.get("title"), 120) or "SOS — immediate assistance required",
        "type": data.get("type", "other"),
        "severity": "CRITICAL",
        "lat": data.get("lat"),
        "lon": data.get("lon"),
        "notes": data.get("notes", "SOS raised from a field console."),
        "location_name": data.get("location_name", ""),
    }, source="sos")
    log.warning("SOS raised: %s", incident["id"])
    socketio.emit("incident_created", incident)


# ==================== MAIN ====================
def run(port: int | None = None):
    port = port or PORT
    log.info("NDRF Base Station v%s on http://localhost:%d (AI %s, routing %s)",
             VERSION, port, "on" if gemini.enabled else "off", "ORS" if ORS_API_KEY else "OSRM")
    socketio.run(app, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True)


if __name__ == "__main__":
    run()
