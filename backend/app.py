from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import google.generativeai as genai
import base64
from io import BytesIO
from PIL import Image
import pandas as pd
import folium
import os
import asyncio
import subprocess

import requests
from time import time
import nest_asyncio

import threading
from math import radians, sin, cos, sqrt, atan2

from queue import Queue
import tempfile

# Suppress deprecation warnings
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

# Apply nest_asyncio for nested event loops
nest_asyncio.apply()

# ==================== FLASK APP INITIALIZATION ====================
app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# ==================== VOICE ASSISTANT GLOBALS ====================
is_activated = False
command_queue = Queue()
voice_loop = None
voice_enabled = True
current_command_id = 0
latest_command_id = 0
recognizer = sr.Recognizer()

# Setup logging to file only (not console)
logging.basicConfig(
    filename='voice_assistant.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# ==================== GET ABSOLUTE PATHS ====================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), 'frontend')
STATIC_DIR = os.path.join(os.path.dirname(BASE_DIR), 'static')
UPLOAD_DIR = os.path.join(os.path.dirname(BASE_DIR), 'uploads')
UPLOADED_IMAGES_DIR = os.path.join(os.path.dirname(BASE_DIR), 'uploaded_images')
AUDIO_DIR = os.path.join(os.path.dirname(BASE_DIR), 'audio_output')

# Create directories
os.makedirs(FRONTEND_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(UPLOADED_IMAGES_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)

# ==================== API KEYS & CONFIGURATION ====================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ORS_API_KEY = os.getenv("ORS_API_KEY")

try:
    genai.configure(api_key=GEMINI_API_KEY)
    logging.info("Gemini API configured successfully")
except Exception as e:
    logging.error(f"Gemini configuration error: {e}")
# Default coordinates (India)
default_start = (28.6129, 77.2295)  # India Gate, Delhi
default_end = (28.6562, 77.2410)    # Red Fort, Delhi
import base64

# ==================== IMPROVED TEXT TO SPEECH ====================
async def edge_speak(text, command_id):
    if not text.strip() or command_id != latest_command_id:
        return

    audio_base64 = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3', dir=AUDIO_DIR) as tmp_file:
            audio_file = tmp_file.name

        tts = edge_tts.Communicate(text=text, voice="en-IN-NeerjaNeural")
        await tts.save(audio_file)

        # Convert to base64
        with open(audio_file, "rb") as f:
            audio_base64 = base64.b64encode(f.read()).decode('utf-8')

        # Send BOTH text and audio to frontend
        socketio.emit('assistant_response', {
            'text': text,
            'audio': audio_base64,
            'command_id': command_id
        })

    except Exception as e:
        logging.error(f"TTS Error: {e}")
        socketio.emit('assistant_response', {'text': text, 'audio': None})
    finally:
        try:
            os.unlink(audio_file)
        except:
            pass


def speak(text, command_id):
    global latest_command_id
    latest_command_id = command_id
    asyncio.run_coroutine_threadsafe(edge_speak(text, command_id), voice_loop)

# ==================== SPEECH RECOGNITION ====================
def listen_and_caption():
    try:
        with sr.Microphone() as source:
            socketio.emit('voice_status', {'status': 'listening'})
            recognizer.adjust_for_ambient_noise(source, duration=10.5)
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=5)
        
        text = recognizer.recognize_google(audio).lower()
        socketio.emit('voice_command', {'command': text, 'timestamp': time()})
        logging.info(f"Voice command: {text}")
        return text
    except sr.WaitTimeoutError:
        return None
    except sr.UnknownValueError:
        socketio.emit('voice_status', {'status': 'unknown'})
        return None
    except sr.RequestError as e:
        logging.error(f"Speech recognition error: {e}")
        socketio.emit('error', {'message': f'Recognition error: {str(e)}'})
        return None
    except Exception as e:
        logging.error(f"Listening error: {e}")
        return None

# ==================== WEATHER FUNCTIONS ====================
def get_city_coordinates(city):
    geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1"
    try:
        response = requests.get(geo_url)
        data = response.json()
        if "results" in data and len(data["results"]) > 0:
            return data["results"][0]["latitude"], data["results"][0]["longitude"]
        return None, None
    except Exception as e:
        logging.error(f"Geocoding error: {e}")
        return None, None

def get_weather(city, command_id):
    latitude, longitude = get_city_coordinates(city)
    if latitude is None or longitude is None:
        speak(f"Sorry, I couldn't find coordinates for {city}.", command_id)
        return None

    weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&current=temperature_2m,wind_speed_10m,precipitation,cloudcover"
    try:
        response = requests.get(weather_url)
        data = response.json()
        temp = data["current"]["temperature_2m"]
        wind_speed = data["current"]["wind_speed_10m"]
        precipitation = data["current"]["precipitation"]
        cloud_cover = data["current"]["cloudcover"]

        weather_desc = f"The current temperature in {city} is {temp}°C with wind speeds of {wind_speed} km/h."
        if precipitation > 0:
            weather_desc += " It is raining."
        elif cloud_cover > 70:
            weather_desc += " The sky is mostly cloudy."
        elif cloud_cover < 30:
            weather_desc += " It's quite sunny."
        else:
            weather_desc += " The weather is moderate."
        
        speak(weather_desc, command_id)
        return weather_desc
    except Exception as e:
        logging.error(f"Weather API error: {e}")
        speak("I couldn't fetch the weather data right now.", command_id)
        return None

# ==================== ROUTE FUNCTIONS ====================
def get_route_map_with_coords(start_lat, start_lon, end_lat, end_lon):
    url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"
    headers = {"Authorization": ORS_API_KEY, "Content-Type": "application/json"}
    payload = {"coordinates": [[start_lon, start_lat], [end_lon, end_lat]]}
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        data = response.json()
        
        if "features" in data and len(data["features"]) > 0:
            route_coords = data["features"][0]["geometry"]["coordinates"]
            route_coords_latlon = [(lat, lon) for lon, lat in route_coords]
            distance = data["features"][0].get("properties", {}).get("summary", {}).get("distance", 0)
            duration = data["features"][0].get("properties", {}).get("summary", {}).get("duration", 0)
            
            center_lat = (start_lat + end_lat) / 2
            center_lon = (start_lon + end_lon) / 2
            route_map = folium.Map(location=[center_lat, center_lon], zoom_start=13)
            folium.PolyLine(route_coords_latlon, color="#00ff88", weight=4, opacity=0.8, tooltip="Shortest Route").add_to(route_map)
            folium.Marker([start_lat, start_lon], popup="Start Point", icon=folium.Icon(color="green")).add_to(route_map)
            folium.Marker([end_lat, end_lon], popup="End Point", icon=folium.Icon(color="red")).add_to(route_map)
            
            map_filename = os.path.join(STATIC_DIR, "shortest_route_map.html")
            route_map.save(map_filename)
            
            return {"success": True, "distance_km": round(distance / 1000, 2), "duration_min": round(duration / 60, 1), "map_url": "/static/shortest_route_map.html"}
        else:
            return generate_fallback_route(start_lat, start_lon, end_lat, end_lon)
    except Exception as e:
        logging.error(f"Route API error: {e}")
        return generate_fallback_route(start_lat, start_lon, end_lat, end_lon)

def generate_fallback_route(start_lat, start_lon, end_lat, end_lon):
    center_lat = (start_lat + end_lat) / 2
    center_lon = (start_lon + end_lon) / 2
    route_map = folium.Map(location=[center_lat, center_lon], zoom_start=13)
    folium.PolyLine([[start_lat, start_lon], [end_lat, end_lon]], color="#00ff88", weight=3, opacity=0.7).add_to(route_map)
    folium.Marker([start_lat, start_lon], popup="Start Point", icon=folium.Icon(color="green")).add_to(route_map)
    folium.Marker([end_lat, end_lon], popup="End Point", icon=folium.Icon(color="red")).add_to(route_map)
    
    map_filename = os.path.join(STATIC_DIR, "shortest_route_map.html")
    route_map.save(map_filename)
    
    # Calculate approximate distance using Haversine formula
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [start_lat, start_lon, end_lat, end_lon])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    distance = R * 2 * atan2(sqrt(a), sqrt(1-a))
    
    return {"success": True, "distance_km": round(distance, 2), "duration_min": round(distance * 2.5, 1), "map_url": "/static/shortest_route_map.html"}

