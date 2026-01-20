# Company Intel AI

AI-powered company intelligence extraction. Analyze any website to automatically extract business information using Claude or OpenAI.

## What It Extracts

| Category | Data Points |
|----------|-------------|
| **Pricing** | Plan names, prices (as numbers), billing type (monthly/annual/one-time) |
| **Customers** | Real company/brand names only (Nike, Spotify, etc.) |
| **Value Proposition** | Main pitch, key selling points |
| **Products & Services** | What they sell |
| **Competitors** | Mentioned competitor names |
| **Company Info** | User/customer count, company description, industry classification |
| **Technologies** | CMS, frameworks, analytics tools (via Wappalyzer) + external services |
| **LinkedIn Data** | Employee count, industry, headquarters, funding, similar companies |
| **Social Links** | Twitter, LinkedIn, Facebook, Instagram, YouTube, etc. |
| **Emails** | Contact emails found on pages |
| **Meta Info** | Page title, description, favicon |

## Features

- **Dual AI Support** - Choose between Claude (Anthropic) or OpenAI
- **Smart Page Discovery** - Sitemap-first discovery + priority-based pattern matching
- **Cost Efficient** - Analyzes max 5 pages (homepage + 4 others) to minimize API costs
- **LinkedIn Enrichment** - Automatically scrapes LinkedIn company pages for additional data
- **Technology Detection** - Identifies CMS, frameworks, and tools using Wappalyzer
- **Stealth Browsing** - Uses Patchright for anti-bot detection bypass
- **Proxy Support** - Optional proxy for better success rates and LinkedIn scraping

## Quick Start

### Prerequisites

