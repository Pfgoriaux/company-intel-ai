/**
 * Wappalyzer Technology Detection
 * Detects technologies using Wappalyzer patterns
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WAPPALYZER_PATH = join(__dirname, '../../wappalyzer');

// Load Wappalyzer data
let categories = {};
let technologies = {};

const loadWappalyzerData = () => {
    if (Object.keys(technologies).length > 0) return;

    console.log('[Wappalyzer] Loading technology database...');

    categories = JSON.parse(readFileSync(join(WAPPALYZER_PATH, 'categories.json'), 'utf-8'));

    const techFiles = ['_', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

    for (const file of techFiles) {
        try {
            const filePath = join(WAPPALYZER_PATH, 'technologies', `${file}.json`);
            const data = JSON.parse(readFileSync(filePath, 'utf-8'));
            technologies = { ...technologies, ...data };
        } catch (e) {
            // File might not exist
        }
    }

    console.log(`[Wappalyzer] Loaded ${Object.keys(technologies).length} technologies`);
};

loadWappalyzerData();

/**
 * Parse pattern string into regex
 */
const parsePattern = (pattern) => {
    if (!pattern) return null;

    let patternStr = pattern;
    let versionGroup = null;
    let confidence = 100;

    if (typeof pattern === 'string' && pattern.includes('\\;')) {
        const parts = pattern.split('\\;');
        patternStr = parts[0];

        for (const part of parts.slice(1)) {
            if (part.startsWith('version:')) {
                versionGroup = part.replace('version:', '');
            } else if (part.startsWith('confidence:')) {
                confidence = parseInt(part.replace('confidence:', ''), 10);
            }
        }
    }

    try {
        return { regex: new RegExp(patternStr, 'i'), versionGroup, confidence };
    } catch (e) {
        return null;
    }
};

/**
 * Extract version from match
 */
const extractVersion = (match, versionGroup) => {
    if (!versionGroup || !match) return null;
    if (versionGroup.startsWith('\\')) {
        const groupNum = parseInt(versionGroup.slice(1), 10);
        return match[groupNum] || null;
    }
    return null;
};

/**
 * Test patterns against value
 */
const testPatterns = (patterns, value) => {
    if (!patterns || !value) return null;

    const patternList = Array.isArray(patterns) ? patterns : [patterns];

    for (const pattern of patternList) {
        const parsed = parsePattern(pattern);
        if (!parsed) continue;

        const match = value.match(parsed.regex);
        if (match) {
            return {
                matched: true,
                version: extractVersion(match, parsed.versionGroup),
                confidence: parsed.confidence
            };
        }
    }
    return null;
};

/**
 * Setup response header collection BEFORE navigation
 */
export const setupWappalyzerDetection = (page) => {
    const responseHeaders = new Map();

    page.on('response', response => {
        if (response.request().resourceType() === 'document') {
            const headers = response.headers();
            for (const [name, value] of Object.entries(headers)) {
                if (!responseHeaders.has(name.toLowerCase())) {
                    responseHeaders.set(name.toLowerCase(), value);
                }
            }
        }
    });

    return { responseHeaders };
};

/**
 * Detect technologies using Wappalyzer patterns
 */
