

## Glide Sales Prep Tool — Site Crawler & Content Analyzer

A tool for your agency's sales process that crawls a prospect's website, extracts content outlines of key pages, and captures full-page screenshots — all saved for future reference.

### Core Workflow

1. **Enter a URL** — Paste a prospect's website URL into a clean input form
2. **Discover Pages** — The tool uses Firecrawl's Map feature to find all site URLs, then auto-detects primary navigation pages and presents them in a checklist
3. **Select & Crawl** — Review the auto-selected pages, add/remove as needed, then hit "Crawl" to scrape content and capture screenshots
4. **View Results** — Each page displayed as a card with its content outline and full-page screenshot
5. **Save & Export** — Results saved to your history; export as a downloadable report

### Page Discovery

- Uses Firecrawl **Map** to quickly discover all URLs on the site
- Auto-identifies primary navigation pages (filters out blog posts, utility pages, etc.)
- Presents a checklist UI where you can toggle pages on/off before crawling

### Content Extraction

- Each selected page scraped via Firecrawl with markdown output
- **Two viewing modes** you can toggle between:
  - **Raw Text** — The page content as extracted, in reading order
  - **AI-Structured Outline** — Lovable AI rewrites the content into a clean content outline with headings, sections, and key messaging summarized (great for sales prep)

### Full-Page Screenshots

- Uses **Thum.io API** with the `fullpage` parameter to capture entire page screenshots (top to bottom)
- Screenshots displayed inline alongside content for each page
- High-resolution PNG output

### Results Dashboard

- **Card layout** per page — page title, URL, content outline (with raw/AI toggle), and full-page screenshot
- Expandable/collapsible cards for easy scanning
- Overall site summary at the top

### History & Export

- All crawl results saved to a **Supabase database** with timestamps
- **History page** to browse past crawls by domain/date
- **Export** results as a downloadable report (printable HTML/PDF-style layout)

### Backend Architecture

- **Firecrawl connector** for site mapping and content scraping (via edge functions)
- **Thum.io edge function** for screenshot generation (API key stored as a secret)
- **Lovable AI edge function** for content outline restructuring
- **Supabase database** tables for crawl history, pages, and results
- **Lovable Cloud** for backend infrastructure

### Pages

1. **Home / Crawl** — URL input, page discovery, and crawl trigger
2. **Results** — View crawl results with content and screenshots
3. **History** — Browse and revisit past crawls

