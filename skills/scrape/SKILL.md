---
name: scrape
description: Convert any webpage to markdown — fetches HTML and outputs clean markdown using html-to-markdown.
origin: picha-pi
---

# Scrape Webpages to Markdown

Convert web pages to markdown format. Useful for extracting content from documentation, articles, or any web page.

## Usage

```bash
./scrape <url>
```

The tool accepts either a full URL (`https://example.com`) or just a domain/hostname. If no scheme is provided, it automatically prepends `https://`.

## Examples

### Scrape a documentation page

```bash
./scrape https://docs.example.com/guide
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
2. Adds `https://` prefix if no scheme is provided
3. Fetches the HTML content via HTTP GET
4. Converts HTML to markdown using `html-to-markdown` library
5. Outputs the result to stdout

## Notes

- Returns non-zero exit code on HTTP errors or invalid status codes
- No headers or user-agent customization available (uses Go's default HTTP client)
- Handles both successful and redirected responses automatically