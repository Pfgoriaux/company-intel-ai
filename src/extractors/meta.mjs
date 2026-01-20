/**
 * Meta Tag Extractor
 * Extracts title, description and favicon from page
 */

/**
 * Extract meta information from page
 * @param {import('playwright').Page} page - Playwright page
 * @returns {Promise<{title: string|null, description: string|null, favicon: string|null}>}
 */
export const extractMeta = async (page) => {
    return await page.evaluate(() => {
        const title = document.title || null;

        const descMeta = document.querySelector('meta[name="description"]') ||
            document.querySelector('meta[property="og:description"]');
        const description = descMeta ? descMeta.getAttribute('content') : null;

        // Favicon extraction
        const faviconLink = document.querySelector('link[rel="icon"]') ||
            document.querySelector('link[rel="shortcut icon"]') ||
            document.querySelector('link[rel="apple-touch-icon"]');
        const favicon = faviconLink ? faviconLink.href : null;

        return { title, description, favicon };
    });
};
