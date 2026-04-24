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
import requests
from time import time
from math import radians, sin, cos, sqrt, atan2
import logging
import traceback

# Suppress warnings
import warnings
warnings.filterwarnings("ignore")

# ==================== FLASK APP INITIALIZATION ====================
app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# ==================== LOGGING ====================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# ==================== GET ABSOLUTE PATHS ====================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), 'frontend')
STATIC_DIR = os.path.join(os.path.dirname(BASE_DIR), 'static')
UPLOAD_DIR = os.path.join(os.path.dirname(BASE_DIR), 'uploads')

# Create directories
os.makedirs(FRONTEND_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

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

# ==================== EQUIPMENT FUNCTIONS ====================
def read_all_equipment():
    """Read equipment from Excel files or return comprehensive JSON database"""
    equipment_files = ["earthquake_kit.xlsx", "flood_kit.xlsx", "mfr_equipment.xlsx"]
    all_items = []
    
    for file in equipment_files:
        file_path = os.path.join(os.path.dirname(BASE_DIR), file)
        try:
            if os.path.exists(file_path):
                df = pd.read_excel(file_path)
                if "Item Name" in df.columns and "Quantity" in df.columns:
                    df["Category"] = file.replace(".xlsx", "").replace("_", " ").title()
                    items = df.to_dict(orient="records")
                    all_items.extend(items)
        except Exception as e:
            logging.error(f"Error reading {file}: {e}")
    
    # Comprehensive equipment database
    if not all_items:
        all_items = [
            # Water Rescue Equipment
            {"Item Name": "Rescue Boat (Inflatable)", "Quantity": 4, "Category": "Water Rescue"},
            {"Item Name": "Rescue Boat (Motorized)", "Quantity": 2, "Category": "Water Rescue"},
            {"Item Name": "Life Jacket (Adult)", "Quantity": 100, "Category": "Water Rescue"},
            {"Item Name": "Life Jacket (Child)", "Quantity": 50, "Category": "Water Rescue"},
            {"Item Name": "Throw Rope Bag", "Quantity": 30, "Category": "Water Rescue"},
            {"Item Name": "Water Rescue Rope 50m", "Quantity": 15, "Category": "Water Rescue"},
            {"Item Name": "De-watering Pump (4 inch)", "Quantity": 4, "Category": "Water Rescue"},
            {"Item Name": "De-watering Pump (6 inch)", "Quantity": 2, "Category": "Water Rescue"},
            {"Item Name": "Submersible Pump", "Quantity": 5, "Category": "Water Rescue"},
            {"Item Name": "Water Rescue Suit", "Quantity": 25, "Category": "Water Rescue"},
            {"Item Name": "Dry Suit (Cold Water)", "Quantity": 10, "Category": "Water Rescue"},
            {"Item Name": "Water Rescue Helmet", "Quantity": 30, "Category": "Water Rescue"},
            {"Item Name": "Swift Water Vest", "Quantity": 20, "Category": "Water Rescue"},
            
            # Medical Equipment
            {"Item Name": "Stretcher (Folding)", "Quantity": 15, "Category": "Medical"},
            {"Item Name": "Stretcher (Scoop)", "Quantity": 8, "Category": "Medical"},
            {"Item Name": "First Aid Kit (Basic)", "Quantity": 50, "Category": "Medical"},
            {"Item Name": "First Aid Kit (Advanced)", "Quantity": 20, "Category": "Medical"},
            {"Item Name": "AED (Defibrillator)", "Quantity": 4, "Category": "Medical"},
            {"Item Name": "Oxygen Cylinder", "Quantity": 10, "Category": "Medical"},
            {"Item Name": "BP Monitor", "Quantity": 15, "Category": "Medical"},
            {"Item Name": "Pulse Oximeter", "Quantity": 20, "Category": "Medical"},
            {"Item Name": "Stethoscope", "Quantity": 20, "Category": "Medical"},
            {"Item Name": "Cervical Collar Set", "Quantity": 30, "Category": "Medical"},
            {"Item Name": "Spine Board", "Quantity": 10, "Category": "Medical"},
            
            # Rope Rescue Equipment
            {"Item Name": "Rescue Rope (Static) 50m", "Quantity": 25, "Category": "Rope Rescue"},
            {"Item Name": "Rescue Rope (Static) 100m", "Quantity": 10, "Category": "Rope Rescue"},
            {"Item Name": "Carabiner (Screw Gate)", "Quantity": 100, "Category": "Rope Rescue"},
            {"Item Name": "Carabiner (Auto-locking)", "Quantity": 50, "Category": "Rope Rescue"},
            {"Item Name": "Descender (Figure 8)", "Quantity": 30, "Category": "Rope Rescue"},
            {"Item Name": "Ascender (Handled)", "Quantity": 25, "Category": "Rope Rescue"},
            {"Item Name": "Pulley (Rescue)", "Quantity": 40, "Category": "Rope Rescue"},
            {"Item Name": "Harness (Full Body)", "Quantity": 30, "Category": "Rope Rescue"},
            
            # Communication Equipment
            {"Item Name": "Two-Way Radio (VHF)", "Quantity": 30, "Category": "Communication"},
            {"Item Name": "Two-Way Radio (UHF)", "Quantity": 20, "Category": "Communication"},
            {"Item Name": "Satellite Phone", "Quantity": 5, "Category": "Communication"},
            {"Item Name": "Megaphone", "Quantity": 10, "Category": "Communication"},
            {"Item Name": "Whistle (Emergency)", "Quantity": 100, "Category": "Communication"},
            
            # Heavy Equipment
            {"Item Name": "Gas Cutter", "Quantity": 3, "Category": "Heavy Equipment"},
            {"Item Name": "Chain Saw", "Quantity": 5, "Category": "Heavy Equipment"},
            {"Item Name": "Generator (2kW)", "Quantity": 4, "Category": "Heavy Equipment"},
            {"Item Name": "Generator (5kW)", "Quantity": 2, "Category": "Heavy Equipment"},
            {"Item Name": "Flood Light (LED)", "Quantity": 10, "Category": "Heavy Equipment"},
            {"Item Name": "Search Light", "Quantity": 6, "Category": "Heavy Equipment"},
            {"Item Name": "Headlamp (LED)", "Quantity": 50, "Category": "Heavy Equipment"},
            
            # Relief Supplies
            {"Item Name": "Thermal Blanket", "Quantity": 500, "Category": "Relief"},
            {"Item Name": "Sleeping Bag", "Quantity": 100, "Category": "Relief"},
            {"Item Name": "Tent (Family Size)", "Quantity": 50, "Category": "Relief"},
            {"Item Name": "Tent (Relief Shelter)", "Quantity": 20, "Category": "Relief"},
            {"Item Name": "Water Purifier", "Quantity": 10, "Category": "Relief"},
            {"Item Name": "Food Packet", "Quantity": 2000, "Category": "Relief"},
            {"Item Name": "Water Bottle", "Quantity": 500, "Category": "Relief"},
            
            # Protective Gear
            {"Item Name": "Helmet (Rescue)", "Quantity": 50, "Category": "Protective Gear"},
            {"Item Name": "Safety Glasses", "Quantity": 100, "Category": "Protective Gear"},
            {"Item Name": "Rescue Gloves", "Quantity": 100, "Category": "Protective Gear"},
            {"Item Name": "N95 Mask", "Quantity": 1000, "Category": "Protective Gear"},
            {"Item Name": "Gas Mask", "Quantity": 25, "Category": "Protective Gear"},
            {"Item Name": "Safety Boots", "Quantity": 100, "Category": "Protective Gear"},
            {"Item Name": "High Visibility Vest", "Quantity": 150, "Category": "Protective Gear"},
            
            # Search & Rescue Equipment
            {"Item Name": "Thermal Imaging Camera", "Quantity": 3, "Category": "Search & Rescue"},
            {"Item Name": "Search Camera", "Quantity": 4, "Category": "Search & Rescue"},
            {"Item Name": "Drone (Quadcopter)", "Quantity": 2, "Category": "Search & Rescue"},
            {"Item Name": "Drone (Thermal)", "Quantity": 1, "Category": "Search & Rescue"},
            {"Item Name": "Search Pole", "Quantity": 10, "Category": "Search & Rescue"},
            {"Item Name": "Rescue Hook", "Quantity": 15, "Category": "Search & Rescue"},
            
            # Fire Rescue Equipment
            {"Item Name": "Fire Extinguisher (ABC)", "Quantity": 30, "Category": "Fire Rescue"},
            {"Item Name": "Fire Extinguisher (CO2)", "Quantity": 10, "Category": "Fire Rescue"},
            {"Item Name": "Fire Blanket", "Quantity": 20, "Category": "Fire Rescue"},
            {"Item Name": "Fire Hose", "Quantity": 5, "Category": "Fire Rescue"},
            
            # Tools
            {"Item Name": "Crowbar", "Quantity": 30, "Category": "Tools"},
            {"Item Name": "Sledgehammer", "Quantity": 15, "Category": "Tools"},
            {"Item Name": "Shovel", "Quantity": 50, "Category": "Tools"},
            {"Item Name": "Pickaxe", "Quantity": 20, "Category": "Tools"},
            {"Item Name": "Axe", "Quantity": 25, "Category": "Tools"},
        ]
    
    return all_items

# ==================== ROUTE FUNCTIONS ====================
def get_route_map_with_coords(start_lat, start_lon, end_lat, end_lon):
    """Generate route map with given coordinates"""
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
    """Generate fallback route when API fails"""
    center_lat = (start_lat + end_lat) / 2
    center_lon = (start_lon + end_lon) / 2
    route_map = folium.Map(location=[center_lat, center_lon], zoom_start=13)
    folium.PolyLine([[start_lat, start_lon], [end_lat, end_lon]], color="#00ff88", weight=3, opacity=0.7).add_to(route_map)
    folium.Marker([start_lat, start_lon], popup="Start Point", icon=folium.Icon(color="green")).add_to(route_map)
    folium.Marker([end_lat, end_lon], popup="End Point", icon=folium.Icon(color="red")).add_to(route_map)
    
    map_filename = os.path.join(STATIC_DIR, "shortest_route_map.html")
    route_map.save(map_filename)
    
    # Calculate approximate distance
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [start_lat, start_lon, end_lat, end_lon])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    distance = R * 2 * atan2(sqrt(a), sqrt(1-a))
    
    return {"success": True, "distance_km": round(distance, 2), "duration_min": round(distance * 2.5, 1), "map_url": "/static/shortest_route_map.html"}

