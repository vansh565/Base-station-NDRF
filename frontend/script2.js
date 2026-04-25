// ==================== GLOBAL VARIABLES ====================
const socket = io("https://base-station-ndrf-7.onrender.com");
let model = null;
let cameraActive = false;
let stream = null;
let boxesVisible = true;
let humanOnly = false;
let recognition = null;
let listening = false;
let startTime = Date.now();

// DOM Elements
const video = document.getElementById('cameraVideo');
const dashVideo = document.getElementById('dashVideo');
const canvas = document.getElementById('cameraCanvas');
const dashCanvas = document.getElementById('dashCanvas');
const ctx = canvas?.getContext('2d');
const dashCtx = dashCanvas?.getContext('2d');

const API_BASE = "https://base-station-ndrf-7.onrender.com";

// ==================== EQUIPMENT DATABASE ====================
// ==================== PROFESSIONAL EQUIPMENT DATABASE ====================
const equipmentDatabase = [
    // ==================== WATER RESCUE EQUIPMENT ====================
    { id: 1, name: "Rescue Boat (Inflatable)", quantity: 6, category: "Water Rescue", subcategory: "Boats", description: "4-person inflatable rescue boat with oars, 15HP motor capable", status: "Available", location: "Warehouse A" },
    { id: 2, name: "Rescue Boat (Motorized)", quantity: 2, category: "Water Rescue", subcategory: "Boats", description: "Motorized rescue boat with 15HP engine, capacity 6 persons", status: "Available", location: "Dock Station" },
    { id: 3, name: "Life Jacket (Adult)", quantity: 250, category: "Water Rescue", subcategory: "Safety Gear", description: "ISO 12402 certified life jackets, buoyancy 150N", status: "Available", location: "Warehouse A" },
    { id: 4, name: "Life Jacket (Child)", quantity: 80, category: "Water Rescue", subcategory: "Safety Gear", description: "Child size life jackets, weight range 15-30kg", status: "Available", location: "Warehouse A" },
    { id: 5, name: "Throw Rope Bag", quantity: 45, category: "Water Rescue", subcategory: "Ropes", description: "25m floating throw rope with bag, 8mm diameter", status: "Available", location: "Warehouse B" },
    { id: 6, name: "Water Rescue Rope", quantity: 25, category: "Water Rescue", subcategory: "Ropes", description: "50m floating water rescue rope, 10mm diameter", status: "Available", location: "Warehouse B" },
    { id: 7, name: "De-watering Pump (4 inch)", quantity: 6, category: "Water Rescue", subcategory: "Pumps", description: "4-inch diesel de-watering pump, 1000 GPM", status: "Available", location: "Equipment Shed" },
    { id: 8, name: "De-watering Pump (6 inch)", quantity: 3, category: "Water Rescue", subcategory: "Pumps", description: "6-inch high-capacity pump, 2000 GPM", status: "Limited", location: "Equipment Shed" },
    { id: 9, name: "Submersible Pump", quantity: 8, category: "Water Rescue", subcategory: "Pumps", description: "Electric submersible pump, 2HP motor", status: "Available", location: "Warehouse C" },
    { id: 10, name: "Water Rescue Suit", quantity: 40, category: "Water Rescue", subcategory: "Protective Gear", description: "Neoprene water rescue suit, thermal protection", status: "Available", location: "Gear Room" },
    { id: 11, name: "Dry Suit (Cold Water)", quantity: 15, category: "Water Rescue", subcategory: "Protective Gear", description: "Thermal dry suit for cold water rescue, -10°C rating", status: "Available", location: "Gear Room" },
    { id: 12, name: "Water Rescue Helmet", quantity: 50, category: "Water Rescue", subcategory: "Protective Gear", description: "Water rescue helmet with visor and ear protection", status: "Available", location: "Gear Room" },
    { id: 13, name: "Swift Water Vest", quantity: 35, category: "Water Rescue", subcategory: "Safety Gear", description: "Swift water rescue vest with quick release", status: "Available", location: "Gear Room" },
    
    // ==================== MEDICAL EQUIPMENT ====================
    { id: 14, name: "Stretcher (Folding)", quantity: 25, category: "Medical", subcategory: "Evacuation", description: "Folding ambulance stretcher, lightweight aluminum", status: "Available", location: "Medical Bay" },
    { id: 15, name: "Stretcher (Scoop)", quantity: 12, category: "Medical", subcategory: "Evacuation", description: "Scoop stretcher for spinal injuries, X-ray compatible", status: "Available", location: "Medical Bay" },
    { id: 16, name: "First Aid Kit (Basic)", quantity: 100, category: "Medical", subcategory: "Kits", description: "Basic first aid kit for minor injuries, 50-piece kit", status: "Available", location: "Medical Bay" },
    { id: 17, name: "First Aid Kit (Advanced)", quantity: 35, category: "Medical", subcategory: "Kits", description: "Advanced trauma kit with tourniquets, bandages", status: "Available", location: "Medical Bay" },
    { id: 18, name: "Mass Casualty Kit", quantity: 8, category: "Medical", subcategory: "Kits", description: "Mass casualty medical kit for 100+ patients", status: "Available", location: "Medical Bay" },
    { id: 19, name: "AED (Defibrillator)", quantity: 8, category: "Medical", subcategory: "Equipment", description: "Automated External Defibrillator with pads", status: "Available", location: "Medical Bay" },
    { id: 20, name: "Oxygen Cylinder", quantity: 20, category: "Medical", subcategory: "Equipment", description: "Portable oxygen cylinder with regulator, 10L", status: "Available", location: "Medical Bay" },
    { id: 21, name: "BP Monitor (Digital)", quantity: 25, category: "Medical", subcategory: "Diagnostic", description: "Digital blood pressure monitor, automatic", status: "Available", location: "Medical Bay" },
    { id: 22, name: "Pulse Oximeter", quantity: 40, category: "Medical", subcategory: "Diagnostic", description: "Finger pulse oximeter for SpO2 monitoring", status: "Available", location: "Medical Bay" },
    { id: 23, name: "Glucometer", quantity: 20, category: "Medical", subcategory: "Diagnostic", description: "Blood glucose monitoring device with strips", status: "Available", location: "Medical Bay" },
    { id: 24, name: "Stethoscope", quantity: 35, category: "Medical", subcategory: "Diagnostic", description: "Professional dual-head stethoscope", status: "Available", location: "Medical Bay" },
    { id: 25, name: "Infrared Thermometer", quantity: 30, category: "Medical", subcategory: "Diagnostic", description: "Non-contact infrared thermometer", status: "Available", location: "Medical Bay" },
    { id: 26, name: "Cervical Collar Set", quantity: 60, category: "Medical", subcategory: "Spinal", description: "Adjustable cervical collars, various sizes", status: "Available", location: "Medical Bay" },
    { id: 27, name: "Spine Board", quantity: 20, category: "Medical", subcategory: "Spinal", description: "Long spine board with straps, X-ray lucent", status: "Available", location: "Medical Bay" },
    { id: 28, name: "Head Immobilizer", quantity: 30, category: "Medical", subcategory: "Spinal", description: "Head immobilizer for spine board", status: "Available", location: "Medical Bay" },
    { id: 29, name: "IV Kit", quantity: 50, category: "Medical", subcategory: "Supplies", description: "IV starter kit with fluids and tubing", status: "Available", location: "Medical Bay" },
    { id: 30, name: "Surgical Kit", quantity: 15, category: "Medical", subcategory: "Equipment", description: "Field surgical kit for emergencies", status: "Limited", location: "Medical Bay" },
    
    // ==================== ROPE RESCUE EQUIPMENT ====================
    { id: 31, name: "Static Rescue Rope 50m", quantity: 40, category: "Rope Rescue", subcategory: "Ropes", description: "Static rescue rope 11mm, 50m, 30kN strength", status: "Available", location: "Rope Room" },
    { id: 32, name: "Static Rescue Rope 100m", quantity: 15, category: "Rope Rescue", subcategory: "Ropes", description: "Static rescue rope 11mm, 100m, 30kN", status: "Available", location: "Rope Room" },
    { id: 33, name: "Dynamic Rope 50m", quantity: 20, category: "Rope Rescue", subcategory: "Ropes", description: "Dynamic rope for climbing rescues", status: "Available", location: "Rope Room" },
    { id: 34, name: "Screw Gate Carabiner", quantity: 200, category: "Rope Rescue", subcategory: "Hardware", description: "Screw gate carabiner, 25kN rating", status: "Available", location: "Rope Room" },
    { id: 35, name: "Auto-locking Carabiner", quantity: 100, category: "Rope Rescue", subcategory: "Hardware", description: "Auto-locking carabiner, 25kN", status: "Available", location: "Rope Room" },
    { id: 36, name: "Figure 8 Descender", quantity: 50, category: "Rope Rescue", subcategory: "Descenders", description: "Figure 8 descender device", status: "Available", location: "Rope Room" },
    { id: 37, name: "Rack Descender", quantity: 25, category: "Rope Rescue", subcategory: "Descenders", description: "Rack descender for SRT rescue", status: "Available", location: "Rope Room" },
    { id: 38, name: "Handled Ascender", quantity: 45, category: "Rope Rescue", subcategory: "Ascenders", description: "Handled ascender for rope climbing", status: "Available", location: "Rope Room" },
    { id: 39, name: "Chest Ascender", quantity: 25, category: "Rope Rescue", subcategory: "Ascenders", description: "Chest ascender for SRT systems", status: "Available", location: "Rope Room" },
    { id: 40, name: "Rescue Pulley", quantity: 60, category: "Rope Rescue", subcategory: "Pulleys", description: "Rescue pulley, 36kN rating, ball bearings", status: "Available", location: "Rope Room" },
    { id: 41, name: "Edge Protector", quantity: 35, category: "Rope Rescue", subcategory: "Protection", description: "Edge protector for rope protection", status: "Available", location: "Rope Room" },
    { id: 42, name: "Rope Grab", quantity: 40, category: "Rope Rescue", subcategory: "Hardware", description: "Rope grab for tensioned systems", status: "Available", location: "Rope Room" },
    { id: 43, name: "Full Body Harness", quantity: 60, category: "Rope Rescue", subcategory: "Harnesses", description: "Full body rescue harness, adjustable", status: "Available", location: "Rope Room" },
    { id: 44, name: "Seat Harness", quantity: 35, category: "Rope Rescue", subcategory: "Harnesses", description: "Seat harness for rope access", status: "Available", location: "Rope Room" },
    
    // ==================== COMMUNICATION EQUIPMENT ====================
    { id: 45, name: "VHF Handheld Radio", quantity: 60, category: "Communication", subcategory: "Radios", description: "VHF handheld two-way radio, 5W, waterproof", status: "Available", location: "Comm Center" },
    { id: 46, name: "UHF Handheld Radio", quantity: 40, category: "Communication", subcategory: "Radios", description: "UHF handheld two-way radio, 5W", status: "Available", location: "Comm Center" },
    { id: 47, name: "Base Station Radio", quantity: 6, category: "Communication", subcategory: "Radios", description: "Base station radio for command center", status: "Available", location: "Comm Center" },
    { id: 48, name: "Satellite Phone", quantity: 10, category: "Communication", subcategory: "Satellite", description: "Satellite phone for remote areas, global coverage", status: "Available", location: "Comm Center" },
    { id: 49, name: "Portable Repeater", quantity: 4, category: "Communication", subcategory: "Repeaters", description: "Portable radio repeater system, 20km range", status: "Available", location: "Comm Center" },
    { id: 50, name: "Megaphone", quantity: 15, category: "Communication", subcategory: "Public Address", description: "Battery-powered megaphone, 1km range", status: "Available", location: "Comm Center" },
    { id: 51, name: "Emergency Whistle", quantity: 200, category: "Communication", subcategory: "Signaling", description: "Emergency whistle with lanyard, 120dB", status: "Available", location: "Comm Center" },
    { id: 52, name: "Signal Mirror", quantity: 50, category: "Communication", subcategory: "Signaling", description: "Glass signal mirror for daylight signaling", status: "Available", location: "Comm Center" },
    
    // ==================== HEAVY EQUIPMENT ====================
    { id: 53, name: "Gas Cutter", quantity: 6, category: "Heavy Equipment", subcategory: "Cutting", description: "Portable gas cutting torch set", status: "Available", location: "Tool Shed" },
    { id: 54, name: "Chain Saw (Gas)", quantity: 10, category: "Heavy Equipment", subcategory: "Cutting", description: "Gas-powered chain saw for trees/debris, 20\" bar", status: "Available", location: "Tool Shed" },
    { id: 55, name: "Concrete Cutter", quantity: 4, category: "Heavy Equipment", subcategory: "Cutting", description: "Gas-powered concrete cutter, 14\" blade", status: "Limited", location: "Tool Shed" },
    { id: 56, name: "Generator (2kW)", quantity: 8, category: "Heavy Equipment", subcategory: "Power", description: "2kW portable generator, silent type", status: "Available", location: "Power House" },
    { id: 57, name: "Generator (5kW)", quantity: 4, category: "Heavy Equipment", subcategory: "Power", description: "5kW portable generator, diesel", status: "Available", location: "Power House" },
    { id: 58, name: "Generator (10kW)", quantity: 2, category: "Heavy Equipment", subcategory: "Power", description: "10kW industrial generator", status: "Available", location: "Power House" },
    { id: 59, name: "LED Flood Light", quantity: 20, category: "Heavy Equipment", subcategory: "Lighting", description: "LED flood light for night operations, 10,000 lumens", status: "Available", location: "Tool Shed" },
    { id: 60, name: "Search Light", quantity: 12, category: "Heavy Equipment", subcategory: "Lighting", description: "Portable high-intensity search light, 5000 lumens", status: "Available", location: "Tool Shed" },
    { id: 61, name: "LED Headlamp", quantity: 100, category: "Heavy Equipment", subcategory: "Lighting", description: "LED headlamp for hands-free lighting, 300 lumens", status: "Available", location: "Tool Shed" },
    
    // ==================== RELIEF SUPPLIES ====================
    { id: 62, name: "Thermal Blanket", quantity: 1000, category: "Relief", subcategory: "Blankets", description: "Mylar thermal blanket for hypothermia prevention", status: "Available", location: "Relief Warehouse" },
    { id: 63, name: "Sleeping Bag (Cold)", quantity: 200, category: "Relief", subcategory: "Bedding", description: "Cold weather sleeping bag, -10°C rating", status: "Available", location: "Relief Warehouse" },
    { id: 64, name: "Family Tent", quantity: 100, category: "Relief", subcategory: "Shelter", description: "Family size tent for 4-6 persons", status: "Available", location: "Relief Warehouse" },
    { id: 65, name: "Relief Shelter", quantity: 30, category: "Relief", subcategory: "Shelter", description: "Large relief shelter for 50+ persons", status: "Available", location: "Relief Warehouse" },
    { id: 66, name: "Water Purifier", quantity: 20, category: "Relief", subcategory: "Water", description: "Portable water purifier, 1000L/day capacity", status: "Available", location: "Relief Warehouse" },
    { id: 67, name: "Water Tank (1000L)", quantity: 10, category: "Relief", subcategory: "Water", description: "Collapsible water storage tank, 1000L", status: "Available", location: "Relief Warehouse" },
    { id: 68, name: "Emergency Food Packet", quantity: 5000, category: "Relief", subcategory: "Food", description: "Emergency food ration packet, 2000 calories", status: "Available", location: "Relief Warehouse" },
    { id: 69, name: "Reusable Water Bottle", quantity: 1000, category: "Relief", subcategory: "Water", description: "Reusable water bottle with filter", status: "Available", location: "Relief Warehouse" },
    { id: 70, name: "Hygiene Kit", quantity: 500, category: "Relief", subcategory: "Hygiene", description: "Complete hygiene kit with soap, toothbrush, sanitizer", status: "Available", location: "Relief Warehouse" },
    
    // ==================== PROTECTIVE GEAR ====================
    { id: 71, name: "Rescue Helmet", quantity: 100, category: "Protective Gear", subcategory: "Head", description: "Multi-purpose rescue helmet, ANSI certified", status: "Available", location: "Gear Room" },
    { id: 72, name: "Safety Glasses", quantity: 200, category: "Protective Gear", subcategory: "Eye", description: "Impact-resistant safety glasses", status: "Available", location: "Gear Room" },
    { id: 73, name: "Rescue Gloves", quantity: 200, category: "Protective Gear", subcategory: "Hand", description: "Cut-resistant rescue gloves, Level 5 protection", status: "Available", location: "Gear Room" },
    { id: 74, name: "Medical Gloves", quantity: 1000, category: "Protective Gear", subcategory: "Hand", description: "Medical examination gloves, nitrile", status: "Available", location: "Medical Bay" },
    { id: 75, name: "N95 Mask", quantity: 2000, category: "Protective Gear", subcategory: "Respiratory", description: "N95 respirator mask, NIOSH approved", status: "Available", location: "Medical Bay" },
    { id: 76, name: "Gas Mask", quantity: 50, category: "Protective Gear", subcategory: "Respiratory", description: "Full-face gas mask with filters, CBRN rated", status: "Available", location: "Gear Room" },
    { id: 77, name: "Safety Boots", quantity: 200, category: "Protective Gear", subcategory: "Foot", description: "Steel toe safety boots, slip resistant", status: "Available", location: "Gear Room" },
    { id: 78, name: "High Vis Vest", quantity: 300, category: "Protective Gear", subcategory: "Visibility", description: "High visibility safety vest, Class 3", status: "Available", location: "Gear Room" },
    { id: 79, name: "Body Armor", quantity: 30, category: "Protective Gear", subcategory: "Body", description: "Protective body armor vest, Level IIIA", status: "Limited", location: "Gear Room" },
    
    // ==================== SEARCH & RESCUE ====================
    { id: 80, name: "Thermal Camera", quantity: 6, category: "Search & Rescue", subcategory: "Detection", description: "Handheld thermal imaging camera, 640x480", status: "Available", location: "Tech Room" },
    { id: 81, name: "Search Camera", quantity: 8, category: "Search & Rescue", subcategory: "Detection", description: "Cable search camera for confined spaces, 30m", status: "Available", location: "Tech Room" },
    { id: 82, name: "Vibration Detector", quantity: 6, category: "Search & Rescue", subcategory: "Detection", description: "Seismic vibration detector for trapped persons", status: "Available", location: "Tech Room" },
    { id: 83, name: "Acoustic Listener", quantity: 6, category: "Search & Rescue", subcategory: "Detection", description: "Acoustic listening device for rescue", status: "Available", location: "Tech Room" },
    { id: 84, name: "Quadcopter Drone", quantity: 5, category: "Search & Rescue", subcategory: "Aerial", description: "Quadcopter drone with 4K camera, 30min flight", status: "Available", location: "Tech Room" },
    { id: 85, name: "Thermal Drone", quantity: 2, category: "Search & Rescue", subcategory: "Aerial", description: "Thermal drone for night search operations", status: "Available", location: "Tech Room" },
    { id: 86, name: "Search Pole", quantity: 20, category: "Search & Rescue", subcategory: "Tools", description: "Extendable search pole with hook, 6m", status: "Available", location: "Tool Shed" },
    { id: 87, name: "Rescue Hook", quantity: 30, category: "Search & Rescue", subcategory: "Tools", description: "Multi-purpose rescue hook, 2m length", status: "Available", location: "Tool Shed" },
    
    // ==================== FIRE RESCUE ====================
    { id: 88, name: "Fire Extinguisher (ABC)", quantity: 60, category: "Fire Rescue", subcategory: "Extinguishers", description: "ABC type fire extinguisher, 6kg", status: "Available", location: "Fire Station" },
    { id: 89, name: "Fire Extinguisher (CO2)", quantity: 20, category: "Fire Rescue", subcategory: "Extinguishers", description: "CO2 fire extinguisher for electrical fires", status: "Available", location: "Fire Station" },
    { id: 90, name: "Fire Blanket", quantity: 40, category: "Fire Rescue", subcategory: "Blankets", description: "Fire blanket for small fires, 1.8m x 1.8m", status: "Available", location: "Fire Station" },
    { id: 91, name: "Fire Hose (50m)", quantity: 10, category: "Fire Rescue", subcategory: "Hoses", description: "50m fire hose with couplings, 2.5\" diameter", status: "Available", location: "Fire Station" },
    { id: 92, name: "Fire Nozzle", quantity: 20, category: "Fire Rescue", subcategory: "Nozzles", description: "Adjustable fire fighting nozzle, 250 GPM", status: "Available", location: "Fire Station" },
    { id: 93, name: "Firefighter Turnout Gear", quantity: 20, category: "Fire Rescue", subcategory: "Protective Gear", description: "Complete firefighter protective gear, NFPA certified", status: "Available", location: "Fire Station" },
    { id: 94, name: "SCBA Set", quantity: 15, category: "Fire Rescue", subcategory: "Breathing", description: "Self-contained breathing apparatus, 45min", status: "Available", location: "Fire Station" },
    
    // ==================== TOOLS ====================
    { id: 95, name: "Crowbar", quantity: 60, category: "Tools", subcategory: "Prying", description: "60cm crowbar for debris removal", status: "Available", location: "Tool Shed" },
    { id: 96, name: "Sledgehammer", quantity: 30, category: "Tools", subcategory: "Breaking", description: "4kg sledgehammer for breaking", status: "Available", location: "Tool Shed" },
    { id: 97, name: "Collapsible Shovel", quantity: 100, category: "Tools", subcategory: "Digging", description: "Collapsible shovel for digging", status: "Available", location: "Tool Shed" },
    { id: 98, name: "Pickaxe", quantity: 40, category: "Tools", subcategory: "Digging", description: "Pickaxe for debris", status: "Available", location: "Tool Shed" },
    { id: 99, name: "Fireman's Axe", quantity: 50, category: "Tools", subcategory: "Cutting", description: "Fireman's axe for rescue, forged steel", status: "Available", location: "Tool Shed" },
    { id: 100, name: "Multitool Kit", quantity: 150, category: "Tools", subcategory: "Multi-purpose", description: "Professional multitool with pliers, knife, screwdrivers", status: "Available", location: "Tool Shed" }
];

