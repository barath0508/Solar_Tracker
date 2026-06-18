#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Update.h>
#include <Wire.h>
#include <esp_arduino_version.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_INA219.h>
#include <DHT.h>

// Custom crash-proof Servo implementation for ESP32-C6 (bypasses buggy ESP32Servo library)
class Servo {
private:
  int _pin;
  int _channel;
public:
  Servo() : _pin(-1), _channel(-1) {}
  
  void setPeriodHertz(int hz) {
    // 50Hz is standard for servos
  }
  
  void attach(int pin, int minPulse = 500, int maxPulse = 2400) {
    _pin = pin;
    #if defined(ESP_ARDUINO_VERSION) && ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
      ledcAttach(_pin, 50, 14); // 50Hz, 14-bit resolution
    #else
      static int nextChannel = 0;
      _channel = nextChannel++;
      ledcSetup(_channel, 50, 14); // 50Hz, 14-bit resolution
      ledcAttachPin(_pin, _channel);
    #endif
  }
  
  void write(int angle) {
    if (_pin == -1) return;
    int pulseWidthUs = map(angle, 0, 180, 500, 2400);
    // 50Hz = 20000us period. 14-bit resolution = 16383 max duty
    int duty = map(pulseWidthUs, 0, 20000, 0, 16383);
    
    #if defined(ESP_ARDUINO_VERSION) && ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
      ledcWrite(_pin, duty);
    #else
      ledcWrite(_channel, duty);
    #endif
  }
};

// ==========================================
// User Credentials & Server Configuration
// ==========================================
// Replace with your local Wi-Fi credentials
const char* ssid = "POCO X6 5G";
const char* password = "12345678";

// 1. Local Dev Server Settings
const char* localHost = "http://192.168.137.60:5173";

// 2. Production Vercel Server Settings (Replace with your actual deployed Vercel domain)
// Note: If left as default/placeholder, Vercel requests will be bypassed to avoid timeout lags.
const char* vercelHost = "https://solar-tracker-pi-jade.vercel.app";

// Helper to check if Vercel server host is configured and should be used
bool shouldUseVercel() {
  String host = String(vercelHost);
  return (host.length() > 0 && host.indexOf("your-vercel-project") == -1 && host.startsWith("http"));
}

// Target Device ID registered in your website's database
// Default for Rajalakshmi Institute of Technology: "d1e028b0-a541-4702-8c20-3354316d2cf1"
#define DEVICE_ID "d1e028b0-a541-4702-8c20-3354316d2cf1"

// ==========================================
// ESP32-C6 Pin Mappings
// ==========================================
// Standard ESP32 pins (32, 33, 34, 35) do not exist on the ESP32-C6.
// Remapped to ADC1 channels on ESP32-C6:
#define LDR_TL 0  // GPIO 0 (ADC1_CH0)
#define LDR_TR 1  // GPIO 1 (ADC1_CH1)
#define LDR_BL 2  // GPIO 2 (ADC1_CH2)
#define LDR_BR 3  // GPIO 3 (ADC1_CH3)

// Servos
#define SERVO_H_PIN 18
#define SERVO_V_PIN 19

// I2C pins for ESP32-C6
#define I2C_SDA 6
#define I2C_SCL 7

// ==========================================
// LCD
// ==========================================
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ==========================================
// INA219
// ==========================================
Adafruit_INA219 ina219;

// ==========================================
// DHT11 Sensor
// ==========================================
#define DHT_PIN 4
#define DHT_TYPE DHT11
DHT dht(DHT_PIN, DHT_TYPE);

// ==========================================
// Servo Objects
// ==========================================
Servo horizontalServo;
Servo verticalServo;

// ==========================================
// State Variables
// ==========================================
int servoH = 90;
int servoV = 45;

const int H_MIN = 0;
const int H_MAX = 180;

const int V_MIN = 10;
const int V_MAX = 100;

// Tracking tolerance — lowered for torch demo sensitivity (LDR diffs ~10-15 units)
const int tolerance = 10;

// Mode control (Auto-tracking vs Remote steering override)
bool isAutoTracking = true;

// Diagnostic Status
int systemFaultCode = 0; // 0=Nominal, 1=Dust/Soiling, 3=Overheat, 4=Motor Blockage
unsigned long lastTelemetryTime = 0;
unsigned long lastCommandPollTime = 0;

const unsigned long telemetryInterval = 2000; // POST telemetry every 2s
const unsigned long commandPollInterval = 500; // Poll commands every 500ms

