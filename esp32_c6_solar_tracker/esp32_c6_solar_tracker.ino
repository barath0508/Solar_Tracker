// ============================================================
//  AadhavanAI — ESP32-C6 Solar Tracker Firmware
//  All 12 bugs fixed (see audit notes inline with FIX: tags)
// ============================================================

#include <Adafruit_INA219.h>
#include <DHT.h>
#include <HTTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <Update.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <esp_arduino_version.h>

// ============================================================
//  Custom crash-proof Servo — bypasses buggy ESP32Servo lib
// ============================================================
class Servo {
private:
  int _pin;
  int _channel;

public:
  Servo() : _pin(-1), _channel(-1) {}

  void setPeriodHertz(int hz) { /* 50 Hz is set inside attach() */ }

  void attach(int pin, int minPulse = 500, int maxPulse = 2400) {
    _pin = pin;
#if defined(ESP_ARDUINO_VERSION) && \
    ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
    ledcAttach(_pin, 50, 14); // 50 Hz, 14-bit
#else
    static int nextChannel = 0;
    _channel = nextChannel++;
    ledcSetup(_channel, 50, 14);
    ledcAttachPin(_pin, _channel);
#endif
  }

  void write(int angle) {
    if (_pin == -1) return;
    int pulseWidthUs = map(angle, 0, 180, 500, 2400);
    int duty = map(pulseWidthUs, 0, 20000, 0, 16383);
#if defined(ESP_ARDUINO_VERSION) && \
    ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
    ledcWrite(_pin, duty);
#else
    ledcWrite(_channel, duty);
#endif
  }
};

// ============================================================
//  Wi-Fi & Server Configuration
// ============================================================
const char *ssid     = "POCO X6 5G";
const char *password = "";

const char *localHost  = "http://10.72.126.126:5173";
const char *vercelHost = "https://solar-tracker-pi-jade.vercel.app";

bool shouldUseVercel() {
  String host = String(vercelHost);
  return (host.length() > 0 &&
          host.indexOf("your-vercel-project") == -1 &&
          host.startsWith("http"));
}

#define DEVICE_ID "d1e028b0-a541-4702-8c20-3354316d2cf1"

// ============================================================
//  ESP32-C6 Pin Mappings
// ============================================================
#define LDR_TL     0   // GPIO 0 — ADC1_CH0 — Top-Left
#define LDR_TR     1   // GPIO 1 — ADC1_CH1 — Top-Right
#define LDR_BL     2   // GPIO 2 — ADC1_CH2 — Bottom-Left
#define LDR_BR     3   // GPIO 3 — ADC1_CH3 — Bottom-Right

#define SERVO_H_PIN 18
#define SERVO_V_PIN 19
#define BUZZER_PIN   5
#define I2C_SDA      6
#define I2C_SCL      7
#define DHT_PIN      4
#define DHT_TYPE DHT11

// ============================================================
//  Peripherals
// ============================================================
LiquidCrystal_I2C lcd(0x27, 16, 2);
Adafruit_INA219    ina219;
DHT                dht(DHT_PIN, DHT_TYPE);
Servo              horizontalServo;
Servo              verticalServo;

// ============================================================
//  State
// ============================================================
int servoH = 90;
int servoV = 45;

const int H_MIN = 0;
const int H_MAX = 180;
const int V_MIN = 10;
const int V_MAX = 100;

// FIX #11 — tolerance raised from 3 → 15 to prevent servo jitter from
//           12-bit ADC noise (3 was 0.07% of 4095 — below noise floor)
const int TRACKING_TOLERANCE = 15;

// FIX #11 — LDR divisor controls sensitivity (20 = 1 servo degree per 20 ADC
//           counts). Tune 10–30 depending on LDR spacing and light source.
const int LDR_STEP_DIVISOR = 20;

bool isAutoTracking = true;

