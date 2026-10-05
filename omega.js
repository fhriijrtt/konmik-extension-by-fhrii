// ID: ext_omega_scans
// NAME: Omega Scans
// VERSION: 1.1.0
// COLOR: #7C3AED
// ICON: https://omegascans.org/favicon.ico
// REFERER: https://omegascans.org/

const SITE = 'https://omegascans.org';
const API = 'https://api.omegascans.org';
const headers = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
    'Referer': SITE + '/',
};

// PERBAIKAN 1: Gunakan await res.text() lalu JSON.parse()
async function fetchJson(url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error('Gagal melakukan parse JSON dari server');
    }
}

function absUrl(u) {
    if (!u) return '';
    if (u.startsWith('http')) return u;
    if (u.startsWith('//')) return 'https:' + u;
    return SITE + (u.startsWith('/') ? '' : '/') + u;
}

function fmtDate(d) {
    if (!d) return '-';
    const t = new Date(d);
    return isNaN(t.getTime()) ? '-' : t.toISOString().split('T')[0];
}

const KonmikExtension = {
    async getList(page, query, filters) {
        const p = page || 1;
        let url = `${API}/query?page=${p}&perPage=20&adult=true&series_type=Comic&status=All&orderBy=latest&order=desc`;
        if (query) url += `&query_string=${encodeURIComponent(query)}`;

        const json = await fetchJson(url);
        const items = json.data || [];

        const mangaList = items.map(s => ({
            id: s.series_slug,
            title: (s.title || '').trim(),
            cover_url: absUrl(s.thumbnail),
            rating: '10.0',
            views: s.total_views != null ? String(s.total_views) : '-',
        })).filter(m => m.id && m.title);

        return { manga_list: mangaList };
    },

    async getDetail(slug) {
        const resJson = await fetchJson(`${API}/series/${slug}`);
        
        // PERBAIKAN 2: Pastikan mengambil object yang benar jika API membungkusnya dalam "data"
        const s = resJson.data || resJson;

        // Ambil semua chapter (paginasi)
        const chapters = [];
        let cp = 1;
        let last = 1;
        do {
            const j = await fetchJson(
                `${API}/chapter/query?page=${cp}&perPage=100&query=&order=desc&series_id=${s.id}`
            );
            for (const c of (j.data || [])) {
                let title = c.chapter_name || 'Chapter';
                if (c.chapter_title) title += ' - ' + c.chapter_title;
                if (c.price && c.price > 0) title += ' 🔒';
                chapters.push({
                    id: `${s.series_slug || slug}/${c.chapter_slug}`,
                    title: title.trim(),
                    date: fmtDate(c.created_at),
                });
            }
            last = (j.meta && j.meta.last_page) || 1;
            cp++;
        } while (cp <= last && cp <= 50);

        const author = s.author || s.studio || 'Unknown';
        const genres = Array.isArray(s.tags) ? s.tags.map(t => t.name).filter(Boolean) : [];

        return {
            title: (s.title || '').trim(),
            cover_url: absUrl(s.thumbnail),
            description: (s.description || 'Tidak ada deskripsi.').replace(/<[^>]*>/g, '').trim(),
            rating: '10.0',
            views: s.total_views != null ? String(s.total_views) : '-',
            genres: genres.length ? genres : ['Comic'],
            author: author,
            artist: author,
            chapters: chapters,
        };
    },

    async getChapterImages(chapterId) {
        // chapterId = "series_slug/chapter_slug"
        const j = await fetchJson(`${API}/chapter/${chapterId}`);
        const raw =
            (j.chapter && j.chapter.chapter_data && j.chapter.chapter_data.images) ||
            (j.chapter_data && j.chapter_data.images) ||
            j.data ||
            [];
        return raw
            .map(img => (typeof img === 'string' ? img : img.url || img.src || ''))
            .filter(Boolean)
            .map(absUrl);
    },
};