// Forward Declarations
void connectWiFi();
void sendTelemetry();
void sendTelemetryTo(const char* host, float v, float i_mA, float p_mW, float temp, float humidity, int tl, int bl, int tr, int br);
void sendFaultAlert(String severity, String message);
void sendFaultAlertTo(const char* host, String severity, String message);
void pollCommands();
void pollCommandsFrom(const char* host);
void runCleaningSweep();
void performOTA(String url, String md5);
float readTemperature();
float readHumidity();

// ==========================================
// Setup
// ==========================================
void setup()
{
  Serial.begin(115200);

  // Initialize I2C with ESP32-C6 pins
  Wire.begin(I2C_SDA, I2C_SCL);

  // LCD
  lcd.init();
  lcd.backlight();
  lcd.print("ESP32-C6 Solar");
  lcd.setCursor(0, 1);
  lcd.print("Booting up...");

  // INA219
  if (!ina219.begin())
  {
    Serial.println("INA219 NOT FOUND!");
    lcd.clear();
    lcd.print("INA219 Error");
    systemFaultCode = 5; // Sensor fault
    delay(2000);
  }

  // DHT
  dht.begin();

  // Servo setup
  horizontalServo.setPeriodHertz(50);
  verticalServo.setPeriodHertz(50);

  horizontalServo.attach(SERVO_H_PIN, 500, 2400);
  verticalServo.attach(SERVO_V_PIN, 500, 2400);

  horizontalServo.write(servoH);
  verticalServo.write(servoV);

  // Connect to Local Wi-Fi
  connectWiFi();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Solar Tracker");
  lcd.setCursor(0, 1);
  lcd.print("ESP32-C6 Ready");

  delay(2000);
}

// ==========================================
// Main Loop
// ==========================================
void loop()
{
  // 1. Maintain Wi-Fi Connection (Non-blocking background reconnect)
  static unsigned long lastWifiCheck = 0;
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastLcdUpdate = 0;
    if (millis() - lastLcdUpdate >= 5000) {
      lastLcdUpdate = millis();
      lcd.clear();
      lcd.print("WiFi Offline");
      lcd.setCursor(0, 1);
      lcd.print("Reconnecting...");
    }
    
    if (lastWifiCheck == 0 || millis() - lastWifiCheck >= 15000) {
      lastWifiCheck = millis();
      Serial.println("Wi-Fi disconnected. Reconnecting in background...");
      WiFi.disconnect(false);
      delay(50);
      WiFi.begin(ssid, password);
    }
  } else {
    lastWifiCheck = 0; // Reset check timer once connected
  }

  // 2. Perform closed-loop tracking if in AUTO mode
  int tl = analogRead(LDR_TL);
  int tr = analogRead(LDR_TR);
  int bl = analogRead(LDR_BL);
  int br = analogRead(LDR_BR);

  if (isAutoTracking)
  {
    // Calculate averages (same naming convention as reference code)
    int avt = (tl + tr) / 2;  // Top average
    int avd = (bl + br) / 2;  // Bottom average
    int avl = (tl + bl) / 2;  // Left average
    int avr = (tr + br) / 2;  // Right average

    int dvert  = avt - avd;   // Positive = top brighter  → tilt up
    int dhoriz = avl - avr;   // Positive = left brighter → turn left

    // --- Proportional step: bigger difference = bigger servo move ---
    // Maps |diff| range [tolerance..400] → step [1..5] degrees
    // Gives snappy response under torch without overshoot under real sun
    auto calcStep = [](int diff) -> int {
      int absDiff = abs(diff);
      if (absDiff < 30)  return 1;
      if (absDiff < 80)  return 2;
      if (absDiff < 150) return 3;
      if (absDiff < 250) return 4;
      return 5;
    };

    // Vertical Tracking
    if (abs(dvert) > tolerance) {
      int step = calcStep(dvert);
      servoV += (dvert > 0) ? step : -step;
      servoV = constrain(servoV, V_MIN, V_MAX);
      verticalServo.write(servoV);
    }

    // Horizontal Tracking
    if (abs(dhoriz) > tolerance) {
      int step = calcStep(dhoriz);
      servoH += (dhoriz > 0) ? -step : step;  // Left brighter → decrease H angle
      servoH = constrain(servoH, H_MIN, H_MAX);
      horizontalServo.write(servoH);
    }
  }

  // 3. Read Electrical & Environmental Sensors
  float busVoltage = 0.0;
  float current_mA = 0.0;
  float power_mW = 0.0;

  if (systemFaultCode != 5) {
    busVoltage = ina219.getBusVoltage_V();
    current_mA = ina219.getCurrent_mA();
    power_mW = ina219.getPower_mW();
  }

  float temp = readTemperature();
  float humidity = readHumidity();

  // 4. Overheat Safety Interlocking
  if (temp > 65.0 && systemFaultCode != 3) {
    systemFaultCode = 3; // Overheat
    sendFaultAlert("critical", "Critical temperature anomaly: " + String(temp, 1) + "C. Risk of thermal degradation.");
    // Move to safe stow angle immediately
    isAutoTracking = false;
    servoH = 90;
    servoV = V_MIN;
    horizontalServo.write(servoH);
    verticalServo.write(servoV);
  } else if (temp <= 60.0 && systemFaultCode == 3) {
    systemFaultCode = 0; // Temp recovered
    isAutoTracking = true;
  }

  // 5. Publish Telemetry to Website API
  if (millis() - lastTelemetryTime >= telemetryInterval) {
    sendTelemetry();
    lastTelemetryTime = millis();
  }

  // 6. Poll Pending Control Commands
  if (millis() - lastCommandPollTime >= commandPollInterval) {
    pollCommands();
    lastCommandPollTime = millis();
  }

  // 7. Render local LCD
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("V:");
  lcd.print(busVoltage, 1);
  lcd.print(" T:");
  lcd.print((int)temp);
  lcd.print(" H:");
  lcd.print((int)humidity);

  lcd.setCursor(0, 1);
  if (isAutoTracking) {
    lcd.print("P:");
    lcd.print(power_mW / 1000.0, 2);
    lcd.print(" H:");
    lcd.print(servoH);
  } else {
    lcd.print("MANUAL H:");
    lcd.print(servoH);
    lcd.print(" V:");
    lcd.print(servoV);
  }

  delay(10); // Fast tracking loop — matches reference dtime=10
}