int  systemFaultCode = 0;
// 0=Nominal, 1=Dust/Soiling, 3=Overheat, 4=Motor Blockage,
// 5=Sensor Fault, 7=Open Circuit, 8=Closed Circuit, 9=Solar Panel Fault

// FIX #6 — suppress electrical fault checking for 3 s while INA219 stabilises
const unsigned long STARTUP_GRACE_MS = 3000;
unsigned long       startupTime      = 0;

// Timing
unsigned long lastTelemetryTime    = 0;
unsigned long lastCommandPollTime  = 0;
unsigned long lastOverridePollTime = 0;
unsigned long lastLcdUpdateTime    = 0;  // FIX #1 — LCD rate-limiter

const unsigned long telemetryInterval   = 2000;  // POST telemetry every 2 s
const unsigned long commandPollInterval = 750;   // FIX #8 — staggered from 500→750 ms
const unsigned long overridePollInterval = 100;  // Fast-lane every 100 ms
const unsigned long lcdRefreshInterval  = 500;   // FIX #1 — LCD only redraws every 500 ms

// FIX #8 — simple mutex: only one HTTP request runs at a time
volatile bool httpBusy = false;

// Sensor snapshot shared between loop() and sendTelemetry() — FIX #4
float g_busVoltage = 0.0;
float g_current_mA = 0.0;
float g_power_mW   = 0.0;
float g_temp       = NAN;
float g_humidity   = NAN;
int   g_ldr_tl = 0, g_ldr_tr = 0, g_ldr_bl = 0, g_ldr_br = 0;

// ============================================================
//  Forward Declarations
// ============================================================
void  connectWiFi();
void  readAllSensors();
void  sendTelemetry();
void  sendTelemetryTo(const char *host);
void  sendFaultAlert(String severity, String message);
void  sendFaultAlertTo(const char *host, String severity, String message);
void  pollCommands();
void  pollCommandsFrom(const char *host);
void  pollFastLaneOverride();
void  runCleaningSweep();
void  performOTA(String url, String md5);
int   getJsonInt(String json, String key);
bool  getJsonBool(String json, String key, bool defaultValue);
String getJsonString(String json, String key);

// ============================================================
//  Setup
// ============================================================
void setup() {
  Serial.begin(115200);

  Wire.begin(I2C_SDA, I2C_SCL);

  lcd.init();
  lcd.backlight();
  lcd.print("ESP32-C6 Solar");
  lcd.setCursor(0, 1);
  lcd.print("Booting up...");

  // FIX #11 — explicitly set 12-bit ADC resolution
  analogReadResolution(12);

  // INA219
  if (!ina219.begin()) {
    Serial.println("[WARN] INA219 NOT FOUND — sensor fault.");
    lcd.clear();
    lcd.print("INA219 Error");
    systemFaultCode = 5;
    delay(2000);
  }

  // DHT
  dht.begin();

  // Servos
  horizontalServo.setPeriodHertz(50);
  verticalServo.setPeriodHertz(50);
  horizontalServo.attach(SERVO_H_PIN, 500, 2400);
  verticalServo.attach(SERVO_V_PIN, 500, 2400);
  horizontalServo.write(servoH);
  verticalServo.write(servoV);

  // Buzzer
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  connectWiFi();

  startupTime = millis(); // FIX #6 — record boot time for grace period

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Solar Tracker");
  lcd.setCursor(0, 1);
  lcd.print("C6 Ready");
  delay(1500);
}