// ==================== SEARCH EQUIPMENT FUNCTION ====================
function searchEquipment(query) {
    if (!query || query.trim() === "") {
        displayAllEquipment();
        return;
    }

    const searchTerm = query.toLowerCase().trim();
    const results = equipmentDatabase.filter(item => 
        item.name.toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm) ||
        item.subcategory.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm) ||
        item.status.toLowerCase().includes(searchTerm) ||
        item.location.toLowerCase().includes(searchTerm)
    );
    
    displayEquipmentResults(results, searchTerm);
    speak(`Found ${results.length} items matching ${searchTerm}`);
}

function displayAllEquipment() {
    displayEquipmentResults(equipmentDatabase, "all");
    speak(`Total ${equipmentDatabase.length} equipment items in database`);
}

function displayEquipmentResults(results, searchTerm) {
    const container = document.getElementById('equipResults');
    if (!container) return;
    
    if (results.length === 0) {
        container.innerHTML = `
            <div class="equip-idle" style="text-align: center; padding: 40px;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <h3 style="color: #dc2626; margin-top: 15px;">No Results Found</h3>
                <p style="color: #8a9bae;">No equipment matching "${searchTerm}"</p>
                <p style="color: #5a6e7a; font-size: 12px; margin-top: 10px;">Try: boat, medical, rope, radio, stretcher, drone, generator</p>
            </div>
        `;
        return;
    }
    
    // Group by category
    const grouped = {};
    results.forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
    });
    
    let html = `
        <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                <div>
                    <span style="color: #2ecc71; font-size: 14px;">🔍 Search Results</span>
                    <span style="color: #8a9bae; margin-left: 10px;">Found ${results.length} item(s)</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <span style="background: #1a3c2c; padding: 4px 12px; border-radius: 20px; font-size: 11px; color: #2ecc71;">✓ Available: ${results.filter(i => i.status === "Available").length}</span>
                    <span style="background: #3c2a1a; padding: 4px 12px; border-radius: 20px; font-size: 11px; color: #f39c12;">⚠ Limited: ${results.filter(i => i.status === "Limited").length}</span>
                </div>
            </div>
    `;
    
    for (const [category, items] of Object.entries(grouped)) {
        const categoryColors = {
            "Water Rescue": "#00aaff",
            "Medical": "#dc2626",
            "Rope Rescue": "#f39c12",
            "Communication": "#3b82f6",
            "Heavy Equipment": "#8b5cf6",
            "Relief": "#10b981",
            "Protective Gear": "#ec4899",
            "Search & Rescue": "#06b6d4",
            "Fire Rescue": "#ef4444",
            "Tools": "#6b7280"
        };
        const catColor = categoryColors[category] || "#2ecc71";
        
        html += `
            <div style="margin-bottom: 25px; background: rgba(15, 17, 26, 0.5); border-radius: 12px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.1)); padding: 12px 16px; border-bottom: 1px solid rgba(46, 204, 113, 0.2);">
                    <span style="color: ${catColor}; font-size: 14px; font-weight: bold;">📁 ${category}</span>
                    <span style="color: #5a6e7a; margin-left: 10px; font-size: 11px;">${items.length} items</span>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: #0a0c12; border-bottom: 1px solid #2ecc71;">
                                <th style="padding: 12px 10px; text-align: left; color: #8a9bae;">Item Name</th>
                                <th style="padding: 12px 10px; text-align: center; color: #8a9bae;">Qty</th>
                                <th style="padding: 12px 10px; text-align: left; color: #8a9bae;">Subcategory</th>
                                <th style="padding: 12px 10px; text-align: left; color: #8a9bae;">Description</th>
                                <th style="padding: 12px 10px; text-align: center; color: #8a9bae;">Status</th>
                                <th style="padding: 12px 10px; text-align: left; color: #8a9bae;">Location</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        items.forEach(item => {
            const statusColor = item.status === "Available" ? "#2ecc71" : "#f39c12";
            const statusText = item.status === "Available" ? "✓ Available" : "⚠ Limited";
            
            html += `
                <tr style="border-bottom: 1px solid #1a2c22; transition: background 0.2s;" onmouseover="this.style.background='rgba(46,204,113,0.05)'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 12px 10px; color: #c8d1e6; font-weight: 500;">${item.name}</td>
                    <td style="padding: 12px 10px; text-align: center; color: #2ecc71; font-weight: bold;">${item.quantity}</td>
                    <td style="padding: 12px 10px; color: #8a9bae;">${item.subcategory}</td>
                    <td style="padding: 12px 10px; color: #5a6e7a; font-size: 11px;">${item.description}</td>
                    <td style="padding: 12px 10px; text-align: center;">
                        <span style="background: ${statusColor}20; color: ${statusColor}; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: bold;">${statusText}</span>
                    </td>
                    <td style="padding: 12px 10px; color: #6b7280; font-size: 11px;">📍 ${item.location}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    container.innerHTML = html;
    
    // Update dashboard stats
    const totalItems = equipmentDatabase.reduce((sum, item) => sum + item.quantity, 0);
    const categories = [...new Set(equipmentDatabase.map(i => i.category))];
    document.getElementById('dashEquipCount').innerHTML = `<span style="font-size: 24px;">${equipmentDatabase.length}</span>`;
    document.getElementById('dashCatCount').innerHTML = `<span style="font-size: 24px;">${categories.length}</span>`;
}

