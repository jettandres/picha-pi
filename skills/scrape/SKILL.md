---
name: scrape
description: Convert any webpage to markdown — fetches HTML and outputs clean markdown using html-to-markdown.
origin: picha-pi
---

# Scrape Webpages to Markdown

Convert web pages to markdown format. Useful for extracting content from documentation, articles, or any web page.

## Usage

```bash
./scrape [-js] <url>
```

The tool accepts either a full URL (`https://example.com`) or just a domain/hostname. If no scheme is provided, it automatically prepends `https://`.

## Options

- `-js` — Use Playwright to render JavaScript. Slower but required for sites that render content client-side (React, Vue, Angular, etc.). Without this flag, uses fast HTTP GET for static HTML.

## Examples

### Scrape a static documentation page

```bash
./scrape https://docs.example.com/guide
```

### Scrape a JavaScript-heavy site (React, Vue, SPA)

```bash
./scrape --js https://example.com
```

### Scrape a simple domain (adds https:// automatically)

```bash
./scrape example.com
```

### Scrape and pipe to a file

```bash
./scrape https://example.com/docs > output.md
```

### Scrape and process with other tools

```bash
./scrape https://example.com | grep -A5 "Installation"
```

## How It Works

1. Takes a URL as a command-line argument
2. Adds `https://` prefix if no scheme provided
3. If `-js` flag is provided:
   - Launches a headless Chromium browser via Playwright
   - Navigates to the URL and waits for JavaScript to execute
   - Extracts the fully rendered HTML
4. Otherwise, fetches raw HTML via HTTP GET
5. Converts HTML to markdown using `html-to-markdown` library
6. Outputs the result to stdout

## Notes

- Returns non-zero exit code on HTTP errors or invalid status codes
- The `-js` flag is slower (starts a browser) but required for JavaScript-rendered sites
- Without `-js`, uses Go's default HTTP client (no custom headers or user-agent)
- Handles both successful and redirected responses automatically