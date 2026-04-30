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
let lastDetectionTime = 0;
const DETECTION_INTERVAL = 100;

// DOM Elements
const video = document.getElementById('cameraVideo');
const dashVideo = document.getElementById('dashVideo');
const canvas = document.getElementById('cameraCanvas');
const dashCanvas = document.getElementById('dashCanvas');
const ctx = canvas?.getContext('2d');
const dashCtx = dashCanvas?.getContext('2d');

const API_BASE = "https://base-station-ndrf-7.onrender.com";

// ==================== EQUIPMENT DATABASE ====================
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

// ==================== CAMERA FUNCTIONS (FIXED) ====================

async function loadModel() {
    try {
        if (typeof cocoSsd === 'undefined') {
            addLog('❌ COCO-SSD library not loaded!', 'error');
            return false;
        }
        
        addLog('📦 Loading object detection model...', 'info');
        model = await cocoSsd.load({ base: 'mobilenet_v2' });
        addLog('✅ Object detection model loaded successfully', 'success');
        return true;
    } catch(err) {
        addLog('❌ Model loading error: ' + err.message, 'error');
        return false;
    }
}

async function startCamera() {
    try {
        if (stream) stopCamera();
        
        addLog('📷 Requesting camera access...', 'info');
        
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
        });
        
        if (video) video.srcObject = stream;
        if (dashVideo) dashVideo.srcObject = stream;
        
        await new Promise((resolve) => {
            if (video) {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            } else resolve();
        });
        
        cameraActive = true;
        addLog('✅ Camera started successfully', 'success');
        
        const placeholder = document.getElementById('cameraPlaceholder');
        if (placeholder) placeholder.style.display = 'none';
        
        const setCanvasDimensions = () => {
            if (video && video.videoWidth && video.videoWidth > 0) {
                if (canvas) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                }
                if (dashCanvas) {
                    dashCanvas.width = video.videoWidth;
                    dashCanvas.height = video.videoHeight;
                }
                startDetection();
                addLog('🎯 Detection started', 'success');
            } else {
                setTimeout(setCanvasDimensions, 100);
            }
        };
        setCanvasDimensions();
        
        speak("Camera started. Object detection is now active.");
        
    } catch(err) {
        addLog('❌ Camera error: ' + err.message, 'error');
        if (err.name === 'NotAllowedError') speak('Camera access denied.');
        else if (err.name === 'NotFoundError') speak('No camera found.');
        else speak('Failed to start camera.');
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    cameraActive = false;
    
    if (video) video.srcObject = null;
    if (dashVideo) dashVideo.srcObject = null;
    
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (dashCtx && dashCanvas) dashCtx.clearRect(0, 0, dashCanvas.width, dashCanvas.height);
    
    const placeholder = document.getElementById('cameraPlaceholder');
    if (placeholder) placeholder.style.display = 'flex';
    
    addLog('🛑 Camera stopped', 'info');
}

async function startDetection() {
    async function detect() {
        if (!cameraActive || !model || !video || !video.videoWidth || video.paused) {
            requestAnimationFrame(detect);
            return;
        }
        
        try {
            const now = Date.now();
            if (now - lastDetectionTime >= DETECTION_INTERVAL) {
                lastDetectionTime = now;
                const predictions = await model.detect(video);
                drawBoxes(predictions);
                updateDetectionList(predictions);
                
                if (humanOnly) {
                    updateDashboardDetection(predictions.filter(p => p.class === 'person').length);
                } else {
                    updateDashboardDetection(predictions.length);
                }
            } else {
                if (window.lastPredictions) drawBoxes(window.lastPredictions);
            }
        } catch(err) {
            console.error('Detection error:', err);
        }
        
        requestAnimationFrame(detect);
    }
    detect();
}