# ==================== EQUIPMENT FUNCTIONS ====================
def read_all_equipment():
    equipment_files = ["earthquake_kit.xlsx", "flood_kit.xlsx", "mfr_equipment.xlsx"]
    all_items = []
    
    for file in equipment_files:
        file_path = os.path.join(os.path.dirname(BASE_DIR), file)
        try:
            if os.path.exists(file_path):
                df = pd.read_excel(file_path)
                if "Item Name" in df.columns and "Quantity" in df.columns:
                    df["Category"] = file.replace(".xlsx", "").replace("_", " ").title()
                    all_items.extend(df.to_dict(orient="records"))
        except Exception as e:
            logging.error(f"Error reading {file}: {e}")
    
    if not all_items:
        all_items = [
            {"Item Name": "Rescue Boat", "Quantity": 4, "Category": "Water Rescue"},
            {"Item Name": "Life Jacket", "Quantity": 50, "Category": "Water Rescue"},
            {"Item Name": "Stretcher", "Quantity": 8, "Category": "Medical"},
            {"Item Name": "First Aid Kit", "Quantity": 15, "Category": "Medical"},
            {"Item Name": "Rescue Rope 50m", "Quantity": 20, "Category": "Rope Rescue"},
            {"Item Name": "Search Light", "Quantity": 6, "Category": "Equipment"},
            {"Item Name": "Two-Way Radio", "Quantity": 12, "Category": "Communication"},
            {"Item Name": "Gas Cutter", "Quantity": 3, "Category": "Heavy Equipment"},
            {"Item Name": "Thermal Blanket", "Quantity": 100, "Category": "Relief"},
            {"Item Name": "Water Purifier", "Quantity": 5, "Category": "Relief"},
            {"Item Name": "De-watering Pump", "Quantity": 4, "Category": "Flood Rescue"},
        ]
    
    return all_items

