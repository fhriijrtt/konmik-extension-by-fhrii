// ID: ext_omegascans
// NAME: Omega Scans
// VERSION: 1.1.0
// COLOR: #7C3AED
// ICON: https://omegascans.org/favicon.ico
// REFERER: https://omegascans.org/

const SITE = 'https://omegascans.org';
const API = 'https://api.omegascans.org';

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Referer': SITE + '/',
    'Origin': SITE,
    'Accept': 'application/json',
};

async function getJson(url) {
    const res = await fetch(url, { headers });
    const status = res.status || 200;
    if (status < 200 || status >= 300) {
        throw new Error('HTTP ' + status + ' untuk ' + url);
    }
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error('Respons bukan JSON: ' + text.slice(0, 120));
    }
}

function fullUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return API + (path.startsWith('/') ? '' : '/') + path;
}

function chapterNumber(name) {
    const m = (name || '').match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : -1;
}

const KonmikExtension = {

    // Daftar komik (katalog + pencarian)
    async getList(page, query, filters) {
        const p = page || 1;
        const url = API + '/query?page=' + p +
            '&perPage=20&series_type=Comic' +
            '&query_string=' + encodeURIComponent(query || '') +
            '&order=desc&orderBy=latest&adult=true&status=All&tags_ids=%5B%5D';

        try {
            const json = await getJson(url);
            const rows = Array.isArray(json) ? json : (json.data || []);

            const mangaList = rows.map(m => ({
                id: m.series_slug,
                title: m.title,
                cover_url: fullUrl(m.thumbnail),
                rating: m.rating ? String(m.rating) : '0.0',
                views: m.total_views ? String(m.total_views) : '-'
            }));

            if (mangaList.length === 0) {
                return { manga_list: [{ id: 'debug', title: 'DEBUG: data kosong (page ' + p + ')', cover_url: '', rating: '0.0', views: '-' }] };
            }
            return { manga_list: mangaList };
        } catch (e) {
            // Sementara: tampilkan error sebagai kartu supaya penyebabnya kelihatan di app
            return { manga_list: [{ id: 'debug', title: 'ERROR: ' + String(e && e.message ? e.message : e).slice(0, 150), cover_url: '', rating: '0.0', views: '-' }] };
        }
    },

    // Detail komik + semua chapter
    async getDetail(slug) {
        const json = await getJson(API + '/series/' + slug);
        const s = (json.data && !json.title) ? json.data : json;

        // Ambil chapter semua halaman
        const chapters = [];
        let page = 1;
        let lastPage = 1;
        do {
            const cj = await getJson(
                API + '/chapter/query?page=' + page +
                '&perPage=100&series_id=' + s.id
            );
            const rows = cj.data || [];
            for (const c of rows) {
                chapters.push({
                    id: slug + '/' + c.chapter_slug,
                    title: c.chapter_name || c.chapter_title || 'Chapter',
                    date: c.created_at || '',
                    _n: chapterNumber(c.chapter_name),
                    _id: c.id || 0
                });
            }
            lastPage = (cj.meta && cj.meta.last_page) ? cj.meta.last_page : 1;
            page++;
        } while (page <= lastPage && page <= 50);

        // Terbaru di atas
        chapters.sort((a, b) => (b._n - a._n) || (b._id - a._id));
        const cleanChapters = chapters.map(c => ({ id: c.id, title: c.title, date: c.date }));

        let genres = [];
        if (Array.isArray(s.tags)) {
            genres = s.tags.map(t => (typeof t === 'string' ? t : t.name)).filter(Boolean);
        }

        return {
            title: s.title,
            cover_url: fullUrl(s.thumbnail),
            description: (s.description || 'Tidak ada deskripsi').replace(/<[^>]*>/g, '').trim(),
            rating: s.rating ? String(s.rating) : '0.0',
            views: s.total_views ? String(s.total_views) : '-',
            genres: genres,
            author: s.author || '?',
            artist: s.studio || s.artist || '?',
            chapters: cleanChapters
        };
    },

    // Gambar halaman chapter. chapterId = "series_slug/chapter_slug"
    async getChapterImages(chapterId) {
        const json = await getJson(API + '/chapter/' + chapterId);

        let images = [];
        if (Array.isArray(json.data) && json.data.length > 0) {
            images = json.data;
        } else if (json.chapter && json.chapter.chapter_data && Array.isArray(json.chapter.chapter_data.images)) {
            images = json.chapter.chapter_data.images;
        }

        if (images.length === 0) {
            throw new Error('Tidak ada gambar (chapter berbayar/terkunci?)');
        }
        return images.map(fullUrl);
    }
};
  
