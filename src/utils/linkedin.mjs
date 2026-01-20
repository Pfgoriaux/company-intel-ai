/**
 * LinkedIn Company Scraper
 * Extracts company information from LinkedIn company pages
 */

import { HttpsProxyAgent } from 'https-proxy-agent';
import * as cheerio from 'cheerio';
import UserAgent from 'user-agents';
import { config } from '../config/index.mjs';

const MAX_RETRIES = 5;
const REQUEST_TIMEOUT = 15000;

/**
 * Build proxy agent from config (same proxy as browser uses)
 */
const getProxyAgent = () => {
    if (!config.proxy?.server) {
        return null;
    }

    const { server, username, password } = config.proxy;

    // Build proxy URL with auth if provided
    let proxyUrl;
    if (username && password) {
        // server format: "host:port" or "http://host:port"
        const serverClean = server.replace(/^https?:\/\//, '');
        proxyUrl = `http://${username}:${password}@${serverClean}`;
    } else {
        proxyUrl = server.includes('://') ? server : `http://${server}`;
    }

    console.log(`[LinkedIn] Using proxy: ${server}`);
    return new HttpsProxyAgent(proxyUrl);
};

/**
 * Extract company slug from LinkedIn URL
 * @param {string} linkedinUrl - Full LinkedIn company URL
 * @returns {string|null} Company slug
 */
export const extractLinkedInSlug = (linkedinUrl) => {
    try {
        const url = new URL(linkedinUrl);
        const match = url.pathname.match(/\/company\/([^/]+)/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
};

/**
 * Find LinkedIn company URL from social links
 * @param {object} socialLinks - Social links object from extraction
 * @param {string[]} allLinks - All social links found (fallback)
 * @returns {string|null} LinkedIn company URL
 */
export const findLinkedInUrl = (socialLinks, allLinks = []) => {
    // Check primary socialLinks object first
    if (socialLinks?.linkedin) {
        const url = Array.isArray(socialLinks.linkedin)
            ? socialLinks.linkedin[0]
            : socialLinks.linkedin;

        // Only return company pages, not personal profiles
        if (url && url.includes('/company/')) {
            return url;
        }
    }

    // Fallback: search in all links array
    for (const link of allLinks) {
        if (link && link.includes('linkedin.com/company/')) {
            return link;
        }
    }

    return null;
};

/**
 * Fetch LinkedIn company page with retries
 * @param {string} companySlug - LinkedIn company slug
 * @returns {Promise<string|null>} HTML content or null
 */
const fetchLinkedInPage = async (companySlug) => {
    const targetUrl = `https://www.linkedin.com/company/${encodeURIComponent(companySlug)}/`;
    const proxyAgent = getProxyAgent();

    console.log(`[LinkedIn] Fetching: ${targetUrl}`);
    if (!proxyAgent) {
        console.log(`[LinkedIn] No proxy configured, attempting direct request`);
    }

    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const randomIP = `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
        const userAgent = new UserAgent();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        try {
            const fetchOptions = {
                signal: controller.signal,
                headers: {
                    'User-Agent': userAgent.toString(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'max-age=0',
                    'X-Forwarded-For': randomIP,
                    'Referer': 'https://www.google.com/'
                }
            };

            // Add proxy agent if available
            if (proxyAgent) {
                fetchOptions.agent = proxyAgent;
            }

            const response = await fetch(targetUrl, fetchOptions);

            clearTimeout(timeout);

            if (response.status === 404) {
                console.log(`[LinkedIn] Company not found: ${companySlug}`);
                return null;
            }

            if (response.status === 429 || response.status === 403 || response.status >= 500) {
                console.log(`[LinkedIn] Status ${response.status}, retrying...`);
                lastError = new Error(`HTTP ${response.status}`);
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.text();

        } catch (error) {
            clearTimeout(timeout);
            lastError = error;

            if (error.name === 'AbortError') {
                console.log(`[LinkedIn] Timeout, retrying...`);
                continue;
            }

            console.log(`[LinkedIn] Error: ${error.message}`);
            continue;
        }
    }

    console.log(`[LinkedIn] Failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
    return null;
};

/**
 * Extract website URL from HTML
 */
const extractWebsiteUrl = (html) => {
    const regex = /<div[^>]*data-test-id="about-us__website"[^>]*>[\s\S]*?href="[^"]*?url=([^"&]+)[^"]*"[\s\S]*?<\/div>/;
    const match = html.match(regex);

    if (match && match[1]) {
        try {
            const decodedUrl = decodeURIComponent(match[1]);
            const url = new URL(decodedUrl);
            return url.hostname;
        } catch {
            return null;
        }
    }
    return null;
};

/**
 * Extract similar companies from HTML
 */
const extractSimilarCompanies = (html) => {
    const similarCompanies = [];
    const $ = cheerio.load(html);

    $('ul.show-more-less__list a.base-aside-card--link[href*="/company/"]').each((i, elem) => {
        const anchor = $(elem);
        const companyPageUrl = anchor.attr('href');
        const companyName = anchor.find('h3.base-aside-card__title').text().trim();
        const industry = anchor.find('p.base-aside-card__subtitle').text().trim();
        const location = anchor.find('p.base-aside-card__second-subtitle').text().trim() || null;

        if (companyName) {
            similarCompanies.push({
                name: companyName,
                linkedinUrl: companyPageUrl || null,
                industry: industry || null,
                location: location
            });
        }
    });

    return similarCompanies;
};

/**
 * Extract funding information from HTML
 */
const extractFunding = (html) => {
    if (!html.includes('Last Round')) {
        return null;
    }

    const funding = {
        lastRound: null,
        date: null,
        amount: null,
        investors: []
    };

    const $ = cheerio.load(html);

    const roundElement = $('a[data-tracking-control-name="funding_last-round"]');
    if (roundElement.length) {
        let roundText = '';
        roundElement.contents().each((i, node) => {
            if (node.type === 'text') {
                roundText += $(node).text();
            }
        });
        funding.lastRound = roundText.trim() || null;
    }

    const dateElement = $('time.before\\:middot');
    if (dateElement.length) {
        funding.date = dateElement.text().trim() || null;
    }

    const amountElement = $('p.text-display-lg');
    if (amountElement.length) {
        funding.amount = amountElement.text().trim() || null;
    }

    $('a[data-tracking-control-name="funding_investors"]').each((i, elem) => {
        if (!$(elem).text().includes('Other investors')) {
            const investorText = $(elem).clone().children('img').remove().end().text().trim();
            if (investorText) {
                funding.investors.push(investorText);
            }
        }
    });

    if (!funding.lastRound && !funding.date && !funding.amount && funding.investors.length === 0) {
        return null;
    }

    return funding;
};

/**
 * Extract description from HTML
 */
const extractDescription = (html) => {
    const scriptRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
    const scriptMatch = html.match(scriptRegex);

    if (scriptMatch && scriptMatch[1]) {
        try {
            const scriptJson = JSON.parse(scriptMatch[1]);
            if (scriptJson['@graph']) {
                const orgObject = scriptJson['@graph'].find(item => item['@type'] === 'Organization');
                if (orgObject && orgObject.description) {
                    return orgObject.description;
                }
            } else if (scriptJson['@type'] === 'Organization' && scriptJson.description) {
                return scriptJson.description;
            }
        } catch {
            // Fall through to regex method
        }
    }

    const descRegex = /<p[^>]*data-test-id="about-us__description"[^>]*>([\s\S]*?)<\/p>/;
    const descMatch = html.match(descRegex);

    if (descMatch && descMatch[1]) {
        return descMatch[1].trim().replace(/\s+/g, ' ');
    }

    return null;
};

/**
 * Extract text from HTML by selector
 */
const extractText = (html, selector) => {
    if (selector.includes('data-test-id')) {
        const testId = selector.match(/data-test-id="([^"]+)"/)?.[1];
        if (testId) {
            const regex = new RegExp(`<div[^>]*data-test-id="${testId}"[^>]*>[\\s\\S]*?<dd[^>]*>([\\s\\S]*?)<\\/dd>`, 's');
            const match = html.match(regex);
            if (match && match[1]) {
                return match[1].trim().replace(/\s+/g, ' ');
            }
        }
    } else {
        const tagName = selector.match(/^(\w+)/)?.[1];
        if (tagName) {
            const regex = new RegExp(`<${tagName}[^>]*>(.*?)</${tagName}>`, 's');
            const match = html.match(regex);
            return match ? match[1].trim() : null;
        }
    }
    return null;
};

/**
 * Extract industry from HTML
 */
const extractIndustry = (html) => {
    const regex = /<div[^>]*data-test-id="about-us__industry"[^>]*>[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/;
    const match = html.match(regex);
    return match?.[1]?.trim() || null;
};

/**
 * Extract LinkedIn ID from HTML
 */
const extractLinkedinId = (html) => {
    let match = html.match(/data-entity-id="([^"]+)"/);
    if (match?.[1]) {
        return match[1].split(':').pop();
    }

    match = html.match(/data-semaphore-content-urn="urn:li:organization:(\d+)"/);
    return match?.[1] || null;
};

/**
 * Extract logo URL from HTML
 */
const extractLogo = (html) => {
    const regex = /<img[\s\S]*?top-card-layout__entity-image[\s\S]*?data-delayed-url="([^"]+)"[\s\S]*?>/;
    const match = html.match(regex);
    return match?.[1]?.replace(/&amp;/g, '&') || null;
};

