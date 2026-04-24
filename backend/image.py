from flask import Flask, request, jsonify
import google.generativeai as genai
import base64
from io import BytesIO
from PIL import Image
from flask_cors import CORS
import pandas as pd

app = Flask(__name__)
CORS(app)

genai.configure(api_key="AIzaSyBVZvmXQCvvodl9-dud5JVR1HjYduQzR_o")  


def read_all_equipment():
    equipment_files = ["earthquake_kit.xlsx", "flood_kit.xlsx", "mfr_equipment.xlsx"]
    all_items = [] 

    for file in equipment_files:
        try:
            df = pd.read_excel(file)
            if "Item Name" in df.columns and "Quantity" in df.columns:
                df["Category"] = file.replace(".xlsx", "").replace("_", " ").title()
                items = df.to_dict(orient="records")
                all_items.extend(items)
            else:
                print(f" Missing required columns in {file}")
        except Exception as e:
            print(f" Error reading {file}: {e}")
    
    return all_items

@app.route('/analyze_frame', methods=['POST'])
def analyze_frame():
    try:
        image_list = request.json.get("images", [])
        if not image_list:
            return jsonify({"error": "No image data received"}), 400

        location = request.json.get("location", {})
        latitude = location.get("latitude")
        longitude = location.get("longitude")

        location_text = ""
        if latitude and longitude:
            location_text = f"\n\nGPS Coordinates: Latitude {latitude}, Longitude {longitude}."

        model = genai.GenerativeModel("gemini-2.0-flash")
        all_results = []

        for idx, image_data in enumerate(image_list):
            try:
                image_bytes = base64.b64decode(image_data.split(",")[1])
                image = Image.open(BytesIO(image_bytes))
                
                prompt = f"""You are an AI assistant supporting the National Disaster Response Force (NDRF) in earthquake disaster response. 
Analyze this drone-captured image from the earthquake-affected area and give the output in exactly 6 separate lines (each line for one purpose). 
Write only professional bullet points as an NDRF team member. 
Follow this format:

1. Key observations of the area (damage, blocked roads, collapsed buildings, trapped people, fire, or flooding).  
2. Immediate safety summary in ONE short line including urgent action.  
3. Required team strength (how many members should be deployed).  
4. Suggested strategy or plan of action.  
5. Tools and equipment needed for this operation.  
6. Location data if visible or identifiable.

Do not add extra text or explanation outside these 6 bullet points.



{location_text}

Be direct and tactical — like a field rescue commander giving rapid instructions. NO asterisks.
Give only 3 lines.
"""

                response = model.generate_content([image, prompt])
                result = response.text if response.text else "No analysis returned."
                all_results.append(f"Image {idx+1}: {result.strip()}")

            except Exception as img_error:
                all_results.append(f"Image {idx+1}: Error analyzing image - {img_error}")

        final_response = "\n".join(all_results)
        return jsonify({"response": final_response})

    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route('/gemini', methods=['POST'])
def gemini_equipment_query():
    try:
        data = request.json
        query = data.get("query", "")

       
        items = read_all_equipment()

        if not items:
            return jsonify({"response": "No equipment data found to process your query."})

        equipment_list = ""
        for item in items:
            name = item.get("Item Name", "Unknown")
            qty = item.get("Quantity", 0)
            category = item.get("Category", "Unknown Kit")
            equipment_list += f"- {name} (Qty: {qty}), in {category}\n"

        
        prompt = f"""You are a professional assistant trained for disaster preparedness, especially for the National Disaster Response Force (NDRF).
The user asked: "{query}"

Here is the available equipment data:
{equipment_list}

Answer the query briefly and professionally. Do not include unnecessary lines. Keep the tone of a trained NDRF logistics assistant.
"""

        model = genai.GenerativeModel("gemini-3-flash-preview")
        response = model.generate_content(prompt)
        result = response.text if response.text else "No response generated."

        return jsonify({"response": result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
