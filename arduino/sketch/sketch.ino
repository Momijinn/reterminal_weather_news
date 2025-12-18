#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_heap_caps.h>
#include <SPI.h>
#include <time.h>
#include <GxEPD2_7C.h>

// --- WiFi / URL ---
const char* WIFI_SSID = "****";
const char* WIFI_PASS = "****";
const char* BMP_URL = "https://momijinn.github.io/reterminal_weather_news/screenshot.bmp";

// --- reTerminal E1002 Pins ---
#define BUTTON_PIN          3 
#define LED_PIN             6
#define BUZZER_PIN         45
#define BATTERY_ADC_PIN     2
#define BATTERY_ENABLE_PIN 21
#define EPD_SCK_PIN   7
#define EPD_MOSI_PIN  9
#define EPD_CS_PIN   10
#define EPD_DC_PIN   11
#define EPD_RST_PIN  12
#define EPD_BUSY_PIN 13
#define SERIAL_RX 44
#define SERIAL_TX 43

SPIClass hspi(HSPI);

// --- Display Buffer Optimization ---
#define MAX_DISPLAY_BUFFER_SIZE 64000
#define MAX_HEIGHT(EPD) (EPD::HEIGHT <= MAX_DISPLAY_BUFFER_SIZE / (EPD::WIDTH / 2) ? \
                         EPD::HEIGHT : MAX_DISPLAY_BUFFER_SIZE / (EPD::WIDTH / 2))

GxEPD2_7C<GxEPD2_730c_GDEP073E01, MAX_HEIGHT(GxEPD2_730c_GDEP073E01)>
display(GxEPD2_730c_GDEP073E01(EPD_CS_PIN, EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN));

// --- 7色パレット ---
const uint8_t palette[][3] = {
  {0,0,0}, {255,255,255}, {0,255,0}, {0,0,255}, {255,0,0}, {255,255,0}, {255,128,0}
};
const uint16_t epdColors[] = {
  GxEPD_BLACK, GxEPD_WHITE, GxEPD_GREEN, GxEPD_BLUE, GxEPD_RED, GxEPD_YELLOW, GxEPD_ORANGE
};

uint16_t nearestColor(uint8_t r, uint8_t g, uint8_t b) {
  long best = 200000; int idx = 1;
  for (int i = 0; i < 7; i++) {
    long dr=(long)r-palette[i][0], dg=(long)g-palette[i][1], db=(long)b-palette[i][2];
    long d=dr*dr+dg*dg+db*db;
    if (d < best) { best = d; idx = i; }
  }
  return epdColors[idx];
}

// --- Battery ---
int getBatteryPercent(float& voltage) {
  digitalWrite(BATTERY_ENABLE_PIN, HIGH);
  delay(10);
  int raw_mv = analogReadMilliVolts(BATTERY_ADC_PIN);
  digitalWrite(BATTERY_ENABLE_PIN, LOW);
  voltage = (raw_mv * 2.0) / 1000.0;
  return constrain(map(voltage * 100, 330, 420, 0, 100), 0, 100);
}

