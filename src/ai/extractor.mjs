/**
 * AI Content Extractor
 * Uses AI to extract business intelligence from page content
 */

import { askAI, parseAIJson } from './providers.mjs';
import { EXTRACTION_SCHEMA } from './schema.mjs';
import { config } from '../config/index.mjs';

// System prompt for extraction
const EXTRACTION_PROMPT = `You are a business analyst AI. Extract key business information from website content.

RULES:
- Respond ONLY with valid JSON matching the provided schema
- pricing.price = NUMBER only, no currency symbols (e.g. "$29/mo" → 29)
- pricing.type = "monthly", "annual", "one-time", or "other"
- customers.names = ONLY real company/brand names (e.g. "Nike", "Spotify"). NO generic terms like "teams", "businesses", "enterprises"
- companyInfo.userCount = number of CUSTOMERS/USERS on website (e.g. "4M users" → 4000000, "10k customers" → 10000)
- companyInfo.description = short company description
- If not found, use empty arrays [] or null as appropriate
- Do NOT include case studies`;

/**
 * Extract business intelligence from page content
 * @param {string} content - Page text content
 * @param {string} url - Page URL for context
 * @returns {Promise<object>} Extracted intelligence
 */
export const extractIntelligence = async (content, url) => {
    // Limit content to avoid token limits
    const truncatedContent = content.slice(0, config.extraction.maxContentLength);

    const userPrompt = `URL: ${url}

PAGE CONTENT:
${truncatedContent}

Extract business intelligence from this page.`;

    try {
        const response = await askAI(EXTRACTION_PROMPT, userPrompt, EXTRACTION_SCHEMA);
        return parseAIJson(response);
    } catch (error) {
        console.error(`[AI Extractor] Error: ${error.message}`);
        return getEmptyResult(error.message);
    }
};

/**
 * Get empty result structure
 */
const getEmptyResult = (errorMessage = null) => ({
    pricing: { found: false, plans: [] },
    customers: { found: false, names: [] },
    valueProposition: { found: false, main: '', points: [] },
    whatTheySell: { found: false, products: [], services: [] },
    competitors: { found: false, names: [] },
    companyInfo: { found: false, userCount: null, description: null },
    ...(errorMessage && { error: errorMessage })
});

/**
 * Merge multiple extraction results
 * @param {object[]} results - Array of extraction results
 * @returns {object} Merged intelligence
 */
export const mergeIntelligence = (results) => {
    const merged = {
        pricing: { found: false, plans: [] },
        customers: { found: false, names: [] },
        valueProposition: { found: false, main: '', points: [] },
        whatTheySell: { found: false, products: [], services: [] },
        competitors: { found: false, names: [] },
        companyInfo: { found: false, userCount: null, description: null }
    };

    for (const result of results) {
        if (!result || result.error) continue;

        // Merge pricing
        if (result.pricing?.found) {
            merged.pricing.found = true;
            if (result.pricing.plans?.length) {
                merged.pricing.plans.push(...result.pricing.plans);
            }
        }

        // Merge customers (company names only)
        if (result.customers?.found) {
            merged.customers.found = true;
            if (result.customers.names?.length) {
                merged.customers.names.push(...result.customers.names);
            }
        }

        // Merge value proposition
        if (result.valueProposition?.found) {
            merged.valueProposition.found = true;
            if (result.valueProposition.main) {
                merged.valueProposition.main = result.valueProposition.main;
            }
            if (result.valueProposition.points?.length) {
                merged.valueProposition.points.push(...result.valueProposition.points);
            }
        }

        // Merge products/services
        if (result.whatTheySell?.found) {
            merged.whatTheySell.found = true;
            if (result.whatTheySell.products?.length) {
                merged.whatTheySell.products.push(...result.whatTheySell.products);
            }
            if (result.whatTheySell.services?.length) {
                merged.whatTheySell.services.push(...result.whatTheySell.services);
            }
        }

        // Merge competitors
        if (result.competitors?.found) {
            merged.competitors.found = true;
            if (result.competitors.names?.length) {
                merged.competitors.names.push(...result.competitors.names);
            }
        }

        // Merge company info (userCount and description only)
        if (result.companyInfo?.found) {
            merged.companyInfo.found = true;
            if (result.companyInfo.userCount) {
                merged.companyInfo.userCount = result.companyInfo.userCount;
            }
            if (result.companyInfo.description) {
                merged.companyInfo.description = result.companyInfo.description;
            }
        }
    }

    // Deduplicate arrays
    merged.pricing.plans = deduplicatePlans(merged.pricing.plans);
    merged.customers.names = [...new Set(merged.customers.names)];
    merged.valueProposition.points = [...new Set(merged.valueProposition.points)];
    merged.whatTheySell.products = [...new Set(merged.whatTheySell.products)];
    merged.whatTheySell.services = [...new Set(merged.whatTheySell.services)];
    merged.competitors.names = [...new Set(merged.competitors.names)];

    return merged;
};

/**
 * Deduplicate pricing plans by name
 */
const deduplicatePlans = (plans) => {
    const seen = new Set();
    return plans.filter(plan => {
        const key = plan.name || JSON.stringify(plan);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};
