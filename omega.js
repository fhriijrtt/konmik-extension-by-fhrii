/**
 * Omega Scans Extension Source for KonMIk
 * File: omega.js
 */

(function() {
    const BASE_URL = "https://omegascans.org";

    class OmegaScans {
        constructor() {
            this.baseUrl = BASE_URL;
            this.name = "Omega Scans";
        }

        async getList(page = 1) {
            try {
                const res = await fetch(`${this.baseUrl}/comics?page=${page}`);
                const html = await res.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");

                const items = doc.querySelectorAll("a[href*='/series/'], a[href*='/comic/']");
                const list = [];

                items.forEach(el => {
                    const href = el.getAttribute("href");
                    const titleEl = el.querySelector("h3") || el.querySelector("span") || el.querySelector("div.title");
                    const imgEl = el.querySelector("img");

                    if (href && titleEl) {
                        const titleText = titleEl.innerText ? titleEl.innerText.trim() : "";
                        if (titleText.length > 0) {
                            list.push({
                                title: titleText,
                                url: href.startsWith("http") ? href : this.baseUrl + href,
                                cover: imgEl ? (imgEl.getAttribute("src") || imgEl.getAttribute("data-src") || "") : ""
                            });
                        }
                    }
                });

                return list;
            } catch (e) {
                console.error("Error getList:", e);
                return [];
            }
        }

        async getDetail(url) {
            try {
                const res = await fetch(url);
                const html = await res.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");

                const title = doc.querySelector("h1")?.innerText.trim() || "";
                const description = doc.querySelector("p.description, .synopsis, div.summary")?.innerText.trim() || "";
                const cover = doc.querySelector("img.cover, meta[property='og:image']")?.getAttribute("content") 
                           || doc.querySelector("img.cover")?.getAttribute("src") || "";

                const chapters = [];
                const chapterElements = doc.querySelectorAll("a[href*='/chapter/']");

                chapterElements.forEach(el => {
                    const name = el.innerText ? el.innerText.trim() : "Chapter";
                    const chapterUrl = el.getAttribute("href");

                    if (chapterUrl) {
                        chapters.push({
                            name: name,
                            url: chapterUrl.startsWith("http") ? chapterUrl : this.baseUrl + chapterUrl
                        });
                    }
                });

                return {
                    title: title,
                    description: description,
                    cover: cover,
                    chapters: chapters
                };
            } catch (e) {
                console.error("Error getDetail:", e);
                return null;
            }
        }

        async getPages(url) {
            try {
                const res = await fetch(url);
                const html = await res.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");

                const pages = [];
                const imgElements = doc.querySelectorAll("div.reader-images img, div.page-break img, img.chapter-img, div.p-2 img");

                imgElements.forEach((img) => {
                    const src = img.getAttribute("data-src") || img.getAttribute("src");
                    if (src && !src.includes("logo") && !src.includes("banner")) {
                        const cleanUrl = src.startsWith("http") ? src : this.baseUrl + src;
                        if (!pages.includes(cleanUrl)) {
                            pages.push(cleanUrl);
                        }
                    }
                });

                return pages;
            } catch (e) {
                console.error("Error getPages:", e);
                return [];
            }
        }
    }

    const instance = new OmegaScans();

    // Export kompatibel untuk sistem eval KonMIk
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = instance;
    } else {
        return instance;
    }
})();