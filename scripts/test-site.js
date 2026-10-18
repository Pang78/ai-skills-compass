import { chromium } from "playwright";

async function runTest() {
  const targetUrl = process.env.TEST_URL || "https://courses.app.tc1.airbase.sg";
  console.log(`[test] Launching browser to test ${targetUrl}...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    console.log(`[browser console ${msg.type()}] ${msg.text()}`);
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on("pageerror", (err) => {
    console.error(`[browser pageerror] ${err.stack || err.message}`);
    pageErrors.push(err.message);
  });

  try {
    await page.goto(targetUrl, { waitUntil: "networkidle" });
    console.log(`[test] Page title: "${await page.title()}"`);

    // Test 1: Category filter button
    console.log("[test] Step 1: Clicking category filter 'AI foundations'...");
    await page.click("button:has-text('AI foundations')");
    await page.waitForTimeout(500);

    // Test 2: Search filter
    console.log("[test] Step 2: Typing into search input...");
    const searchInput = page.locator("input[aria-label='Search courses']");
    await searchInput.fill("Google");
    await page.waitForTimeout(500);

    // Test 3: Clear search
    console.log("[test] Step 3: Clearing search...");
    const clearBtn = page.locator("button[aria-label='Clear search']");
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(500);
    }

    // Test 4: Open 'Our approach' modal
    console.log("[test] Step 4: Clicking 'Our approach' modal button...");
    await page.click("button:has-text('Our approach')");
    await page.waitForTimeout(500);

    const modalVisible = await page.isVisible("dialog.modal");
    console.log(`[test] Result: Modal visible = ${modalVisible}`);

    if (modalVisible) {
      console.log("[test] Step 5: Closing modal...");
      await page.click(".modal button[aria-label='Close dialog']");
      await page.waitForTimeout(500);
    }

    // Test 5: Role picker
    console.log("[test] Step 6: Clicking 'Business owner' role pathway button...");
    await page.click("button:has-text('Business owner')");
    await page.waitForTimeout(500);

    console.log("[test] SUCCESS: All interactions executed without errors!");
  } catch (err) {
    console.error("[test] Test execution failed:", err);
  } finally {
    await browser.close();
    console.log(`[test] Summary -> Total logs: ${consoleLogs.length}, Page errors: ${pageErrors.length}`);
    if (pageErrors.length > 0) {
      console.error("[test] CRITICAL PAGE ERRORS:", pageErrors);
      process.exit(1);
    }
  }
}

runTest();
