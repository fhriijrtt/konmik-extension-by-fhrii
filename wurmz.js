// ID: ext_wurmz
// NAME: Wurmz
// VERSION: 1.2.0
// COLOR: #FF5722
// ICON: https://wurmz.net/favicon.ico
// REFERER: https://wurmz.net/

var BASE = 'https://wurmz.net';
var headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Referer': BASE + '/'
};

async function fetchHtml(url) {
    var res = await fetch(url, { headers: headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
}

function extractMatch(regex, str, defaultVal) {
    var m = str.match(regex);
    return m ? m[1].trim() : (defaultVal || '');
}

function extractAll(regex, str) {
    var matches = [];
    var m;
    while ((m = regex.exec(str)) !== null) {
        matches.push(m);
    }
    return matches;
}

var KonmikExtension = {
    // 1. Scraper Daftar Komik & Pencarian
    async getList(page, query, filters) {
        var p = page || 1;
        var url = query 
            ? BASE + '/page/' + p + '/?s=' + encodeURIComponent(query) 
            : BASE + '/manga/?page=' + p + '&order=update';
        
        try {
            var html = await fetchHtml(url);
            var cardRegex = /<a[^>]*href="([^"]+)"[^>]*title="([^"]*)"[\s\S]*?(?:data-src|src)="([^"]+)"[\s\S]*?(?:<div class="tt">([^<]+)<\/div>)?/gi;
            var matches = extractAll(cardRegex, html);
            
            if (matches.length === 0) {
                var fallbackRegex = /<div class="[^"]*(?:bsx|kanan|limit|animepost)[^"]*">[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<(?:div|h3)[^>]*>([^<]+)<\/(?:div|h3)>/gi;
                matches = extractAll(fallbackRegex, html);
            }

            var mangaList = [];
            var seen = {};

            for (var i = 0; i < matches.length; i++) {
                var m = matches[i];
                var urlPath = m[1];
                var title = m[2] || m[3] || m[4] || 'Unknown Title';
                var cover = (m[2] && m[2].indexOf('http') === 0) ? m[2] : (m[3] || '');
                
                if (cover.indexOf('?') !== -1) cover = cover.split('?')[0];
                if (seen[urlPath]) continue;
                seen[urlPath] = true;

                mangaList.push({
                    id: urlPath,
                    title: title.trim(),
                    cover_url: cover,
                    rating: '0.0',
                    views: '-'
                });
            }

            if (mangaList.length === 0) {
                return { manga_list: [{ id: 'debug', title: 'DEBUG: HTML len=' + html.length + ' (Kemungkinan Cloudflare)', cover_url: '', rating: '0.0', views: '-' }] };
            }

            return { manga_list: mangaList };
        } catch (e) {
            return { manga_list: [{ id: 'debug', title: 'ERROR: ' + (e.message || e), cover_url: '', rating: '0.0', views: '-' }] };
        }
    },

    // 2. Scraper Detail Komik & Daftar Chapter
    async getDetail(urlPath) {
        var html = await fetchHtml(urlPath);
        
        var title = extractMatch(/<h1 class="entry-title"[^>]*>([^<]+)<\/h1>/i, html, 'Unknown Title');
        var desc = extractMatch(/<div class="entry-content"[^>]*>([\s\S]*?)<\/div>/i, html, 'Tidak ada deskripsi').replace(/<[^>]*>/g, '').trim();
        
        var cover = extractMatch(/property="og:image"\s+content="([^"]+)"/i, html) || 
                    extractMatch(/<div class="thumb">\s*<img[^>]*src="([^"]+)"/i, html);
        if (cover && cover.indexOf('?') !== -1) cover = cover.split('?')[0];

        var author = extractMatch(/<span>Author:\s*([^<]+)<\/span>/i, html, 'Unknown');
        
        var genreRegex = /<span class="mgen">\s*<a[^>]*>([^<]+)<\/a>/gi;
        var genreMatches = extractAll(genreRegex, html);
        var genres = [];
        for (var j = 0; j < genreMatches.length; j++) {
            genres.push(genreMatches[j][1].trim());
        }

        var chapterRegex = /<li>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<span class="chapternum">([^<]+)<\/span>[\s\S]*?<span class="date">([^<]+)<\/span>/gi;
        var chapMatches = extractAll(chapterRegex, html);
        
        var chapters = [];
        for (var k = 0; k < chapMatches.length; k++) {
            chapters.push({
                id: chapMatches[k][1],
                title: chapMatches[k][2].trim(),
                date: chapMatches[k][3].trim()
            });
        }

        if (chapters.length === 0) {
            var altChapterRegex = /<div class="chatt">\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
            var altMatches = extractAll(altChapterRegex, html);
            for (var l = 0; l < altMatches.length; l++) {
                chapters.push({
                    id: altMatches[l][1],
                    title: altMatches[l][2].trim(),
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
        var html = await fetchHtml(chapterUrl);
        var readerArea = extractMatch(/<div[^>]*id="readerarea"[^>]*>([\s\S]*?)<\/div>/i, html);
        
        var imgRegex = /(?:data-src|data-lazy-src|src)="([^"]+)"/gi;
        var matches = extractAll(imgRegex, readerArea);
        
        var images = [];
        for (var mIdx = 0; mIdx < matches.length; mIdx++) {
            var imgUrl = matches[mIdx][1].trim();
            if (imgUrl && images.indexOf(imgUrl) === -1 && imgUrl.indexOf('logo') === -1 && imgUrl.indexOf('banner') === -1) {
                images.push(imgUrl);
            }
        }

        if (images.length === 0) {
            throw new Error('Tidak ada gambar ditemukan (chapter terkunci/berbayar?)');
        }

        return images;
    }
};