// ============================================================
//  Main Loop
// ============================================================
void loop() {

  // ── 1. Non-blocking WiFi reconnect ────────────────────────
  static unsigned long lastWifiCheck = 0;
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastLcdWifi = 0;
    if (millis() - lastLcdWifi >= 5000) {
      lastLcdWifi = millis();
      lcd.clear();
      lcd.print("WiFi Offline");
      lcd.setCursor(0, 1);
      lcd.print("Reconnecting...");
      lastLcdUpdateTime = millis(); // prevent immediate LCD overwrite
    }
    if (lastWifiCheck == 0 || millis() - lastWifiCheck >= 15000) {
      lastWifiCheck = millis();
      Serial.println("[WiFi] Disconnected — attempting reconnect.");
      WiFi.disconnect(false);
      // FIX #7 — give radio 200 ms to fully reset before calling begin()
      delay(200);
      WiFi.mode(WIFI_STA);
      WiFi.begin(ssid, password);
    }
  } else {
    lastWifiCheck = 0;
  }

  // ── 2. Read ALL sensors once per loop tick ──────────────── FIX #4
  readAllSensors();

  // ── 3. Auto-tracking ──────────────────────────────────────
  if (isAutoTracking) {
    int avt = (g_ldr_tl + g_ldr_tr) / 2; // Top average
    int avd = (g_ldr_bl + g_ldr_br) / 2; // Bottom average
    int avl = (g_ldr_tl + g_ldr_bl) / 2; // Left average
    int avr = (g_ldr_tr + g_ldr_br) / 2; // Right average

    int dvert  = avt - avd; // positive → tilt up
    int dhoriz = avl - avr; // positive → rotate left (CCW from top)

    // FIX #2 — was `int * 0.05` which always truncated to 0.
    //          Now uses integer division; apply only beyond tolerance band.
    if (abs(dhoriz) > TRACKING_TOLERANCE) {
      int step = constrain(dhoriz / LDR_STEP_DIVISOR, -5, 5);
      servoH   = constrain(servoH + step, H_MIN, H_MAX);
      horizontalServo.write(servoH);
    }

    if (abs(dvert) > TRACKING_TOLERANCE) {
      int step = constrain(dvert / LDR_STEP_DIVISOR, -5, 5);
      servoV   = constrain(servoV + step, V_MIN, V_MAX);
      verticalServo.write(servoV);
    }
  }

  // ── 4. Overheat Safety ────────────────────────────────────
  // FIX #5 — only trigger thermal stow when temp is a valid reading (not NAN)
  if (!isnan(g_temp)) {
    if (g_temp > 65.0 && systemFaultCode != 3) {
      systemFaultCode = 3;
      sendFaultAlert("critical",
                     "Critical temperature anomaly: " + String(g_temp, 1) +
                     "C. Risk of thermal degradation.");
      isAutoTracking = false;
      servoH = 90; servoV = V_MIN;
      horizontalServo.write(servoH);
      verticalServo.write(servoV);
    } else if (g_temp <= 60.0 && systemFaultCode == 3) {
      systemFaultCode = 0;
      isAutoTracking  = true;
    }
  }

  // ── 5. Electrical Fault Detection ─────────────────────────
  // FIX #6 — skip electrical fault checks during startup grace period
  bool inGrace = (millis() - startupTime < STARTUP_GRACE_MS);
  if (!inGrace && systemFaultCode != 5 && systemFaultCode != 3) {
    bool isVoltageZero = (g_busVoltage < 0.1f);
    bool isCurrentZero = (g_current_mA < 0.1f);

    if (isVoltageZero && isCurrentZero) {
      if (systemFaultCode != 9) {
        systemFaultCode = 9;
        sendFaultAlert("critical",
                       "Solar Panel Fault detected: both voltage and current are zero.");
      }
    } else if (isVoltageZero) {
      if (systemFaultCode != 8) {
        systemFaultCode = 8;
        sendFaultAlert("critical",
                       "Closed Circuit Fault detected: voltage is zero while current is drawn.");
      }
    } else if (isCurrentZero) {
      if (systemFaultCode != 7) {
        systemFaultCode = 7;
        sendFaultAlert("warning",
                       "Open Circuit Fault detected: current is zero while voltage remains positive.");
      }
    } else {
      if (systemFaultCode == 7 || systemFaultCode == 8 || systemFaultCode == 9) {
        systemFaultCode = 0;
      }
    }
  }

  // ── 6. Publish Telemetry ───────────────────────────────────
  if (!httpBusy && millis() - lastTelemetryTime >= telemetryInterval) {
    lastTelemetryTime = millis();
    sendTelemetry();
  }

  // ── 7. Poll Pending Commands (Supabase) ───────────────────
  // FIX #8 — staggered interval; skip if HTTP is already busy
  if (!httpBusy && millis() - lastCommandPollTime >= commandPollInterval) {
    lastCommandPollTime = millis();
    pollCommands();
  }

  // ── 8. Fast-lane override poll (local, 100 ms) ────────────
  if (!httpBusy && millis() - lastOverridePollTime >= overridePollInterval) {
    lastOverridePollTime = millis();
    pollFastLaneOverride();
  }

  // ── 9. Buzzer alarm (non-blocking) ────────────────────────
  if (systemFaultCode != 0) {
    int beepInterval = 1200;
    if      (systemFaultCode == 3 || systemFaultCode == 9) beepInterval = 300;
    else if (systemFaultCode == 7 || systemFaultCode == 8 ||
             systemFaultCode == 5 || systemFaultCode == 4) beepInterval = 600;
    bool buzzerOn = (millis() / beepInterval) % 2 == 0;
    digitalWrite(BUZZER_PIN, buzzerOn ? HIGH : LOW);
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }

  // ── 10. LCD refresh — rate-limited to 500 ms ──────────────
  // FIX #1 — was lcd.clear() every 5 ms flooding the I²C bus
  if (millis() - lastLcdUpdateTime >= lcdRefreshInterval) {
    lastLcdUpdateTime = millis();

    // Row 0: Voltage | Temp | Humidity
    lcd.setCursor(0, 0);
    lcd.print("V:");
    lcd.print(g_busVoltage, 1);
    lcd.print(" T:");
    if (isnan(g_temp)) lcd.print("--"); else lcd.print((int)g_temp);
    lcd.print(" H:");
    if (isnan(g_humidity)) lcd.print("--"); else lcd.print((int)g_humidity);
    lcd.print("  "); // clear any leftover characters

    // Row 1: Mode-dependent info
    lcd.setCursor(0, 1);
    if (isAutoTracking) {
      lcd.print("P:");
      lcd.print(g_power_mW / 1000.0, 2);
      lcd.print("W H:");
      lcd.print(servoH);
      lcd.print("    ");
    } else {
      // FIX #9 — lcd.printf() is not a valid method; replaced with print()
      lcd.print("MAN H:");
      lcd.print(servoH);
      lcd.print(" V:");
      lcd.print(servoV);
      lcd.print("  ");
    }
  }

  // FIX #12 — replaced delay(5) with yield() to keep the WiFi RTOS stack alive
  yield();
}