- Node.js 18+
- An API key from [Claude](https://console.anthropic.com/) or [OpenAI](https://platform.openai.com/api-keys)

### 1. Clone & Install

```bash
git clone https://github.com/Pfgoriaux/company-intel-ai.git
cd company-intel-ai

# Install dependencies
npm install

# Install browser (Patchright/Chromium)
npx patchright install chrome
```

### 2. Configure

```bash
# Copy example config
cp .env.example .env

# Edit .env with your API key
nano .env  # or use any editor
```

**Minimum required configuration:**
```env
AI_PROVIDER=claude
CLAUDE_API_KEY=your_api_key_here
```

### 3. Run

```bash
npm start
```

You should see:
```
========================================
   Company Intel AI Server Started
========================================
   Port: 3002
   AI Provider: claude
   Proxy: Disabled
----------------------------------------
   POST /analyze - Analyze a company
   GET  /health  - Health check
========================================
```

### 4. Test

```bash
curl -X POST http://localhost:3002/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://stripe.com"}'
```

## Configuration

All settings are controlled via environment variables. See `.env.example` for the full list.

### Required

| Variable | Description |
|----------|-------------|
| `AI_PROVIDER` | `claude` or `openai` |
| `CLAUDE_API_KEY` | Your Claude API key (if using Claude) |
| `OPENAI_API_KEY` | Your OpenAI API key (if using OpenAI) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | Server port |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | Claude model to use |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model to use |
| `BROWSER_HEADLESS` | `true` | Set `false` to see browser (debugging) |
| `BROWSER_TIMEOUT` | `20000` | Navigation timeout (ms) |
| `MAX_PAGES_TO_VISIT` | `4` | Max pages beyond homepage |
| `MAX_CONTENT_LENGTH` | `15000` | Characters per page sent to AI |
| `PROXY_SERVER` | - | Proxy URL (e.g., `http://proxy:8080`) |
| `PROXY_USERNAME` | - | Proxy auth username |
| `PROXY_PASSWORD` | - | Proxy auth password |

## API Reference

### POST /analyze

Analyze a company website.

**Request:**
```json
{
  "url": "https://example.com",
  "useAI": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Website URL to analyze |
| `useAI` | boolean | No | Enable AI extraction (default: `true`) |

**Response:**
```json
{
  "url": "https://example.com",
  "data": {
    "socialLinks": {
      "twitter": "https://twitter.com/example",
      "linkedin": "https://linkedin.com/company/example"
    },
    "allSocialLinksFound": ["..."],
    "emails": ["hello@example.com"],
    "meta": {
      "title": "Example - Do Amazing Things",
      "description": "We help you do amazing things",
      "favicon": "https://example.com/favicon.ico"
    },
    "cms": "WordPress",
    "detectedTechnologies": ["React", "Node.js", "Google Analytics", "AWS"],
    "technologies": [
      { "hostname": "www.googletagmanager.com", "tags": ["network_script"] },
      { "hostname": "cdn.segment.com", "tags": ["network_script", "dom_script"] }
    ],
    "intelligence": {
      "pricing": {
        "found": true,
        "plans": [
          { "name": "Starter", "price": 29, "type": "monthly" },
          { "name": "Pro", "price": 99, "type": "monthly" }
        ]
      },
      "customers": {
        "found": true,
        "names": ["Nike", "Spotify", "Airbnb"]
      },
      "valueProposition": {
        "found": true,
        "main": "Automate your workflow in minutes",
        "points": ["Save 10 hours/week", "No code required"]
      },
      "whatTheySell": {
        "found": true,
        "products": ["Workflow automation platform"],
        "services": ["Enterprise consulting"]
      },
      "competitors": {
        "found": true,
        "names": ["Zapier", "Make"]
      },
      "companyInfo": {
        "found": true,
        "userCount": 50000,
        "description": "Workflow automation for modern teams",
        "industry": "AI"
      },
      "linkedinData": {
        "companyName": "Example Inc",
        "logo": "https://...",
        "website": "example.com",
        "industry": "Software",
        "employeeCount": 125,
        "foundedYear": "2019",
        "headquarter": {
          "country": "US",
          "city": "San Francisco",
          "region": "California"
        },
        "funding": {
          "lastRound": "Series A",
          "amount": "$10M",
          "investors": ["Sequoia", "a16z"]
        },
        "similarCompanies": [
          { "name": "Competitor Inc", "industry": "Software" }
        ]
      }
    },
    "pagesAnalyzed": [
      "https://example.com",
      "https://example.com/pricing",
      "https://example.com/features"
    ],
    "sitemapFound": true,
    "linkedinFound": true
  },
  "error": null,
  "statusCode": 200,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "aiProvider": "claude",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Project Structure

```
company-intel-ai/
├── src/
│   ├── index.mjs              # Express server & main endpoint
│   ├── config/
│   │   └── index.mjs          # Configuration management
│   ├── ai/
│   │   ├── providers.mjs      # AI abstraction (Claude/OpenAI)
│   │   ├── extractor.mjs      # Business intelligence extraction
│   │   ├── pageDiscovery.mjs  # Smart page discovery
│   │   └── schema.mjs         # JSON schema for AI output
│   ├── extractors/
│   │   ├── socials.mjs        # Social link extraction
│   │   ├── emails.mjs         # Email extraction
│   │   ├── meta.mjs           # Meta tag extraction
│   │   └── technologies.mjs   # Wappalyzer integration
│   └── utils/
│       ├── browser.mjs        # Patchright browser utilities
│       ├── sitemap.mjs        # Sitemap fetching & parsing
│       ├── linkedin.mjs       # LinkedIn company scraper
│       └── wappalyzer.mjs     # Technology detection
├── wappalyzer/                # Wappalyzer technology fingerprints
├── .env.example               # Example environment config
├── .gitignore
├── Dockerfile                 # Docker deployment
├── package.json
└── README.md
```

## Industry Classification

The AI automatically classifies each company into one of 27 industry categories:

| Category | Category | Category |
|----------|----------|----------|
| DeepTech | Climate | Industry |
| AI | Biotechnology | Robotic |
| Crypto / Blockchain / Web3 | Gaming / Esports | FinTech |
| EdTech | FoodTech | HealthTech |
| MarTech / AdTech | PropTech | LegalTech |
| Cybersecurity | SpaceTech | Logistics / Supply Chain |
| Immersive Tech (AR/VR) | Mobility | PetTech |
| E-commerce | Retail | Advanced Materials / Nanotech |
| AgriTech | Longevity / Biohacking | DefenseTech |

If none of these fit, it returns `"Other"`.

The classification is based on the company's products, services, and value proposition extracted from the website content.

## How It Works

```
1. Fetch sitemap.xml (if available)
   ↓
2. Load homepage
   - Extract social links, emails, meta tags
   - Detect technologies (Wappalyzer)
   - Find LinkedIn company page link
   ↓
3. Discover valuable pages (priority order):
   - /pricing, /price, /plans (Tier 1)
   - /features, /solutions, /products, /services (Tier 2)
   - Sitemap pattern matching first, then AI suggestions
   ↓
4. Visit pages (max 4 additional)
   - AI extracts business intelligence from each
   ↓
5. Scrape LinkedIn (if company page found)
   - Employee count, funding, industry, etc.
   ↓
6. Merge & return results
```

## Deployment

### Local Docker

```bash
# Build
docker build -t company-intel-ai .

# Run
docker run -p 3002:3002 \
  -e AI_PROVIDER=claude \
  -e CLAUDE_API_KEY=your_key \
  company-intel-ai
```

### Deploy with Coolify on Hetzner (Recommended)

[Coolify](https://coolify.io/) is an open-source, self-hostable Heroku/Vercel alternative. Combined with [Hetzner](https://www.hetzner.com/) servers, it's a cost-effective way to deploy this project.

#### 1. Get a Hetzner Server

1. Create an account at [Hetzner Cloud](https://console.hetzner.cloud/)
2. Create a new project and add a server:
   - **Type**: CPX21 (3 vCPU, 4GB RAM) or higher recommended
   - **Image**: Ubuntu 22.04
   - **Location**: Choose nearest to your users
3. Note your server's IP address

#### 2. Install Coolify

SSH into your server and run:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Once installed, access Coolify at `http://your-server-ip:8000` and complete the setup.

#### 3. Deploy This Project

1. In Coolify, click **"New Resource"** → **"Public Repository"**
2. Enter: `https://github.com/Pfgoriaux/company-intel-ai`
3. Select **"Dockerfile"** as build pack
4. Configure environment variables:
   - `AI_PROVIDER`: `claude`
   - `CLAUDE_API_KEY`: your API key
   - `BROWSER_HEADLESS`: `true`
5. Set port to `3002`
6. Click **Deploy**

Coolify will build the Docker image and deploy it automatically.

#### Useful Resources

| Resource | Description |
|----------|-------------|
| [Hetzner Cloud](https://www.hetzner.com/cloud) | Affordable cloud servers (from ~$4/month) |
| [Coolify Docs](https://coolify.io/docs) | Self-hosting platform documentation |
| [Coolify GitHub](https://github.com/coollabsio/coolify) | Open-source, self-hostable PaaS |

## Cost Optimization

The default configuration is optimized for cost:

- **Max 5 pages analyzed** (homepage + 4 others)
- **Priority-based selection** - Pricing pages first, then features/products
- **Sitemap-first discovery** - Pattern matching on sitemap URLs (free) before AI suggestions
- **Content truncation** - Each page limited to 15,000 characters for AI (configurable via `MAX_CONTENT_LENGTH`)

Estimated cost per analysis:
- Claude Sonnet: ~$0.02-0.05
- GPT-4o: ~$0.03-0.08

## Troubleshooting

### Browser won't start
```bash
# Reinstall browser
npx patchright install chrome --force
```

### LinkedIn scraping fails
- LinkedIn aggressively blocks scrapers without proxies
- Configure `PROXY_SERVER` for better success rates
- Works best with residential proxies

### AI returns empty results
- Check your API key is valid
- Ensure the website has actual content (not JS-heavy SPAs)
- Try setting `BROWSER_HEADLESS=false` to debug

### Timeout errors
- Increase `BROWSER_TIMEOUT` for slow websites
- Some sites may block headless browsers

## Security Notice

**Never commit your `.env` file!** It contains sensitive API keys.

- `.env` is already in `.gitignore`
- Use `.env.example` as a template
- Rotate API keys if accidentally exposed

## License

MIT

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

Built with Claude, OpenAI, Patchright, and Wappalyzer.