function loadEquipment() {
    displayAllEquipment();
}

// ==================== DOCUMENTATION FUNCTION ====================
window.showDocumentation = function() {
    console.log("Documentation button clicked!");
    
     
   const docHtml = `
    <div style="background: linear-gradient(135deg, #0f111a 0%, #0a0c12 100%); border-radius: 16px; padding: 25px; border: 1px solid rgba(46, 204, 113, 0.3);">
        
        <!-- Header with System Overview -->
        <div style="border-bottom: 1px solid rgba(46, 204, 113, 0.2); padding-bottom: 20px; margin-bottom: 20px;">
            <h3 style="color: #2ecc71; font-family: 'Orbitron', monospace; font-size: 18px; letter-spacing: 2px; text-align: center; margin-bottom: 10px;">
                 NDRF / SDRF COMMAND CENTER v3.0
            </h3>
            <p style="color: #8a9bae; text-align: center; font-size: 13px; margin-bottom: 15px;">
                Real-Time Disaster Response Management System
            </p>
            
            <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 15px; margin-top: 10px;">
                <h4 style="color: #2ecc71; font-size: 13px; margin-bottom: 10px;"> SYSTEM CAPABILITIES</h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 12px;">
                    <div style="color: #c8d1e6;"> <span style="color: #2ecc71;">Live Camera Feed</span> - Real-time object detection with YOLO/COCO-SSD</div>
                    <div style="color: #c8d1e6;"> <span style="color: #2ecc71;">AI Image Analysis</span> - Gemini-powered disaster assessment</div>
                    <div style="color: #c8d1e6;"> <span style="color: #2ecc71;">Route Planning</span> - Shortest path generation for rescue operations</div>
                    <div style="color: #c8d1e6;"> <span style="color: #2ecc71;">Equipment Database</span> - Searchable inventory of rescue gear</div>
                    <div style="color: #c8d1e6;"> <span style="color: #2ecc71;">Voice Commands</span> - Hands-free operation using speech recognition</div>
                    <div style="color: #c8d1e6;"> <span style="color: #2ecc71;">Weather Updates</span> - Real-time weather for any location</div>
                    <div style="color: #c8d1e6;"> <span style="color: #2ecc71;">Website Integration</span> - Quick access to essential web services</div>
                    <div style="color: #c8d1e6;"> <span style="color: #2ecc71;">System Logs</span> - Real-time activity monitoring</div>
                </div>
            </div>
        </div>
        
        <!-- Voice Commands Section -->
        <div style="margin-bottom: 20px;">
            <h4 style="color: #3b82f6; font-size: 14px; margin-bottom: 12px; border-left: 3px solid #3b82f6; padding-left: 10px;">
                🎤 VOICE COMMAND REFERENCE
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 8px;">
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;">
                    <code style="color: #2ecc71;">"hello" / "hey"</code>
                    <span style="color: #5a6e7a; font-size: 11px; display: block;">Activate voice assistant</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;">
                    <code style="color: #2ecc71;">"show route" / "shortest path"</code>
                    <span style="color: #5a6e7a; font-size: 11px; display: block;">Generate rescue route map</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;">
                    <code style="color: #2ecc71;">"start camera"</code>
                    <span style="color: #5a6e7a; font-size: 11px; display: block;">Activate live camera feed with detection</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;">
                    <code style="color: #2ecc71;">"stop camera"</code>
                    <span style="color: #5a6e7a; font-size: 11px; display: block;">Deactivate camera feed</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;">
                    <code style="color: #2ecc71;">"search equipment [item]"</code>
                    <span style="color: #5a6e7a; font-size: 11px; display: block;">Search rescue equipment database</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;">
                    <code style="color: #2ecc71;">"weather in [city]"</code>
                    <span style="color: #5a6e7a; font-size: 11px; display: block;">Get current weather conditions</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;">
                    <code style="color: #2ecc71;">"analyze image"</code>
                    <span style="color: #5a6e7a; font-size: 11px; display: block;">Open AI disaster image analysis</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;">
                    <code style="color: #2ecc71;">"stop listening"</code>
                    <span style="color: #5a6e7a; font-size: 11px; display: block;">Deactivate voice recognition</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;">
                    <code style="color: #2ecc71;">"human only mode"</code>
                    <span style="color: #5a6e7a; font-size: 11px; display: block;">Filter detections to humans only</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;">
                    <code style="color: #2ecc71;">"help" / "documentation"</code>
                    <span style="color: #5a6e7a; font-size: 11px; display: block;">Display this reference guide</span>
                </div>
            </div>
        </div>
        
        <!-- Equipment Search Section -->
        <div style="margin-bottom: 20px;">
            <h4 style="color: #3b82f6; font-size: 14px; margin-bottom: 12px; border-left: 3px solid #3b82f6; padding-left: 10px;">
                🔍 EQUIPMENT SEARCH EXAMPLES
            </h4>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <div style="background: rgba(0,0,0,0.3); border-radius: 20px; padding: 6px 15px;">
                    <span style="color: #2ecc71;">"search equipment boat"</span>
                    <span style="color: #5a6e7a; font-size: 11px;"> → Rescue boats (6 available)</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 20px; padding: 6px 15px;">
                    <span style="color: #2ecc71;">"search equipment medical"</span>
                    <span style="color: #5a6e7a; font-size: 11px;"> → Medical supplies (70+ items)</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 20px; padding: 6px 15px;">
                    <span style="color: #2ecc71;">"search equipment rope"</span>
                    <span style="color: #5a6e7a; font-size: 11px;"> → Rope rescue gear (35+ items)</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 20px; padding: 6px 15px;">
                    <span style="color: #2ecc71;">"search equipment radio"</span>
                    <span style="color: #5a6e7a; font-size: 11px;"> → Communication devices (50+ units)</span>
                </div>
            </div>
        </div>
        
        <!-- Quick Commands Grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
            <div style="text-align: center; padding: 12px; background: rgba(0,0,0,0.3); border-radius: 12px;">
                <div style="color: #2ecc71; font-size: 24px;">🎤</div>
                <div style="color: #c8d1e6; font-size: 11px;">Voice Control</div>
                <div style="color: #5a6e7a; font-size: 9px;">Hands-free operation</div>
            </div>
            <div style="text-align: center; padding: 12px; background: rgba(0,0,0,0.3); border-radius: 12px;">
                <div style="color: #2ecc71; font-size: 24px;">🗺️</div>
                <div style="color: #c8d1e6; font-size: 11px;">Route Planning</div>
                <div style="color: #5a6e7a; font-size: 9px;">Shortest path generation</div>
            </div>
            <div style="text-align: center; padding: 12px; background: rgba(0,0,0,0.3); border-radius: 12px;">
                <div style="color: #2ecc71; font-size: 24px;">📸</div>
                <div style="color: #c8d1e6; font-size: 11px;">AI Analysis</div>
                <div style="color: #5a6e7a; font-size: 9px;">Disaster image assessment</div>
            </div>
            <div style="text-align: center; padding: 12px; background: rgba(0,0,0,0.3); border-radius: 12px;">
                <div style="color: #2ecc71; font-size: 24px;">📦</div>
                <div style="color: #c8d1e6; font-size: 11px;">Equipment DB</div>
                <div style="color: #5a6e7a; font-size: 9px;">Rescue gear inventory</div>
            </div>
        </div>
        
        <!-- General Questions -->
        <div style="margin-bottom: 20px;">
            <h4 style="color: #3b82f6; font-size: 14px; margin-bottom: 12px; border-left: 3px solid #3b82f6; padding-left: 10px;">
                 GENERAL KNOWLEDGE QUERIES
            </h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px 12px;"><span style="color: #2ecc71;">"who are you"</span> <span style="color: #5a6e7a;">- Assistant introduction</span></div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px 12px;"><span style="color: #2ecc71;">"what can you do"</span> <span style="color: #5a6e7a;">- Feature list</span></div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px 12px;"><span style="color: #2ecc71;">"what is NDRF"</span> <span style="color: #5a6e7a;">- About National Disaster Response Force</span></div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px 12px;"><span style="color: #2ecc71;">"drone status"</span> <span style="color: #5a6e7a;">- Drone operational info</span></div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px 12px;"><span style="color: #2ecc71;">"time" / "date"</span> <span style="color: #5a6e7a;">- Current time and date</span></div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px 12px;"><span style="color: #2ecc71;">"thank you"</span> <span style="color: #5a6e7a;">- Acknowledgment</span></div>
            </div>
        </div>
        
        <!-- Website Commands -->
        <div style="margin-bottom: 20px;">
            <h4 style="color: #3b82f6; font-size: 14px; margin-bottom: 12px; border-left: 3px solid #3b82f6; padding-left: 10px;">
                🌐 QUICK WEBSITE ACCESS
            </h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px 12px;"><span style="color: #2ecc71;">"open google"</span> <span style="color: #5a6e7a;">- Google Search</span></div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px 12px;"><span style="color: #2ecc71;">"open youtube"</span> <span style="color: #5a6e7a;">- YouTube</span></div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px 12px;"><span style="color: #2ecc71;">"open gmail"</span> <span style="color: #5a6e7a;">- Gmail</span></div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px 12px;"><span style="color: #2ecc71;">"open maps"</span> <span style="color: #5a6e7a;">- Google Maps</span></div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px 12px;"><span style="color: #2ecc71;">"open github"</span> <span style="color: #5a6e7a;">- GitHub</span></div>
            </div>
        </div>
        
        <!-- Footer Tips -->
        <div style="background: linear-gradient(135deg, #0f111a 0%, #0a0c12 100%); border-radius: 12px; padding: 15px; text-align: center; border: 1px solid rgba(46, 204, 113, 0.2);">
            <div style="display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap;">
                <div>
                    <span style="color: #2ecc71;"> PRO TIP</span>
                    <span style="color: #8a9bae; font-size: 12px; display: block;">Click "Start Listening" for hands-free voice control</span>
                </div>
                <div style="width: 1px; height: 30px; background: rgba(46,204,113,0.2);"></div>
                <div>
                    <span style="color: #2ecc71;"> SHORTCUT</span>
                    <span style="color: #8a9bae; font-size: 12px; display: block;">Type commands directly in text box</span>
                </div>
                <div style="width: 1px; height: 30px; background: rgba(46,204,113,0.2);"></div>
                <div>
                    <span style="color: #2ecc71;"> UPDATE</span>
                    <span style="color: #8a9bae; font-size: 12px; display: block;">Equipment database auto-refreshes</span>
                </div>
            </div>
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(46,204,113,0.1); color: #5a6e7a; font-size: 10px;">
                © 2024 NDRF Command Center | Real-Time Disaster Response System | Version 3.0
            </div>
        </div>
    </div>
`;
    const responseDiv = document.getElementById('commandResponse');
    if (responseDiv) {
        responseDiv.innerHTML = docHtml;
        console.log("Documentation displayed successfully!");
    } else {
        console.log("commandResponse element not found!");
        alert("Documentation: Say 'hello', 'show route', 'search equipment boat', 'start camera', 'stop camera'");
    }
    
    // Also speak
    const utterance = new SpeechSynthesisUtterance("Here is the documentation of all available commands.");
    utterance.rate = 1;
    utterance.lang = "en-IN";
    window.speechSynthesis.speak(utterance);
};

