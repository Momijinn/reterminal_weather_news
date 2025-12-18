# 仕様

## 概要

本スケッチは reTerminal E1002（ESP32-S3 + 7.3" カラー EPD）で動作し、指定 BMP 画像を定期またはボタン押下で表示し、その後 Deep Sleep へ戻る省電力ループを実現します。

## ネットワークと時刻

- `WIFI_SSID`/`WIFI_PASS` で Wi-Fi に接続し、`configTime` で `ntp.nict.jp` から時刻を取得。
- 取得に成功した時刻が 1:00〜5:00 の範囲であれば「夜間モード」とし、日中の自動更新をスキップする判定に使います。

## 表示更新のトリガー

- GPIO 3（右上ボタン）を `esp_sleep_enable_ext1_wakeup` で登録しており、ボタン押下で起動すると昼夜問わず描画を実行し、ブザーを 2 回鳴らして完了を通知します。
- ボタン未押下での起動は夜間モードだと描画をスキップし、それ以外は毎時 05 分（現在時刻から 1 時間後の x:05）に更新します。
- 描画タイミングは `sleepSeconds` を `3600 - (now % 3600) + 300` で計算し、深夜は朝 5 時までまとめて休眠します。

## BMP の取得と描画

- `BMP_URL` の HTTPS 先から `HTTPClient` で BMP をダウンロードし、`heap_caps_malloc(MALLOC_CAP_SPIRAM)` で PSRAM にバッファを確保。
- BMP ヘッダからデータオフセット・幅・高さを算出し、`nearestColor` で 7 色パレットにマッピングして `display.drawPixel` で描画します。
- SPI は HSPI (`EPD_SCK_PIN=7`, `EPD_MOSI_PIN=9`) に切り替え、`display.firstPage()` / `display.nextPage()` を使ってページ描画、クロック 4 MHz で更新します。

## Deep Sleep と省電力

- 描画後は `WiFi.disconnect(true)` / `WiFi.mode(WIFI_OFF)` で接続を完全に切り、バッテリ電源制御（GPIO 21）もオフにしてから Deep Sleep に移行。
- GPIO 2 で `analogReadMilliVolts` によるバッテリ電圧測定ユーティリティ (`getBatteryPercent`) を用意し、警告やログ出力などの拡張ポイントを残します。
- Deep Sleep 解除条件はボタン（GPIO 3）の LOW 信号または設定したタイマで、復帰時だけ Wi-Fi 接続から描画ルーチンを再開します。

## ハードウェア構成とログ出力

- 主要 GPIO: 3（ボタン）、6（LED）、45（ブザー）、2（バッテリ ADC）、21（バッテリ電源制御）。
- EPD 接続: CS=10、DC=11、RST=12、BUSY=13。
- `Serial1` を 115200bps（RX=44、TX=43）で利用し、Wi-Fi 状態・描画判定・Deep Sleep 判定を出力します。

## 運用上の注意

- BMP は 600×448 前後で 24bit パディング付きのデータ構造を使う必要があります。
- `GxEPD2_730c_GDEP073E01` の `MAX_HEIGHT` を 64000 バッファで計算し、PSRAM によるページ描画を前提としています。
- `WiFi.disconnect(true)` を呼んだ直後に `esp_sleep_enable_timer_wakeup` / `esp_sleep_enable_ext1_wakeup` をセットし、Deep Sleep 状態に移行します。

## 拡張ポイント

- `getBatteryPercent` を呼び出して残量がしきい値以下なら LED を点灯したり、ログに出力するなどの監視を追加可能です。
- `palette` や `nearestColor` のロジックを調整して他のカラーパレットに対応できます。