// ==========================================
// Helper Functions
// ==========================================

int getJsonInt(String json, String key) {
  int keyIdx = json.indexOf("\"" + key + "\"");
  if (keyIdx == -1) return -999;
  
  int colonIdx = json.indexOf(":", keyIdx + key.length() + 2);
  if (colonIdx == -1) return -999;
  
  int start = colonIdx + 1;
  while (start < json.length() && isSpace(json.charAt(start))) {
    start++;
  }
  
  int end = start;
  while (end < json.length() && (isDigit(json.charAt(end)) || json.charAt(end) == '-' || json.charAt(end) == '+')) {
    end++;
  }
  
  if (start == end) return -999;
  return json.substring(start, end).toInt();
}

bool getJsonBool(String json, String key, bool defaultValue) {
  int keyIdx = json.indexOf("\"" + key + "\"");
  if (keyIdx == -1) return defaultValue;
  
  int colonIdx = json.indexOf(":", keyIdx + key.length() + 2);
  if (colonIdx == -1) return defaultValue;
  
  int start = colonIdx + 1;
  while (start < json.length() && isSpace(json.charAt(start))) {
    start++;
  }
  
  if (json.substring(start, start + 4) == "true") return true;
  if (json.substring(start, start + 5) == "false") return false;
  return defaultValue;
}

String getJsonString(String json, String key) {
  int keyIdx = json.indexOf("\"" + key + "\"");
  if (keyIdx == -1) return "";
  
  int colonIdx = json.indexOf(":", keyIdx + key.length() + 2);
  if (colonIdx == -1) return "";
  
  int startQuote = json.indexOf("\"", colonIdx + 1);
  if (startQuote == -1) return "";
  
  int endQuote = json.indexOf("\"", startQuote + 1);
  if (endQuote == -1) return "";
  
  String val = json.substring(startQuote + 1, endQuote);
  val.replace("\\/", "/"); 
  return val;
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  
  // Ensure we terminate any active background connection attempts first
  WiFi.disconnect(false);
  delay(100);
  
  Serial.print("Connecting to Wi-Fi SSID: ");
  Serial.println(ssid);
  
  lcd.clear();
  lcd.print("Connecting WiFi");
  lcd.setCursor(0, 1);
  lcd.print(ssid);

  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi Connected!");
    Serial.print("Local IP Address: ");
    Serial.println(WiFi.localIP());
    lcd.clear();
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
  } else {
    Serial.println("\nWi-Fi connection failed.");
    lcd.clear();
    lcd.print("WiFi Fail!");
  }
  delay(1000);
}