/**
 * Parse employee count string to number
 * @param {string} sizeStr - e.g. "51-200 employees" or "10001+"
 * @returns {number|null}
 */
const parseEmployeeCount = (sizeStr) => {
    if (!sizeStr) return null;

    // Try to extract numbers
    const numbers = sizeStr.match(/\d+/g);
    if (!numbers) return null;

    // If range like "51-200", return average
    if (numbers.length >= 2) {
        return Math.round((parseInt(numbers[0]) + parseInt(numbers[1])) / 2);
    }

    // Single number
    return parseInt(numbers[0]);
};

/**
 * Extract company information from LinkedIn HTML
 * @param {string} html - HTML content
 * @returns {object} Company information
 */
const extractCompanyInfo = (html) => {
    const scriptRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
    const scriptMatch = html.match(scriptRegex);

    if (!scriptMatch) {
        return { error: 'Could not find company information' };
    }

    try {
        const scriptJson = JSON.parse(scriptMatch[1]);

        let companyData = null;
        if (scriptJson['@graph']) {
            companyData = scriptJson['@graph'].find(item => item['@type'] === 'Organization');
        } else if (scriptJson['@type'] === 'Organization') {
            companyData = scriptJson;
        }

        if (!companyData) {
            return { error: 'Could not find organization data' };
        }

        const address = companyData.address || {};
        const companySize = extractText(html, 'div[data-test-id="about-us__size"]');

        return {
            companyName: companyData.name || extractText(html, 'h1'),
            logo: extractLogo(html),
            description: extractDescription(html),
            website: extractWebsiteUrl(html),
            employeeCount: parseEmployeeCount(companySize) || parseEmployeeCount(companyData.numberOfEmployees?.value),
            companySize: companySize,
            foundedYear: extractText(html, 'div[data-test-id="about-us__foundedOn"]'),
            industry: extractIndustry(html) || companyData.industry || null,
            linkedinId: extractLinkedinId(html),
            headquarter: {
                country: address.addressCountry || null,
                city: address.addressLocality || null,
                region: address.addressRegion || null
            },
            funding: extractFunding(html),
            similarCompanies: extractSimilarCompanies(html)
        };
    } catch (e) {
        console.error('[LinkedIn] Error parsing:', e.message);
        return { error: 'Error parsing company information' };
    }
};

/**
 * Scrape LinkedIn company page
 * @param {string} companySlug - LinkedIn company slug (e.g. "microsoft")
 * @returns {Promise<object|null>} Company information or null
 */
export const scrapeLinkedInCompany = async (companySlug) => {
    if (!companySlug) {
        return null;
    }

    console.log(`[LinkedIn] Scraping company: ${companySlug}`);

    const html = await fetchLinkedInPage(companySlug);
    if (!html) {
        return null;
    }

    const companyInfo = extractCompanyInfo(html);

    if (companyInfo.error) {
        console.log(`[LinkedIn] ${companyInfo.error}`);
        return null;
    }

    console.log(`[LinkedIn] Successfully extracted: ${companyInfo.companyName}`);
    return companyInfo;
};