# ==================== WEATHER FUNCTIONS ====================
def get_city_coordinates(city):
    geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1"
    try:
        response = requests.get(geo_url, timeout=10)
        data = response.json()
        if "results" in data and len(data["results"]) > 0:
            return data["results"][0]["latitude"], data["results"][0]["longitude"]
        return None, None
    except Exception as e:
        logging.error(f"Geocoding error: {e}")
        return None, None

def get_weather(city):
    """Fetch weather for a city"""
    latitude, longitude = get_city_coordinates(city)
    if latitude is None or longitude is None:
        return f"Sorry, I couldn't find coordinates for {city}."

    weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&current=temperature_2m,wind_speed_10m,precipitation,cloudcover"
    try:
        response = requests.get(weather_url, timeout=10)
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
        
        return weather_desc
    except Exception as e:
        logging.error(f"Weather API error: {e}")
        return "I couldn't fetch the weather data right now."

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

# ==================== IMAGE UPLOAD ROUTE ====================
@app.route('/upload_image', methods=['POST'])
def upload_image():
    """Handle image file upload directly and analyze with Gemini"""
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Read image file
        image_bytes = file.read()
        
        if not image_bytes:
            return jsonify({"error": "Empty image file"}), 400
        
        # Convert to base64 for preview
        image_data = base64.b64encode(image_bytes).decode('utf-8')
        image_preview = f"data:image/jpeg;base64,{image_data}"
        
        # Analyze the image with Gemini
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            prompt = """You are an NDRF disaster response commander. Analyze this disaster image.

Provide analysis in this format:

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

            image = Image.open(BytesIO(image_bytes))
            response = model.generate_content([image, prompt])
            result = response.text if response.text else "Analysis unavailable"
            
            return jsonify({
                "success": True,
                "analysis": result,
                "image_preview": image_preview
            })
            
        except Exception as gemini_error:
            logging.error(f"Gemini error: {gemini_error}")
            return jsonify({
                "success": True,
                "analysis": "Image received. AI analysis temporarily unavailable. Please try again later.",
                "image_preview": image_preview
            })
        
    except Exception as e:
        logging.error(f"Upload error: {e}")
        return jsonify({"error": str(e)}), 500

# ==================== ANALYZE FRAME ROUTE ====================
@app.route('/analyze_frame', methods=['POST'])
def analyze_frame():
    try:
        data = request.json
        image_list = data.get("images", [])
        
        if not image_list:
            return jsonify({"error": "No image data received"}), 400

        model = genai.GenerativeModel("gemini-1.5-flash")
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
                all_results.append(f"📸 IMAGE {idx+1}\n{result}")

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

# ==================== GEMINI QUERY ROUTE ====================
@app.route('/gemini', methods=['POST'])
def gemini_query():
    try:
        data = request.json
        query = data.get("query", "")
        
        if not query:
            return jsonify({"response": "Please ask a question."}), 400
        
        logging.info(f"Gemini Query: {query}")
        
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        prompt = f"""You are an NDRF disaster response assistant. Provide a helpful, concise answer to this question: {query}
        