function drawBoxes(predictions) {
    if (!ctx || !dashCtx) return;
    
    window.lastPredictions = predictions;
    
    if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (dashCanvas) dashCtx.clearRect(0, 0, dashCanvas.width, dashCanvas.height);
    
    if (!boxesVisible) return;
    
    ctx.font = '14px monospace';
    ctx.lineWidth = 2;
    dashCtx.font = '14px monospace';
    dashCtx.lineWidth = 2;
    
    predictions.forEach(pred => {
        if (humanOnly && pred.class !== 'person') return;
        
        const [x, y, width, height] = pred.bbox;
        const confidence = Math.round(pred.score * 100);
        let color = pred.class === 'person' ? '#2ecc71' : (pred.class === 'car' ? '#f39c12' : '#3b82f6');
        
        ctx.strokeStyle = color;
        ctx.strokeRect(x, y, width, height);
        
        const label = `${pred.class} ${confidence}%`;
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x, y - 20, textWidth + 6, 18);
        ctx.fillStyle = color;
        ctx.fillText(label, x + 2, y - 5);
        
        dashCtx.strokeStyle = color;
        dashCtx.strokeRect(x, y, width, height);
        dashCtx.fillStyle = 'rgba(0,0,0,0.6)';
        dashCtx.fillRect(x, y - 20, textWidth + 6, 18);
        dashCtx.fillStyle = color;
        dashCtx.fillText(label, x + 2, y - 5);
    });
}

function updateDetectionList(predictions) {
    const detList = document.getElementById('detectionList');
    if (!detList) return;
    
    const filtered = humanOnly ? predictions.filter(p => p.class === 'person') : predictions;
    
    if (filtered.length > 0) {
        detList.innerHTML = `<h3 style="color:#2ecc71;">🎯 Detected (${filtered.length})</h3>` +
            filtered.slice(0, 8).map(p => 
                `<div class="detection-item"><span>${p.class}</span><span>${Math.round(p.score * 100)}%</span></div>`
            ).join('');
    } else {
        detList.innerHTML = `<h3 style="color:#2ecc71;">🎯 Detections</h3><div style="color:#5a6e7a; text-align:center; padding:20px;">${humanOnly ? 'No people detected' : 'No objects detected'}</div>`;
    }
}

function updateDashboardDetection(count) {
    const dashDetect = document.getElementById('dashDetect');
    if (dashDetect) {
        dashDetect.innerHTML = `<div style="text-align:center;"><div style="color:#2ecc71; font-size:20px;">${count}</div><div style="color:#5a6e7a; font-size:10px;">${humanOnly ? 'PEOPLE' : 'OBJECTS'}</div></div>`;
    }
}

// ==================== EQUIPMENT FUNCTIONS ====================
function searchEquipment(query) {
    if (!query || query.trim() === "") {
        displayAllEquipment();
        return;
    }

    const searchTerm = query.toLowerCase().trim();
    const results = equipmentDatabase.filter(item => 
        item.name.toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm)
    );
    
    displayEquipmentResults(results, searchTerm);
    speak(`Found ${results.length} items matching ${searchTerm}`);
}

function displayAllEquipment() {
    displayEquipmentResults(equipmentDatabase, "all");
}