export const detectTechnologies = async (page, collector, scriptUrls = [], xhrUrls = []) => {
    console.log('[Wappalyzer] Starting detection...');

    const detected = new Map();

    const addDetection = (techName, tech, confidence = 100, version = null) => {
        const existing = detected.get(techName);
        const newConfidence = existing ? Math.max(existing.confidence, confidence) : confidence;
        const newVersion = version || (existing?.version) || null;

        detected.set(techName, {
            name: techName,
            confidence: Math.min(newConfidence, 100),
            version: newVersion,
            categories: (tech.cats || []).map(catId => ({
                id: catId,
                name: categories[catId]?.name || 'Unknown'
            })),
            website: tech.website || null,
            icon: tech.icon || null
        });
    };

    try {
        const pageData = await collectPageData(page, collector);

        for (const [techName, tech] of Object.entries(technologies)) {
            let totalConfidence = 0;
            let detectedVersion = null;

            // Check scriptSrc patterns
            if (tech.scriptSrc && scriptUrls.length > 0) {
                const patterns = Array.isArray(tech.scriptSrc) ? tech.scriptSrc : [tech.scriptSrc];
                for (const url of scriptUrls) {
                    const result = testPatterns(patterns, url);
                    if (result?.matched) {
                        totalConfidence += result.confidence;
                        if (result.version) detectedVersion = result.version;
                    }
                }
            }

            // Check xhr patterns
            if (tech.xhr && xhrUrls.length > 0) {
                const patterns = Array.isArray(tech.xhr) ? tech.xhr : [tech.xhr];
                for (const url of xhrUrls) {
                    const result = testPatterns(patterns, url);
                    if (result?.matched) {
                        totalConfidence += result.confidence;
                        if (result.version) detectedVersion = result.version;
                    }
                }
            }

            // Check meta tags
            if (tech.meta && pageData.meta) {
                for (const [metaName, pattern] of Object.entries(tech.meta)) {
                    const metaValue = pageData.meta[metaName.toLowerCase()];
                    if (metaValue) {
                        const result = testPatterns(pattern, metaValue);
                        if (result?.matched) {
                            totalConfidence += result.confidence;
                            if (result.version) detectedVersion = result.version;
                        } else if (pattern === '') {
                            totalConfidence += 100;
                        }
                    }
                }
            }

            // Check JavaScript globals
            if (tech.js && pageData.jsGlobals) {
                for (const [jsVar, pattern] of Object.entries(tech.js)) {
                    const jsValue = pageData.jsGlobals[jsVar];
                    if (jsValue !== undefined) {
                        if (pattern === '') {
                            totalConfidence += 100;
                        } else {
                            const result = testPatterns(pattern, String(jsValue));
                            if (result?.matched) {
                                totalConfidence += result.confidence;
                                if (result.version) detectedVersion = result.version;
                            }
                        }
                    }
                }
            }

            // Check HTML patterns
            if (tech.html && pageData.html) {
                const patterns = Array.isArray(tech.html) ? tech.html : [tech.html];
                const result = testPatterns(patterns, pageData.html);
                if (result?.matched) {
                    totalConfidence += result.confidence;
                    if (result.version) detectedVersion = result.version;
                }
            }

            // Check response headers
            if (tech.headers && pageData.headers) {
                for (const [headerName, pattern] of Object.entries(tech.headers)) {
                    const headerValue = pageData.headers[headerName.toLowerCase()];
                    if (headerValue) {
                        if (pattern === '') {
                            totalConfidence += 100;
                        } else {
                            const result = testPatterns(pattern, headerValue);
                            if (result?.matched) {
                                totalConfidence += result.confidence;
                                if (result.version) detectedVersion = result.version;
                            }
                        }
                    }
                }
            }

            // Check cookies
            if (tech.cookies && pageData.cookies) {
                for (const [cookieName, pattern] of Object.entries(tech.cookies)) {
                    const cookie = pageData.cookies.find(c => c.name.toLowerCase() === cookieName.toLowerCase());
                    if (cookie) {
                        if (pattern === '') {
                            totalConfidence += 100;
                        } else {
                            const result = testPatterns(pattern, cookie.value);
                            if (result?.matched) {
                                totalConfidence += result.confidence;
                                if (result.version) detectedVersion = result.version;
                            }
                        }
                    }
                }
            }

            // Check DOM selectors
            if (tech.dom && pageData.domResults) {
                const domPatterns = typeof tech.dom === 'string' ? { [tech.dom]: {} } : tech.dom;

                for (const [selector, checks] of Object.entries(domPatterns)) {
                    const domResult = pageData.domResults[selector];
                    if (domResult?.exists) {
                        if (Object.keys(checks).length === 0 || checks.exists === '') {
                            totalConfidence += 100;
                        } else {
                            if (checks.text && domResult.text) {
                                const result = testPatterns(checks.text, domResult.text);
                                if (result?.matched) {
                                    totalConfidence += result.confidence;
                                    if (result.version) detectedVersion = result.version;
                                }
                            }
                            if (checks.attributes && domResult.attributes) {
                                for (const [attrName, attrPattern] of Object.entries(checks.attributes)) {
                                    const attrValue = domResult.attributes[attrName];
                                    if (attrValue) {
                                        const result = testPatterns(attrPattern, attrValue);
                                        if (result?.matched) {
                                            totalConfidence += result.confidence;
                                            if (result.version) detectedVersion = result.version;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (totalConfidence > 0) {
                addDetection(techName, tech, totalConfidence, detectedVersion);
            }
        }

        // Process implies (dependencies)
        let changed = true;
        while (changed) {
            changed = false;
            for (const [techName] of detected.entries()) {
                const tech = technologies[techName];
                if (tech?.implies) {
                    const implies = Array.isArray(tech.implies) ? tech.implies : [tech.implies];
                    for (const implied of implies) {
                        let impliedName = implied;
                        let impliedConfidence = 100;

                        if (implied.includes('\\;')) {
                            const parts = implied.split('\\;');
                            impliedName = parts[0];
                            for (const part of parts.slice(1)) {
                                if (part.startsWith('confidence:')) {
                                    impliedConfidence = parseInt(part.replace('confidence:', ''), 10);
                                }
                            }
                        }

                        if (!detected.has(impliedName) && technologies[impliedName]) {
                            addDetection(impliedName, technologies[impliedName], impliedConfidence);
                            changed = true;
                        }
                    }
                }
            }
        }

        const detectedArray = Array.from(detected.values())
            .filter(d => d.confidence >= 50)
            .sort((a, b) => b.confidence - a.confidence);

        const cms = detectedArray.find(d => d.categories.some(c => c.id === 1));

        console.log(`[Wappalyzer] Detected ${detectedArray.length} technologies${cms ? `, CMS: ${cms.name}` : ''}`);

        return {
            cms: cms?.name || null,
            cmsDetails: cms || null,
            detectedTechnologies: detectedArray
        };

    } catch (error) {
        console.error('[Wappalyzer] Error:', error.message);
        return { cms: null, cmsDetails: null, detectedTechnologies: [] };
    }
};

/**
 * Collect page data for detection
 */
const collectPageData = async (page, collector) => {
    const data = {
        meta: {},
        jsGlobals: {},
        html: '',
        headers: {},
        cookies: [],
        domResults: {}
    };

    try {
        data.headers = Object.fromEntries(collector.responseHeaders || new Map());
        data.cookies = await page.context().cookies();

        data.html = await page.evaluate(() => {
            return document.documentElement.outerHTML.substring(0, 100000);
        });

        data.meta = await page.evaluate(() => {
            const metas = {};
            document.querySelectorAll('meta[name], meta[property]').forEach(meta => {
                const name = (meta.getAttribute('name') || meta.getAttribute('property') || '').toLowerCase();
                const content = meta.getAttribute('content') || '';
                if (name) metas[name] = content;
            });
            return metas;
        });

        const jsVarsToCheck = getJsVarsToCheck();
        data.jsGlobals = await page.evaluate((vars) => {
            const results = {};
            for (const varPath of vars) {
                try {
                    const parts = varPath.split('.');
                    let value = window;
                    for (const part of parts) {
                        if (value === undefined || value === null) break;
                        value = value[part];
                    }
                    if (value !== undefined && value !== window) {
                        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                            results[varPath] = value;
                        } else if (typeof value === 'object' || typeof value === 'function') {
                            results[varPath] = true;
                        }
                    }
                } catch (e) { }
            }
            return results;
        }, jsVarsToCheck);

        const domSelectorsToCheck = getDomSelectorsToCheck();
        data.domResults = await page.evaluate((selectors) => {
            const results = {};
            for (const selector of selectors) {
                try {
                    const el = document.querySelector(selector);
                    if (el) {
                        results[selector] = {
                            exists: true,
                            text: el.textContent?.substring(0, 500) || '',
                            attributes: {}
                        };
                        for (const attr of el.attributes) {
                            results[selector].attributes[attr.name] = attr.value;
                        }
                    }
                } catch (e) { }
            }
            return results;
        }, domSelectorsToCheck);

    } catch (error) {
        console.error('[Wappalyzer] Error collecting data:', error.message);
    }

    return data;
};

const getJsVarsToCheck = () => {
    const vars = new Set();
    for (const tech of Object.values(technologies)) {
        if (tech.js) {
            for (const jsVar of Object.keys(tech.js)) {
                vars.add(jsVar);
            }
        }
    }
    return Array.from(vars);
};

const getDomSelectorsToCheck = () => {
    const selectors = new Set();
    for (const tech of Object.values(technologies)) {
        if (tech.dom) {
            if (typeof tech.dom === 'string') {
                selectors.add(tech.dom);
            } else {
                for (const selector of Object.keys(tech.dom)) {
                    selectors.add(selector);
                }
            }
        }
    }
    return Array.from(selectors);
};

export const getCategoryName = (categoryId) => categories[categoryId]?.name || 'Unknown';
export const getCategories = () => categories;
export const getTechnologyCount = () => Object.keys(technologies).length;