Answer in 1-2 sentences maximum. Be direct and useful."""
        
        response = model.generate_content(prompt)
        result = response.text if response.text else "I couldn't process that request."
        
        return jsonify({"response": result})
        
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "quota" in error_msg:
            return jsonify({"response": "AI service is currently unavailable. Please try again later."}), 200
        else:
            logging.error(f"Gemini error: {e}")
            return jsonify({"response": "Error processing request."}), 200

# ==================== EQUIPMENT LIST ROUTE ====================
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
            categories[cat].append(f"  • {item.get('Item Name', 'Unknown')} (Qty: {item.get('Quantity', 0)})")
        
        for cat, cat_items in categories.items():
            equipment_text += f"\n📁 {cat}\n"
            equipment_text += "─"*40 + "\n"
            equipment_text += "\n".join(cat_items) + "\n"
        
        equipment_text += "\n" + "="*60 + "\n"
        equipment_text += f"📊 Total: {len(items)} items, {len(categories)} categories\n"
        
        return jsonify({"equipment": equipment_text})
    except Exception as e:
        return jsonify({"equipment": f"Error: {str(e)}"}), 500

# ==================== GENERATE ROUTE ROUTE ====================
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

# ==================== WEATHER ROUTE ====================
@app.route('/weather', methods=['POST'])
def weather_api():
    try:
        data = request.json
        city = data.get('city', '')
        if not city:
            return jsonify({"error": "No city provided"}), 400
        
        result = get_weather(city)
        return jsonify({"weather": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== PING ROUTE ====================
@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({
        "status": "ok",
        "message": "NDRF Base Station API Running"
    })

# ==================== STATIC FILES ====================
@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(STATIC_DIR, filename)

# ==================== SOCKET.IO EVENTS ====================
@socketio.on('connect')
def handle_connect():
    emit('connected', {'message': 'Connected to NDRF Base Station'})

@socketio.on('voice_command')
def handle_voice_command(data):
    command = data.get('command', '').lower()
    if command:
        emit('voice_response', {'command': command, 'status': 'received'})

@socketio.on('request_equipment')
def handle_equipment_request():
    items = read_all_equipment()
    emit('equipment_data', {'items': items})

# ==================== MAIN ENTRY POINT ====================
if __name__ == "__main__":
    print("\n" + "="*70)
    print("🚨 NDRF/SDRF DISASTER RESPONSE BASE STATION")
    print("="*70)
    print(f"📍 Web Server: http://localhost:5000")
    print(f"📁 Frontend: {FRONTEND_DIR}")
    print(f"📁 Static: {STATIC_DIR}")
    print("-"*70)
    print("✅ FEATURES:")
    print("  📹 Live Camera Feed with Object Detection")
    print("  🧠 AI Image Analysis (Gemini)")
    print("  📦 Equipment Database (70+ items)")
    print("  🗺️ Route Planning")
    print("  📸 Image Upload Analysis")
    print("  🌤️ Weather Information")
    print("="*70)
    print("\n💡 Open browser: http://localhost:5000")
    print("="*70 + "\n")
    
    socketio.run(app, host="0.0.0.0", port=5000, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)