/**
 * Company Intel AI
 * AI-powered company intelligence extraction
 *
 * Main entry point - Express server with single endpoint
 */

import 'dotenv/config';
import express from 'express';

// Config
import { config, validateConfig } from './config/index.mjs';

// Extractors (from original project)
import { extractSocials } from './extractors/socials.mjs';
import { extractEmails } from './extractors/emails.mjs';
import { extractMeta } from './extractors/meta.mjs';
import { setupTechDetection, collectTechnologies } from './extractors/technologies.mjs';

// AI modules
import { extractIntelligence, mergeIntelligence } from './ai/extractor.mjs';
import { getPagesToVisit } from './ai/pageDiscovery.mjs';

// Utilities
import { fetchSitemapUrls } from './utils/sitemap.mjs';
import { findLinkedInUrl, extractLinkedInSlug, scrapeLinkedInCompany } from './utils/linkedin.mjs';

// Browser utilities
import {
    launchBrowser,
    createContext,
    navigateTo,
    getPageLinks,
    getPageContent,
    closeBrowser
} from './utils/browser.mjs';

// Validate config on startup
try {
    validateConfig();
} catch (error) {
    console.error(`[Config Error] ${error.message}`);
    process.exit(1);
}

// Express app
const app = express();
app.use(express.json());

/**
 * Main API Endpoint
 * POST /analyze
 *
 * Request: { "url": "https://example.com" }
 * Response: Company intelligence data
 */