# ==================== GEMINI QUERY WITH CONTEXT ====================
def ask_gemini_with_context(query, command_id):
    query_lower = query.lower()
    
    # Weather command
    if any(k in query_lower for k in ["weather", "temperature"]):
        city = query_lower.replace("weather", "").replace("temperature", "").replace("in", "").strip()
        if city:
            get_weather(city, command_id)
        else:
            speak("Please specify a city name.", command_id)
        return
    
    # Route command
    if any(k in query_lower for k in ["route", "shortest path"]):
        speak("Generating route map...", command_id)
        result = get_route_map_with_coords(default_start[0], default_start[1], default_end[0], default_end[1])
        if result["success"]:
            speak(f"Route generated. Distance: {result['distance_km']} kilometers. Estimated time: {result['duration_min']} minutes.", command_id)
            socketio.emit('route_generated', result)
        else:
            speak("Error generating route.", command_id)
        return
    
    # Equipment command
    if any(k in query_lower for k in ["equipment", "kit", "item", "available"]):
        items = read_all_equipment()
        if items:
            equipment_list = "\n".join([f"- {item.get('Item Name', 'Unknown')} (Qty: {item.get('Quantity', 0)})" for item in items[:20]])
            prompt = f"You are an NDRF logistics assistant. Available equipment:\n{equipment_list}\n\nQuestion: {query}\nProvide a helpful, concise response.on;y 1 line"
        else:
            prompt = f"You are an NDRF logistics assistant. Question: {query}\nProvide practical equipment recommendations. only 1 line"
    else:
        prompt = f"You are an expert assistant for NDRF (National Disaster Response Force). Provide accurate, professional information about disaster response only one line.\nQuestion: {query}\nProvide a helpful, concise response."
    
    try:
        model = genai.GenerativeModel("gemini-3-flash-preview")
        response = model.generate_content(prompt)
        answer = response.text
        speak(answer, command_id)
        return answer
    except Exception as e:
        logging.error(f"Gemini error: {e}")
        speak("Error processing your request. Please try again.", command_id)
        return None

