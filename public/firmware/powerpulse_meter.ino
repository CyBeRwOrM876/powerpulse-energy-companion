/*
  PowerPulse meter firmware (ESP32) — simulated current readings over MQTT
  -----------------------------------------------------------------------
  Publishes simulated per-circuit readings every 2 s so the PowerPulse
  dashboard (and MQTT Explorer) receive live data from a real board.
  When you get current clamps (e.g. SCT-013), replace simulateCircuitW()
  with a real RMS reading per input.

  Libraries (Arduino IDE > Library Manager):
    - PubSubClient  by Nick O'Leary
    - ArduinoJson   by Benoit Blanchon (v7)
  Board: "ESP32 Dev Module" (esp32 by Espressif)

  Topics (DEVICE_ID must match Settings > Meter connection on the website):
    powerpulse/<DEVICE_ID>/telemetry  meter -> site   readings JSON
    powerpulse/<DEVICE_ID>/status     meter -> site   "online"/"offline" (retained, LWT)
    powerpulse/<DEVICE_ID>/config     site  -> meter  circuits for this business (retained)
    powerpulse/<DEVICE_ID>/cmd        site  -> meter  {"id":"c1","on":false} or {"outage_s":30}
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ======== EDIT THESE ========
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* DEVICE_ID = "pp-xxxxxxxx";     // copy from website Settings
const char* MQTT_HOST = "broker.hivemq.com";
const uint16_t MQTT_PORT = 1883;
// ============================

const uint32_t PUBLISH_MS = 2000;
const int LED_PIN = 2;
const int MAX_CIRCUITS = 8;

WiFiClient net;
PubSubClient mqtt(net);

String tTelemetry, tStatus, tConfig, tCmd;

enum Pattern { CYCLING, STEADY, PEAK, BURST, LIGHTING };

struct Circuit {
  char id[8];
  char name[32];
  float ratedW;
  Pattern pattern;
  bool on;
  bool active;
  float timerMin;   // simulated minutes until next state change
  int spike;        // ticks of unusual draw
};

Circuit circuits[MAX_CIRCUITS];
int circuitCount = 0;
float speedFactor = 60.0;   // simulated minutes per real second
double energyKwh = 0;
uint32_t lastPublish = 0;
uint32_t bootMs = 0;
int32_t outageLeftS = 0;

float frand(float a, float b) { return a + (b - a) * (esp_random() / 4294967295.0f); }

Pattern parsePattern(const char* p) {
  if (!strcmp(p, "cycling")) return CYCLING;
  if (!strcmp(p, "peak")) return PEAK;
  if (!strcmp(p, "burst")) return BURST;
  if (!strcmp(p, "lighting")) return LIGHTING;
  return STEADY;
}

void addCircuit(const char* id, const char* name, float w, Pattern p) {
  if (circuitCount >= MAX_CIRCUITS) return;
  Circuit& c = circuits[circuitCount++];
  strlcpy(c.id, id, sizeof(c.id));
  strlcpy(c.name, name, sizeof(c.name));
  c.ratedW = w; c.pattern = p; c.on = true;
  c.active = frand(0, 1) > 0.5; c.timerMin = frand(2, 12); c.spike = 0;
}

void defaultCircuits() {   // used until the website sends its config
  circuitCount = 0;
  addCircuit("c1", "Fridges", 900, CYCLING);
  addCircuit("c2", "POS & lighting", 350, LIGHTING);
  addCircuit("c3", "Machines", 1500, BURST);
  addCircuit("c4", "Air conditioner", 1400, PEAK);
}

float simHour() {
  float uptimeS = (millis() - bootMs) / 1000.0f;
  return fmod(8.0f + uptimeS * speedFactor / 3600.0f, 24.0f);   // simulated day starts 08:00
}

float simulateCircuitW(Circuit& c, float simMinutes) {
  float h = simHour();
  bool open = h >= 7 && h < 19;
  float f = 0;
  switch (c.pattern) {
    case CYCLING:
    case BURST:
      c.timerMin -= simMinutes;
      if (c.timerMin <= 0) {
        c.active = (c.pattern == CYCLING) ? !c.active : (frand(0, 1) < (open ? 0.55 : 0.10));
        c.timerMin = c.active ? frand(c.pattern == CYCLING ? 10 : 4, c.pattern == CYCLING ? 18 : 15) : frand(6, 20);
      }
      f = c.active ? frand(0.82, 1.0) : (c.pattern == CYCLING ? frand(0.03, 0.07) : frand(0, 0.02));
      break;
    case STEADY: f = frand(0.70, 0.85); break;
    case PEAK: {
      float curve = (h >= 7 && h <= 19) ? sin(PI * (h - 7) / 12.0) : 0;
      f = constrain(0.12 + 0.85 * max(0.0f, curve) + frand(-0.05, 0.05), 0.0, 1.0);
      break;
    }
    case LIGHTING: f = (h >= 6 && h < 21) ? frand(0.85, 0.95) : frand(0.2, 0.3); break;
  }
  float w = c.ratedW * f;
  if (c.spike > 0) { w *= 1.65; c.spike--; }
  return w;
}

void handleConfig(const JsonDocument& doc) {
  JsonArrayConst arr = doc["circuits"].as<JsonArrayConst>();
  if (arr.isNull() || arr.size() == 0) return;
  if (doc["speed"].is<float>()) speedFactor = max(1.0f, doc["speed"].as<float>());
  circuitCount = 0;
  for (JsonObjectConst o : arr) {
    addCircuit(o["id"] | "c?", o["name"] | "Circuit", o["w"] | 500.0f, parsePattern(o["p"] | "steady"));
    circuits[circuitCount - 1].on = o["on"] | true;
  }
  Serial.printf("Config: %d circuits, speed x%.0f\n", circuitCount, speedFactor);
}

void handleCmd(const JsonDocument& doc) {
  if (doc["outage_s"].is<int>()) {
    outageLeftS = constrain(doc["outage_s"].as<int>(), 0, 600);
    Serial.printf("Simulated outage for %d s\n", outageLeftS);
    return;
  }
  const char* id = doc["id"];
  if (!id) return;
  for (int i = 0; i < circuitCount; i++) {
    if (!strcmp(circuits[i].id, id)) {
      circuits[i].on = doc["on"] | true;
      Serial.printf("Circuit %s -> %s\n", id, circuits[i].on ? "ON" : "OFF");
    }
  }
}

void onMessage(char* topic, byte* payload, unsigned int len) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, len)) return;
  String t(topic);
  if (t == tConfig) handleConfig(doc);
  else if (t == tCmd) handleCmd(doc);
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Wi-Fi: connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.printf("\nWi-Fi OK, IP %s\n", WiFi.localIP().toString().c_str());
}

void connectMqtt() {
  while (!mqtt.connected()) {
    String clientId = String("pp-meter-") + DEVICE_ID + "-" + String((uint32_t)esp_random(), HEX);
    Serial.print("MQTT: connecting... ");
    if (mqtt.connect(clientId.c_str(), nullptr, nullptr, tStatus.c_str(), 1, true, "offline")) {
      Serial.println("OK");
      mqtt.publish(tStatus.c_str(), "online", true);
      mqtt.subscribe(tConfig.c_str(), 1);
      mqtt.subscribe(tCmd.c_str(), 1);
    } else {
      Serial.printf("failed (%d), retry in 3 s\n", mqtt.state());
      delay(3000);
    }
  }
}

void publishTelemetry(float dtS) {
  float simMinutes = dtS * speedFactor / 60.0f;
  bool outage = outageLeftS > 0;
  if (outage) outageLeftS = max(0, (int)(outageLeftS - dtS));
  float voltage = outage ? 0 : 230.0 + frand(-4, 4);

  if (!outage && frand(0, 1) < 0.015 && circuitCount > 0) circuits[(int)frand(0, circuitCount - 0.01)].spike = 3;

  JsonDocument doc;
  doc["device"] = DEVICE_ID;
  doc["voltage"] = round(voltage * 10) / 10.0;
  JsonArray arr = doc["circuits"].to<JsonArray>();
  float totalW = 0;
  const char* alertId = nullptr;
  for (int i = 0; i < circuitCount; i++) {
    Circuit& c = circuits[i];
    bool spiking = c.spike > 0;
    float w = (!outage && c.on) ? simulateCircuitW(c, simMinutes) : 0;
    if (spiking && w > 0) alertId = c.id;
    totalW += w;
    JsonObject o = arr.add<JsonObject>();
    o["id"] = c.id;
    o["name"] = c.name;
    o["power_w"] = (int)round(w);
    o["current_a"] = voltage > 0 ? round(w / voltage * 100) / 100.0 : 0;
    o["on"] = c.on;
  }
  energyKwh += (totalW / 1000.0) * dtS * speedFactor / 3600.0;
  doc["power_kw"] = round(totalW) / 1000.0;
  doc["energy_kwh"] = energyKwh;
  doc["uptime_s"] = (millis() - bootMs) / 1000;
  doc["speed"] = speedFactor;
  doc["outage"] = outage;
  if (alertId) doc["alert"] = alertId; else doc["alert"] = nullptr;

  char buf[1536];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(tTelemetry.c_str(), (const uint8_t*)buf, n, false);
  digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  Serial.printf("%.2f kW  %.1f V  E=%.3f kWh\n", totalW / 1000.0, voltage, energyKwh);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  bootMs = millis();
  String base = String("powerpulse/") + DEVICE_ID;
  tTelemetry = base + "/telemetry";
  tStatus = base + "/status";
  tConfig = base + "/config";
  tCmd = base + "/cmd";
  defaultCircuits();
  connectWiFi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(2048);
  mqtt.setKeepAlive(30);
  mqtt.setCallback(onMessage);
}

void loop() {
  connectWiFi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();
  uint32_t now = millis();
  if (now - lastPublish >= PUBLISH_MS) {
    float dt = lastPublish == 0 ? PUBLISH_MS / 1000.0f : (now - lastPublish) / 1000.0f;
    lastPublish = now;
    publishTelemetry(dt);
  }
}
