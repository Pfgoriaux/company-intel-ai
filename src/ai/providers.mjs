/**
 * AI Provider Abstraction
 * Unified interface for Claude and OpenAI
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from '../config/index.mjs';

// Provider instances (lazy loaded)
let claudeClient = null;
let openaiClient = null;

/**
 * Get Claude client
 */
const getClaude = () => {
    if (!claudeClient) {
        claudeClient = new Anthropic({ apiKey: config.claudeApiKey });
    }
    return claudeClient;
};

/**
 * Get OpenAI client
 */
const getOpenAI = () => {
    if (!openaiClient) {
        openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
    }
    return openaiClient;
};

/**
 * Send a prompt to the configured AI provider
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message/content
 * @param {object} jsonSchema - Optional JSON schema for structured output
 * @returns {Promise<string>} AI response text
 */
export const askAI = async (systemPrompt, userPrompt, jsonSchema = null) => {
    const provider = config.aiProvider;

    if (provider === 'claude') {
        return await askClaude(systemPrompt, userPrompt, jsonSchema);
    } else if (provider === 'openai') {
        return await askOpenAI(systemPrompt, userPrompt, jsonSchema);
    } else {
        throw new Error(`Unknown AI provider: ${provider}`);
    }
};

/**
 * Ask Claude (schema included in prompt)
 */
const askClaude = async (systemPrompt, userPrompt, jsonSchema = null) => {
    const client = getClaude();

    // For Claude, include schema in system prompt
    let finalSystemPrompt = systemPrompt;
    if (jsonSchema) {
        finalSystemPrompt += `\n\nYou MUST respond with valid JSON matching this exact schema:\n${JSON.stringify(jsonSchema, null, 2)}`;
    }

    const response = await client.messages.create({
        model: config.claudeModel,
        max_tokens: 4096,
        system: finalSystemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
    });

    return response.content[0].text;
};

/**
 * Ask OpenAI (native JSON schema support)
 */
const askOpenAI = async (systemPrompt, userPrompt, jsonSchema = null) => {
    const client = getOpenAI();

    const options = {
        model: config.openaiModel,
        max_tokens: 4096,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]
    };

    // Use native structured output if schema provided
    if (jsonSchema) {
        options.response_format = {
            type: "json_schema",
            json_schema: {
                name: "extraction_result",
                strict: true,
                schema: jsonSchema
            }
        };
    }

    const response = await client.chat.completions.create(options);

    return response.choices[0].message.content;
};

/**
 * Parse JSON from AI response (handles markdown code blocks)
 * @param {string} text - AI response text
 * @returns {object} Parsed JSON
 */
export const parseAIJson = (text) => {
    // Remove markdown code blocks if present
    let cleaned = text.trim();

    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
    }

    if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
    }

    return JSON.parse(cleaned.trim());
};
