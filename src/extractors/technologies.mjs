/**
 * Technology Detection
 * Extracts external technology URLs from network requests, DOM scripts, and iframes
 * Integrates Wappalyzer for technology identification
 */

import { setupWappalyzerDetection, detectTechnologies } from '../utils/wappalyzer.mjs';

// Extensions to exclude
const EXCLUDED_EXTENSIONS = ['.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.mp3', '.pdf'];

// Link types to exclude
const EXCLUDED_LINK_RELS = ['stylesheet', 'icon', 'canonical', 'apple-touch-icon', 'manifest', 'preconnect', 'dns-prefetch', 'shortcut'];

const isExcludedExtension = (url) => {
    try {
        const pathname = new URL(url).pathname.toLowerCase();
        return EXCLUDED_EXTENSIONS.some(ext => pathname.endsWith(ext));
    } catch {
        return true;
    }
};

const isSameOrigin = (url, pageHostname) => {
    try {
        const hostname = new URL(url).hostname.replace(/^www\./, '');
        return hostname === pageHostname;
    } catch {
        return true;
    }
};

/**
 * Setup network request listener BEFORE navigation
 * Call this before page.goto()
 * @param {import('playwright').Page} page
 * @returns {Object} Collector object
 */
export const setupTechDetection = (page) => {
    const networkRequests = new Map();
    const allScriptUrls = new Set();
    const allXhrUrls = new Set();

    const wappalyzerCollector = setupWappalyzerDetection(page);

    page.on('request', request => {
        const url = request.url();
        const resourceType = request.resourceType();

        if (resourceType === 'script') {
            allScriptUrls.add(url);
        }

        if (resourceType === 'xhr' || resourceType === 'fetch') {
            allXhrUrls.add(url);
        }

        if (['script', 'xhr', 'fetch'].includes(resourceType)) {
            if (!networkRequests.has(url)) {
                networkRequests.set(url, new Set());
            }
            networkRequests.get(url).add(`network_${resourceType}`);
        }
    });

    return {
        networkRequests,
        allScriptUrls,
        allXhrUrls,
        wappalyzerCollector
    };
};

/**
 * Collect all technologies after page load
 * @param {import('playwright').Page} page
 * @param {Object} collector - From setupTechDetection
 * @returns {Promise<Object>} Detection results
 */
export const collectTechnologies = async (page, collector) => {
    console.log('[Tech Detector] Collecting technologies...');

    const pageUrl = page.url();
    const pageHostname = new URL(pageUrl).hostname.replace(/^www\./, '');

    const externalTechnologies = new Map();

    const addTechnology = (url, type) => {
        if (!url) return;
        if (isSameOrigin(url, pageHostname)) return;
        if (isExcludedExtension(url)) return;

        if (!externalTechnologies.has(url)) {
            externalTechnologies.set(url, new Set());
        }
        externalTechnologies.get(url).add(type);
    };

    try {
        // Network requests
        let networkCount = 0;
        for (const [url, types] of collector.networkRequests.entries()) {
            for (const type of types) {
                addTechnology(url, type);
                networkCount++;
            }
        }
        console.log(`[Tech Detector] Captured ${networkCount} network requests`);

        // DOM scripts
        const domScriptUrls = await page.evaluate(() =>
            Array.from(document.querySelectorAll('script[src]'), el => el.src)
        );
        domScriptUrls.forEach(url => {
            addTechnology(url, 'dom_script');
            collector.allScriptUrls.add(url);
        });

        // Iframes
        const iframeUrls = await page.evaluate(() =>
            Array.from(document.querySelectorAll('iframe[src]'), el => el.src)
        );
        iframeUrls.forEach(url => addTechnology(url, 'iframe'));

        // Link tags
        const linkUrls = await page.evaluate((excludedRels) => {
            return Array.from(document.querySelectorAll('link[href]'))
                .filter(el => {
                    const rel = (el.rel || '').toLowerCase();
                    return !excludedRels.some(excluded => rel.includes(excluded));
                })
                .map(el => ({ href: el.href, rel: el.rel }));
        }, EXCLUDED_LINK_RELS);
        linkUrls.forEach(({ href, rel }) => addTechnology(href, `link_${rel || 'unknown'}`));

        // Group by hostname
        const hostnameTechnologies = new Map();
        for (const [url, types] of externalTechnologies.entries()) {
            try {
                const hostname = new URL(url).hostname;
                if (!hostnameTechnologies.has(hostname)) {
                    hostnameTechnologies.set(hostname, new Set());
                }
                for (const type of types) {
                    hostnameTechnologies.get(hostname).add(type);
                }
            } catch {
                continue;
            }
        }

        const rawTechnologies = Array.from(hostnameTechnologies.entries()).map(([hostname, types]) => ({
            hostname,
            tags: Array.from(types)
        }));

        console.log(`[Tech Detector] Found ${rawTechnologies.length} external hostnames`);

        // Wappalyzer detection
        const allScriptUrlsArray = Array.from(collector.allScriptUrls);
        const allXhrUrlsArray = Array.from(collector.allXhrUrls);
        const wappalyzerResult = await detectTechnologies(
            page,
            collector.wappalyzerCollector,
            allScriptUrlsArray,
            allXhrUrlsArray
        );

        return {
            cms: wappalyzerResult.cms,
            detectedTechnologies: wappalyzerResult.detectedTechnologies,
            technologies: rawTechnologies
        };

    } catch (error) {
        console.error('[Tech Detector] Error:', error.message);
        return {
            cms: null,
            detectedTechnologies: [],
            technologies: []
        };
    }
};
