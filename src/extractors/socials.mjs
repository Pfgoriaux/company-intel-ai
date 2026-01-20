/**
 * Social Media Link Extractor
 * Detects social media profiles from page links
 */

// URL normalization helper
const normalizeUrl = (url) => {
    if (!url) return '';
    return url.toLowerCase()
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .split('?')[0]
        .split('#')[0]
        .replace(/\/$/, '');
};

// URLs to ignore (templates, generic pages)
const BLACKLISTED_URLS = new Set([
    'facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com',
    'facebook.com/facebook', 'instagram.com/instagram', 'tiktok.com/@tiktok',
    'facebook.com/profile.php', 'facebook.com/me', 'instagram.com/invites/contact',
    'facebook.com/shopify', 'instagram.com/shopify', 'tiktok.com/@shopify',
    'instagram.com/wix', 'twitter.com/wix'
].map(normalizeUrl));

// Path patterns to exclude (posts, videos, etc.)
const EXCLUDED_PATHS = [
    '/p/', '/posts/', '/reel/', '/reels/', '/video/', '/videos/',
    '/status/', '/watch', '/hashtag/', '/explore/', '/stories/',
    '/share', '/login', '/signup', '/help', '/about', '/privacy',
    '/terms', '/settings', '/home', '/search'
];

/**
 * Extract social media profile links
 * @param {string[]} links - Array of URLs found on page
 * @returns {object} Social links organized by platform
 */
export const extractSocials = (links) => {
    // Platform detection patterns
    const patterns = {
        facebook: /^https?:\/\/(?:www\.)?facebook\.com\/[^/]+$/i,
        instagram: /^https?:\/\/(?:www\.)?instagram\.com\/[^/]+$/i,
        twitter: /^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-zA-Z0-9_]+$/i,
        youtube: /^https?:\/\/(?:www\.)?youtube\.com\/(?:@|user\/|channel\/|c\/)[^/]+$/i,
        tiktok: /^https?:\/\/(?:www\.)?tiktok\.com\/@[^/]+$/i,
        linkedin: /^https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^/]+$/i,
        pinterest: /^https?:\/\/(?:www\.)?pinterest\.[a-z.]+\/[^/]+$/i,
        discord: /^https?:\/\/(?:www\.)?discord\.gg\/[^/]+$/i,
        snapchat: /^https?:\/\/(?:www\.)?snapchat\.com\/add\/[^/]+$/i
    };

    const found = {};
    const allFound = new Set();
    const multiples = {};

    for (const href of links) {
        if (!href) continue;

        // Skip blacklisted URLs
        if (BLACKLISTED_URLS.has(normalizeUrl(href))) continue;

        try {
            const url = new URL(href);
            if (!['http:', 'https:'].includes(url.protocol)) continue;

            // Skip excluded paths
            const path = url.pathname.toLowerCase();
            if (EXCLUDED_PATHS.some(p => path.startsWith(p))) continue;

            // Clean URL (remove trailing slash)
            const cleanUrl = `${url.origin}${url.pathname}`.replace(/\/$/, '');

            // Match against patterns
            for (const [platform, regex] of Object.entries(patterns)) {
                if (regex.test(cleanUrl)) {
                    if (!found[platform]) {
                        found[platform] = cleanUrl;
                    } else if (found[platform] !== cleanUrl) {
                        // Track multiple profiles per platform
                        if (!multiples[platform]) {
                            multiples[platform] = new Set([found[platform]]);
                        }
                        multiples[platform].add(cleanUrl);
                    }
                    allFound.add(cleanUrl);
                    break;
                }
            }
        } catch {
            continue;
        }
    }

    // Convert Sets to Arrays
    const multiplesAsArrays = {};
    for (const key in multiples) {
        multiplesAsArrays[key] = [...multiples[key]];
    }

    return {
        socialLinks: found,
        allSocialLinksFound: [...allFound],
        multiplesFound: multiplesAsArrays
    };
};