// ==================== STATIC RESPONSES ====================
const staticResponses = {
    "hello": "Hello! I am Fateh, your NDRF assistant. How can I help you?",
    "hey": "Hey there! How can I assist you?",
    "who are you": "I am Fateh, your NDRF disaster response assistant.",
    "what is your name": "My name is Fateh.",
    "what can you do": "I can help with route planning, equipment search, camera controls, and image analysis. Say 'help' to see all commands.",
    "how are you": "I'm fully operational and ready to assist you!",
    "thank you": "You're welcome! Stay safe!",
    "thanks": "You're welcome!",
    "bye": "Goodbye! Stay safe. Say 'hello' to activate me again.",
    "goodbye": "Goodbye! Wishing you safety.",
    "help": "Showing documentation.",
    "drone": "The drone can operate safely in up to 30 km/h wind speed.",
    "what is ndrf": "NDRF stands for National Disaster Response Force."
};

// ==================== SPEECH FUNCTIONS ====================
function speak(text) {
    console.log("Speaking:", text);
    
    const responseDiv = document.getElementById('commandResponse');
    if (responseDiv && !responseDiv.innerHTML.includes("background")) {
        responseDiv.innerHTML = `<div style="color: #86efac; padding: 10px;">🤖 Assistant: ${text}</div>`;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.volume = 1;
    utterance.pitch = 1;
    utterance.lang = "en-IN";
    
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
            const preferred = window.speechSynthesis.getVoices().find(v => v.lang === "en-IN" || v.lang === "en-GB");
            if (preferred) utterance.voice = preferred;
            window.speechSynthesis.speak(utterance);
        };
    } else {
        const preferred = voices.find(v => v.lang === "en-IN" || v.lang === "en-GB");
        if (preferred) utterance.voice = preferred;
        window.speechSynthesis.speak(utterance);
    }
}

