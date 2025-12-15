import { chromium } from 'playwright';

// サーバーのポート番号とスクリーンショットのファイル名を定義
const PORT = 3000;
const OUTPUT_FILE = 'screenshot.jpg';
const URL = `http://localhost:${PORT}/`;

async function captureScreenshot() {
  console.log(`🚀 Launching browser to screenshot ${URL}`);

  // ヘッドレスモードでChromiumを起動
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // サーバーのURLにアクセス
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // ページ全体（フルページ）のJPEGスクリーンショットを撮影
    await page.screenshot({
      path: OUTPUT_FILE,
      type: 'jpeg',
      quality: 80,
      fullPage: true,
    });

    console.log(`✅ Screenshot saved to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error(`❌ Failed to capture screenshot:`, error);
    process.exit(1); // エラー時は処理を終了
  } finally {
    await browser.close();
    console.log('🚪 Browser closed.');
  }
}

captureScreenshot();
