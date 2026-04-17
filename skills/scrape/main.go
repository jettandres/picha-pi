package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/JohannesKaufmann/html-to-markdown/v2"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "Usage: scrape <url>")
		os.Exit(1)
	}

	url := os.Args[1]
	if len(url) > 4 && url[:4] != "http" {
		url = "https://" + url
	}

	resp, err := http.Get(url)
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Fatalf("status: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}

	markdown, err := htmltomarkdown.ConvertString(string(body))
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(markdown)
}