function getStaticResponse(command) {
    const cmdLower = command.toLowerCase();
    for (const [key, response] of Object.entries(staticResponses)) {
        if (cmdLower.includes(key)) {
            return response;
        }
    }
    return null;
}

// ==================== IMAGE ANALYSIS FUNCTIONS ====================
async function analyzeUploadedImage(file) {
    addLog(`📸 Analyzing uploaded image: ${file.name}`, 'info');
    speak(`Analyzing uploaded image...`);
    
    const resultContainer = document.getElementById('aiResultContainer');
    if (resultContainer) {
        resultContainer.innerHTML = '<div class="ai-loading" style="display:flex; flex-direction:column; align-items:center; gap:15px;"><div class="spinner"></div><span>Analyzing image with AI...</span></div>';
    }
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch(`${API_BASE}/analyze_image`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && resultContainer) {
            resultContainer.innerHTML = `<div class="ai-result-data" style="display:block">
                <div class="ai-result-section">
                    <h4> Analysis Result</h4>
                    <pre style="white-space:pre-wrap; font-family:monospace; font-size:12px; line-height:1.5; max-height:400px; overflow-y:auto;">${data.analysis || 'No analysis returned'}</pre>
                </div>
            </div>`;
            addLog(' Image analysis complete', 'success');
            speak('Analysis complete. Check the result in the AI Analysis panel.');
        } else {
            throw new Error(data.error || 'Analysis failed');
        }
    } catch (err) {
        console.error('Analysis error:', err);
        if (resultContainer) {
            resultContainer.innerHTML = `<div class="ai-result-idle">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
                <h3>Analysis Failed</h3>
                <p>${err.message}</p>
                <p style="font-size:11px;">Make sure Flask server is running on port 5000</p>
            </div>`;
        }
        addLog(`Analysis error: ${err.message}`, 'error');
        speak('Analysis failed. Please check if the server is running.');
    }
}