// ============================================================
//  Read All Sensors — called once per loop tick            FIX #4
// ============================================================
void readAllSensors() {
  if (systemFaultCode != 5) {
    g_busVoltage = ina219.getBusVoltage_V();
    g_current_mA = ina219.getCurrent_mA();
    g_power_mW   = ina219.getPower_mW();
  } else {
    g_busVoltage = 0.0f;
    g_current_mA = 0.0f;
    g_power_mW   = 0.0f;
  }

  g_temp     = readTemperature();
  g_humidity = readHumidity();

  g_ldr_tl = analogRead(LDR_TL);
  g_ldr_tr = analogRead(LDR_TR);
  g_ldr_bl = analogRead(LDR_BL);
  g_ldr_br = analogRead(LDR_BR);
}

// ============================================================
//  Temperature — DHT11 primary; NAN on fail (no CPU die temp)
// ============================================================
float readTemperature() {
  float temp = dht.readTemperature();
  // FIX #5 — removed fallback to temperatureRead() which returns CPU die
  //          temperature (40-80°C) and would always trigger overheat fault.
  //          Return NAN instead; callers handle NAN gracefully.
  if (!isnan(temp) && temp >= -20.0f && temp <= 80.0f) {
    return temp;
  }
  return NAN;
}

float readHumidity() {
  float hum = dht.readHumidity();
  if (isnan(hum) || hum < 0.0f || hum > 100.0f) {
    return NAN;
  }
  return hum;
}

