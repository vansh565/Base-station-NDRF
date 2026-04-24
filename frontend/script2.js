// ==================== GLOBAL VARIABLES ====================
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

const API_BASE = `http://${window.location.hostname}:5000`;

// ==================== EQUIPMENT DATABASE ====================
const equipmentDatabase = [
    { name: "Rescue Boat", quantity: 6, category: "Water Rescue", description: "Inflatable rescue boat" },
    { name: "Life Jacket", quantity: 150, category: "Water Rescue", description: "ISO certified life jacket" },
    { name: "Stretcher", quantity: 23, category: "Medical", description: "Folding ambulance stretcher" },
    { name: "First Aid Kit", quantity: 70, category: "Medical", description: "Advanced first aid kit" },
    { name: "AED", quantity: 4, category: "Medical", description: "Automated External Defibrillator" },
    { name: "Rescue Rope", quantity: 35, category: "Rope Rescue", description: "Static rescue rope 50m" },
    { name: "Carabiner", quantity: 150, category: "Rope Rescue", description: "Screw gate carabiner" },
    { name: "Two-Way Radio", quantity: 50, category: "Communication", description: "VHF/UHF handheld radio" },
    { name: "Satellite Phone", quantity: 5, category: "Communication", description: "Satellite phone" },
    { name: "Generator", quantity: 6, category: "Heavy Equipment", description: "Portable generator" },
    { name: "Thermal Blanket", quantity: 500, category: "Relief", description: "Mylar thermal blanket" },
    { name: "Tent", quantity: 70, category: "Relief", description: "Family size tent" },
    { name: "Helmet", quantity: 50, category: "Protective Gear", description: "Multi-purpose rescue helmet" },
    { name: "Safety Boots", quantity: 100, category: "Protective Gear", description: "Steel toe safety boots" },
    { name: "Drone", quantity: 3, category: "Search & Rescue", description: "Quadcopter drone with camera" },
    { name: "Fire Extinguisher", quantity: 40, category: "Fire Rescue", description: "ABC type fire extinguisher" },
    { name: "Crowbar", quantity: 30, category: "Tools", description: "60cm crowbar for debris removal" },
    { name: "Shovel", quantity: 50, category: "Tools", description: "Collapsible shovel" }
];

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
function generateRoute() {
    const canvasEl = document.getElementById('routeCanvas');
    if (!canvasEl) return;
    
    const ctxR = canvasEl.getContext('2d');
    canvasEl.width = canvasEl.clientWidth || 800;
    canvasEl.height = 400;
    
    ctxR.clearRect(0, 0, canvasEl.width, canvasEl.height);
    
    // Grid
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
    ctxR.fillText('START', 45, canvasEl.height - 70);
    
    // End point
    ctxR.fillStyle = '#dc2626';
    ctxR.beginPath();
    ctxR.arc(canvasEl.width - 80, 60, 10, 0, Math.PI * 2);
    ctxR.fill();
    ctxR.fillText('RESCUE', canvasEl.width - 95, 50);
    
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
    
    document.getElementById('routeStatus').innerHTML = ' Route generated | Distance: 2.8 km | Time: 7 min';
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