module.exports = {
    name: "Omega Scans",
    baseUrl: "https://omegascans.org",
    lang: "en",

    // 1. Ambil Katalog via API / JSON Payload
    async getList(page = 1) {
        try {
            // Menembak endpoint API / data payload Next.js
            const res = await fetch(`${this.baseUrl}/api/comics?page=${page}&query=`);
            if (!res.ok) {
                // Fallback jika API utama membutuhkan query RSC
                const rscRes = await fetch(`${this.baseUrl}/comics?_rsc=1e5ao`);
                const rscText = await rscRes.text();
                return this.parseRSC(rscText);
            }
            const data = await res.json();

            const list = [];
            const comics = data.comics || data.data || data;

            if (Array.isArray(comics)) {
                comics.forEach(item => {
                    list.push({
                        title: item.title || item.name,
                        url: `${this.baseUrl}/series/${item.slug || item.id}`,
                        cover: item.thumbnail || item.cover || item.image || ""
                    });
                });
            }

            return list;
        } catch (e) {
            console.error("Error getList API:", e);
            return [];
        }
    },

    // Helper untuk memproses data jika server merespons format RSC Text
    parseRSC(text) {
        const list = [];
        try {
            const matches = text.match(/\{"id":.*?"title":.*?\}/g);
            if (matches) {
                matches.forEach(jsonStr => {
                    try {
                        const item = JSON.parse(jsonStr);
                        if (item.title && (item.slug || item.id)) {
                            list.push({
                                title: item.title,
                                url: `${this.baseUrl}/series/${item.slug || item.id}`,
                                cover: item.thumbnail || item.cover || ""
                            });
                        }
                    } catch (err) {}
                });
            }
        } catch (e) {}
        return list;
    },

    // 2. Ambil Detail & Chapter List via API
    async getDetail(url) {
        try {
            const slug = url.split('/').pop();
            const res = await fetch(`${this.baseUrl}/api/series/${slug}`);
            
            if (res.ok) {
                const data = await res.json();
                const chapters = (data.chapters || []).map(ch => ({
                    name: ch.name || `Chapter ${ch.chapter_name || ch.number}`,
                    url: `${this.baseUrl}/series/${slug}/${ch.slug || ch.id}`
                }));

                return {
                    title: data.title || "",
                    description: data.description || "",
                    cover: data.thumbnail || data.cover || "",
                    chapters: chapters
                };
            }

            // Fallback scraping standar jika API khusus detail di-block
            const htmlRes = await fetch(url);
            const html = await htmlRes.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            const chapters = [];
            doc.querySelectorAll("a[href*='/chapter/'], a[href*='/series/']").forEach(el => {
                if (el.getAttribute("href")?.includes(slug)) {
                    chapters.push({
                        name: el.innerText.trim() || "Chapter",
                        url: el.getAttribute("href").startsWith("http") ? el.getAttribute("href") : this.baseUrl + el.getAttribute("href")
                    });
                }
            });

            return {
                title: doc.querySelector("h1")?.innerText.trim() || "Omega Comic",
                description: doc.querySelector("p")?.innerText.trim() || "",
                cover: doc.querySelector("img")?.getAttribute("src") || "",
                chapters: chapters
            };
        } catch (e) {
            console.error("Error getDetail:", e);
            return null;
        }
    },

    // 3. Ambil Gambar Reader
    async getPages(url) {
        try {
            const res = await fetch(url);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            const pages = [];
            // Mengambil semua tag img di area baca
            const imgElements = doc.querySelectorAll("img");

            imgElements.forEach((img) => {
                const src = img.getAttribute("data-src") || img.getAttribute("src") || img.getAttribute("data-lazy-src");
                if (src && (src.includes("storage") || src.includes("uploads") || src.includes("media") || src.includes("chapter"))) {
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
};            return [];
        }
    },

    // 2. Ambil Detail Komik & Daftar Chapter
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
    },

    // 3. Ambil Gambar Reader
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
};