float readTemperature() {
  // Try reading from DHT11 first
  float temp = dht.readTemperature();
  if (!isnan(temp) && temp >= -20.0 && temp <= 100.0) {
    return temp;
  }

  // Read ESP32-C6 internal core temperature
  #if defined(ESP32)
  temp = temperatureRead();
  if (isnan(temp) || temp < -40.0 || temp > 150.0) {
    // Return simulated ambient temp if internal read is out of bounds
    return 32.5 + random(-10, 10) / 10.0;
  }
  return temp;
  #else
  return 30.2;
  #endif
}

float readHumidity() {
  float hum = dht.readHumidity();
  if (isnan(hum) || hum < 0.0 || hum > 100.0) {
    return 55.0; // fallback to 55%
  }
  return hum;
}

void sendTelemetryTo(const char* host,
                     float busVoltage, float current_mA, float power_mW,
                     float temp, float humidity,
                     int ldr_tl, int ldr_bl, int ldr_tr, int ldr_br) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure clientSecure;

  String url = String(host) + "/api/telemetry";
  bool success = false;
  if (url.startsWith("https://")) {
    clientSecure.setInsecure();
    success = http.begin(clientSecure, url);
  } else {
    success = http.begin(client, url);
  }

  if (!success) {
    Serial.printf("[Telemetry] HTTP begin failed for: %s\n", host);
    return;
  }

  http.addHeader("Content-Type", "application/json");

  // Ingested current and power are scaled to Amps and Watts for web graphing compatibility
  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"v\":" + String(busVoltage, 2) + ",";
  json += "\"i\":" + String(current_mA / 1000.0, 4) + ",";
  json += "\"p\":" + String(power_mW / 1000.0, 4) + ",";
  json += "\"temp\":" + String(temp, 1) + ",";
  json += "\"humidity\":" + String(humidity, 1) + ",";
  json += "\"fault\":" + String(systemFaultCode) + ",";
  json += "\"ldr\":[" + String(ldr_tl) + ","
                      + String(ldr_bl) + ","
                      + String(ldr_tr) + ","
                      + String(ldr_br) + "]";
  json += "}";

  int httpCode = http.POST(json);
  String response = http.getString();
  Serial.printf("[Telemetry] POST Code: %d, Response: %s (Host: %s)\n", httpCode, response.c_str(), host);

  http.end();
}

void sendTelemetry() {
  // Read all sensors ONCE per cycle
  float busVoltage = (systemFaultCode != 5) ? ina219.getBusVoltage_V() : 0.0;
  float current_mA = (systemFaultCode != 5) ? ina219.getCurrent_mA() : 0.0;
  float power_mW   = (systemFaultCode != 5) ? ina219.getPower_mW()   : 0.0;
  float temp       = readTemperature();
  float humidity   = readHumidity();
  int   ldr_tl     = analogRead(LDR_TL);  // Top-Left
  int   ldr_bl     = analogRead(LDR_BL);  // Bottom-Left
  int   ldr_tr     = analogRead(LDR_TR);  // Top-Right
  int   ldr_br     = analogRead(LDR_BR);  // Bottom-Right

  // ---- Serial Monitor Live Readings (printed once per cycle) ----
  Serial.println(F("========= SENSOR READINGS ========="));
  Serial.printf("  Voltage   : %.2f V\n",               busVoltage);
  Serial.printf("  Current   : %.2f mA  (%.4f A)\n",    current_mA, current_mA / 1000.0);
  Serial.printf("  Power     : %.2f mW  (%.4f W)\n",    power_mW,   power_mW   / 1000.0);
  Serial.printf("  Temp      : %.1f C\n",                temp);
  Serial.printf("  Humidity  : %.1f %%\n",               humidity);
  Serial.printf("  LDR TL/BL/TR/BR : %d / %d / %d / %d\n", ldr_tl, ldr_bl, ldr_tr, ldr_br);

  // Compute differences for diagnostic visibility
  int avt = (ldr_tl + ldr_tr) / 2;
  int avd = (ldr_bl + ldr_br) / 2;
  int avl = (ldr_tl + ldr_bl) / 2;
  int avr = (ldr_tr + ldr_br) / 2;
  Serial.printf("  Avg Top/Bot/Left/Right: %d / %d / %d / %d\n", avt, avd, avl, avr);
  Serial.printf("  Vert diff: %d  |  Horiz diff: %d  |  Tol: %d\n", avt - avd, avl - avr, tolerance);
  Serial.printf("  Fault Code: %d | Mode: %s\n",        systemFaultCode, isAutoTracking ? "AUTO" : "MANUAL");
  Serial.printf("  Servo H/V : %d / %d\n",              servoH, servoV);
  Serial.println(F("==================================="));

  // Post the same snapshot to both endpoints
  sendTelemetryTo(localHost, busVoltage, current_mA, power_mW, temp, humidity, ldr_tl, ldr_bl, ldr_tr, ldr_br);
  if (shouldUseVercel()) {
    sendTelemetryTo(vercelHost, busVoltage, current_mA, power_mW, temp, humidity, ldr_tl, ldr_bl, ldr_tr, ldr_br);
  }
}