## ==================== SPEAK FUNCTION ====================
def speak(text, command_id=None):
    print(f"🔊 {text}")

    socketio.emit('assistant_response', {
        'text': text,
        'audio': None
    })

# ==================== STATIC RESPONSES ====================
STATIC_RESPONSES = {
    "who are you": "I am an NDRF disaster response assistant.",
    "yourself": "I am an NDRF disaster response assistant designed to help in rescue operations.",
    "help": "You can ask about weather, route, drone or equipment.",
    "drone": "Drone can operate safely up to 30 km per hour wind speed."
}

def get_static_response(cmd):
    for key in STATIC_RESPONSES:
        if key in cmd:
            return STATIC_RESPONSES[key]
    return None
@app.route('/analyze_image', methods=['POST'])
def analyze_image():
    """Analyze uploaded image with Gemini AI"""
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Read image
        image_bytes = file.read()
        image = Image.open(BytesIO(image_bytes))
        
        # Use Gemini to analyze
        model = genai.GenerativeModel("gemini-3-flash-preview")
        
        prompt = """You are an NDRF disaster response commander. Analyze this disaster image.

Provide analysis in this format:

🔍 OBSERVATIONS:
- What do you see in this image?
- Any damage, hazards, or trapped people?

🚨 IMMEDIATE ACTIONS:
- What needs to be done right now?

👥 TEAM REQUIRED:
- How many personnel needed?
- What specialized units?

🗺️ STRATEGY:
- Step-by-step rescue plan

📦 EQUIPMENT NEEDED:
- Specific tools and supplies needed

⚠️ RISK LEVEL: LOW/MEDIUM/HIGH/CRITICAL

Be direct and tactical."""
        
        response = model.generate_content([image, prompt])
        result = response.text if response.text else "Unable to analyze image"
        
        return jsonify({
            "success": True,
            "analysis": result
        })
        
    except Exception as e:
        print(f"Analysis error: {e}")
        return jsonify({"error": str(e)}), 500
# ==================== GEMINI ====================
def ask_gemini_with_context(query, command_id):
    try:
        model = genai.GenerativeModel("gemini-3-flash-preview")
        response = model.generate_content(query)

        answer = response.text if hasattr(response, "text") else str(response)

        print("🤖 Gemini:", answer)
        speak(answer, command_id)

    except Exception as e:
        print("❌ Gemini Error:", e)
        speak(".", command_id)


# ==================== VOICE BOT MAIN LOOP ====================
def voice_bot_loop():
    global is_activated, current_command_id
    asyncio.set_event_loop(voice_loop)

    current_command_id = 1
    speak("NDRF Assistant activated. Say hello to begin.", current_command_id)

    while True:
        try:
            command = listen_and_caption()
            if command is None:
                continue

            current_command_id += 1
            command_lower = command.lower()

            print("🎤 Heard:", command_lower)

            # ================= ACTIVATION =================
            if not is_activated:
                if "hello" in command_lower or "hey" in command_lower:
                    is_activated = True
                    speak("Hello! I am your NDRF assistant. How can I help you?", current_command_id)
                else:
                    # Quick commands without activation
                    if "weather" in command_lower:
                        city = command_lower.replace("weather", "").replace("in", "").strip()
                        if city:
                            get_weather(city, current_command_id)

                    elif "route" in command_lower:
                        speak("Generating route map...", current_command_id)
                        result = get_route_map_with_coords(
                            default_start[0], default_start[1],
                            default_end[0], default_end[1]
                        )
                        if result["success"]:
                            speak(f"Route generated. Distance {result['distance_km']} km. Time {result['duration_min']} minutes.", current_command_id)
                            socketio.emit('route_generated', result)

                continue

            # ================= ACTIVE MODE =================

            # EXIT
            if any(x in command_lower for x in ["stop", "exit", "bye", "quit"]):
                is_activated = False
                speak("Goodbye! Say hello to activate me again.", current_command_id)
                continue

            # ================= STATIC FIRST =================
            static = get_static_response(command_lower)
            if static:
                print("🧠 Static:", static)
                speak(static, current_command_id)
                continue

            # ================= FEATURES =================
            if "weather" in command_lower:
                city = command_lower.replace("weather", "").replace("in", "").strip()
                if city:
                    get_weather(city, current_command_id)
                else:
                    speak("Please specify a city name.", current_command_id)
                continue

            elif "path" in command_lower:
                speak("Generating route map...", current_command_id)
                result = get_route_map_with_coords(
                    default_start[0], default_start[1],
                    default_end[0], default_end[1]
                )
                if result["success"]:
                    speak(f"Route generated. Distance {result['distance_km']} km. Time {result['duration_min']} minutes.", current_command_id)
                    socketio.emit('route_generated', result)
                continue

            elif "analyze" in command_lower or "analyse" in command_lower:
                speak("Analyzing drone images firstly you have to upload image from image section.", current_command_id)
                socketio.emit('analyze_images_request', {})
                continue

            # ================= GEMINI FALLBACK =================
            else:
                print("🤖 Fallback to Gemini")
                ask_gemini_with_context(command, current_command_id)

        except Exception as e:
            print("❌ Error:", e)
            socketio.emit('error', {'message': str(e)})
