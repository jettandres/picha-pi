package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/JohannesKaufmann/html-to-markdown/v2"
)

func main() {
	flag.Parse()

	if flag.NArg() != 1 {
		fmt.Fprintln(os.Stderr, "Usage: scrape <url>")
		os.Exit(1)
	}

	url := flag.Arg(0)
	if len(url) > 4 && url[:4] != "http" {
		url = "https://" + url
	}

	htmlContent, err := fetchWithHTTP(url)
	if err != nil {
		log.Fatal(err)
	}

	markdown, err := htmltomarkdown.ConvertString(htmlContent)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(markdown)
}

var client = &http.Client{
}

func fetchWithHTTP(url string) (string, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; ScrapeTool/1.0)")

	resp, err := client.Do(req)
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