// ============================================================
//  WiFi Connect
// ============================================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  WiFi.disconnect(false);
  // FIX #7 — wait 200 ms for radio to fully reset before begin()
  delay(200);
  WiFi.mode(WIFI_STA);

  Serial.print("[WiFi] Connecting to: ");
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
    Serial.println("\n[WiFi] Connected!");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());
    lcd.clear();
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection FAILED.");
    lcd.clear();
    lcd.print("WiFi Fail!");
  }
  delay(1000);
}

// ============================================================
//  Telemetry — uses already-read global snapshot            FIX #4
// ============================================================
void sendTelemetryTo(const char *host) {
  if (WiFi.status() != WL_CONNECTED) return;

  httpBusy = true; // FIX #8

  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure clientSecure;

  String url     = String(host) + "/api/telemetry";
  bool   success = false;
  if (url.startsWith("https://")) {
    clientSecure.setInsecure();
    success = http.begin(clientSecure, url);
  } else {
    success = http.begin(client, url);
  }

  if (!success) {
    Serial.printf("[Telemetry] HTTP begin failed: %s\n", host);
    httpBusy = false;
    return;
  }

  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"v\":"  + String(g_busVoltage, 2)         + ",";
  json += "\"i\":"  + String(g_current_mA / 1000.0, 4) + ",";
  json += "\"p\":"  + String(g_power_mW   / 1000.0, 4) + ",";
  json += "\"temp\":"     + (isnan(g_temp)     ? "null" : String(g_temp, 1))     + ",";
  json += "\"humidity\":" + (isnan(g_humidity) ? "null" : String(g_humidity, 1)) + ",";
  json += "\"fault\":"    + String(systemFaultCode)    + ",";
  json += "\"ldr\":["     + String(g_ldr_tl) + "," + String(g_ldr_bl) + "," +
                            String(g_ldr_tr) + "," + String(g_ldr_br) + "]";
  json += "}";

  int    httpCode = http.POST(json);
  String response = http.getString();
  Serial.printf("[Telemetry] POST %d — %s (Host: %s)\n",
                httpCode, response.c_str(), host);
  http.end();
  httpBusy = false; // FIX #8
}

void sendTelemetry() {
  // ── Serial monitor snapshot ──
  Serial.println(F("========= SENSOR READINGS ========="));
  Serial.printf("  Voltage   : %.2f V\n",     g_busVoltage);
  Serial.printf("  Current   : %.2f mA\n",    g_current_mA);
  Serial.printf("  Power     : %.2f mW\n",    g_power_mW);
  Serial.printf("  Temp      : %s C\n",       isnan(g_temp)     ? "NaN" : String(g_temp, 1).c_str());
  Serial.printf("  Humidity  : %s %%\n",      isnan(g_humidity) ? "NaN" : String(g_humidity, 1).c_str());
  Serial.printf("  LDR TL/TR/BL/BR: %d/%d/%d/%d\n",
                g_ldr_tl, g_ldr_tr, g_ldr_bl, g_ldr_br);

  int avt = (g_ldr_tl + g_ldr_tr) / 2;
  int avd = (g_ldr_bl + g_ldr_br) / 2;
  int avl = (g_ldr_tl + g_ldr_bl) / 2;
  int avr = (g_ldr_tr + g_ldr_br) / 2;
  Serial.printf("  Avg Top/Bot/Left/Right: %d/%d/%d/%d\n", avt, avd, avl, avr);
  Serial.printf("  Vert diff: %d | Horiz diff: %d | Tol: %d\n",
                avt - avd, avl - avr, TRACKING_TOLERANCE);
  Serial.printf("  Fault: %d | Mode: %s\n",
                systemFaultCode, isAutoTracking ? "AUTO" : "MANUAL");
  Serial.printf("  Servo H/V: %d/%d\n", servoH, servoV);
  Serial.println(F("==================================="));

  sendTelemetryTo(localHost);
  if (shouldUseVercel()) {
    sendTelemetryTo(vercelHost);
  }
}

