/**
 * Page Discovery
 * Sitemap-first pattern matching, AI fallback for homepage links
 */

import { askAI, parseAIJson } from './providers.mjs';
import { config } from '../config/index.mjs';

// Patterns to look for (ordered by priority - pricing first!)
const PRIORITY_PATTERNS = [
    // Tier 1: Pricing (highest priority)
    ['/pricing', '/price', '/plans'],
    // Tier 2: Product/features info
    ['/features', '/solutions', '/products', '/services']
];

// AI prompt for page selection
const DISCOVERY_PROMPT = `You are a web analyst. Given a list of URLs from a website, pick the most valuable pages for business intelligence.

PRIORITY ORDER (most important first):
1. Pricing/plans page (ALWAYS include if available)
2. Features/products/solutions
3. Services offered

Return ONLY a JSON array of URLs. No explanation.`;

/**
 * Normalize hostname (remove www prefix)
 */
const normalizeHostname = (hostname) => hostname.replace(/^www\./, '');

/**
 * Filter URLs to same domain only
 */
const filterSameDomain = (urls, baseUrl) => {
    const baseHostname = normalizeHostname(new URL(baseUrl).hostname);

    return urls.filter(url => {
        try {
            return normalizeHostname(new URL(url).hostname) === baseHostname;
        } catch {
            return false;
        }
    });
};

/**
 * Find URLs matching target patterns (priority-ordered)
 * @param {string[]} urls - URLs to search
 * @returns {string[]} Matching URLs, pricing first
 */
const findPatternMatches = (urls) => {
    const matchesByTier = PRIORITY_PATTERNS.map(() => []);

    for (const url of urls) {
        try {
            const path = new URL(url).pathname.toLowerCase();

            // Check each priority tier
            for (let tier = 0; tier < PRIORITY_PATTERNS.length; tier++) {
                const patterns = PRIORITY_PATTERNS[tier];

                for (const pattern of patterns) {
                    if (path.includes(pattern)) {
                        matchesByTier[tier].push(url);
                        break;
                    }
                }
            }
        } catch {
            continue;
        }
    }

    // Flatten with priority order: pricing first, then features/products
    const ordered = matchesByTier.flat();
    return [...new Set(ordered)];
};

/**
 * Ask AI to pick valuable pages from a list of URLs
 * @param {string[]} urls - Candidate URLs
 * @param {string} baseUrl - Website base URL
 * @param {number} maxPages - Maximum pages to select
 * @returns {Promise<string[]>} Selected URLs
 */
const askAIToPickPages = async (urls, baseUrl, maxPages) => {
    // Limit candidates to avoid token bloat
    const candidates = urls.slice(0, 100);

    if (candidates.length === 0) {
        return [];
    }

    const userPrompt = `Website: ${baseUrl}

URLs to choose from:
${candidates.join('\n')}

Pick up to ${maxPages} URLs that would have the most valuable business information.
Return JSON array: ["url1", "url2", ...]`;

    try {
        const response = await askAI(DISCOVERY_PROMPT, userPrompt);
        const selected = parseAIJson(response);

        // Validate returned URLs exist in our list
        return selected.filter(url => candidates.includes(url)).slice(0, maxPages);
    } catch (error) {
        console.error(`[Discovery] AI error: ${error.message}`);
        return [];
    }
};

/**
 * Get pages to visit
 * Strategy: Sitemap patterns first (free), AI fallback if needed
 *
 * @param {string[]} homepageLinks - Links found on homepage
 * @param {string} baseUrl - Website base URL
 * @param {string[]} sitemapUrls - URLs from sitemap (optional)
 * @returns {Promise<string[]>} URLs to visit
 */
export const getPagesToVisit = async (homepageLinks, baseUrl, sitemapUrls = []) => {
    const maxPages = config.browser.maxPagesToVisit;
    let selectedPages = [];

    // Step 1: Try sitemap pattern matching (FREE - no AI)
    if (sitemapUrls.length > 0) {
        const sameDomainSitemap = filterSameDomain(sitemapUrls, baseUrl);
        selectedPages = findPatternMatches(sameDomainSitemap);

        console.log(`[Discovery] Sitemap: ${sameDomainSitemap.length} URLs, ${selectedPages.length} match patterns`);
    }

    // Step 2: If sitemap found enough pages, we're done
    if (selectedPages.length >= maxPages) {
        const limited = selectedPages.slice(0, maxPages);
        console.log(`[Discovery] Using ${limited.length} pages from sitemap patterns (no AI needed)`);
        return limited;
    }

    // Step 3: Fallback - use AI to pick from homepage links
    console.log(`[Discovery] Sitemap patterns insufficient, asking AI to pick from homepage links...`);

    const sameDomainLinks = filterSameDomain(homepageLinks, baseUrl);
    const aiSelected = await askAIToPickPages(sameDomainLinks, baseUrl, maxPages - selectedPages.length);

    console.log(`[Discovery] AI selected ${aiSelected.length} additional pages`);

    // Combine sitemap patterns + AI selections
    const combined = [...new Set([...selectedPages, ...aiSelected])];
    const limited = combined.slice(0, maxPages);

    console.log(`[Discovery] Will visit ${limited.length} pages total`);
    return limited;
};
