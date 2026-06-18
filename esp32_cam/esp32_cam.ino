#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include "esp_http_server.h"

// ==========================================
// User Credentials & Server Configuration
// ==========================================
const char* ssid = "ASHWIN";
const char* password = "12345678"; // Replace with your actual Wi-Fi password if different

// Target Vite Dev Server API Endpoint on your local machine
const char* uploadUrl = "http://192.168.137.60:5173/api/camera/upload";
const char* commandUrl = "http://192.168.137.60:5173/api/commands/poll?device_id=";

// Target Device ID registered in your website's database
#define DEVICE_ID "d1e028b0-a541-4702-8c20-3354316d2cf1"

// ==========================================
// ESP32-CAM AI-Thinker Pin Layout
// ==========================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// HTTP Server instance
httpd_handle_t camera_httpd = NULL;

// Timers
unsigned long lastUploadTime = 0;
const unsigned long uploadInterval = 3600000; // 1 hour in milliseconds
unsigned long lastCommandPollTime = 0;
const unsigned long commandPollInterval = 1000; // Poll commands every 1 second

// Forward Declarations
void connectWiFi();
void captureAndUpload();
void startCameraServer();
void pollCommands();

// ==========================================
// Stream Handler for MJPEG
// ==========================================
#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

esp_err_t stream_handler(httpd_req_t *req){
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;
  char * part_buf[64];

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if(res != ESP_OK){
    return res;
  }

  while(true){
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      res = ESP_FAIL;
    } else {
      _jpg_buf_len = fb->len;
      _jpg_buf = fb->buf;
    }
    if(res == ESP_OK){
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }
    if(res == ESP_OK){
      size_t hlen = snprintf((char *)part_buf, 64, _STREAM_PART, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, (const char *)part_buf, hlen);
    }
    if(res == ESP_OK){
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }
    if(fb){
      esp_camera_fb_return(fb);
      fb = NULL;
      _jpg_buf = NULL;
    } else if(res == ESP_OK){
      break;
    }
    if(res != ESP_OK){
      break;
    }
    // Limit frame rate a bit
    delay(50);
  }
  return res;
}

// ==========================================
// Single Image Capture Handler
// ==========================================
esp_err_t capture_handler(httpd_req_t *req){
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;

  fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  
  res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

// ==========================================
// Setup
// ==========================================
void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

  // Configure Camera Settings
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  // Select frame size and quality
  if(psramFound()){
    config.frame_size = FRAMESIZE_UXGA; // 1600x1200
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA; // 800x600
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  // Camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);
    return;
  }

  sensor_t * s = esp_camera_sensor_get();
  s->set_framesize(s, FRAMESIZE_VGA); // 640x480 for fast streaming

  // Connect to WiFi
  connectWiFi();

  // Start HTTP Server
  startCameraServer();

  // Perform initial upload on startup
  captureAndUpload();
  lastUploadTime = millis();
}

// ==========================================
// Main Loop
// ==========================================
void loop() {
  // Check hourly upload interval (non-blocking)
  if (millis() - lastUploadTime >= uploadInterval) {
    captureAndUpload();
    lastUploadTime = millis();
  }

  // Poll pending commands (non-blocking)
  if (millis() - lastCommandPollTime >= commandPollInterval) {
    pollCommands();
    lastCommandPollTime = millis();
  }

  // Re-establish Wi-Fi if disconnected
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  delay(100);
}

// ==========================================
// Wi-Fi Connection Helper
// ==========================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Connecting to Wi-Fi SSID: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi Connected!");
    Serial.print("Camera Stream URL: http://");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWi-Fi connection failed. Retrying...");
  }
}

// ==========================================
// HTTP Capture & Upload Helper
// ==========================================
void captureAndUpload() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Upload aborted: No Wi-Fi connection.");
    return;
  }

  Serial.println("Capturing frame for upload...");
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Capture failed.");
    return;
  }

  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure clientSecure;
  bool success = false;

  Serial.print("Uploading JPEG to: ");
  Serial.println(uploadUrl);
  
  if (String(uploadUrl).startsWith("https://")) {
    clientSecure.setInsecure();
    success = http.begin(clientSecure, uploadUrl);
  } else {
    success = http.begin(client, uploadUrl);
  }
  
  if (success) {
    http.addHeader("Content-Type", "image/jpeg");
    int httpResponseCode = http.POST(fb->buf, fb->len);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.printf("Upload success. Code: %d, Response: %s\n", httpResponseCode, response.c_str());
    } else {
      Serial.printf("Upload error. Code: %d, Message: %s\n", httpResponseCode, http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  } else {
    Serial.println("HTTP connection failed.");
  }

  esp_camera_fb_return(fb);
}

// ==========================================
// HTTP Command Polling Helper
// ==========================================
void pollCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure clientSecure;
  bool success = false;

  String url = String(commandUrl) + String(DEVICE_ID) + "&client=camera";

  if (url.startsWith("https://")) {
    clientSecure.setInsecure();
    success = http.begin(clientSecure, url);
  } else {
    success = http.begin(client, url);
  }

  if (!success) {
    Serial.println("[Commands Poll] HTTP begin failed");
    return;
  }

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

      if (action == "capture") {
        Serial.println("Capture command acknowledged. Executing capture...");
        captureAndUpload();
      }
    }
  } else {
    // Suppress verbose connection failure logs to avoid spamming the console
    if (httpCode != -1) {
      Serial.printf("[Commands Poll] Connection failed. HTTP: %d\n", httpCode);
    }
  }

  http.end();
}

// ==========================================
// HTTP Server Starter
// ==========================================
void startCameraServer(){
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t capture_uri = {
    .uri       = "/capture",
    .method    = HTTP_GET,
    .handler   = capture_handler,
    .user_ctx  = NULL
  };
  
  Serial.printf("Starting camera server on port: '%d'\n", config.server_port);
  if (httpd_start(&camera_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(camera_httpd, &stream_uri);
    httpd_register_uri_handler(camera_httpd, &capture_uri);
  }
}