// ============================================================
//  Fault Alert
// ============================================================
void sendFaultAlertTo(const char *host, String severity, String message) {
  if (WiFi.status() != WL_CONNECTED) return;

  httpBusy = true; // FIX #8
  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure clientSecure;

  String url     = String(host) + "/api/faults";
  bool   success = false;
  if (url.startsWith("https://")) {
    clientSecure.setInsecure();
    success = http.begin(clientSecure, url);
  } else {
    success = http.begin(client, url);
  }

  if (!success) { httpBusy = false; return; }

  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"severity\":\""  + severity           + "\",";
  json += "\"message\":\""   + message            + "\"";
  json += "}";

  int httpCode = http.POST(json);
  Serial.printf("[Fault Alert] %d (Host: %s)\n", httpCode, host);
  http.end();
  httpBusy = false; // FIX #8
}

void sendFaultAlert(String severity, String message) {
  sendFaultAlertTo(localHost, severity, message);
  if (shouldUseVercel()) {
    sendFaultAlertTo(vercelHost, severity, message);
  }
}

// ============================================================
//  Command Poll (Supabase — stow / clean / reboot / OTA)
// ============================================================
void pollCommandsFrom(const char *host) {
  if (WiFi.status() != WL_CONNECTED) return;

  httpBusy = true; // FIX #8
  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure clientSecure;

  String url     = String(host) + "/api/commands/poll?device_id=" + String(DEVICE_ID);
  bool   success = false;
  if (url.startsWith("https://")) {
    clientSecure.setInsecure();
    success = http.begin(clientSecure, url);
  } else {
    success = http.begin(client, url);
  }

  if (!success) { httpBusy = false; return; }

  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String response = http.getString();
    Serial.println("[Commands] " + response + " (Host: " + host + ")");

    if (response.indexOf("\"action\"") != -1) {
      String action = "";
      int actionIdx = response.indexOf("\"action\":\"");
      if (actionIdx != -1) {
        int start = actionIdx + 10;
        int end   = response.indexOf("\"", start);
        action    = response.substring(start, end);
        Serial.println("[Command Router] Action: " + action);
      }

      if (action == "reboot") {
        lcd.clear();
        lcd.print("Remote Reboot...");
        delay(1000);
        ESP.restart();

      } else if (action == "stow") {
        isAutoTracking = false;
        servoH = 90; servoV = V_MIN;
        horizontalServo.write(servoH);
        verticalServo.write(servoV);
        lcd.clear();
        lcd.print("Mode: STOWED");

      } else if (action == "clean") {
        runCleaningSweep();

      } else if (action == "override") {
        isAutoTracking = getJsonBool(response, "auto", true);

        int azimuth = getJsonInt(response, "azimuth");
        if (azimuth != -999) {
          servoH = constrain(90 - azimuth, H_MIN, H_MAX);
          horizontalServo.write(servoH);
          Serial.printf("[Override] H servo → %d°\n", servoH);
        }

        int elevation = getJsonInt(response, "elevation");
        if (elevation != -999) {
          servoV = constrain(elevation, V_MIN, V_MAX);
          verticalServo.write(servoV);
          Serial.printf("[Override] V servo → %d°\n", servoV);
        }

        lcd.clear();
        if (isAutoTracking) {
          lcd.print("Mode: AUTO");
        } else {
          lcd.print("Mode: OVERRIDE");
          lcd.setCursor(0, 1);
          // FIX #9 — lcd.printf() not valid; using print()
          lcd.print("H:");
          lcd.print(servoH);
          lcd.print(" V:");
          lcd.print(servoV);
        }

      } else if (action == "calibrate") {
        String otaUrl = getJsonString(response, "ota_url");
        String md5    = getJsonString(response, "md5_hash");
        if (otaUrl.length() > 0) {
          performOTA(otaUrl, md5);
        }
      }
    }
  } else {
    if (httpCode != -1) {
      Serial.printf("[Commands] Poll failed. HTTP: %d (Host: %s)\n", httpCode, host);
    }
  }

  http.end();
  httpBusy = false; // FIX #8
}

