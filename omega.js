/**
 * Omega Scans Extension Source for KonMIk
 * File: omega.js
 */

const BASE_URL = "https://omegascans.org";

/**
 * 1. Mengambil Daftar / Katalog Komik (getList)
 * @param {number} page 
 */
async function getList(page = 1) {
    try {
        const response = await fetch(`${BASE_URL}/comics?page=${page}`);
        const html = await response.text();
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
                        url: href.startsWith("http") ? href : BASE_URL + href,
                        cover: imgEl ? (imgEl.getAttribute("src") || imgEl.getAttribute("data-src") || "") : ""
                    });
                }
            }
        });

        return list;
    } catch (error) {
        console.error("Error pada getList:", error);
        return [];
    }
}

/**
 * 2. Mengambil Detail Komik & Daftar Chapter (getDetail)
 * @param {string} detailUrl 
 */
async function getDetail(detailUrl) {
    try {
        const response = await fetch(detailUrl);
        const html = await response.text();
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
            const url = el.getAttribute("href");

            if (url) {
                chapters.push({
                    name: name,
                    url: url.startsWith("http") ? url : BASE_URL + url
                });
            }
        });

        return {
            title: title,
            description: description,
            cover: cover,
            chapters: chapters
        };
    } catch (error) {
        console.error("Error pada getDetail:", error);
        return null;
    }
}

/**
 * 3. Mengambil Halaman Gambar Reader (getPages)
 * @param {string} chapterUrl 
 */
async function getPages(chapterUrl) {
    try {
        const response = await fetch(chapterUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const pages = [];
        const imgElements = doc.querySelectorAll("div.reader-images img, div.page-break img, img.chapter-img, div.p-2 img");

        imgElements.forEach((img) => {
            const src = img.getAttribute("data-src") || img.getAttribute("src");
            if (src && !src.includes("logo") && !src.includes("banner")) {
                const cleanUrl = src.startsWith("http") ? src : BASE_URL + src;
                if (!pages.includes(cleanUrl)) {
                    pages.push(cleanUrl);
                }
            }
        });

        return pages;
    } catch (error) {
        console.error("Error pada getPages:", error);
        return [];
    }
}

// Export fungsi ke ranah global / modul ekosistem KonMIk
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getList, getDetail, getPages };
} else if (typeof window !== 'undefined') {
    window.getList = getList;
    window.getDetail = getDetail;
    window.getPages = getPages;
}        return {
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
