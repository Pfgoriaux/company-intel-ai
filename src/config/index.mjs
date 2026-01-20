/**
 * Configuration
 * All settings in one place for easy maintenance
 */

export const config = {
    // Server
    port: process.env.PORT || 3002,

    // AI Provider: 'claude' or 'openai'
    aiProvider: process.env.AI_PROVIDER || 'claude',

    // API Keys
    claudeApiKey: process.env.CLAUDE_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,

    // AI Models
    claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',

    // Proxy (optional)
    proxy: process.env.PROXY_SERVER ? {
        server: process.env.PROXY_SERVER,
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD
    } : null,

    // Browser settings
    browser: {
        headless: process.env.BROWSER_HEADLESS !== 'false', // Default true, set to 'false' to see browser
        timeout: parseInt(process.env.BROWSER_TIMEOUT) || 20000,
        maxPagesToVisit: parseInt(process.env.MAX_PAGES_TO_VISIT) || 4 // Default 4 for cost efficiency
    },

    // AI extraction settings
    extraction: {
        maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH) || 15000 // Characters per page sent to AI
    }
};

/**
 * Validate configuration
 */
export const validateConfig = () => {
    const { aiProvider, claudeApiKey, openaiApiKey } = config;

    if (aiProvider === 'claude' && !claudeApiKey) {
        throw new Error('CLAUDE_API_KEY is required when using Claude');
    }

    if (aiProvider === 'openai' && !openaiApiKey) {
        throw new Error('OPENAI_API_KEY is required when using OpenAI');
    }

    return true;
};
