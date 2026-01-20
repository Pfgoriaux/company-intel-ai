/**
 * Email Extractor
 * Finds valid email addresses in page content
 */

// Patterns to exclude (fake/generic emails)
const EMAIL_BLACKLIST = [
    'noreply', 'no-reply', 'donotreply', 'example.com', 'test.com',
    'domain.com', 'yourcompany', 'company.com', 'sentry.io',
    'wixpress.com', 'shopify.com', '@2x.png', '.png', '.jpg', '.svg'
];

/**
 * Extract valid email addresses from text content
 * @param {string} content - Page text content
 * @returns {string[]} Array of unique emails
 */
export const extractEmails = (content) => {
    if (!content) return [];

    // Email regex pattern
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    const rawEmails = content.match(emailRegex) || [];

    const validEmails = rawEmails.filter(email => {
        const lower = email.toLowerCase();

        // Check blacklist
        if (EMAIL_BLACKLIST.some(pattern => lower.includes(pattern))) {
            return false;
        }

        // Validate format
        const parts = email.split('@');
        if (parts.length !== 2) return false;

        // Check TLD length
        const tld = parts[1].split('.').pop();
        if (!tld || tld.length < 2) return false;

        // Exclude file references
        if (/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js)$/i.test(email)) {
            return false;
        }

        return true;
    });

    // Return unique lowercase emails
    return [...new Set(validEmails.map(e => e.toLowerCase()))];
};
