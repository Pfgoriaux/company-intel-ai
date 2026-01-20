/**
 * JSON Schema for AI extraction output
 * Ensures consistent structure across providers
 */

export const EXTRACTION_SCHEMA = {
    type: "object",
    properties: {
        pricing: {
            type: "object",
            properties: {
                found: { type: "boolean" },
                plans: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Plan name (e.g. 'Pro', 'Business', 'Enterprise')" },
                            price: { type: "number", description: "Price as number only, no currency symbol" },
                            type: {
                                type: "string",
                                enum: ["monthly", "annual", "one-time", "other"],
                                description: "Billing frequency"
                            }
                        },
                        required: ["name", "price", "type"]
                    }
                }
            },
            required: ["found", "plans"]
        },
        customers: {
            type: "object",
            properties: {
                found: { type: "boolean" },
                names: {
                    type: "array",
                    items: { type: "string" },
                    description: "Only real company/brand names (e.g. 'Nike', 'Spotify'). NOT generic terms."
                }
            },
            required: ["found", "names"]
        },
        valueProposition: {
            type: "object",
            properties: {
                found: { type: "boolean" },
                main: { type: "string", description: "Main value proposition in one sentence" },
                points: {
                    type: "array",
                    items: { type: "string" },
                    description: "Key selling points"
                }
            },
            required: ["found", "main", "points"]
        },
        whatTheySell: {
            type: "object",
            properties: {
                found: { type: "boolean" },
                products: {
                    type: "array",
                    items: { type: "string" },
                    description: "Product names or categories"
                },
                services: {
                    type: "array",
                    items: { type: "string" },
                    description: "Service offerings"
                }
            },
            required: ["found", "products", "services"]
        },
        competitors: {
            type: "object",
            properties: {
                found: { type: "boolean" },
                names: {
                    type: "array",
                    items: { type: "string" },
                    description: "Competitor company names mentioned"
                }
            },
            required: ["found", "names"]
        },
        companyInfo: {
            type: "object",
            properties: {
                found: { type: "boolean" },
                userCount: {
                    type: ["number", "null"],
                    description: "Number of customers/users mentioned on website (e.g. '4M users' = 4000000)"
                },
                description: {
                    type: ["string", "null"],
                    description: "Short company description"
                },
                industry: {
                    type: "string",
                    enum: [
                        "DeepTech",
                        "Climate",
                        "Industry",
                        "AI",
                        "Biotechnology",
                        "Robotic",
                        "Crypto / Blockchain / Web3",
                        "Gaming / Esports",
                        "FinTech",
                        "EdTech",
                        "FoodTech",
                        "HealthTech",
                        "MarTech / AdTech",
                        "PropTech",
                        "LegalTech",
                        "Cybersecurity",
                        "SpaceTech",
                        "Logistics / Supply Chain",
                        "Immersive Tech (AR/VR)",
                        "Mobility",
                        "PetTech",
                        "E-commerce",
                        "Retail",
                        "Advanced Materials / Nanotech",
                        "AgriTech",
                        "Longevity / Biohacking",
                        "DefenseTech",
                        "Other"
                    ],
                    description: "The industry/sector the company operates in"
                }
            },
            required: ["found", "userCount", "description", "industry"]
        }
    },
    required: ["pricing", "customers", "valueProposition", "whatTheySell", "competitors", "companyInfo"]
};

