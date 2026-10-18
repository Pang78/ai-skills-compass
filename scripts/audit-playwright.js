import { chromium, devices } from "playwright";

async function runAudit() {
  const targetUrl = process.env.TEST_URL || "https://courses.app.tc1.airbase.sg";
  console.log(`\n==================================================`);
  console.log(`Starting Playwright Comprehensive Audit on: ${targetUrl}`);
  console.log(`==================================================\n`);

  const browser = await chromium.launch({ headless: true });
  const report = {
    cspAndErrors: [],
    consoleWarnings: [],
    networkFailures: [],
    responsiveAudit: [],
    keyboardAndAccessibility: [],
    functionalFlows: [],
    performance: {},
  };

  // 1. Initial Page Load & Console / CSP inspection
  console.log(`--- [1/5] Checking Console, Network, and CSP ---`);
  const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      report.cspAndErrors.push({ text: msg.text(), location: msg.location() });
    } else if (msg.type() === "warning") {
      report.consoleWarnings.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    report.cspAndErrors.push({ text: err.message, stack: err.stack });
  });

  page.on("requestfailed", (req) => {
    report.networkFailures.push({ url: req.url(), failure: req.failure() });
  });

  const response = await page.goto(targetUrl, { waitUntil: "networkidle" });
  report.httpStatus = response?.status();

  // Performance timings
  const performanceTiming = JSON.parse(
    await page.evaluate(() => JSON.stringify(window.performance.timing))
  );
  const paintEntries = JSON.parse(
    await page.evaluate(() => JSON.stringify(window.performance.getEntriesByType("paint")))
  );
  report.performance = {
    dns: performanceTiming.domainLookupEnd - performanceTiming.domainLookupStart,
    tcp: performanceTiming.connectEnd - performanceTiming.connectStart,
    ttfb: performanceTiming.responseStart - performanceTiming.requestStart,
    domLoaded: performanceTiming.domContentLoadedEventEnd - performanceTiming.navigationStart,
    windowLoaded: performanceTiming.loadEventEnd - performanceTiming.navigationStart,
    paints: paintEntries,
  };

  // 2. Responsive Viewport Audits (Checking for overflow, clipping, touch targets)
  console.log(`--- [2/5] Checking Responsive Layouts & Overflows ---`);
  const viewports = [
    { name: "Mobile (iPhone SE - 375x667)", width: 375, height: 667 },
    { name: "Mobile (iPhone 14 - 390x844)", width: 390, height: 844 },
    { name: "Tablet (iPad - 768x1024)", width: 768, height: 1024 },
    { name: "Desktop (1280x800)", width: 1280, height: 800 },
    { name: "Large Desktop (1920x1080)", width: 1920, height: 1080 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);

    const overflowInfo = await page.evaluate(() => {
      const docEl = document.documentElement;
      const body = document.body;
      const hasHorizontalScroll =
        docEl.scrollWidth > docEl.clientWidth || body.scrollWidth > body.clientWidth;

      // Find any element causing overflow
      const overflowingElements = [];
      const allEls = document.querySelectorAll("*");
      for (const el of allEls) {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth + 2) {
          overflowingElements.push({
            tagName: el.tagName,
            className: el.className,
            right: rect.right,
            windowWidth: window.innerWidth,
          });
        }
      }
      return {
        hasHorizontalScroll,
        scrollWidth: Math.max(docEl.scrollWidth, body.scrollWidth),
        clientWidth: docEl.clientWidth,
        overflowingElements: overflowingElements.slice(0, 5),
      };
    });

    report.responsiveAudit.push({
      viewport: vp.name,
      ...overflowInfo,
    });
  }

  // 3. Accessibility & Keyboard Navigation
  console.log(`--- [3/5] Checking Keyboard Nav & Accessibility Semantics ---`);
  // Reset viewport to desktop
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(targetUrl, { waitUntil: "networkidle" });

  const a11yAudit = await page.evaluate(() => {
    const issues = [];
    // 1. Missing alt text or aria labels
    const buttons = Array.from(document.querySelectorAll("button"));
    buttons.forEach((btn, idx) => {
      const text = btn.innerText.trim();
      const ariaLabel = btn.getAttribute("aria-label");
      const title = btn.getAttribute("title");
      if (!text && !ariaLabel && !title) {
        issues.push(`Button #${idx} (${btn.className}) has no text, aria-label, or title.`);
      }
    });

    // 2. Links without text or accessible name
    const links = Array.from(document.querySelectorAll("a"));
    links.forEach((a, idx) => {
      const text = a.innerText.trim();
      const ariaLabel = a.getAttribute("aria-label");
      if (!text && !ariaLabel) {
        issues.push(`Anchor #${idx} (href="${a.getAttribute("href")}") has no accessible text.`);
      }
    });

    // 3. Heading hierarchy
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => ({
      tag: h.tagName,
      text: h.textContent?.trim().slice(0, 30),
    }));

    // 4. Form inputs without label or aria-label
    const inputs = Array.from(document.querySelectorAll("input, select, textarea"));
    inputs.forEach((input) => {
      const ariaLabel = input.getAttribute("aria-label");
      const id = input.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const wrappedByLabel = input.closest("label");
      if (!ariaLabel && !hasLabel && !wrappedByLabel) {
        issues.push(`Input (${input.name || input.type}) missing accessible label.`);
      }
    });

    // 5. Tap target sizes (< 24px or < 44px)
    const smallTargets = [];
    document.querySelectorAll("button, a, input, select").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.width < 24 || rect.height < 24)) {
        smallTargets.push({
          tag: el.tagName,
          text: el.textContent?.trim().slice(0, 20),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          class: el.className,
        });
      }
    });

    return { issues, headings, smallTargetsCount: smallTargets.length, smallTargets: smallTargets.slice(0, 8) };
  });

  report.keyboardAndAccessibility = a11yAudit;

  // 4. Deep Functional Flows
  console.log(`--- [4/5] Checking Functional Interactive User Flows ---`);

  // Test Flow A: Search & Filter combinations & Reset
  console.log("Testing Search & Filter & Reset...");
  const searchInput = page.locator("input[aria-label='Search courses']");
  await searchInput.fill("nonexistentquery12345");
  await page.waitForTimeout(300);

  const emptyText = await page.locator(".empty").textContent();
  const resetBtn = page.locator(".empty button:has-text('Reset filters')");
  const hasResetBtn = await resetBtn.isVisible();
  await resetBtn.click();
  await page.waitForTimeout(300);
  const queryAfterReset = await searchInput.inputValue();
  const cardsCountAfterReset = await page.locator(".course-card").count();

  report.functionalFlows.push({
    test: "Search non-existent query -> Reset button",
    emptyStateShown: !!emptyText,
    resetButtonVisible: hasResetBtn,
    queryCleared: queryAfterReset === "",
    cardsRestoredCount: cardsCountAfterReset,
  });

  // Test Flow B: Sort Dropdown
  console.log("Testing Sorting...");
  const sortSelect = page.locator("select[aria-label='Sort courses']");
  await sortSelect.selectOption("az");
  await page.waitForTimeout(300);
  const firstCourseTitleAZ = await page.locator(".course-card h3").first().textContent();

  await sortSelect.selectOption("shortest");
  await page.waitForTimeout(300);
  const firstCourseTitleShortest = await page.locator(".course-card h3").first().textContent();

  await sortSelect.selectOption("curated");
  await page.waitForTimeout(300);
  const firstCourseTitleCurated = await page.locator(".course-card h3").first().textContent();

  report.functionalFlows.push({
    test: "Sort courses (A-Z vs Shortest vs Curated)",
    firstAZ: firstCourseTitleAZ,
    firstShortest: firstCourseTitleShortest,
    firstCurated: firstCourseTitleCurated,
  });

  // Test Flow C: Course Comparison (1, 2, 3, 4th limit, Compare modal, Clear)
  console.log("Testing Course Comparison Flow...");
  const compareToggles = page.locator(".compare-toggle");
  await compareToggles.nth(0).click();
  await page.waitForTimeout(200);

  const compareBar = page.locator(".compare-bar");
  const compareBarVisible = await compareBar.isVisible();
  const compareBtnDisabled = await page.locator(".compare-bar .lime-button").isDisabled();

  // Add 2nd course
  await compareToggles.nth(1).click();
  await page.waitForTimeout(200);
  const compareBtnEnabled = !(await page.locator(".compare-bar .lime-button").isDisabled());

  // Add 3rd course
  await compareToggles.nth(2).click();
  await page.waitForTimeout(200);

  // Try to add 4th course -> should trigger Toast notice
  await compareToggles.nth(3).click();
  await page.waitForTimeout(200);
  const toastText = await page.locator(".toast").textContent();

  // Open Compare Modal
  await page.locator(".compare-bar .lime-button").click();
  await page.waitForTimeout(300);
  const compareModalVisible = await page.locator("dialog.modal.wide").isVisible();
  const tableHeadersCount = await page.locator("dialog.modal table thead th").count();

  // Close Compare Modal via Escape key
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const compareModalAfterEscape = await page.locator("dialog.modal.wide").isVisible();

  // Clear compare bar
  const clearCompareBtn = page.locator(".clear-compare");
  if (await clearCompareBtn.isVisible()) {
    await clearCompareBtn.click();
    await page.waitForTimeout(200);
  }
  const compareBarAfterClear = await compareBar.isVisible();

  report.functionalFlows.push({
    test: "Course comparison (limit 3, disabled state, toast notice, modal escape key, clear)",
    compareBarAppearedOn1: compareBarVisible,
    buttonDisabledOn1: compareBtnDisabled,
    buttonEnabledOn2: compareBtnEnabled,
    toastOn4thCourse: toastText,
    compareModalOpened: compareModalVisible,
    tableColumnsCount: tableHeadersCount,
    modalClosedWithEscape: !compareModalAfterEscape,
    compareBarCleared: !compareBarAfterClear,
  });

  // Test Flow D: Detail Modal & Escape / Backdrop behavior
  console.log("Testing Detail Modal & Backdrop & Escape key...");
  await page.locator(".course-card .title-button").first().click();
  await page.waitForTimeout(300);
  const detailModalVisible = await page.locator("dialog.modal").isVisible();

  // Test Escape key
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const detailModalClosedOnEsc = !(await page.locator("dialog.modal").isVisible());

  // Test opening again and clicking backdrop
  await page.locator(".course-card .title-button").first().click();
  await page.waitForTimeout(300);
  // Click outside modal content (e.g., top-left corner 10, 10)
  await page.mouse.click(10, 10);
  await page.waitForTimeout(300);
  const detailModalClosedOnBackdrop = !(await page.locator("dialog.modal").isVisible());

  report.functionalFlows.push({
    test: "Detail modal interactions",
    opened: detailModalVisible,
    closedOnEscape: detailModalClosedOnEsc,
    closedOnBackdropClick: detailModalClosedOnBackdrop,
  });

  // Test Flow E: Learning Pathways & Download
  console.log("Testing Learning Pathways & Download file...");
  const roleButtons = page.locator(".role-picker .role");
  const roleCount = await roleButtons.count();

  // Switch to Developer
  await page.locator(".role-picker button:has-text('Developer')").click();
  await page.waitForTimeout(200);
  const developerPathTitle = await page.locator(".path-card h3").textContent();

  // Test Download action
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(".download").click(),
  ]);
  const downloadFileName = download.suggestedFilename();
  const downloadStream = await download.createReadStream();
  let downloadedContent = "";
  for await (const chunk of downloadStream) {
    downloadedContent += chunk.toString();
  }

  report.functionalFlows.push({
    test: "Learning pathway role switch & file download",
    rolesCount: roleCount,
    developerTitle: developerPathTitle,
    downloadFilename: downloadFileName,
    downloadContentPreview: downloadedContent.slice(0, 150),
  });

  // 5. External Links Audit
  console.log(`--- [5/5] Auditing External Provider Links ---`);
  const externalLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href^='http']")).map((a) => ({
      href: a.getAttribute("href"),
      target: a.getAttribute("target"),
      rel: a.getAttribute("rel"),
      text: a.innerText.trim(),
    }));
  });
  report.externalLinks = externalLinks;

  await browser.close();

  console.log(`\n==================================================`);
  console.log(`AUDIT RESULTS SUMMARY:`);
  console.log(`==================================================`);
  console.log(JSON.stringify(report, null, 2));
}

runAudit().catch(console.error);