void pollCommands() {
  pollCommandsFrom(localHost);
  if (shouldUseVercel()) {
    pollCommandsFrom(vercelHost);
  }
}

// ============================================================
//  Fast-Lane Override (local server only — 100 ms)
// ============================================================
void pollFastLaneOverride() {
  // FIX #3 — removed the dead/inverted guard block
  //          (was: `if (WiFi.status() != WL_CONNECTED || !isAutoTracking == false) {}`)
  if (WiFi.status() != WL_CONNECTED) return;

  httpBusy = true; // FIX #8
  HTTPClient http;
  WiFiClient client;

  String url = String(localHost) +
               "/api/commands/override?device_id=" + String(DEVICE_ID);
  if (!http.begin(client, url)) {
    http.end();
    httpBusy = false;
    return;
  }

  http.setTimeout(200); // 200 ms hard timeout for local server
  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String response = http.getString();

    // Skip null commands
    if (response.indexOf("\"command\":null")   != -1 ||
        response.indexOf("\"command\": null")  != -1) {
      http.end();
      httpBusy = false;
      return;
    }
    if (response.indexOf("\"action\":\"override\"")  == -1 &&
        response.indexOf("\"action\": \"override\"") == -1) {
      http.end();
      httpBusy = false;
      return;
    }

    bool autoMode  = getJsonBool(response, "auto", true);
    int  azimuth   = getJsonInt(response, "azimuth");
    int  elevation = getJsonInt(response, "elevation");

    isAutoTracking = autoMode;

    if (!autoMode) {
      if (azimuth != -999) {
        servoH = constrain(90 - azimuth, H_MIN, H_MAX);
        horizontalServo.write(servoH);
      }
      if (elevation != -999) {
        servoV = constrain(elevation, V_MIN, V_MAX);
        verticalServo.write(servoV);
      }
      Serial.printf("[FastLane] Override — H:%d V:%d\n", servoH, servoV);

      // FIX #9 — lcd.printf() replaced with lcd.print()
      lcd.clear();
      lcd.print("MANUAL [FAST]");
      lcd.setCursor(0, 1);
      lcd.print("H:");
      lcd.print(servoH);
      lcd.print(" V:");
      lcd.print(servoV);
    } else {
      Serial.println("[FastLane] Auto mode active.");
    }
  }

  http.end();
  httpBusy = false; // FIX #8
}

// ============================================================
//  Cleaning Sweep
// ============================================================
void runCleaningSweep() {
  lcd.clear();
  lcd.print("Sweeping Panel");
  lcd.setCursor(0, 1);
  lcd.print("Cleaning...");

  int currentH = servoH;
  int currentV = servoV;

  // East → West sweep
  for (int h = currentH; h <= H_MAX; h += 2) { horizontalServo.write(h); delay(15); }
  for (int h = H_MAX;    h >= H_MIN; h -= 2) { horizontalServo.write(h); delay(15); }
  for (int h = H_MIN;    h <= 90;    h += 2) { horizontalServo.write(h); delay(15); }
  servoH = 90;

  // Flat → zenith elevation sweep
  for (int v = currentV; v <= V_MAX; v += 2) { verticalServo.write(v); delay(15); }
  for (int v = V_MAX;    v >= V_MIN; v -= 2) { verticalServo.write(v); delay(15); }
  for (int v = V_MIN;    v <= 45;    v += 2) { verticalServo.write(v); delay(15); }
  servoV = 45;

  isAutoTracking = true;
  lcd.clear();
  lcd.print("Sweep Complete");
  lcd.setCursor(0, 1);
  lcd.print("Mode: AUTO");
  delay(1000);
}

