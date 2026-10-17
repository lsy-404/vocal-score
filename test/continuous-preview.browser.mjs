import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4190/';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});

const quarter = 705600000;
const project = {
  version: 153,
  projectName: 'Continuous scroll study',
  time: { tempo: [{ position: 0, bpm: 120 }], meter: [{ index: 0, numerator: 4, denominator: 4 }] },
  tracks: [{
    name: 'Lead',
    mainGroup: {
      uuid: 'continuous-lead',
      notes: Array.from({ length: 1100 }, (_, index) => ({
        onset: index * quarter,
        duration: quarter,
        pitch: [60, 62, 64, 65, 67, 69, 71, 72][index % 8],
        lyrics: 'la',
      })),
    },
  }],
};

try {
  const page = await browser.newPage({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#file-input') && !document.querySelector('#file-input').disabled, null, { timeout: 30000 });
  await page.locator('#file-input').setInputFiles({
    name: 'continuous-scroll.svp',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('#pdf-button:enabled').waitFor({ timeout: 90000 });
  const viewport = page.locator('.score-viewer__viewport');
  const pages = page.locator('.score-viewer__page');
  await page.waitForFunction(() => document.querySelectorAll('.score-viewer__page').length >= 3, null, { timeout: 30000 });
  const count = await pages.count();
  assert(count >= 3, `long score should span multiple pages, got ${count}`);

  const dimensions = await viewport.evaluate(element => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
  assert(dimensions.scrollHeight > dimensions.clientHeight * 2, 'all pages share a vertically scrollable viewport');
  const gaps = await pages.evaluateAll(elements => elements.slice(1).map((element, index) => {
    const previous = elements[index].getBoundingClientRect();
    const current = element.getBoundingClientRect();
    return current.top - previous.bottom;
  }));
  assert(gaps.every(gap => gap >= 9 && gap <= 11), `page gaps remain compact: ${gaps.join(', ')}`);

  const firstSheet = pages.nth(0).locator('.score-viewer__sheet');
  const lastPage = pages.nth(count - 1);
  const lastSheet = lastPage.locator('.score-viewer__sheet');
  await page.waitForFunction(() => document.querySelector('.score-viewer__page .score-viewer__sheet[data-rendered="true"] > svg'));
  assert.equal(await lastSheet.evaluate(sheet => sheet.dataset.rendered || ''), '', 'distant pages are deferred');

  await lastPage.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(index => document.querySelectorAll('.score-viewer__page')[index]?.querySelector('.score-viewer__sheet > svg'), count - 1, { timeout: 30000 });
  await page.waitForFunction(index => Number(document.querySelector('.score-viewer__page-input').value) === index + 1, count - 1);
  await page.waitForFunction(() => !document.querySelector('.score-viewer__page .score-viewer__sheet').firstChild, null, { timeout: 10000 });
  assert.equal(await firstSheet.evaluate(sheet => sheet.childElementCount), 0, 'far-away page SVG copies are released');

  const beforeZoom = await pages.nth(0).evaluate(element => parseFloat(element.style.width));
  const lastBeforeZoom = await lastPage.evaluate(element => parseFloat(element.style.width));
  assert.equal(lastBeforeZoom, beforeZoom, 'all page placeholders share the document zoom');
  const zoom = page.locator('.score-viewer__zoom');
  await zoom.selectOption('0.75');
  await page.waitForFunction(previous => parseFloat(document.querySelector('.score-viewer__page').style.width) < previous - 20, beforeZoom);
  const afterZoom = await pages.nth(0).evaluate(element => parseFloat(element.style.width));
  assert.equal(await lastPage.evaluate(element => parseFloat(element.style.width)), afterZoom, 'zoom updates every page wrapper');

  const pageInput = page.locator('.score-viewer__page-input');
  await pageInput.fill('2');
  await pageInput.press('Enter');
  await page.waitForFunction(() => Number(document.querySelector('.score-viewer__page-input').value) === 2);
  await page.waitForFunction(() => {
    const viewer = document.querySelector('.score-viewer__viewport');
    const target = document.querySelector('.score-viewer__page[data-page-number="2"]');
    return target && Math.abs(target.getBoundingClientRect().top - viewer.getBoundingClientRect().top) < 40;
  });

  await zoom.selectOption('fit');
  await viewport.evaluate(element => { element.scrollTop = 0; });
  await page.waitForFunction(() => document.querySelector('.score-viewer__page-count')?.textContent.includes('第 1 页'));
  await pages.nth(1).evaluate(element => element.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => document.querySelector('.score-viewer__page-count')?.textContent.includes('第 2 页'));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  const toolbarGeometry = await page.evaluate(() => {
    const navigation = document.querySelector('.score-viewer__navigation').getBoundingClientRect();
    const zoomControl = document.querySelector('.score-viewer__zoom').getBoundingClientRect();
    return { navigationRight: navigation.right, zoomLeft: zoomControl.left, toolbarRight: document.querySelector('.score-viewer__toolbar').getBoundingClientRect().right };
  });
  assert(toolbarGeometry.navigationRight <= toolbarGeometry.zoomLeft, 'mobile toolbar navigation and zoom do not overlap');
  assert(toolbarGeometry.zoomLeft < toolbarGeometry.toolbarRight, 'mobile zoom control remains inside the toolbar');

  assert.deepEqual(errors, [], 'scrolling and rendering produce no uncaught browser errors');
  process.stdout.write(JSON.stringify({ status: 'passed', pages: count, compactGapPx: gaps[0], releasedDistantPages: true }));
  await page.close();
} finally {
  await browser.close();
}
