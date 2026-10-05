// ID: ext_omega_scans
// NAME: Omega Scans
// VERSION: 1.1.2
// COLOR: #7C3AED
// ICON: https://omegascans.org/favicon.ico
// REFERER: https://omegascans.org/

const SITE = 'https://omegascans.org';
const API = 'https://api.omegascans.org';
const headers = {
    'Accept': 'application/json, text/plain, */*',
    // Menggunakan User-Agent Desktop standar (seperti Doujindesu) agar lebih aman dari blokir Cloudflare
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Referer': SITE + '/',
    'Origin': SITE
};

async function fetchJson(url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error('Gagal parse JSON dari server');
    }
}

function absUrl(u) {
    if (!u) return 'https://via.placeholder.com/150?text=No+Cover';
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
        try {
            const p = page || 1;
            let url = `${API}/query?page=${p}&perPage=20&adult=true&series_type=Comic&status=All&orderBy=latest&order=desc`;
            if (query) url += `&query_string=${encodeURIComponent(query)}`;

            const json = await fetchJson(url);
            const items = json.data || [];

            const mangaList = items.map(s => ({
                // Menambahkan fallback (s.slug atau s.id) jika s.series_slug tidak ada
                id: s.series_slug || s.slug || String(s.id || ''),
                title: (s.title || s.name || 'Tanpa Judul').trim(),
                cover_url: absUrl(s.thumbnail || s.cover || s.image),
                rating: '10.0',
                views: s.total_views != null ? String(s.total_views) : '-',
            })).filter(m => m.id && m.title !== 'Tanpa Judul');

            // Jika berhasil fetch tapi data benar-benar kosong
            if (mangaList.length === 0) {
                return { 
                    manga_list: [{
                        id: 'debug_empty', 
                        title: 'Data kosong. Format API mungkin berubah.', 
                        cover_url: 'https://via.placeholder.com/150?text=Empty', 
                        rating: '0', 
                        views: '-'
                    }]
                };
            }

            return { manga_list: mangaList };

        } catch (e) {
            // TAMPILKAN ERROR SEBAGAI KOMIK (Smart Debugging)
            return {
                manga_list: [{
                    id: 'error_debug',
                    title: `ERROR: ${e.message}`,
                    cover_url: 'https://via.placeholder.com/150?text=Error',
                    rating: '0.0',
                    views: 'Error'
                }]
            };
        }
    },

    async getDetail(slug) {
        // Mencegah error lanjutan jika user mengklik komik error
        if (slug === 'error_debug' || slug === 'debug_empty') {
            throw new Error("Ini hanya pesan error, tidak bisa dibuka.");
        }

        const resJson = await fetchJson(`${API}/series/${slug}`);
        const s = resJson.data || resJson;

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
                    // Fallback keamanan untuk id chapter
                    id: `${s.series_slug || s.slug || slug}/${c.chapter_slug || c.slug}`,
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
            title: (s.title || s.name || '').trim(),
            cover_url: absUrl(s.thumbnail || s.cover || s.image),
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
    }
};
