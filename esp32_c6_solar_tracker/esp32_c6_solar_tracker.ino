#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Update.h>
#include <Wire.h>
#include <esp_arduino_version.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_INA219.h>

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

// Replace with your development machine's local IP address
// e.g. "http://192.168.1.15:5173/api/telemetry"
const char* telemetryUrl = "https://solar-tracker-pi-jade.vercel.app/api/telemetry";
const char* faultUrl     = "https://solar-tracker-pi-jade.vercel.app/api/faults";
const char* commandUrl   = "https://solar-tracker-pi-jade.vercel.app/api/commands/poll?device_id=";

// Target Device ID registered in your website's database
// Default for Delhi North Tracker #01: "d1e028b0-a541-4702-8c20-3354316d2cf1"
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

// Tracking tolerance
const int tolerance = 50;

// Mode control (Auto-tracking vs Remote steering override)
bool isAutoTracking = true;

// Diagnostic Status
int systemFaultCode = 0; // 0=Nominal, 1=Dust/Soiling, 3=Overheat, 4=Motor Blockage
unsigned long lastTelemetryTime = 0;
unsigned long lastCommandPollTime = 0;

const unsigned long telemetryInterval = 2000; // POST telemetry every 2s
const unsigned long commandPollInterval = 2000; // Poll commands every 2s

// Forward Declarations
void connectWiFi();
void sendTelemetry();
void sendFaultAlert(String severity, String message);
void pollCommands();
void runCleaningSweep();
void performOTA(String url, String md5);
float readTemperature();

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
    // Calculate averages
    int topAvg = (tl + tr) / 2;
    int bottomAvg = (bl + br) / 2;

    int leftAvg = (tl + bl) / 2;
    int rightAvg = (tr + br) / 2;

    int verticalDiff = topAvg - bottomAvg;
    int horizontalDiff = leftAvg - rightAvg;

    // Vertical Tracking
    if (abs(verticalDiff) > tolerance)
    {
      if (verticalDiff > 0) {
        servoV++;
      } else {
        servoV--;
      }
      servoV = constrain(servoV, V_MIN, V_MAX);
      verticalServo.write(servoV);
    }

    // Horizontal Tracking
    if (abs(horizontalDiff) > tolerance)
    {
      if (horizontalDiff > 0) {
        servoH--;
      } else {
        servoH++;
      }
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
  lcd.print(" I:");
  lcd.print(current_mA, 0);

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

  delay(100);
}

// ==========================================
// Helper Functions
// ==========================================

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
  // Read ESP32-C6 internal core temperature
  #if defined(ESP32)
  float temp = temperatureRead();
  if (isnan(temp) || temp < -40.0 || temp > 150.0) {
    // Return simulated ambient temp if internal read is out of bounds
    return 32.5 + random(-10, 10) / 10.0;
  }
  return temp;
  #else
  return 30.2;
  #endif
}

void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure clientSecure;
  
  bool success = false;
  if (String(telemetryUrl).startsWith("https://")) {
    clientSecure.setInsecure();
    success = http.begin(clientSecure, telemetryUrl);
  } else {
    success = http.begin(client, telemetryUrl);
  }

  if (!success) {
    Serial.println("HTTP begin for telemetry failed");
    return;
  }

  http.addHeader("Content-Type", "application/json");

  float busVoltage = (systemFaultCode != 5) ? ina219.getBusVoltage_V() : 0.0;
  float current_mA = (systemFaultCode != 5) ? ina219.getCurrent_mA() : 0.0;
  float power_mW = (systemFaultCode != 5) ? ina219.getPower_mW() : 0.0;
  float temp = readTemperature();

  // Ingested current and power are scaled to Amps and Watts for web graphing compatibility
  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"v\":" + String(busVoltage, 2) + ",";
  json += "\"i\":" + String(current_mA / 1000.0, 4) + ","; 
  json += "\"p\":" + String(power_mW / 1000.0, 4) + ",";
  json += "\"temp\":" + String(temp, 1) + ",";
  json += "\"fault\":" + String(systemFaultCode) + ",";
  json += "\"ldr\":[" + String(analogRead(LDR_TL)) + "," 
                      + String(analogRead(LDR_BL)) + "," 
                      + String(analogRead(LDR_TR)) + "," 
                      + String(analogRead(LDR_BR)) + "]";
  json += "}";

  int httpCode = http.POST(json);
  String response = http.getString();
  Serial.printf("[Telemetry] POST Code: %d, Response: %s\n", httpCode, response.c_str());

  http.end();
}

void sendFaultAlert(String severity, String message) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure clientSecure;
  
  bool success = false;
  if (String(faultUrl).startsWith("https://")) {
    clientSecure.setInsecure();
    success = http.begin(clientSecure, faultUrl);
  } else {
    success = http.begin(client, faultUrl);
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
  Serial.printf("[Fault Alert] Status Code: %d, Response: %s\n", httpCode, response.c_str());
  http.end();
}

void pollCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure clientSecure;
  
  String url = String(commandUrl) + String(DEVICE_ID);
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
    Serial.println("[Commands Poll] Response: " + response);

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
        
        isAutoTracking = (response.indexOf("\"auto\":true") != -1);
        
        // Extract azimuth angle (-45 to 45)
        int azimuthIdx = response.indexOf("\"azimuth\":");
        if (azimuthIdx != -1) {
          int start = azimuthIdx + 10;
          int endComma = response.indexOf(",", start);
          int endBracket = response.indexOf("}", start);
          int end = (endComma != -1 && endComma < endBracket) ? endComma : endBracket;
          int azimuth = response.substring(start, end).toInt();
          // Adjust horizontal servo. Negative azimuth (East) -> Larger servo angle
          servoH = constrain(90 - azimuth, H_MIN, H_MAX);
          horizontalServo.write(servoH);
          Serial.printf("Set manual horizontal servo to %d deg\n", servoH);
        }
        
        // Extract elevation angle (0 to 90)
        int elevationIdx = response.indexOf("\"elevation\":");
        if (elevationIdx != -1) {
          int start = elevationIdx + 12;
          int endComma = response.indexOf(",", start);
          int endBracket = response.indexOf("}", start);
          int end = (endComma != -1 && endComma < endBracket) ? endComma : endBracket;
          int elevation = response.substring(start, end).toInt();
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
        String otaUrlStr = "";
        int urlIdx = response.indexOf("\"ota_url\":\"");
        if (urlIdx != -1) {
          int start = urlIdx + 11;
          int end = response.indexOf("\"", start);
          otaUrlStr = response.substring(start, end);
          otaUrlStr.replace("\\/", "/"); // Decode escaped URL characters
        }

        String md5Hash = "";
        int md5Idx = response.indexOf("\"md5_hash\":\"");
        if (md5Idx != -1) {
          int start = md5Idx + 12;
          int end = response.indexOf("\"", start);
          md5Hash = response.substring(start, end);
        }

        if (otaUrlStr.length() > 0) {
          Serial.println("OTA deployment package detected. Fetching...");
          performOTA(otaUrlStr, md5Hash);
        }
      }
    }
  } else {
    Serial.printf("[Commands Poll] Connection failed. HTTP: %d\n", httpCode);
  }

  http.end();
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