app.post('/analyze', async (req, res) => {
    const { url: targetUrl, useAI = true } = req.body;

    // Validate input
    if (!targetUrl) {
        return res.status(400).json({
            url: null,
            data: null,
            error: 'URL is required',
            statusCode: 400,
            timestamp: new Date().toISOString()
        });
    }

    console.log(`\n[Analyze] Starting analysis of: ${targetUrl}`);
    console.log(`[Analyze] AI Provider: ${config.aiProvider}`);
    console.log(`[Analyze] AI Enabled: ${useAI}`);

    let browser = null;
    let context = null;
    let sitemapData = { urls: [], found: false };

    try {
        // Step 0: Fetch sitemap (before browser launch - simple HTTP request)
        console.log(`[Analyze] Fetching sitemap...`);
        sitemapData = await fetchSitemapUrls(targetUrl);
        console.log(`[Analyze] Sitemap: ${sitemapData.found ? sitemapData.urls.length + ' URLs found' : 'not found'}`);

        // Launch browser
        browser = await launchBrowser();
        context = await createContext(browser);
        const page = await context.newPage();

        // Setup technology detection BEFORE navigation (captures network requests)
        const techCollector = setupTechDetection(page);

        // Step 1: Visit homepage
        console.log(`[Analyze] Loading homepage...`);
        const success = await navigateTo(page, targetUrl);
        if (!success) {
            throw new Error('Failed to load homepage');
        }

        // Step 2: Extract basic data from homepage
        const links = await getPageLinks(page);
        const homeContent = await getPageContent(page);
        const meta = await extractMeta(page);
        const socials = extractSocials(links);
        const emails = extractEmails(homeContent);

        // Detect technologies (Wappalyzer + network analysis)
        const techResult = await collectTechnologies(page, techCollector);

        console.log(`[Analyze] Homepage: ${links.length} links, ${socials.allSocialLinksFound.length} socials, ${emails.length} emails`);
        console.log(`[Analyze] Technologies: ${techResult.detectedTechnologies.length} detected${techResult.cms ? `, CMS: ${techResult.cms}` : ''}`);

        // Step 2b: Try to scrape LinkedIn company page (if found)
        let linkedinData = null;
        const linkedinUrl = findLinkedInUrl(socials.socialLinks, socials.allSocialLinksFound);
        if (linkedinUrl) {
            const slug = extractLinkedInSlug(linkedinUrl);
            if (slug) {
                console.log(`[Analyze] Found LinkedIn company page: ${linkedinUrl}`);
                linkedinData = await scrapeLinkedInCompany(slug);
                if (linkedinData) {
                    console.log(`[Analyze] LinkedIn data extracted successfully`);
                } else {
                    console.log(`[Analyze] LinkedIn scrape failed (no proxy or blocked)`);
                }
            }
        } else {
            console.log(`[Analyze] No LinkedIn company page found in social links`);
        }

        // Step 3: Discover pages to visit (sitemap patterns first, AI fallback)
        const pagesToVisit = await getPagesToVisit(links, targetUrl, sitemapData.urls);

        // Step 4: Visit each page and extract intelligence
        const intelligenceResults = [];

        // First, analyze homepage
        if (useAI) {
            console.log(`[Analyze] Extracting intelligence from homepage...`);
            const homeIntel = await extractIntelligence(homeContent, targetUrl);
            intelligenceResults.push(homeIntel);
        }

        // Then, visit additional pages
        for (const pageUrl of pagesToVisit) {
            console.log(`[Analyze] Visiting: ${pageUrl}`);

            const pageSuccess = await navigateTo(page, pageUrl);
            if (!pageSuccess) continue;

            const pageContent = await getPageContent(page);

            // Extract emails from this page too
            const pageEmails = extractEmails(pageContent);
            emails.push(...pageEmails);

            // AI extraction if enabled
            if (useAI) {
                console.log(`[Analyze] Extracting intelligence...`);
                const intel = await extractIntelligence(pageContent, pageUrl);
                intelligenceResults.push(intel);
            }
        }

        // Step 5: Merge all intelligence
        const intelligence = useAI
            ? mergeIntelligence(intelligenceResults)
            : null;

        // Step 6: Build response
        // Enrich intelligence with LinkedIn data if available
        if (linkedinData && intelligence) {
            // Keep AI-extracted userCount (customers/users from website)
            // Only use LinkedIn description as fallback if AI didn't find one
            if (!intelligence.companyInfo?.description && linkedinData.description) {
                intelligence.companyInfo = {
                    ...intelligence.companyInfo,
                    found: true,
                    description: linkedinData.description
                };
            }

            // Add LinkedIn-specific data (employeeCount lives here)
            intelligence.linkedinData = {
                companyName: linkedinData.companyName,
                logo: linkedinData.logo,
                website: linkedinData.website,
                industry: linkedinData.industry,
                employeeCount: linkedinData.employeeCount,
                foundedYear: linkedinData.foundedYear,
                headquarter: linkedinData.headquarter,
                funding: linkedinData.funding,
                similarCompanies: linkedinData.similarCompanies,
                linkedinId: linkedinData.linkedinId
            };
        }

        const responseData = {
            // Original extraction (from find-socials-networks)
            socialLinks: socials.socialLinks,
            allSocialLinksFound: socials.allSocialLinksFound,
            multiplesFound: socials.multiplesFound,
            emails: [...new Set(emails)],
            meta,

            // Technology detection (Wappalyzer)
            cms: techResult.cms,
            detectedTechnologies: techResult.detectedTechnologies,
            technologies: techResult.technologies,

            // AI-extracted intelligence (enriched with LinkedIn if available)
            intelligence,

            // Discovery info
            pagesAnalyzed: [targetUrl, ...pagesToVisit],
            sitemapFound: sitemapData.found,
            linkedinFound: !!linkedinData
        };

        console.log(`[Analyze] Complete! Analyzed ${responseData.pagesAnalyzed.length} pages`);

        res.status(200).json({
            url: targetUrl,
            data: responseData,
            error: null,
            statusCode: 200,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`[Analyze] Error: ${error.message}`);

        let statusCode = 500;
        if (error.message.includes('timeout')) statusCode = 504;
        if (error.message.includes('net::ERR')) statusCode = 503;

        res.status(statusCode).json({
            url: targetUrl,
            data: null,
            error: error.message,
            statusCode,
            timestamp: new Date().toISOString()
        });

    } finally {
        await closeBrowser(context, browser);
    }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        aiProvider: config.aiProvider,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(config.port, () => {
    console.log(`
========================================
   Company Intel AI Server Started
========================================
   Port: ${config.port}
   AI Provider: ${config.aiProvider}
   Proxy: ${config.proxy ? 'Enabled' : 'Disabled'}
----------------------------------------
   POST /analyze - Analyze a company
   GET  /health  - Health check
========================================
`);
});