function displayEquipmentResults(results, searchTerm) {
    const container = document.getElementById('equipResults');
    if (!container) return;
    
    if (results.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px;"><h3 style="color:#dc2626;">No Results Found</h3><p>No equipment matching "${searchTerm}"</p></div>`;
        return;
    }
    
    let html = `<div style="padding:20px;"><h3 style="color:#2ecc71;">🔍 Found ${results.length} item(s)</h3><table style="width:100%; border-collapse:collapse;">`;
    html += `<tr style="background:#0a0c12;"><th style="padding:10px; text-align:left;">Item</th><th>Qty</th><th>Category</th><th>Status</th></tr>`;
    
    results.forEach(item => {
        html += `<tr style="border-bottom:1px solid #1a3c2c;">
            <td style="padding:10px;">${item.name}</td>
            <td style="padding:10px; text-align:center; color:#2ecc71;">${item.quantity}</td>
            <td style="padding:10px;">${item.category}</td>
            <td style="padding:10px;"><span style="color:#2ecc71;">${item.status}</span></td>
        </tr>`;
    });
    html += `早年</div>`;
    container.innerHTML = html;
    
    const dashEquipCount = document.getElementById('dashEquipCount');
    if (dashEquipCount) dashEquipCount.innerHTML = `<span style="font-size:24px;">${equipmentDatabase.length}</span>`;
    
    const categories = [...new Set(equipmentDatabase.map(i => i.category))];
    const dashCatCount = document.getElementById('dashCatCount');
    if (dashCatCount) dashCatCount.innerHTML = `<span style="font-size:24px;">${categories.length}</span>`;
}

function loadEquipment() {
    displayAllEquipment();
}

