/**
 * Browser Utilities
 * Patchright browser management with stealth settings
 */

import { chromium } from 'patchright';
import { config } from '../config/index.mjs';

/**
 * Launch browser with stealth settings
 * @returns {Promise<import('playwright').Browser>}
 */
export const launchBrowser = async () => {
    return await chromium.launch({
        headless: config.browser.headless,
        channel: 'chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    });
};

/**
 * Create browser context with optional proxy
 * @param {import('playwright').Browser} browser
 * @returns {Promise<import('playwright').BrowserContext>}
 */
export const createContext = async (browser) => {
    const options = {
        viewport: null,
        locale: 'en-US',
        timezoneId: 'America/New_York',
        geolocation: { longitude: -74.006, latitude: 40.7128 },
        permissions: ['geolocation']
    };

    if (config.proxy) {
        options.proxy = config.proxy;
        console.log('[Browser] Using proxy');
    }

    return await browser.newContext(options);
};

/**
 * Navigate to URL and wait for load
 * @param {import('playwright').Page} page
 * @param {string} url
 * @returns {Promise<boolean>} Success status
 */
export const navigateTo = async (page, url) => {
    try {
        await page.goto(url, {
            waitUntil: 'load',
            timeout: config.browser.timeout
        });
        return true;
    } catch (error) {
        console.error(`[Browser] Navigation failed: ${error.message}`);
        return false;
    }
};

/**
 * Extract all links from page
 * @param {import('playwright').Page} page
 * @returns {Promise<string[]>}
 */
export const getPageLinks = async (page) => {
    return await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]'), el => el.href)
    );
};

/**
 * Extract text content from page
 * @param {import('playwright').Page} page
 * @returns {Promise<string>}
 */
export const getPageContent = async (page) => {
    return await page.evaluate(() => document.body.innerText || '');
};

/**
 * Safely close browser resources
 * @param {import('playwright').BrowserContext} context
 * @param {import('playwright').Browser} browser
 */
export const closeBrowser = async (context, browser) => {
    if (context) {
        await context.close().catch(() => { });
        console.log('[Browser] Context closed');
    }
    if (browser) {
        await browser.close().catch(() => { });
        console.log('[Browser] Browser closed');
    }
};
