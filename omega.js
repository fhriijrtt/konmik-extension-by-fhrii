/**
 * Omega Scans Extension Source for KonMIk / Mihon (JS Runner)
 */
class OmegaScans {
    constructor() {
        this.baseUrl = "https://omegascans.org";
        this.name = "Omega Scans";
        this.lang = "en";
    }

    /**
     * 1. Mengambil Daftar Komik Terbaru / Katalog
     */
    async getPopularManga(page = 1) {
        const response = await fetch(`${this.baseUrl}/comics?page=${page}`);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const mangaList = [];
        const items = doc.querySelectorAll("a[href*='/series/']");

        items.forEach(el => {
            const href = el.getAttribute("href");
            const titleEl = el.querySelector("h3") || el.querySelector("span");
            const imgEl = el.querySelector("img");

            if (href && titleEl) {
                mangaList.push({
                    title: titleEl.innerText.trim(),
                    url: href.startsWith("http") ? href : this.baseUrl + href,
                    thumbnail: imgEl ? imgEl.getAttribute("src") : ""
                });
            }
        });

        return {
            manga: mangaList,
            hasNextPage: items.length > 0
        };
    }

    /**
     * 2. Mengambil Detail Informasi Komik & Daftar Chapter
     */
    async getMangaDetails(mangaUrl) {
        const response = await fetch(mangaUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const title = doc.querySelector("h1")?.innerText.trim() || "";
        const description = doc.querySelector("p.description, .synopsis")?.innerText.trim() || "";
        const thumbnail = doc.querySelector("img.cover, meta[property='og:image']")?.getAttribute("content") || "";

        // Scraping Chapter List
        const chapters = [];
        const chapterElements = doc.querySelectorAll("a[href*='/chapter/']");

        chapterElements.forEach(el => {
            const name = el.innerText.trim();
            const url = el.getAttribute("href");

            if (url) {
                chapters.push({
                    name: name,
                    url: url.startsWith("http") ? url : this.baseUrl + url,
                    dateUpload: new Date().toISOString()
                });
            }
        });

        return {
            title,
            description,
            thumbnail,
            chapters
        };
    }

    /**
     * 3. Mengambil URL Gambar di Dalam Chapter (Reader Pages)
     */
    async getPageList(chapterUrl) {
        const response = await fetch(chapterUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const pages = [];
        
        // Menangkap gambar chapter utama
        const imgElements = doc.querySelectorAll("div.reader-images img, div.page-break img, img.chapter-img");

        imgElements.forEach((img, index) => {
            const src = img.getAttribute("data-src") || img.getAttribute("src");
            if (src && !src.includes("logo") && !src.includes("banner")) {
                pages.push({
                    index: index,
                    url: src.startsWith("http") ? src : this.baseUrl + src
                });
            }
        });

        return pages;
    }
}

// Export modul agar dapat dibaca oleh engine launcher
if (typeof module !== 'undefined') {
    module.exports = OmegaScans;
                  }