// --- BMP Processing ---
bool downloadAndDraw() {
  Serial1.println("[HTTP] Starting download...");
  HTTPClient http;
  http.begin(BMP_URL);
  int httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    Serial1.printf("[HTTP] Error: %d\n", httpCode);
    return false;
  }

  int total = http.getSize();
  uint8_t* bmpBuffer = (uint8_t*)heap_caps_malloc(total, MALLOC_CAP_SPIRAM);
  if (!bmpBuffer) {
    Serial1.println("[ERROR] PSRAM allocation failed.");
    return false;
  }

  WiFiClient* stream = http.getStreamPtr();
  int loaded = 0;
  while (http.connected() && loaded < total) {
    int available = stream->available();
    if (available > 0) {
      int readLen = stream->readBytes(&bmpBuffer[loaded], available);
      loaded += readLen;
    }
    delay(1);
  }
  http.end();

  if (bmpBuffer[0] != 'B' || bmpBuffer[1] != 'M') {
    heap_caps_free(bmpBuffer);
    return false;
  }

  uint32_t offset = *(uint32_t*)&bmpBuffer[10];
  int32_t  w      = *(int32_t*)&bmpBuffer[18];
  int32_t  h      = *(int32_t*)&bmpBuffer[22];
  uint32_t rowSize = (w * 3 + 3) & ~3; 
  bool flip = (h > 0); 
  if (h < 0) h = -h;

  display.setRotation(0);
  display.setFullWindow();
  display.firstPage();
  do {
    for (int y = 0; y < h; y++) {
      if (y >= display.height()) break;
      uint32_t rowOffset = flip ? (h - 1 - y) * rowSize : y * rowSize;
      uint8_t* pRow = &bmpBuffer[offset + rowOffset];
      for (int x = 0; x < w; x++) {
        if (x >= display.width()) break;
        display.drawPixel(x, y, nearestColor(pRow[x*3+2], pRow[x*3+1], pRow[x*3]));
      }
      if (y % 10 == 0) yield();
    }
  } while (display.nextPage());

  heap_caps_free(bmpBuffer);
  return true;
}

// --- Setup ---
void setup() {
  Serial1.begin(115200, SERIAL_8N1, SERIAL_RX, SERIAL_TX);
  delay(500);
  Serial1.println("\n--- reTerminal E1002 Optimized Boot ---");

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BATTERY_ENABLE_PIN, OUTPUT);

  esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
  bool isButtonWake = (cause == ESP_SLEEP_WAKEUP_EXT1);

  // 1. WiFi接続（電力効率化設定）
  WiFi.setSleep(true); // 通信時の消費電力を抑制
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int retry = 0;
  while(WiFi.status() != WL_CONNECTED && retry++ < 40) delay(500);

  // 2. 時刻取得と判定
  configTime(9 * 3600, 0, "ntp.nict.jp");
  struct tm t;
  bool timeValid = getLocalTime(&t);
  
  // 深夜モード判定 (1:00〜5:00)
  bool isNight = (timeValid && t.tm_hour >= 1 && t.tm_hour < 5);

  // 3. 描画の実行条件（ボタン押し、または日中）
  if (isButtonWake || !isNight) {
    Serial1.println("Updating Display...");
    hspi.begin(EPD_SCK_PIN, -1, EPD_MOSI_PIN, -1);
    display.epd2.selectSPI(hspi, SPISettings(4000000, MSBFIRST, SPI_MODE0));
    display.init(115200, true, 50, false);

    if (downloadAndDraw()) {
      if (isButtonWake) {
        tone(BUZZER_PIN, 2000, 100); delay(150); tone(BUZZER_PIN, 2000, 100);
      }
    }
  } else {
    Serial1.println("Night mode: Skipping display update.");
  }

  // 4. WiFiを完全にシャットダウン（スリープ前の最重要処理）
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  Serial1.println("WiFi powered off.");

  // 5. 次のスリープ時間の計算
  uint32_t sleepSeconds;
  if (isNight) {
    // 深夜帯なら朝5時まで一気に寝る
    int hoursToWait = (5 - t.tm_hour);
    sleepSeconds = (hoursToWait * 3600) - (t.tm_min * 60);
    Serial1.printf("Night sleep: next wakeup at 05:00 (%d seconds)\n", sleepSeconds);
  } else {
    // 日中は次の「x時05分」まで寝る
    time_t now; time(&now);
    sleepSeconds = 3600 - (now % 3600) + 300; 
    Serial1.printf("Day sleep: %d seconds\n", sleepSeconds);
  }

  // 6. Deep Sleep開始
  esp_sleep_enable_ext1_wakeup(1ULL << BUTTON_PIN, ESP_EXT1_WAKEUP_ALL_LOW);
  esp_sleep_enable_timer_wakeup((uint64_t)sleepSeconds * 1000000ULL);
  Serial1.println("Going to Deep Sleep.");
  esp_deep_sleep_start();
}

void loop() {}