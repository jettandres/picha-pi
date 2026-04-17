package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/JohannesKaufmann/html-to-markdown/v2"
	"github.com/playwright-community/playwright-go"
)

func main() {
	useJS := flag.Bool("js", false, "Use Playwright to render JavaScript (slower but required for JS-heavy sites)")
	flag.Parse()

	if flag.NArg() != 1 {
		fmt.Fprintln(os.Stderr, "Usage: scrape [-js] <url>")
		fmt.Fprintln(os.Stderr, "  -js   Use Playwright to render JavaScript")
		os.Exit(1)
	}

	url := flag.Arg(0)
	if len(url) > 4 && url[:4] != "http" {
		url = "https://" + url
	}

	var htmlContent string
	var err error

	if *useJS {
		htmlContent, err = fetchWithPlaywright(url)
	} else {
		htmlContent, err = fetchWithHTTP(url)
	}

	if err != nil {
		log.Fatal(err)
	}

	markdown, err := htmltomarkdown.ConvertString(htmlContent)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(markdown)
}

func fetchWithHTTP(url string) (string, error) {
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("status: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}

func fetchWithPlaywright(url string) (string, error) {
	pw, err := playwright.Run()
	if err != nil {
		return "", fmt.Errorf("failed to start playwright: %w", err)
	}
	defer pw.Stop()

	browser, err := pw.Chromium.Launch()
	if err != nil {
		return "", fmt.Errorf("failed to launch browser: %w", err)
	}
	defer browser.Close()

	page, err := browser.NewPage()
	if err != nil {
		return "", fmt.Errorf("failed to create page: %w", err)
	}
	defer page.Close()

	if _, err := page.Goto(url); err != nil {
		return "", fmt.Errorf("failed to navigate to %s: %w", url, err)
	}

	// Wait for network to be idle (JavaScript rendered)
	page.WaitForLoadState(playwright.PageWaitForLoadStateOptions{
		State: playwright.LoadStateNetworkidle,
	})

	content, err := page.Content()
	if err != nil {
		return "", fmt.Errorf("failed to get page content: %w", err)
	}

	return content, nil
}