def start_voice_bot():
    global voice_loop
    voice_loop = asyncio.new_event_loop()
    voice_thread = threading.Thread(target=voice_bot_loop, daemon=True)
    voice_thread.start()
    logging.info("Voice bot started in background")
    socketio.emit('voice_status', {'status': 'started'})

# ==================== FLASK API ROUTES ====================
@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/style.css')
def serve_css():
    return send_from_directory(FRONTEND_DIR, 'style.css')

@app.route('/script.js')
def serve_js():
    return send_from_directory(FRONTEND_DIR, 'script.js')

@app.route('/analyze_frame', methods=['POST'])


def analyze_frame():
    try:
        data = request.json
        image_list = data.get("images", [])
        
        if not image_list:
            return jsonify({"error": "No image data received"}), 400

        model = genai.GenerativeModel("gemini-3-flash-preview")
        all_results = []

        for idx, image_data in enumerate(image_list):
            try:
                if ',' in image_data:
                    image_bytes = base64.b64decode(image_data.split(",")[1])
                else:
                    image_bytes = base64.b64decode(image_data)
                    
                image = Image.open(BytesIO(image_bytes))
                
                prompt = """You are an NDRF disaster response commander. Analyze this disaster image.

Provide analysis:

OBSERVATIONS:
- Damage assessment and hazards

IMMEDIATE ACTIONS:
- Priority rescue operations

TEAM REQUIRED:
- Personnel and specialized units needed

STRATEGY:
- Step-by-step rescue plan

EQUIPMENT NEEDED:
- Specific tools and supplies

RISK LEVEL: [LOW/MEDIUM/HIGH/CRITICAL]

Be direct and tactical."""

                response = model.generate_content([image, prompt])
                result = response.text if response.text else "Analysis unavailable"
                all_results.append(f"IMAGE {idx+1}\n{result}")

            except Exception as img_error:
                error_msg = str(img_error).lower()
                if "429" in error_msg or "quota" in error_msg:
                    all_results.append(f"IMAGE {idx+1}: ⚠️ AI limit reached. Try again later.")
                else:
                    all_results.append(f"IMAGE {idx+1}: ❌ Error processing image.")

        final_response = "\n\n" + "="*50 + "\n\n".join(all_results)
        return jsonify({"response": final_response})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/gemini', methods=['POST'])
