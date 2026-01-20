/**
 * Sitemap Discovery Utility
 * Fetches and parses sitemap.xml for smarter page discovery
 * No external dependencies - uses regex-based XML parsing
 */

const SITEMAP_TIMEOUT = 10000; // 10s timeout
const MAX_URLS = 500; // Maximum URLs to return

/**
 * Fetch content from a URL with timeout
 * @param {string} url - URL to fetch
 * @returns {Promise<string|null>} Content or null on failure
 */
const fetchWithTimeout = async (url) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SITEMAP_TIMEOUT);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CompanyIntelBot/1.0)'
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return null;
        }

        return await response.text();
    } catch (error) {
        clearTimeout(timeoutId);
        return null;
    }
};

/**
 * Parse URLs from XML sitemap content using regex
 * @param {string} xml - XML content
 * @returns {string[]} Array of URLs
 */
const parseXmlUrls = (xml) => {
    const urls = [];

    // Match <loc>...</loc> tags (standard sitemap format)
    const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
    let match;

    while ((match = locRegex.exec(xml)) !== null && urls.length < MAX_URLS) {
        const url = match[1].trim();
        if (url.startsWith('http')) {
            urls.push(url);
        }
    }

    return urls;
};

/**
 * Check if URL is a sitemap index (contains sitemap references)
 * @param {string} xml - XML content
 * @returns {boolean}
 */
const isSitemapIndex = (xml) => {
    return xml.includes('<sitemapindex') || xml.includes('<sitemap>');
};

/**
 * Parse sitemap index to get individual sitemap URLs
 * @param {string} xml - XML content
 * @returns {string[]} Array of sitemap URLs
 */
const parseSitemapIndex = (xml) => {
    const sitemaps = [];

    // Match sitemap URLs in sitemap index
    const sitemapRegex = /<sitemap>[\s\S]*?<loc>\s*(.*?)\s*<\/loc>[\s\S]*?<\/sitemap>/gi;
    let match;

    while ((match = sitemapRegex.exec(xml)) !== null && sitemaps.length < 10) {
        const url = match[1].trim();
        if (url.startsWith('http')) {
            sitemaps.push(url);
        }
    }

    return sitemaps;
};

/**
 * Parse robots.txt to find Sitemap directives
 * @param {string} baseUrl - Base URL of the website
 * @returns {Promise<string[]>} Array of sitemap URLs found in robots.txt
 */
export const parseRobotsTxt = async (baseUrl) => {
    const url = new URL(baseUrl);
    const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;

    console.log(`[Sitemap] Checking robots.txt: ${robotsUrl}`);

    const content = await fetchWithTimeout(robotsUrl);
    if (!content) {
        return [];
    }

    const sitemaps = [];
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim().toLowerCase();
        if (trimmed.startsWith('sitemap:')) {
            const sitemapUrl = line.substring(line.indexOf(':') + 1).trim();
            if (sitemapUrl.startsWith('http')) {
                sitemaps.push(sitemapUrl);
            }
        }
    }

    console.log(`[Sitemap] Found ${sitemaps.length} sitemap(s) in robots.txt`);
    return sitemaps;
};

/**
 * Fetch and parse a single sitemap
 * @param {string} sitemapUrl - URL of the sitemap
 * @returns {Promise<string[]>} Array of URLs from sitemap
 */
const fetchSingleSitemap = async (sitemapUrl) => {
    console.log(`[Sitemap] Fetching: ${sitemapUrl}`);

    const content = await fetchWithTimeout(sitemapUrl);
    if (!content) {
        console.log(`[Sitemap] Failed to fetch: ${sitemapUrl}`);
        return [];
    }

    // Check if it's a sitemap index
    if (isSitemapIndex(content)) {
        console.log(`[Sitemap] Found sitemap index, parsing...`);
        const childSitemaps = parseSitemapIndex(content);
        const allUrls = [];

        // Fetch first few child sitemaps only (to avoid too many requests)
        for (const childUrl of childSitemaps.slice(0, 3)) {
            const childContent = await fetchWithTimeout(childUrl);
            if (childContent && !isSitemapIndex(childContent)) {
                const urls = parseXmlUrls(childContent);
                allUrls.push(...urls);

                if (allUrls.length >= MAX_URLS) break;
            }
        }

        return allUrls.slice(0, MAX_URLS);
    }

    // Regular sitemap
    return parseXmlUrls(content);
};

/**
 * Fetch all URLs from a website's sitemap(s)
 * Tries multiple discovery methods:
 * 1. /sitemap.xml
 * 2. robots.txt Sitemap: directive
 *
 * @param {string} baseUrl - Base URL of the website
 * @returns {Promise<{urls: string[], found: boolean}>} Sitemap data
 */
export const fetchSitemapUrls = async (baseUrl) => {
    const url = new URL(baseUrl);
    const baseHost = `${url.protocol}//${url.host}`;
    const allUrls = new Set();

    // Method 1: Try standard /sitemap.xml
    const standardSitemapUrl = `${baseHost}/sitemap.xml`;
    const standardUrls = await fetchSingleSitemap(standardSitemapUrl);

    if (standardUrls.length > 0) {
        standardUrls.forEach(u => allUrls.add(u));
        console.log(`[Sitemap] Found ${standardUrls.length} URLs from /sitemap.xml`);
    }

    // Method 2: Check robots.txt for additional sitemaps
    if (allUrls.size < MAX_URLS) {
        const robotsSitemaps = await parseRobotsTxt(baseUrl);

        for (const sitemapUrl of robotsSitemaps) {
            // Skip if we already fetched /sitemap.xml
            if (sitemapUrl.toLowerCase() === standardSitemapUrl.toLowerCase()) {
                continue;
            }

            const urls = await fetchSingleSitemap(sitemapUrl);
            urls.forEach(u => allUrls.add(u));

            if (allUrls.size >= MAX_URLS) break;
        }
    }

    const urlArray = [...allUrls].slice(0, MAX_URLS);
    const found = urlArray.length > 0;

    console.log(`[Sitemap] Total: ${urlArray.length} unique URLs found`);

    return {
        urls: urlArray,
        found
    };
};