void sendFaultAlertTo(const char* host, String severity, String message) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure clientSecure;
  
  String url = String(host) + "/api/faults";
  bool success = false;
  if (url.startsWith("https://")) {
    clientSecure.setInsecure();
    success = http.begin(clientSecure, url);
  } else {
    success = http.begin(client, url);
  }

  if (!success) return;

  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"severity\":\"" + severity + "\",";
  json += "\"message\":\"" + message + "\"";
  json += "}";

  int httpCode = http.POST(json);
  String response = http.getString();
  Serial.printf("[Fault Alert] Status Code: %d, Response: %s (Host: %s)\n", httpCode, response.c_str(), host);
  http.end();
}

void sendFaultAlert(String severity, String message) {
  sendFaultAlertTo(localHost, severity, message);
  if (shouldUseVercel()) {
    sendFaultAlertTo(vercelHost, severity, message);
  }
}

void pollCommandsFrom(const char* host) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure clientSecure;
  
  String url = String(host) + "/api/commands/poll?device_id=" + String(DEVICE_ID);
  bool success = false;
  
  if (url.startsWith("https://")) {
    clientSecure.setInsecure();
    success = http.begin(clientSecure, url);
  } else {
    success = http.begin(client, url);
  }

  if (!success) return;

  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String response = http.getString();
    Serial.println("[Commands Poll] Response: " + response + " (Host: " + host + ")");

    // Parse commands using index matching (lightweight, zero dependency)
    if (response.indexOf("\"action\"") != -1) {
      String action = "";
      int actionIdx = response.indexOf("\"action\":\"");
      if (actionIdx != -1) {
        int start = actionIdx + 10;
        int end = response.indexOf("\"", start);
        action = response.substring(start, end);
        Serial.println("[Command Router] Parsed Action: " + action);
      }

      if (action == "reboot") {
        Serial.println("Reboot command acknowledged. Resetting chip...");
        lcd.clear();
        lcd.print("Remote Reboot...");
        delay(1000);
        ESP.restart();
      }
      else if (action == "stow") {
        Serial.println("Stow command acknowledged. Locking panel flat...");
        isAutoTracking = false;
        servoH = 90;
        servoV = V_MIN;
        horizontalServo.write(servoH);
        verticalServo.write(servoV);
        lcd.clear();
        lcd.print("Mode: STOWED (0)");
      }
      else if (action == "clean") {
        Serial.println("Clean command acknowledged. Initiating wiper sweep...");
        runCleaningSweep();
      }
      else if (action == "override") {
        Serial.println("Manual override angles received.");
        
        isAutoTracking = getJsonBool(response, "auto", true);
        
        int azimuth = getJsonInt(response, "azimuth");
        if (azimuth != -999) {
          // Adjust horizontal servo. Negative azimuth (East) -> Larger servo angle
          servoH = constrain(90 - azimuth, H_MIN, H_MAX);
          horizontalServo.write(servoH);
          Serial.printf("Set manual horizontal servo to %d deg\n", servoH);
        }
        
        int elevation = getJsonInt(response, "elevation");
        if (elevation != -999) {
          servoV = constrain(elevation, V_MIN, V_MAX);
          verticalServo.write(servoV);
          Serial.printf("Set manual vertical servo to %d deg\n", servoV);
        }

        lcd.clear();
        if (isAutoTracking) {
          lcd.print("Mode: AUTO");
        } else {
          lcd.print("Mode: OVERRIDE");
          lcd.setCursor(0, 1);
          lcd.printf("H:%d V:%d", servoH, servoV);
        }
      }
      else if (action == "calibrate") {
        // Calibrate action triggers the OTA update pipeline
        String otaUrlStr = getJsonString(response, "ota_url");
        String md5Hash = getJsonString(response, "md5_hash");

        if (otaUrlStr.length() > 0) {
          Serial.println("OTA deployment package detected. Fetching...");
          performOTA(otaUrlStr, md5Hash);
        }
      }
    }
  } else {
    // Suppress verbose connection failure logs to avoid spamming the console
    if (httpCode != -1) {
      Serial.printf("[Commands Poll] Connection failed. HTTP: %d (Host: %s)\n", httpCode, host);
    }
  }

  http.end();
}