@app.route('/gemini', methods=['POST'])
def gemini_query():
    try:
        data = request.json
        query = data.get("query", "")
        
        if not query:
            return jsonify({"response": "Please ask a question."}), 400
        
        print(f"🤖 Gemini Query: {query}")
        
        # Use a more reliable model
        model = genai.GenerativeModel("gemini-3-flash-preview")
        
        prompt = f"""You are an NDRF disaster response assistant. Provide a helpful, concise answer to this question: {query}
        
Answer in 1-2 sentences maximum. Be direct and useful."""
        
        response = model.generate_content(prompt)
        result = response.text if response.text else "I couldn't process that request."
        
        print(f"🤖 Gemini Response: {result[:100]}...")
        
        return jsonify({"response": result})
        
    except Exception as e:
        print(f"❌ Gemini Error: {e}")
        # Return a fallback response instead of crashing
        return jsonify({"response": "I'm having trouble connecting to the AI service. Please try again in a moment."}), 200

@app.route('/equipment_list', methods=['GET'])
def get_equipment_list():
    try:
        items = read_all_equipment()
        
        equipment_text = "="*60 + "\n"
        equipment_text += "NDRF EQUIPMENT INVENTORY\n"
        equipment_text += "="*60 + "\n\n"
        
        categories = {}
        for item in items:
            cat = item.get('Category', 'General')
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(f"  - {item.get('Item Name', 'Unknown')} (Qty: {item.get('Quantity', 0)})")
        
        for cat, cat_items in categories.items():
            equipment_text += f"\n[{cat}]\n"
            equipment_text += "\n".join(cat_items) + "\n"
        
        equipment_text += "\n" + "="*60 + "\n"
        equipment_text += f"Total: {len(items)} items, {len(categories)} categories\n"
        
        return jsonify({"equipment": equipment_text})
    except Exception as e:
        return jsonify({"equipment": f"Error: {str(e)}"}), 500

@app.route('/generate_route', methods=['POST'])

def generate_route_api():
    try:
        data = request.json
        start_lat = data.get('start_lat', default_start[0])
        start_lon = data.get('start_lon', default_start[1])
        end_lat = data.get('end_lat', default_end[0])
        end_lon = data.get('end_lon', default_end[1])
        
        result = get_route_map_with_coords(start_lat, start_lon, end_lat, end_lon)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/voice_command', methods=['POST'])
def voice_command_api():
    try:
        data = request.json
        command = data.get('command', '').lower()
        
        if not command:
            return jsonify({"error": "No command provided"}), 400
        
        global current_command_id
        current_command_id += 1
        
        # Process in background thread to avoid blocking
        threading.Thread(target=ask_gemini_with_context, args=(command, current_command_id)).start()
        
        return jsonify({"success": True, "command": command})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({
        "status": "ok",
        "message": "NDRF Base Station API Running",
        "voice_bot_active": True
    })

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(STATIC_DIR, filename)

# ==================== SOCKET.IO EVENTS ====================
@socketio.on('connect')
def handle_connect():
    socketio.emit('connected', {'message': 'Connected to NDRF Base Station'})

@socketio.on('voice_command')
def handle_voice_command(data):
    command = data.get('command', '').lower()
    if command:
        global current_command_id
        current_command_id += 1
        threading.Thread(target=ask_gemini_with_context, args=(command, current_command_id)).start()

@socketio.on('request_equipment')
def handle_equipment_request():
    items = read_all_equipment()
    socketio.emit('equipment_data', {'items': items})

# ==================== MAIN ENTRY POINT ====================
if __name__ == "__main__":
    # Suppress pygame welcome message
    os.environ['PYGAME_HIDE_SUPPORT_PROMPT'] = '1'
    
    print("="*70)
    print("NDRF/SDRF DISASTER RESPONSE BASE STATION v4.0")
    print("="*70)
    print(f"Web Server: http://localhost:5000")
    print(f"Frontend: {FRONTEND_DIR}")
    print("-"*70)
    print("FEATURES:")
    print("  - Live Camera Feed with Object Detection")
    print("  - AI Image Analysis (Gemini)")
    print("  - Equipment Database")
    print("  - Voice Assistant (Say 'hello' to activate)")
    print("  - Route Planning")
    print("="*70)
    print("")
    print("Starting server...")
    print("")
    
    # Start voice bot in background
   
    
    # Run Flask app with SocketIO
import os

port = int(os.environ.get("PORT", 10000))
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