async function analyzeLiveFrame() {
    if (!cameraActive || !video?.videoWidth) {
        addLog(' Please start camera first', 'warning');
        speak('Please start the camera first before analyzing a frame.');
        return;
    }
    
    addLog(' Capturing and analyzing current frame...', 'info');
    speak('Analyzing current camera frame...');
    
    const resultContainer = document.getElementById('aiResultContainer');
    if (resultContainer) {
        resultContainer.innerHTML = '<div class="ai-loading" style="display:flex; flex-direction:column; align-items:center; gap:15px;"><div class="spinner"></div><span>Analyzing image with AI...</span></div>';
    }
    
    // Capture current video frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);
    
    // Convert to blob for sending
    tempCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('image', blob, 'frame.jpg');
        
        try {
            const response = await fetch(`${API_BASE}/analyze_image`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && resultContainer) {
                resultContainer.innerHTML = `<div class="ai-result-data" style="display:block">
                    <div class="ai-result-section">
                        <h4> Analysis Result</h4>
                        <pre style="white-space:pre-wrap; font-family:monospace; font-size:12px; line-height:1.5; max-height:400px; overflow-y:auto;">${data.analysis || 'No analysis returned'}</pre>
                    </div>
                </div>`;
                addLog(' Frame analysis complete', 'success');
                speak('Analysis complete. Check the result.');
            } else {
                throw new Error(data.error || 'Analysis failed');
            }
        } catch (err) {
            console.error('Analysis error:', err);
            if (resultContainer) {
                resultContainer.innerHTML = `<div class="ai-result-idle">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/>
                        <path d="M12 6v6l4 2"/>
                    </svg>
                    <h3>Analysis Failed</h3>
                    <p>${err.message}</p>
                </div>`;
            }
            addLog(` Analysis error: ${err.message}`, 'error');
            speak('Analysis failed.');
        }
    }, 'image/jpeg', 0.8);
}

