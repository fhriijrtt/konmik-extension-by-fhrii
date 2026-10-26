// ID: ext_wurmz
// NAME: Wurmz
// VERSION: 1.0.0
// COLOR: #FF5722
// ICON: https://wurmz.net/favicon.ico
// REFERER: https://wurmz.net/

const BASE = 'https://wurmz.net';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Referer': BASE + '/',
};

async function fetchHtml(url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
}

function extractMatch(regex, str, defaultVal = '') {
    const m = str.match(regex);
    return m ? m[1].trim() : defaultVal;
}

function extractAll(regex, str) {
    const matches = [];
    let m;
    while ((m = regex.exec(str)) !== null) {
        matches.push(m);
    }
    return matches;
}

const KonmikExtension = {
    // 1. Scraper Daftar Komik & Pencarian
    async getList(page, query, filters) {
        const p = page || 1;
        let url = query 
            ? `${BASE}/page/${p}/?s=${encodeURIComponent(query)}` 
            : `${BASE}/manga/?page=${p}&order=update`;
        
        try {
            const html = await fetchHtml(url);
            // Regex MangaThemesia Card (.bsx)
            const cardRegex = /<div class="bsx">[\s\S]*?<a[^>]*href="([^"]+)"[^>]*title="([^"]*)"[\s\S]*?(?:data-src|src)="([^"]+)"[\s\S]*?(?:<div class="tt">([^<]+)<\/div>)?/gi;
            const matches = extractAll(cardRegex, html);
            const mangaList = [];
            const seen = new Set();

            for (const m of matches) {
                const urlPath = m[1];
                let title = m[2] || m[4] || 'Unknown Title';
                let cover = m[3] || '';
                
                if (cover.includes('?')) cover = cover.split('?')[0];
                if (seen.has(urlPath)) continue;
                seen.add(urlPath);

                mangaList.push({
                    id: urlPath,
                    title: title.trim(),
                    cover_url: cover,
                    rating: '0.0',
                    views: '-'
                });
            }

            if (mangaList.length === 0) {
                return { manga_list: [{ id: 'debug', title: 'DEBUG: Data kosong (page ' + p + ')', cover_url: '', rating: '0.0', views: '-' }] };
            }

            return { manga_list: mangaList };
        } catch (e) {
            return { manga_list: [{ id: 'debug', title: 'ERROR: ' + (e.message || e), cover_url: '', rating: '0.0', views: '-' }] };
        }
    },

    // 2. Scraper Detail Komik & Daftar Chapter
    async getDetail(urlPath) {
        const html = await fetchHtml(urlPath);
        
        const title = extractMatch(/<h1 class="entry-title"[^>]*>([^<]+)<\/h1>/i, html, 'Unknown Title');
        const desc = extractMatch(/<div class="entry-content"[^>]*>([\s\S]*?)<\/div>/i, html, 'Tidak ada deskripsi').replace(/<[^>]*>/g, '').trim();
        
        let cover = extractMatch(/property="og:image"\s+content="([^"]+)"/i, html) || 
                    extractMatch(/<div class="thumb">\s*<img[^>]*src="([^"]+)"/i, html);
        if (cover && cover.includes('?')) cover = cover.split('?')[0];

        const author = extractMatch(/<span>Author:\s*([^<]+)<\/span>/i, html, 'Unknown');
        
        // Ambil Genre
        const genreRegex = /<span class="mgen">\s*<a[^>]*>([^<]+)<\/a>/gi;
        const genreMatches = extractAll(genreRegex, html);
        const genres = genreMatches.map(m => m[1].trim());

        // Ambil Daftar Chapter
        const chapterRegex = /<li>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<span class="chapternum">([^<]+)<\/span>[\s\S]*?<span class="date">([^<]+)<\/span>/gi;
        const chapMatches = extractAll(chapterRegex, html);
        
        let chapters = [];
        for (const m of chapMatches) {
            chapters.push({
                id: m[1],
                title: m[2].trim(),
                date: m[3].trim()
            });
        }

        // Fallback chapter list jika struktur sedikit beda
        if (chapters.length === 0) {
            const altChapterRegex = /<div class="chatt">\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
            const altMatches = extractAll(altChapterRegex, html);
            for (const m of altMatches) {
                chapters.push({
                    id: m[1],
                    title: m[2].trim(),
                    date: '-'
                });
            }
        }

        return {
            title: title,
            cover_url: cover || '',
            description: desc,
            rating: '0.0',
            views: '-',
            genres: genres.length > 0 ? genres : ['Manga'],
            author: author,
            artist: author,
            chapters: chapters
        };
    },

    // 3. Scraper Gambar Halaman Baca (Reader)
    async getChapterImages(chapterUrl) {
        const html = await fetchHtml(chapterUrl);
        const readerArea = extractMatch(/<div[^>]*id="readerarea"[^>]*>([\s\S]*?)<\/div>/i, html);
        
        const imgRegex = /(?:data-src|data-lazy-src|src)="([^"]+)"/gi;
        const matches = extractAll(imgRegex, readerArea);
        
        const images = [];
        for (const m of matches) {
            let imgUrl = m[1].trim();
            if (imgUrl && !images.includes(imgUrl) && !imgUrl.includes('logo') && !imgUrl.includes('banner')) {
                images.push(imgUrl);
            }
        }

        if (images.length === 0) {
            throw new Error('Tidak ada gambar ditemukan (chapter terkunci/berbayar?)');
        }

        return images;
    }
};