void pollCommands() {
  pollCommandsFrom(localHost);
  if (shouldUseVercel()) {
    pollCommandsFrom(vercelHost);
  }
}

void runCleaningSweep() {
  lcd.clear();
  lcd.print("Sweeping Panel");
  lcd.setCursor(0, 1);
  lcd.print("Cleaning...     ");

  int currentH = servoH;
  int currentV = servoV;

  // Sweep East to West
  for (int h = currentH; h <= H_MAX; h += 2) {
    horizontalServo.write(h);
    delay(15);
  }
  for (int h = H_MAX; h >= H_MIN; h -= 2) {
    horizontalServo.write(h);
    delay(15);
  }
  for (int h = H_MIN; h <= 90; h += 2) {
    horizontalServo.write(h);
    delay(15);
  }
  servoH = 90;

  // Sweep Elevation flat to zenith
  for (int v = currentV; v <= V_MAX; v += 2) {
    verticalServo.write(v);
    delay(15);
  }
  for (int v = V_MAX; v >= V_MIN; v -= 2) {
    verticalServo.write(v);
    delay(15);
  }
  for (int v = V_MIN; v <= 45; v += 2) {
    verticalServo.write(v);
    delay(15);
  }
  servoV = 45;

  isAutoTracking = true;
  lcd.clear();
  lcd.print("Sweep Complete");
  lcd.setCursor(0, 1);
  lcd.print("Mode: AUTO      ");
  delay(1000);
}

void performOTA(String url, String md5) {
  Serial.println("OTA Update: Initializing download...");
  lcd.clear();
  lcd.print("OTA Upgrade");
  lcd.setCursor(0, 1);
  lcd.print("Downloading...");

  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure(); // Bypass cert checks for local dev bucket URLs

  http.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);
  
  if (!http.begin(client, url)) {
    Serial.println("OTA Error: Failed to open HTTP client");
    lcd.clear();
    lcd.print("OTA Init Fail");
    delay(2000);
    return;
  }

  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    int contentLength = http.getSize();
    WiFiClient* stream = http.getStreamPtr();

    Serial.printf("Binary size: %d bytes\n", contentLength);

    if (md5.length() == 32) {
      Update.setMD5(md5.c_str());
      Serial.println("Target MD5: " + md5);
    }

    if (Update.begin(contentLength)) {
      lcd.setCursor(0, 1);
      lcd.print("Writing Flash..");
      Serial.println("Flashing partition...");

      size_t written = Update.writeStream(*stream);

      if (written == contentLength) {
        Serial.printf("Flashed %d bytes successfully.\n", written);
      } else {
        Serial.printf("Flash write mismatch. Wrote %d/%d bytes.\n", written, contentLength);
      }

      if (Update.end()) {
        if (Update.isFinished()) {
          Serial.println("OTA Complete! Resetting chip...");
          lcd.clear();
          lcd.print("OTA Complete!");
          lcd.setCursor(0, 1);
          lcd.print("Rebooting...");
          delay(2000);
          ESP.restart();
        } else {
          Serial.println("OTA finished but status is not verified.");
        }
      } else {
        Serial.printf("OTA Flashing Error: %d\n", Update.getError());
        lcd.clear();
        lcd.print("OTA Err Code:");
        lcd.setCursor(0, 1);
        lcd.print(Update.getError());
        delay(3000);
      }
    } else {
      Serial.println("OTA Error: Insufficient flash storage partition size.");
      lcd.clear();
      lcd.print("OTA Space Error");
      delay(3000);
    }
  } else {
    Serial.printf("OTA download failed. GET response: %d\n", httpCode);
    lcd.clear();
    lcd.print("Download Failed");
    delay(3000);
  }

  http.end();
}