// ==================== COMMAND HANDLER ====================
async function takeCommand(command) {
    console.log("Command:", command);
    
    const history = document.getElementById('historyList');
    if (history) {
        const time = new Date().toLocaleTimeString();
        history.innerHTML = `<div class="history-item"><span>${time}</span><span>${command}</span><span style="color:#2ecc71;">✓</span></div>` + history.innerHTML;
        while (history.children.length > 20) history.removeChild(history.lastChild);
    }
    
    // Stop camera
    if (command.includes("stop camera")) {
        stopCamera();
        speak("Camera stopped.");
        return;
    }
    
    // Start camera
    if (command.includes("start camera")) {
        startCamera();
        speak("Starting camera...");
        document.querySelector('[data-panel="camera"]')?.click();
        return;
    }
    
    // Show route
    if (command.includes("show route") || command.includes("shortest path")) {
        generateRoute();
        speak("Generating shortest path route...");
        document.querySelector('[data-panel="route"]')?.click();
        return;
    }
    
    // Help command
    if (command.includes("help") || command.includes("documentation")) {
        showDocumentation();
        speak("Here is the documentation.");
        document.querySelector('[data-panel="commands"]')?.click();
        return;
    }
    
    // Analyze image command
    if (command.includes("analyze image") || command.includes("analyze frame")) {
        if (cameraActive) {
            analyzeLiveFrame();
        } else {
            speak("Please upload an image using the Upload Image button, or start the camera first.");
            document.querySelector('[data-panel="ai-analysis"]')?.click();
        }
        return;
    }
    
    // Equipment search
    if (command.includes("search equipment")) {
        let searchTerm = command.replace("search equipment", "").replace("for", "").trim();
        if (searchTerm) {
            searchEquipment(searchTerm);
        } else {
            loadEquipment();
        }
        document.querySelector('[data-panel="equipment"]')?.click();
        return;
    }
    
    // Static response
    const staticResponse = getStaticResponse(command);
    if (staticResponse) {
        speak(staticResponse);
        return;
    }
    
    // Weather
    if (command.includes("weather")) {
        let city = command.replace("weather", "").replace("in", "").trim();
        if (city) {
            speak(`Fetching weather for ${city}...`);
            try {
                const response = await fetch(`${API_BASE}/weather`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ city: city })
                });
                const data = await response.json();
                speak(data.weather || "Weather data unavailable.");
            } catch(e) {
                speak("Could not fetch weather data.");
            }
        } else {
            speak("Please specify a city name. Example: 'weather in Delhi'");
        }
        return;
    }
    
    // Time
    if (command.includes("time")) {
        speak(`The current time is ${new Date().toLocaleTimeString()}`);
        return;
    }
    
    // Date
    if (command.includes("date")) {
        speak(`Today's date is ${new Date().toLocaleDateString()}`);
        return;
    }
    
    // Human only mode
    if (command.includes("human only")) {
        humanOnly = !humanOnly;
        speak(`Human only mode ${humanOnly ? 'activated' : 'deactivated'}`);
        document.getElementById('btnHumanOnly').style.background = humanOnly ? '#2ecc71' : '';
        return;
    }
    
    // Default
    speak("Say 'help' or check the Documentation  to see all available commands.");
}
// ==================== ROUTE FUNCTIONS ====================
async function generateRoute() {
    addLog('🗺️ Generating route map...', 'info');
    speak('Generating shortest path route...');
    
    const routeStatus = document.getElementById('routeStatus');
    if (routeStatus) routeStatus.innerHTML = '🔄 Generating route...';
    
    const routeMapContainer = document.getElementById('routeMapContainer');
    if (routeMapContainer) {
        routeMapContainer.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#2ecc71;"><div class="spinner"></div><span style="margin-left:10px;">Generating route map...</span></div>';
    }
    
    try {
        const response = await fetch(`${API_BASE}/generate_route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
       const data = await response.json();

let finalUrl = data.map_url.startsWith("http")
    ? data.map_url
    : `${API_BASE}/${data.map_url}`;

console.log("Opening map:", finalUrl);

window.open(finalUrl, "_blank");   // 🔥 open in new tab
        
        if (data.success && data.map_url) {
            if (routeStatus) {
                routeStatus.innerHTML = `✅ Route generated | Distance: ${data.distance_km} km | Time: ${data.duration_min} min`;
            }
            addLog(`✅ Route generated: ${data.distance_km} km`, 'success');
            speak(`Route generated! Distance: ${data.distance_km} km, Time: ${data.duration_min} minutes.`);
            
            // Display the folium map in an iframe
            if (routeMapContainer) {
                const iframe = document.createElement('iframe');
                iframe.src = data.map_url;
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.border = 'none';
                iframe.style.borderRadius = '12px';
                routeMapContainer.innerHTML = '';
                routeMapContainer.appendChild(iframe);
                
                // Hide overlay if exists
                const overlay = document.getElementById('routeOverlay');
                if (overlay) overlay.style.display = 'none';
            }
            
            // Update dashboard preview
            const dashRoutePreview = document.getElementById('dashRoutePreview');
            if (dashRoutePreview) {
                dashRoutePreview.innerHTML = `
                    <div style="text-align: center;">
                        <div style="color: #2ecc71; font-size: 20px;">${data.distance_km}</div>
                        <div style="color: #5a6e7a; font-size: 10px;">KM</div>
                        <div style="color: #2ecc71; font-size: 20px; margin-top: 5px;">${data.duration_min}</div>
                        <div style="color: #5a6e7a; font-size: 10px;">MIN</div>
                        <div style="font-size: 9px; color: #86efac; margin-top: 5px;">✓ Shortest path</div>
                    </div>
                `;
            }
        } else {
            // Fallback to static canvas map if backend fails
            drawStaticRouteMap();
            if (routeStatus) routeStatus.innerHTML = `✅ Route generated (Static) | Distance: 2.8 km | Time: 7 min`;
            speak('Route generated using static map.');
        }
    } catch (err) {
        console.error('Route error:', err);
        addLog(`❌ Route error: ${err.message}`, 'error');
        // Fallback to static canvas map
        drawStaticRouteMap();
        if (routeStatus) routeStatus.innerHTML = `✅ Route generated (Static) | Distance: 2.8 km | Time: 7 min`;
        speak('Route generated using static map.');
    }
}

// Static canvas map as fallback (when backend is not available)
function drawStaticRouteMap() {
    const canvasEl = document.getElementById('routeCanvas');
    if (!canvasEl) return;
    
    const ctxR = canvasEl.getContext('2d');
    canvasEl.width = canvasEl.clientWidth || 800;
    canvasEl.height = 400;
    
    ctxR.clearRect(0, 0, canvasEl.width, canvasEl.height);
    
    // Draw grid
    ctxR.strokeStyle = '#1a3c2c';
    for(let i = 0; i < canvasEl.width; i += 50) {
        ctxR.beginPath();
        ctxR.moveTo(i, 0);
        ctxR.lineTo(i, canvasEl.height);
        ctxR.stroke();
        ctxR.beginPath();
        ctxR.moveTo(0, i);
        ctxR.lineTo(canvasEl.width, i);
        ctxR.stroke();
    }
    
    // Start point
    ctxR.fillStyle = '#2ecc71';
    ctxR.beginPath();
    ctxR.arc(60, canvasEl.height - 60, 10, 0, Math.PI * 2);
    ctxR.fill();
    ctxR.fillStyle = '#fff';
    ctxR.font = '12px monospace';
    ctxR.fillText('START', 45, canvasEl.height - 70);
    
    // End point
    ctxR.fillStyle = '#dc2626';
    ctxR.beginPath();
    ctxR.arc(canvasEl.width - 80, 60, 10, 0, Math.PI * 2);
    ctxR.fill();
    ctxR.fillText('RESCUE', canvasEl.width - 95, 50);
    
    // Obstacles
    ctxR.fillStyle = 'rgba(220, 38, 38, 0.15)';
    ctxR.fillRect(150, 150, 80, 60);
    ctxR.fillRect(320, 250, 100, 70);
    ctxR.fillRect(480, 120, 70, 80);
    
    // Path
    ctxR.beginPath();
    ctxR.moveTo(60, canvasEl.height - 60);
    ctxR.lineTo(150, canvasEl.height - 150);
    ctxR.lineTo(280, canvasEl.height - 220);
    ctxR.lineTo(420, 200);
    ctxR.lineTo(canvasEl.width - 150, 100);
    ctxR.lineTo(canvasEl.width - 80, 60);
    ctxR.strokeStyle = '#2ecc71';
    ctxR.lineWidth = 3;
    ctxR.stroke();
    
    // Waypoints
    const points = [
        { x: 60, y: canvasEl.height - 60 },
        { x: 150, y: canvasEl.height - 150 },
        { x: 280, y: canvasEl.height - 220 },
        { x: 420, y: 200 },
        { x: canvasEl.width - 150, y: 100 },
        { x: canvasEl.width - 80, y: 60 }
    ];
    points.forEach(point => {
        ctxR.fillStyle = '#2ecc71';
        ctxR.beginPath();
        ctxR.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctxR.fill();
    });
    
    const routeStatus = document.getElementById('routeStatus');
    if (routeStatus && !routeStatus.innerHTML.includes('static')) {
        routeStatus.innerHTML = '✅ Route generated (Static) | Distance: 2.8 km | Time: 7 min';
    }
}
// ==================== EQUIPMENT FUNCTIONS ====================
function searchEquipment(query) {
    const results = equipmentDatabase.filter(item => 
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
    );
    
    const container = document.getElementById('equipResults');
    if (results.length === 0) {
        container.innerHTML = `<div class="equip-idle"><p> No equipment found for "${query}"</p></div>`;
        speak(`No equipment found for ${query}`);
    } else {
        let html = `<h3 style="color:#2ecc71;">🔍 Found ${results.length} item(s)</h3><table style="width:100%">\
<th>Item</th><th>Qty</th><th>Category</th></tr>`;
        results.forEach(item => {
            html += `<tr><td>${item.name}</td><td style="color:#2ecc71">${item.quantity}</td><td>${item.category}</td></tr>`;
        });
        html += `</table>`;
        container.innerHTML = html;
        speak(`Found ${results.length} items for ${query}`);
    }
}

function loadEquipment() {
    const container = document.getElementById('equipResults');
    let html = `<h3 style="color:#2ecc71;"> All Equipment (${equipmentDatabase.length} items)</h3><table style="width:100%">\
<th>Item</th><th>Qty</th><th>Category</th></tr>`;
    equipmentDatabase.forEach(item => {
        html += `<tr><td>${item.name}</td><td style="color:#2ecc71">${item.quantity}</td><td>${item.category}</td></tr>`;
    });
    html += `</table>`;
    container.innerHTML = html;
    
    const categories = [...new Set(equipmentDatabase.map(i => i.category))];
    document.getElementById('dashEquipCount').innerText = equipmentDatabase.length;
    document.getElementById('dashCatCount').innerText = categories.length;
}

// ==================== CAMERA FUNCTIONS ====================
async function loadModel() {
    try {
        model = await cocoSsd.load();
        addLog(' Model loaded');
        return true;
    } catch(err) {
        addLog('❌ Model error: ' + err.message);
        return false;
    }
}

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        dashVideo.srcObject = stream;
        await video.play();
        cameraActive = true;
        addLog(' Camera started');
        document.getElementById('cameraPlaceholder').style.display = 'none';
        
        video.addEventListener('loadedmetadata', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            dashCanvas.width = video.videoWidth;
            dashCanvas.height = video.videoHeight;
        });
        
        startDetection();
    } catch(err) {
        addLog(' Camera error: ' + err.message);
        speak('Camera error. Please check permissions.');
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
    cameraActive = false;
    addLog('Camera stopped');
    document.getElementById('cameraPlaceholder').style.display = 'flex';
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function startDetection() {
    async function detect() {
        if (!cameraActive || !model || !video?.videoWidth) {
            requestAnimationFrame(detect);
            return;
        }
        try {
            const predictions = await model.detect(video);
            drawBoxes(predictions);
            
            const detList = document.getElementById('detectionList');
            if (detList) {
                if (predictions.length > 0) {
                    detList.innerHTML = '<h3>Detections</h3>' + predictions.slice(0, 10).map(p => 
                        `<div class="detection-item"><span>${p.class}</span><span>${Math.round(p.score * 100)}%</span></div>`
                    ).join('');
                } else {
                    detList.innerHTML = '<h3>Detections</h3><div>No detections</div>';
                }
            }
        } catch(e) {}
        requestAnimationFrame(detect);
    }
    detect();
}

function drawBoxes(predictions) {
    if (!ctx || !dashCtx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dashCtx.clearRect(0, 0, dashCanvas.width, dashCanvas.height);
    if (!boxesVisible) return;
    
    predictions.forEach(pred => {
        if (humanOnly && pred.class !== 'person') return;
        const [x, y, w, h] = pred.bbox;
        const color = pred.class === 'person' ? '#2ecc71' : '#3b82f6';
        
        [ctx, dashCtx].forEach(c => {
            c.strokeStyle = color;
            c.strokeRect(x, y, w, h);
            c.fillStyle = color;
            c.fillText(`${pred.class}`, x, y-5);
        });
    });
}

// ==================== VOICE RECOGNITION ====================
function initVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        addLog('Voice not supported');
        return;
    }
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    
    recognition.onstart = () => {
        listening = true;
        document.getElementById('voiceVisualizer').classList.add('listening');
        addLog('🎤 Voice started');
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[event.resultIndex][0].transcript.toLowerCase();
        document.getElementById('transcriptText').innerHTML = transcript;
        addLog(`🎤 Recognized: "${transcript}"`);
        takeCommand(transcript);
    };
    
    recognition.onerror = (event) => {
        addLog(`Voice error: ${event.error}`);
        document.getElementById('voiceVisualizer').classList.remove('listening');
    };
    
    recognition.onend = () => {
        document.getElementById('voiceVisualizer').classList.remove('listening');
        if (listening) {
            setTimeout(() => recognition.start(), 1000);
        }
    };
}

function startListening() {
    if (!recognition) initVoice();
    if (recognition) {
        listening = true;
        recognition.start();
        document.getElementById('btnStartVoice').disabled = true;
        document.getElementById('btnStopVoice').disabled = false;
        addLog('🎤 Voice activated');
        speak("Voice activated. Say a command like 'hello' or 'show route'.");
    }
}

function stopListening() {
    listening = false;
    if (recognition) recognition.stop();
    document.getElementById('btnStartVoice').disabled = false;
    document.getElementById('btnStopVoice').disabled = true;
    addLog('Voice stopped');
    speak("Voice stopped.");
}

// ==================== HELPER FUNCTIONS ====================
function addLog(message) {
    const logs = document.getElementById('logsContainer');
    const time = new Date().toLocaleTimeString();
    logs.innerHTML += `<div class="log-entry"><span class="log-time">${time}</span>${message}</div>`;
    logs.scrollTop = logs.scrollHeight;
    console.log(message);
}

function updateUptime() {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(uptime / 60);
    const secs = uptime % 60;
    document.getElementById('sysUptime').innerText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
setInterval(updateUptime, 1000);

function updateClock() {
    const now = new Date();
    document.getElementById('systemClock').innerText = now.toLocaleTimeString();
    document.getElementById('systemDate').innerText = now.toLocaleDateString();
    document.getElementById('camTime').innerText = now.toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

// ==================== EVENT LISTENERS ====================
document.getElementById('btnStartCamera')?.addEventListener('click', startCamera);
document.getElementById('btnStopCamera')?.addEventListener('click', stopCamera);
document.getElementById('btnToggleBoxes')?.addEventListener('click', () => {
    boxesVisible = !boxesVisible;
    document.getElementById('btnToggleBoxes').innerText = boxesVisible ? 'Hide Boxes' : 'Show Boxes';
});
document.getElementById('btnHumanOnly')?.addEventListener('click', () => {
    humanOnly = !humanOnly;
    document.getElementById('btnHumanOnly').style.background = humanOnly ? '#2ecc71' : '';
});
document.getElementById('btnAnalyzeFrame')?.addEventListener('click', analyzeLiveFrame);
document.getElementById('btnSearchEquip')?.addEventListener('click', () => {
    const query = document.getElementById('equipSearchInput')?.value;
    if (query) searchEquipment(query);
    else loadEquipment();
});
document.getElementById('btnGenRoute')?.addEventListener('click', generateRoute);
document.getElementById('btnStartVoice')?.addEventListener('click', startListening);
document.getElementById('btnStopVoice')?.addEventListener('click', stopListening);
document.getElementById('btnExecuteCmd')?.addEventListener('click', () => {
    const cmd = document.getElementById('textCommandInput')?.value;
    if (cmd) takeCommand(cmd.toLowerCase());
});
document.getElementById('btnClearLogs')?.addEventListener('click', () => {
    document.getElementById('logsContainer').innerHTML = '<div class="log-entry">Logs cleared</div>';
});

// ==================== DOCUMENTATION BUTTON ====================
const docsBtn = document.getElementById('btnShowDocs');
if (docsBtn) {
    docsBtn.addEventListener('click', function() {
        showDocumentation();
        speak("Here is the documentation.");
    });
}

// Dashboard documentation button
const dashboardDocBtn = document.getElementById('dashboardDocBtn');
if (dashboardDocBtn) {
    dashboardDocBtn.addEventListener('click', function() {
        showDocumentation();
        document.querySelector('[data-panel="commands"]')?.click();
    });
}

// Command chips
document.querySelectorAll('.cmd-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const cmd = chip.getAttribute('data-cmd');
        if (cmd) takeCommand(cmd);
    });
});

// Navigation
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${item.dataset.panel}`)?.classList.add('active');
    });
});

