#!/usr/bin/env node
// Playwright script to generate manual screenshots for Biosanarcall Medical System.
// This script logs in with demo credentials, navigates through key pages, and captures screenshots.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Por defecto usa producción (frontend servido desde dist/ vía Nginx)
// Usa BASE_URL env var para override si necesitas dev server local
const BASE_URL = process.env.BASE_URL || 'https://biosanarcall.site';
const OUT_DIR = path.resolve(__dirname, '../../docs/manual_screenshots');
const CREDENTIALS = { 
  email: process.env.MANUAL_EMAIL || 'demo@demo.com', 
  password: process.env.MANUAL_PASSWORD || 'demo123' 
};

async function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function screenshotPage(page, name, waitForSelector, timeout = 5000) {
  if (waitForSelector) {
    try { 
      await page.waitForSelector(waitForSelector, { timeout }); 
    } catch (e) { 
      console.warn(`Selector ${waitForSelector} not found for ${name}, continuing...`);
    }
  }
  // Wait a bit for any animations to complete
  await page.waitForTimeout(1000);
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log('✓ Saved', name);
}

(async () => {
  await ensureOutDir();
  console.log('Launching browser...');
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ 
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log('Opening app at', BASE_URL);
  
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.error('Failed to load app:', e.message);
    await browser.close();
    process.exit(1);
  }

  // Login process
  console.log('Attempting login...');
  try {
    // Wait for email input (AnimatedInputField component)
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', CREDENTIALS.email);
    
    // Wait for password input
    await page.waitForSelector('input[id="password"]', { timeout: 5000 });
    await page.fill('input[id="password"]', CREDENTIALS.password);
    
    // Click submit button
    await page.click('button[type="submit"]');
    
    // Wait for navigation to complete
    await page.waitForURL(/.*\/((?!login).)*$/, { timeout: 10000 });
    console.log('✓ Login successful');
    
    // Wait for dashboard to load
    await page.waitForTimeout(2000);
  } catch (e) {
    console.error('Login failed:', e.message);
    await page.screenshot({ path: path.join(OUT_DIR, 'error_login.png'), fullPage: true });
    await browser.close();
    process.exit(1);
  }

  // Dashboard (Index page)
  console.log('Capturing Dashboard...');
  await screenshotPage(page, '01_dashboard.png', 'main');

  // Cola de Espera (Queue)
  console.log('Capturing Cola de Espera...');
  try {
    await page.goto(BASE_URL + '/queue', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Wait for accordion/data to load
    await screenshotPage(page, '02_queue.png', 'main');
  } catch (e) { 
    console.warn('Queue page error:', e.message); 
  }

  // Cola Diaria
  console.log('Capturing Cola Diaria...');
  try {
    await page.goto(BASE_URL + '/daily-queue', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    await screenshotPage(page, '03_daily_queue.png', 'main');
  } catch (e) { 
    console.warn('Daily queue error:', e.message); 
  }

  // Pacientes
  console.log('Capturing Pacientes...');
  try {
    await page.goto(BASE_URL + '/patients', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    await screenshotPage(page, '04_patients.png', 'main');
  } catch (e) { 
    console.warn('Patients page error:', e.message); 
  }

  // Llamadas
  console.log('Capturing Llamadas...');
  try {
    await page.goto(BASE_URL + '/calls', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshotPage(page, '05_calls.png', 'main');
  } catch (e) { 
    console.warn('Calls page error:', e.message); 
  }

  // SMS page (direct route)
  console.log('Capturing SMS...');
  try {
    await page.goto(BASE_URL + '/sms', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshotPage(page, '06_sms.png', 'main');
  } catch (e) { 
    console.warn('SMS page error:', e.message); 
  }

  // Ubicaciones
  console.log('Capturing Ubicaciones...');
  try {
    await page.goto(BASE_URL + '/locations', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshotPage(page, '07_locations.png', 'main');
  } catch (e) { 
    console.warn('Locations page error:', e.message); 
  }

  // Analytics (estadísticas)
  console.log('Capturing Analytics...');
  try {
    await page.goto(BASE_URL + '/analytics', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Charts may take time to render
    await screenshotPage(page, '08_statistics.png', 'main');
  } catch (e) { 
    console.warn('Analytics page error:', e.message); 
  }

  // Settings
  console.log('Capturing Settings...');
  try {
    await page.goto(BASE_URL + '/settings', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshotPage(page, '09_settings.png', 'main');
  } catch (e) { 
    console.warn('Settings page error:', e.message); 
  }

  await browser.close();
  console.log('\n✓ Done! Screenshots saved to', OUT_DIR);
  console.log('You can now review the images and update docs/MANUAL_DE_USO.md with descriptions.');
})();
