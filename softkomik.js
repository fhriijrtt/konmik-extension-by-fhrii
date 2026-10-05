// ID: ext_softkomik
// NAME: Softkomik
// VERSION: 1.0.0
// COLOR: #F59E0B
// ICON: https://softkomik.co/icon.jpg
// REFERER: https://softkomik.co/

const SITE = 'https://softkomik.co';
const API = 'https://api.softkomik.org';
const COVER_BASE = 'https://cover.softdevices.my.id/softkomik-cover';
const SESSION_URL = SITE + '/api/session/chapter/oaisos';

// Token terikat ke User-Agent, jadi UA yang sama dipakai untuk ambil session dan request API
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';

const baseHeaders = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Referer': SITE + '/komik/list',
    'Origin': SITE,
};

// ---------- util ----------

function parseJson(text) {
    try {
        return JSON.parse(text);
    } catch (e1) {
        try {
            return JSON.parse(String(text).replace(/^\uFEFF/, '').replace(/[\u0000-\u001F]/g, ' '));
        } catch (e2) {
            throw new Error('JSON gagal: ' + (e2 && e2.message ? e2.message : e2) +
                ' | len=' + String(text).length + ' | awal=' + String(text).slice(0, 80));
        }
    }
}

async function httpGet(url, headers) {
    const res = await fetch(url, { headers: headers || baseHeaders });
    const status = res.status || 200;
    const text = await res.text();
    return { status: status, text: text };
}

function enc(s) {
    return encodeURIComponent(String(s == null ? '' : s));
}

function errMsg(e) {
    return String(e && e.message ? e.message : e);
}

function stripHtml(s) {
    return String(s || '').replace(/<[^>]*>/g, '').trim();
}

function humanize(slug) {
    return String(slug || '').replace(/-bahasa-indonesia$/, '').replace(/-/g, ' ');
}

function coverUrl(m) {
    const p = (m && (m.gambar || m.cover || m.cover_url || m.thumbnail || m.image)) || '';
    if (!p) return '';
    if (/^https?:/.test(p)) return p;
    if (p.indexOf('//') === 0) return 'https:' + p;
    return COVER_BASE + (p.charAt(0) === '/' ? '' : '/') + p;
}

function debugCard(text) {
    return { manga_list: [{ id: 'debug', title: text, cover_url: '', rating: '0.0', views: '-' }] };
}

// Cari objek pertama yang punya title_slug di dalam JSON bersarang (untuk __NEXT_DATA__)
function findComic(obj, depth) {
    if (!obj || typeof obj !== 'object' || depth > 6) return null;
    if (!Array.isArray(obj) && obj.title_slug && obj.title) return obj;
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
        const r = findComic(obj[keys[i]], depth + 1);
        if (r) return r;
    }
    return null;
}

// ---------- session (token + sign) ----------

let _session = null;

async function getSession(force) {
    if (!force && _session && Number(_session.ex) > Date.now() + 5000) return _session;
    const r = await httpGet(SESSION_URL, baseHeaders);
    if (r.status < 200 || r.status >= 300) {
        throw new Error('Session HTTP ' + r.status);
    }
    const d = parseJson(r.text);
    if (!d || !d.token || !d.sign) {
        throw new Error('Session tidak valid: ' + String(r.text).slice(0, 120));
    }
    // Sama seperti kode situs: buang bagian setelah "|oiq&"
    d.sign = String(d.sign).split('|oiq&')[0];
    _session = d;
    return d;
}

async function apiGet(path) {
    for (let attempt = 0; attempt < 2; attempt++) {
        const s = await getSession(attempt > 0);
        const h = {};
        const k = Object.keys(baseHeaders);
        for (let i = 0; i < k.length; i++) h[k[i]] = baseHeaders[k[i]];
        h['X-Token'] = s.token;
        h['X-Sign'] = s.sign;
        if (s.contentAccess && s.contentAccess.token && s.contentAccess.sign) {
            h['X-Content-Token'] = s.contentAccess.token;
            h['X-Content-Sign'] = s.contentAccess.sign;
        }
        const r = await httpGet(API + path, h);
        if ((r.status === 401 || r.status === 403) && attempt === 0) {
            _session = null;
            continue;
        }
        if (r.status < 200 || r.status >= 300) {
            throw new Error('HTTP ' + r.status + ' untuk ' + path);
        }
        return parseJson(r.text);
    }
    throw new Error('Session ditolak server (401/403)');
}

// ---------- info komik dari halaman web (__NEXT_DATA__) ----------