document.querySelectorAll('.dash-card[data-goto]').forEach(card => {
    card.addEventListener('click', () => {
        const target = card.dataset.goto;
        document.querySelectorAll('.menu-item').forEach(item => {
            if (item.dataset.panel === target) item.click();
        });
    });
});

document.getElementById('hamburger')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('collapsed');
});

// ==================== IMAGE UPLOAD ====================
document.getElementById('btnUploadImage')?.addEventListener('click', () => {
    document.getElementById('imageUploadInput').click();
});

document.getElementById('imageUploadInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Show preview
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.getElementById('aiPreviewImg');
            const dropzone = document.querySelector('.ai-image-dropzone');
            const previewWrapper = document.getElementById('imagePreviewWrapper');
            
            if (img) {
                img.src = event.target.result;
                img.style.display = 'block';
            }
            if (dropzone) dropzone.style.display = 'none';
            if (previewWrapper) previewWrapper.style.display = 'flex';
            
            addLog(`📸 Image selected: ${file.name}`);
        };
        reader.readAsDataURL(file);
        
        // Analyze the image
        analyzeUploadedImage(file);
    }
});

// Remove image button
document.getElementById('removeImageBtn')?.addEventListener('click', () => {
    const img = document.getElementById('aiPreviewImg');
    const dropzone = document.querySelector('.ai-image-dropzone');
    const previewWrapper = document.getElementById('imagePreviewWrapper');
    const imageUpload = document.getElementById('imageUploadInput');
    
    if (img) {
        img.src = '';
        img.style.display = 'none';
    }
    if (dropzone) dropzone.style.display = 'flex';
    if (previewWrapper) previewWrapper.style.display = 'none';
    if (imageUpload) imageUpload.value = '';
    
    addLog('Image removed');
    speak('Image removed.');
});

// ==================== INITIALIZATION ====================
async function init() {
    addLog('='.repeat(40));
    addLog('NDRF Command Center Initialized');
    addLog('='.repeat(40));
    await loadModel();
    loadEquipment();
    addLog(' System Ready!');
    addLog(' Say "help" for commands');
    speak("NDRF Command Center ready. Say hello to begin.");
}

init();