// ==================== DOCUMENTATION FUNCTION (FULLY RESTORED) ====================
window.showDocumentation = function() {
    console.log("Documentation button clicked!");
    
    const docHtml = `
    <div style="background: linear-gradient(135deg, #0f111a 0%, #0a0c12 100%); border-radius: 16px; padding: 25px; border: 1px solid rgba(46, 204, 113, 0.3);">
        
        <!-- Header with System Overview -->
        <div style="border-bottom: 1px solid rgba(46, 204, 113, 0.2); padding-bottom: 20px; margin-bottom: 20px;">
            <h3 style="color: #2ecc71; font-family: 'Orbitron', monospace; font-size: 18px; letter-spacing: 2px; text-align: center; margin-bottom: 10px;">
                🚨 NDRF / SDRF COMMAND CENTER v3.0
            </h3>
            <p style="color: #8a9bae; text-align: center; font-size: 13px; margin-bottom: 15px;">
                Real-Time Disaster Response Management System
            </p>
            
            <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 15px; margin-top: 10px;">
                <h4 style="color: #2ecc71; font-size: 13px; margin-bottom: 10px;">⚡ SYSTEM CAPABILITIES</h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 12px;">
                    <div style="color: #c8d1e6;">🎥 <span style="color: #2ecc71;">Live Camera Feed</span> - Real-time object detection with COCO-SSD</div>
                    <div style="color: #c8d1e6;">🤖 <span style="color: #2ecc71;">AI Image Analysis</span> - Gemini-powered disaster assessment</div>
                    <div style="color: #c8d1e6;">🗺️ <span style="color: #2ecc71;">Route Planning</span> - Shortest path generation for rescue operations</div>
                    <div style="color: #c8d1e6;">📦 <span style="color: #2ecc71;">Equipment Database</span> - Searchable inventory of rescue gear</div>
                    <div style="color: #c8d1e6;">🎤 <span style="color: #2ecc71;">Voice Commands</span> - Hands-free operation using speech recognition</div>
                    <div style="color: #c8d1e6;">🌤️ <span style="color: #2ecc71;">Weather Updates</span> - Real-time weather for any location</div>
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
                    <span style="color: #5a6e7a; font-size: 11px; display: block;">AI disaster image analysis</span>
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
                    <span style="color: #5a6e7a; font-size: 11px;"> → Rescue boats available</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 20px; padding: 6px 15px;">
                    <span style="color: #2ecc71;">"search equipment medical"</span>
                    <span style="color: #5a6e7a; font-size: 11px;"> → Medical supplies</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 20px; padding: 6px 15px;">
                    <span style="color: #2ecc71;">"search equipment rope"</span>
                    <span style="color: #5a6e7a; font-size: 11px;"> → Rope rescue gear</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 20px; padding: 6px 15px;">
                    <span style="color: #2ecc71;">"search equipment radio"</span>
                    <span style="color: #5a6e7a; font-size: 11px;"> → Communication devices</span>
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
                📚 GENERAL KNOWLEDGE QUERIES
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
        
        <!-- Footer Tips -->
        <div style="background: linear-gradient(135deg, #0f111a 0%, #0a0c12 100%); border-radius: 12px; padding: 15px; text-align: center; border: 1px solid rgba(46, 204, 113, 0.2);">
            <div style="display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap;">
                <div>
                    <span style="color: #2ecc71;">💡 PRO TIP</span>
                    <span style="color: #8a9bae; font-size: 12px; display: block;">Click "Start Listening" for hands-free voice control</span>
                </div>
                <div style="width: 1px; height: 30px; background: rgba(46,204,113,0.2);"></div>
                <div>
                    <span style="color: #2ecc71;">⌨️ SHORTCUT</span>
                    <span style="color: #8a9bae; font-size: 12px; display: block;">Type commands directly in text box</span>
                </div>
                <div style="width: 1px; height: 30px; background: rgba(46,204,113,0.2);"></div>
                <div>
                    <span style="color: #2ecc71;">🔄 UPDATE</span>
                    <span style="color: #8a9bae; font-size: 12px; display: block;">Equipment database auto-refreshes</span>
                </div>
            </div>
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(46,204,113,0.1); color: #5a6e7a; font-size: 10px;">
                © 2024 NDRF Command Center | Real-Time Disaster Response System | Version 3.0
            </div>
        </div>
    </div>`;
    
    const responseDiv = document.getElementById('commandResponse');
    if (responseDiv) {
        responseDiv.innerHTML = docHtml;
        console.log("Documentation displayed successfully!");
    }
    
    speak("Here is the documentation of all available commands.");
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

// ==================== ROUTE FUNCTIONS ====================
async function generateRoute() {
    addLog('🗺️ Generating route map...', 'info');
    speak('Generating shortest path route...');

    const routeStatus = document.getElementById('routeStatus');
    const routeMapContainer = document.getElementById('routeMapContainer');
    
    if (routeStatus) routeStatus.innerHTML = '🔄 Generating route...';
    if (routeMapContainer) {
        routeMapContainer.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#2ecc71;">Generating route...</div>`;
    }

    try {
        const response = await fetch(`${API_BASE}/generate_route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const data = await response.json();

        if (data.success && data.map_url) {
            const finalUrl = data.map_url.startsWith("http") ? data.map_url : `${API_BASE}${data.map_url}`;
            const iframe = document.createElement('iframe');
            iframe.src = finalUrl;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.borderRadius = '12px';
            
            if (routeMapContainer) {
                routeMapContainer.innerHTML = '';
                routeMapContainer.appendChild(iframe);
            }
            if (routeStatus) {
                routeStatus.innerHTML = `✅ Route generated | Distance: ${data.distance_km} km | Time: ${data.duration_min} min`;
            }
            addLog(`✅ Route generated: ${data.distance_km} km`, 'success');
            speak(`Route generated! Distance: ${data.distance_km} km, Time: ${data.duration_min} minutes.`);
        } else {
            throw new Error("Invalid response");
        }
    } catch (err) {
        console.error('Route error:', err);
        if (routeStatus) routeStatus.innerHTML = `⚠️ Route error: ${err.message}`;
        speak('Route generation failed. Please check backend connection.');
    }
}

// ==================== IMAGE ANALYSIS ====================
async function analyzeUploadedImage(file) {
    addLog(`📸 Analyzing uploaded image: ${file.name}`, 'info');
    speak(`Analyzing uploaded image...`);
    
    const resultContainer = document.getElementById('aiResultContainer');
    if (resultContainer) {
        resultContainer.innerHTML = '<div class="ai-loading"><div class="spinner"></div><span>Analyzing image with AI...</span></div>';
    }
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch(`${API_BASE}/analyze_image`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success && resultContainer) {
            resultContainer.innerHTML = `<div class="ai-result-data"><pre style="white-space:pre-wrap;">${data.analysis || 'No analysis returned'}</pre></div>`;
            addLog('✅ Image analysis complete', 'success');
            speak('Analysis complete.');
        } else {
            throw new Error(data.error || 'Analysis failed');
        }
    } catch (err) {
        console.error('Analysis error:', err);
        if (resultContainer) {
            resultContainer.innerHTML = `<div class="ai-result-idle"><h3>Analysis Failed</h3><p>${err.message}</p></div>`;
        }
        speak('Analysis failed.');
    }
}

async function analyzeLiveFrame() {
    if (!cameraActive || !video?.videoWidth) {
        addLog('⚠️ Please start camera first', 'warning');
        speak('Please start the camera first.');
        return;
    }
    
    addLog('📸 Analyzing current frame...', 'info');
    speak('Analyzing current camera frame...');
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);
    
    tempCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('image', blob, 'frame.jpg');
        
        try {
            const response = await fetch(`${API_BASE}/analyze_image`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            
            const resultContainer = document.getElementById('aiResultContainer');
            if (data.success && resultContainer) {
                resultContainer.innerHTML = `<div class="ai-result-data"><pre style="white-space:pre-wrap;">${data.analysis || 'No analysis returned'}</pre></div>`;
                addLog('✅ Frame analysis complete', 'success');
                speak('Analysis complete.');
            }
        } catch (err) {
            console.error('Analysis error:', err);
            speak('Analysis failed.');
        }
    }, 'image/jpeg', 0.8);
}

// ==================== VOICE RECOGNITION ====================
function initVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        addLog('❌ Voice not supported in this browser', 'error');
        return;
    }
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    
    recognition.onstart = () => {
        listening = true;
        const voiceVisualizer = document.getElementById('voiceVisualizer');
        if (voiceVisualizer) voiceVisualizer.classList.add('listening');
        addLog('🎤 Voice activated', 'success');
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[event.resultIndex][0].transcript.toLowerCase();
        const transcriptText = document.getElementById('transcriptText');
        if (transcriptText) transcriptText.innerHTML = transcript;
        addLog(`🎤 Recognized: "${transcript}"`, 'info');
        takeCommand(transcript);
    };
    
    recognition.onerror = (event) => {
        addLog(`Voice error: ${event.error}`, 'error');
        const voiceVisualizer = document.getElementById('voiceVisualizer');
        if (voiceVisualizer) voiceVisualizer.classList.remove('listening');
    };
    
    recognition.onend = () => {
        const voiceVisualizer = document.getElementById('voiceVisualizer');
        if (voiceVisualizer) voiceVisualizer.classList.remove('listening');
        if (listening) setTimeout(() => recognition.start(), 1000);
    };
}

function startListening() {
    if (!recognition) initVoice();
    if (recognition) {
        listening = true;
        recognition.start();
        const btnStartVoice = document.getElementById('btnStartVoice');
        const btnStopVoice = document.getElementById('btnStopVoice');
        if (btnStartVoice) btnStartVoice.disabled = true;
        if (btnStopVoice) btnStopVoice.disabled = false;
        addLog('🎤 Voice activated', 'success');
        speak("Voice activated. Say a command like 'hello' or 'show route'.");
    }
}

function stopListening() {
    listening = false;
    if (recognition) recognition.stop();
    const btnStartVoice = document.getElementById('btnStartVoice');
    const btnStopVoice = document.getElementById('btnStopVoice');
    if (btnStartVoice) btnStartVoice.disabled = false;
    if (btnStopVoice) btnStopVoice.disabled = true;
    addLog('🔇 Voice stopped', 'info');
    speak("Voice stopped.");
}
// ==================== WEATHER (OPEN-METEO DIRECT JS) ====================

// Get coordinates from city name
async function getCoordinates(city) {
    try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`);
        const data = await res.json();

        if (data.results && data.results.length > 0) {
            return {
                lat: data.results[0].latitude,
                lon: data.results[0].longitude
            };
        }
        return null;
    } catch (err) {
        console.error("Geocoding error:", err);
        return null;
    }
}

// Get weather using coordinates
async function getWeather(city) {
    try {
        const coords = await getCoordinates(city);

        if (!coords) {
            speak("City not found.");
            return;
        }

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m`;

        const res = await fetch(url);
        const data = await res.json();

        const temp = data.current.temperature_2m;

        const result = `Temperature in ${city} is ${temp}°C`;

        speak(result);
        addLog(`🌤️ ${result}`);

    } catch (err) {
        console.error("Weather error:", err);
        speak("Unable to fetch weather.");
    }
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
        const cameraPanel = document.querySelector('[data-panel="camera"]');
        if (cameraPanel) cameraPanel.click();
        return;
    }
    
    // Show route
    if (command.includes("show route") || command.includes("shortest path")) {
        generateRoute();
        speak("Generating shortest path route...");
        const routePanel = document.querySelector('[data-panel="route"]');
        if (routePanel) routePanel.click();
        return;
    }
    
    // Help command
    if (command.includes("help") || command.includes("documentation")) {
        showDocumentation();
        speak("Here is the documentation.");
        const commandsPanel = document.querySelector('[data-panel="commands"]');
        if (commandsPanel) commandsPanel.click();
        return;
    }
    
    // Analyze image command
    if (command.includes("analyze image") || command.includes("analyze frame")) {
        if (cameraActive) {
            analyzeLiveFrame();
        } else {
            speak("Please start the camera first.");
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
        const equipmentPanel = document.querySelector('[data-panel="equipment"]');
        if (equipmentPanel) equipmentPanel.click();
        return;
    }
    
    // Static response
    const staticResponse = getStaticResponse(command);
    if (staticResponse) {
        speak(staticResponse);
        return;
    }
    
// ================= WEATHER =================
if (command.includes("weather")) {
    let city = command.replace("weather", "").replace("in", "").trim();

    if (city) {
        speak(`Getting weather for ${city}`);
        await getWeather(city);
    } else {
        speak("Please say a city name like weather in Delhi");
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
        const btnHumanOnly = document.getElementById('btnHumanOnly');
        if (btnHumanOnly) btnHumanOnly.style.background = humanOnly ? '#2ecc71' : '';
        return;
    }
    
    // Default
    speak("Say 'help' or check the Documentation to see all available commands.");
}

// ==================== HELPER FUNCTIONS ====================
function addLog(message, type = 'info') {
    const logs = document.getElementById('logsContainer');
    if (!logs) {
        console.log(message);
        return;
    }
    
    const time = new Date().toLocaleTimeString();
    const color = type === 'error' ? '#dc2626' : (type === 'success' ? '#2ecc71' : '#8a9bae');
    logs.innerHTML += `<div class="log-entry"><span class="log-time" style="color: ${color};">${time}</span>${message}</div>`;
    logs.scrollTop = logs.scrollHeight;
    console.log(message);
}

function updateUptime() {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(uptime / 60);
    const secs = uptime % 60;
    const sysUptime = document.getElementById('sysUptime');
    if (sysUptime) sysUptime.innerText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function updateClock() {
    const now = new Date();
    const systemClock = document.getElementById('systemClock');
    const systemDate = document.getElementById('systemDate');
    const camTime = document.getElementById('camTime');
    
    if (systemClock) systemClock.innerText = now.toLocaleTimeString();
    if (systemDate) systemDate.innerText = now.toLocaleDateString();
    if (camTime) camTime.innerText = now.toLocaleTimeString();
}

// ==================== EVENT LISTENERS ====================
document.getElementById('btnStartCamera')?.addEventListener('click', startCamera);
document.getElementById('btnStopCamera')?.addEventListener('click', stopCamera);
document.getElementById('btnToggleBoxes')?.addEventListener('click', () => {
    boxesVisible = !boxesVisible;
    const btn = document.getElementById('btnToggleBoxes');
    if (btn) btn.innerText = boxesVisible ? 'Hide Boxes' : 'Show Boxes';
});
document.getElementById('btnHumanOnly')?.addEventListener('click', () => {
    humanOnly = !humanOnly;
    const btn = document.getElementById('btnHumanOnly');
    if (btn) btn.style.background = humanOnly ? '#2ecc71' : '';
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
    const logsContainer = document.getElementById('logsContainer');
    if (logsContainer) logsContainer.innerHTML = '<div class="log-entry">Logs cleared</div>';
});

// Documentation button
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
        const commandsPanel = document.querySelector('[data-panel="commands"]');
        if (commandsPanel) commandsPanel.click();
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
        const panel = document.getElementById(`panel-${item.dataset.panel}`);
        if (panel) panel.classList.add('active');
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

// Hamburger menu
const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');
if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

// ==================== IMAGE UPLOAD ====================
const btnUploadImage = document.getElementById('btnUploadImage');
const imageUploadInput = document.getElementById('imageUploadInput');
const removeImageBtn = document.getElementById('removeImageBtn');

if (btnUploadImage) {
    btnUploadImage.addEventListener('click', () => {
        if (imageUploadInput) imageUploadInput.click();
    });
}

if (imageUploadInput) {
    imageUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
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
            analyzeUploadedImage(file);
        }
    });
}

if (removeImageBtn) {
    removeImageBtn.addEventListener('click', () => {
        const img = document.getElementById('aiPreviewImg');
        const dropzone = document.querySelector('.ai-image-dropzone');
        const previewWrapper = document.getElementById('imagePreviewWrapper');
        
        if (img) {
            img.src = '';
            img.style.display = 'none';
        }
        if (dropzone) dropzone.style.display = 'flex';
        if (previewWrapper) previewWrapper.style.display = 'none';
        if (imageUploadInput) imageUploadInput.value = '';
        
        addLog('Image removed');
        speak('Image removed.');
    });
}

// ==================== INITIALIZATION ====================
async function init() {
    addLog('='.repeat(40));
    addLog('🚨 NDRF Command Center v3.0');
    addLog('='.repeat(40));
    
    const modelLoaded = await loadModel();
    
    if (modelLoaded) {
        addLog('✅ System ready!', 'success');
        addLog('💡 Say "start camera" to begin detection', 'info');
        speak("NDRF Command Center ready. Say start camera to begin.");
    } else {
        addLog('⚠️ Running without object detection', 'warning');
        speak("System ready but object detection model failed to load. Camera will work without detection.");
    }
    
    loadEquipment();
    setInterval(updateUptime, 1000);
    setInterval(updateClock, 1000);
    updateClock();
}

// Add CSS for detection items
const style = document.createElement('style');
style.textContent = `
    .detection-item {
        display: flex;
        justify-content: space-between;
        padding: 8px 10px;
        border-bottom: 1px solid #1a3c2c;
        font-size: 12px;
        transition: background 0.2s;
    }
    .detection-item:hover {
        background: rgba(46, 204, 113, 0.1);
    }
    #detectionList {
        max-height: 400px;
        overflow-y: auto;
    }
    .log-entry {
        font-family: monospace;
        font-size: 11px;
        padding: 4px 0;
        border-bottom: 1px solid #1a2c22;
    }
    .log-time {
        color: #2ecc71;
        margin-right: 10px;
    }
`;
document.head.appendChild(style);
document.addEventListener("DOMContentLoaded", () => {

    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImg");
    const closeBtn = document.querySelector(".close-btn");

    // Open image
    window.openImage = function (img) {
        modal.style.display = "flex";
        modalImg.src = img.src;
    };

    // Close button click
    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });

    // Click outside image to close
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });

});


init();