async function fetchInfo(slug) {
    const pageSlug = /-bahasa-indonesia$/.test(slug) ? slug : slug + '-bahasa-indonesia';
    const r = await httpGet(SITE + '/' + pageSlug, {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': SITE + '/',
    });
    const m = r.text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    return findComic(parseJson(m[1]), 0);
}

function toGenres(s) {
    const g = s.Genre || s.genre || s.genres || [];
    if (typeof g === 'string') return g.split(',').map(x => x.trim()).filter(Boolean);
    if (Array.isArray(g)) {
        return g.map(x => (typeof x === 'string' ? x : (x && (x.name || x.title)))).filter(Boolean);
    }
    return [];
}

// ---------- kontrak KonMik ----------

const KonmikExtension = {

    // Daftar komik (katalog + pencarian)
    async getList(page, query, filters) {
        const p = page || 1;
        const q = (query || '').trim();
        let path = '/komik?page=' + p + '&limit=24&sortBy=newKomik&name=' + enc(q);
        if (!q) {
            const rating = (filters && filters.rating) ? String(filters.rating).toLowerCase() : 'normal';
            path += '&contentRating=' + enc(rating);
        }

        try {
            const json = await apiGet(path);
            const rows = Array.isArray(json) ? json : (json.data || []);

            if (rows.length === 0) {
                if (q || p > 1) return { manga_list: [] };
                return debugCard('DEBUG: data kosong (page ' + p + ')');
            }

            const list = [];
            for (let i = 0; i < rows.length; i++) {
                const m = rows[i];
                const id = m.title_slug || m.slug;
                if (!id) continue;
                list.push({
                    id: id,
                    title: m.title || humanize(id),
                    cover_url: coverUrl(m),
                    rating: m.rating ? String(m.rating) : '0.0',
                    views: (m.view || m.views || m.viewCount) ? String(m.view || m.views || m.viewCount) : '-'
                });
            }
            if (list.length === 0) {
                return debugCard('DEBUG: field slug tidak ketemu, keys=' + Object.keys(rows[0]).join(',').slice(0, 150));
            }
            return { manga_list: list };
        } catch (e) {
            return debugCard('ERROR: ' + errMsg(e).slice(0, 150));
        }
    },

    // Detail komik + semua chapter. slug = title_slug
    async getDetail(slug) {
        let s = null;
        try { s = await fetchInfo(slug); } catch (e) { s = null; }
        s = s || {};

        const ch = await apiGet('/komik/' + enc(slug) + '/chapter?limit=9999999');
        const all = [].concat(ch.chapter || [], ch.newChapter || [], ch.startChapter || []);

        const seen = {};
        const chapters = [];
        for (let i = 0; i < all.length; i++) {
            const c = all[i];
            const num = String(c.chapter);
            if (seen[num]) continue;
            seen[num] = true;
            chapters.push({
                id: slug + '|' + num + '|' + (c._id || c.id || ''),
                title: 'Chapter ' + num,
                date: c.updatedAt || c.createdAt || c.date || '',
                _n: parseFloat(num)
            });
        }
        chapters.sort((a, b) => (isNaN(b._n) ? -1 : b._n) - (isNaN(a._n) ? -1 : a._n));
        const clean = chapters.map(c => ({ id: c.id, title: c.title, date: c.date }));

        return {
            title: s.title || humanize(slug),
            cover_url: coverUrl(s),
            description: stripHtml(s.sinopsis || s.synopsis || s.description) || 'Tidak ada deskripsi',
            rating: s.rating ? String(s.rating) : '0.0',
            views: (s.view || s.views || s.viewCount) ? String(s.view || s.views || s.viewCount) : '-',
            genres: toGenres(s),
            author: s.author || '?',
            artist: s.artist || s.author || '?',
            chapters: clean
        };
    },

    // Gambar chapter. chapterId = "title_slug|nomor_chapter|_id"
    async getChapterImages(chapterId) {
        const parts = String(chapterId).split('|');
        if (parts.length < 3 || !parts[2]) {
            throw new Error('ID chapter tidak lengkap: ' + chapterId);
        }
        const json = await apiGet('/komik/' + enc(parts[0]) + '/chapter/' + enc(parts[1]) + '/imgs/' + enc(parts[2]));
        const imgs = Array.isArray(json.imageSrc) ? json.imageSrc : [];
        if (imgs.length === 0) {
            throw new Error('Data gambar chapter kosong.');
        }
        return imgs.map(u => (String(u).indexOf('//') === 0 ? 'https:' + u : String(u)));
    }
};