// ============================================================
//  OTA Update                                              FIX #10
// ============================================================
void performOTA(String url, String md5) {
  Serial.println("[OTA] Initialising download...");
  lcd.clear();
  lcd.print("OTA Upgrade");
  lcd.setCursor(0, 1);
  lcd.print("Downloading...");

  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure();
  http.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);

  if (!http.begin(client, url)) {
    Serial.println("[OTA] Failed to open HTTP connection.");
    lcd.clear();
    lcd.print("OTA Init Fail");
    delay(2000);
    return;
  }

  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    int contentLength = http.getSize();

    // FIX #10 — guard against invalid content length before starting Update
    if (contentLength <= 0) {
      Serial.println("[OTA] Invalid content length — aborting.");
      lcd.clear();
      lcd.print("OTA Size Error");
      http.end();
      delay(2000);
      return;
    }

    Serial.printf("[OTA] Binary size: %d bytes\n", contentLength);

    if (md5.length() == 32) {
      Update.setMD5(md5.c_str());
      Serial.println("[OTA] Target MD5: " + md5);
    }

    if (Update.begin(contentLength)) {
      lcd.setCursor(0, 1);
      lcd.print("Writing Flash...");
      Serial.println("[OTA] Flashing partition...");

      // FIX #10 — use getStream() by reference, not getStreamPtr() which can return null
      WiFiClient &stream  = http.getStream();
      size_t      written = Update.writeStream(stream);

      if (written == (size_t)contentLength) {
        Serial.printf("[OTA] Flashed %u bytes OK.\n", written);
      } else {
        Serial.printf("[OTA] Flash mismatch: wrote %u / %d bytes.\n",
                      written, contentLength);
      }

      if (Update.end()) {
        if (Update.isFinished()) {
          Serial.println("[OTA] Complete! Rebooting...");
          lcd.clear();
          lcd.print("OTA Complete!");
          lcd.setCursor(0, 1);
          lcd.print("Rebooting...");
          delay(2000);
          ESP.restart();
        } else {
          Serial.println("[OTA] Finished but not verified.");
        }
      } else {
        Serial.printf("[OTA] Flash error: %d\n", Update.getError());
        lcd.clear();
        lcd.print("OTA Err:");
        lcd.setCursor(0, 1);
        lcd.print(Update.getError());
        delay(3000);
      }
    } else {
      Serial.println("[OTA] Insufficient flash partition space.");
      lcd.clear();
      lcd.print("OTA Space Error");
      delay(3000);
    }
  } else {
    Serial.printf("[OTA] Download failed. HTTP: %d\n", httpCode);
    lcd.clear();
    lcd.print("OTA Fail:");
    lcd.setCursor(0, 1);
    lcd.print(httpCode);
    delay(3000);
  }

  http.end();
}

// ============================================================
//  Lightweight JSON Helpers
// ============================================================
int getJsonInt(String json, String key) {
  int keyIdx = json.indexOf("\"" + key + "\"");
  if (keyIdx == -1) return -999;

  int colonIdx = json.indexOf(":", keyIdx + key.length() + 2);
  if (colonIdx == -1) return -999;

  int start = colonIdx + 1;
  while (start < (int)json.length() && isSpace(json.charAt(start))) start++;

  int end = start;
  while (end < (int)json.length() &&
         (isDigit(json.charAt(end)) || json.charAt(end) == '-' ||
          json.charAt(end) == '+')) {
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
  while (start < (int)json.length() && isSpace(json.charAt(start))) start++;

  if (json.substring(start, start + 4) == "true")  return true;
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
