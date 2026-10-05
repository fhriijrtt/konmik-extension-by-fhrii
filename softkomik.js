// ID: ext_softkomik
// NAME: Softkomik
// VERSION: 1.0.0
// COLOR: #F59E0B
// ICON: https://softkomik.co/icon.jpg
// REFERER: https://softkomik.co/

const SITE = 'https://softkomik.co';
const API = 'https://api.softkomik.org';
const COVER_BASE = 'https://cover.softdevices.my.id/softkomik-cover';
const SESSION_URLS = {
    list: SITE + '/api/session/aksjkas',
    chapter: SITE + '/api/session/chapter/oaisos',
};

// Token terikat ke User-Agent, jadi UA yang sama dipakai di semua request
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';

// Header untuk API (lintas-origin, seperti browser)
const apiHeaders = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Referer': SITE + '/komik/list',
    'Origin': SITE,
};

// Header untuk endpoint di softkomik.co sendiri (same-origin GET: browser tidak mengirim Origin)
const siteJsonHeaders = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': SITE + '/komik/list',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
};

const htmlHeaders = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': SITE + '/',
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
    return { manga_list: [{ id: 'debug', title: '[Softkomik] ' + text, cover_url: '', rating: '0.0', views: '-' }] };
}

// Catatan diagnosa singkat, ikut tampil di kartu error supaya penyebabnya kelihatan
const _diag = [];
function note(s) {
    _diag.push(String(s).slice(0, 110));
    if (_diag.length > 8) _diag.shift();
}
function diag() {
    return _diag.join(' ; ');
}

// ---------- HTTP + cookie (bila engine mendukung) ----------

const _jar = {};
let _bootInfo = 'boot=belum';
let _bootAt = 0;

function cookieHeader() {
    return Object.keys(_jar).map(n => n + '=' + _jar[n]).join('; ');
}

function readSetCookies(res) {
    let list = [];
    try {
        const h = res.headers;
        if (!h) return list;
        let v = null;
        if (typeof h.getSetCookie === 'function') v = h.getSetCookie();
        if ((!v || !v.length) && typeof h.get === 'function') v = h.get('set-cookie') || h.get('Set-Cookie');
        if (!v) v = h['set-cookie'] || h['Set-Cookie'];
        if (!v && h.map) v = h.map['set-cookie'];
        if ((!v || !v.length) && typeof h.entries === 'function') {
            const found = [];
            for (const e of h.entries()) {
                if (String(e[0]).toLowerCase() === 'set-cookie') found.push(String(e[1]));
            }
            if (found.length) v = found;
        }
        if (v) {
            if (Array.isArray(v)) list = v.slice();
            else list = String(v).split(/,(?=\s*[A-Za-z0-9_\-\.]+=)/);
        }
    } catch (e) {}
    return list;
}

function storeCookies(list) {
    for (let i = 0; i < list.length; i++) {
        const pair = String(list[i]).split(';')[0];
        const eq = pair.indexOf('=');
        if (eq > 0) _jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    }
}

async function httpGet(url, headers) {
    const h = {};
    const src = headers || apiHeaders;
    Object.keys(src).forEach(k => { h[k] = src[k]; });
    const ck = cookieHeader();
    if (ck) h['Cookie'] = ck;
    const res = await fetch(url, { headers: h });
    const status = res.status || 200;
    const text = await res.text();
    const sc = readSetCookies(res);
    storeCookies(sc);
    return { status: status, text: text, setCookies: sc.length };
}

// Coba tangkap cookie dari kunjungan halaman (hanya berguna kalau engine app membolehkan)
async function bootstrapCookies() {
    if (Date.now() - _bootAt < 120000) return;
    _bootAt = Date.now();
    try {
        const r = await httpGet(SITE + '/komik/list', htmlHeaders);
        _bootInfo = 'boot=' + r.status + ' len=' + String(r.text || '').length + ' sc=' + r.setCookies;
    } catch (e) {
        _bootInfo = 'boot=ERR ' + errMsg(e).slice(0, 50);
    }
}

// ---------- session (token + sign) - jalur API ----------

const _sess = {};
let _apiDownUntil = 0; // setelah session gagal, API dilewati sebentar agar fallback langsung jalan

function tryParseSession(r) {
    const body = String(r.text || '');
    if (r.status < 200 || r.status >= 300 || !body.trim()) return null;
    try {
        const d = JSON.parse(body);
        if (d && d.token && d.sign) return d;
    } catch (e) {}
    return null;
}

async function getSession(kind, force) {
    const cur = _sess[kind];
    if (!force && cur && Number(cur.ex) > Date.now() + 5000) return cur;

    const url = SESSION_URLS[kind];
    let r = await httpGet(url, siteJsonHeaders);
    let d = tryParseSession(r);

    if (!d) {
        await bootstrapCookies();
        r = await httpGet(url, siteJsonHeaders);
        d = tryParseSession(r);
    }
    if (!d) {
        _apiDownUntil = Date.now() + 90000;
        throw new Error('SESSION ' + kind + ' ditolak (status ' + r.status + ' len=' + String(r.text || '').length + ' ' + _bootInfo + ')');
    }
    d.sign = String(d.sign).split('|oiq&')[0];
    _sess[kind] = d;
    return d;
}

async function apiGet(path, kind) {
    if (Date.now() < _apiDownUntil) throw new Error('API dilewati (session baru saja gagal)');
    const k = kind || 'list';
    for (let attempt = 0; attempt < 2; attempt++) {
        const s = await getSession(k, attempt > 0);
        const h = {};
        Object.keys(apiHeaders).forEach(n => { h[n] = apiHeaders[n]; });
        h['X-Token'] = s.token;
        h['X-Sign'] = s.sign;
        if (s.contentAccess && s.contentAccess.token && s.contentAccess.sign) {
            h['X-Content-Token'] = s.contentAccess.token;
            h['X-Content-Sign'] = s.contentAccess.sign;
        }
        const r = await httpGet(API + path, h);
        const body = String(r.text || '');
        const empty = !body.trim();
        if ((r.status === 401 || r.status === 403 || empty) && attempt === 0) {
            _sess[k] = null;
            continue;
        }
        if (r.status < 200 || r.status >= 300) {
            throw new Error('API HTTP ' + r.status + ' | ' + body.slice(0, 60));
        }
        if (empty) throw new Error('API kosong (status ' + r.status + ')');
        return parseJson(body);
    }
    throw new Error('Session ditolak server (401/403)');
}

// Panggil API, kembalikan null kalau gagal (error dicatat ke diagnosa)
async function tryApi(path, kind) {
    try {
        return await apiGet(path, kind);
    } catch (e) {
        note('API ' + path.split('?')[0].slice(0, 36) + ': ' + errMsg(e).slice(0, 80));
        return null;
    }
}

// ---------- jalur tanpa cookie: halaman web + __NEXT_DATA__ ----------

let _buildId = '';

async function fetchPage(url) {
    const r = await httpGet(url, htmlHeaders);
    const m = String(r.text || '').match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    let data = null;
    if (m) {
        try { data = parseJson(m[1]); } catch (e) { data = null; }
    }
    if (data && data.buildId) _buildId = data.buildId;
    return { status: r.status, html: String(r.text || ''), data: data };
}

// Data mentah Next.js (/_next/data/<buildId>/...json), butuh buildId dari salah satu halaman
async function fetchNextJson(route) {
    if (!_buildId) {
        try { await fetchPage(SITE + '/komik/list'); } catch (e) {}
    }
    if (!_buildId) return null;
    const h = {};
    Object.keys(siteJsonHeaders).forEach(k => { h[k] = siteJsonHeaders[k]; });
    h['x-nextjs-data'] = '1';
    const r = await httpGet(SITE + '/_next/data/' + _buildId + route, h);
    if (!String(r.text || '').trim()) return null;
    try { return parseJson(r.text); } catch (e) { return null; }
}

function walk(obj, depth, fn) {
    if (!obj || typeof obj !== 'object' || depth > 9) return;
    fn(obj);
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) walk(obj[keys[i]], depth + 1, fn);
}

// Objek komik tunggal (halaman detail)
function findComic(obj) {
    let found = null;
    walk(obj, 0, o => {
        if (!found && !Array.isArray(o) && o.title_slug && o.title) found = o;
    });
    return found;
}

// Semua objek komik (halaman daftar / hasil pencarian)
function collectComics(obj) {
    const out = [];
    const seen = {};
    walk(obj, 0, o => {
        if (Array.isArray(o)) return;
        const id = o.title_slug || o.slug;
        if (id && o.title && typeof id === 'string' && !seen[id]) {
            seen[id] = true;
            out.push(o);
        }
    });
    return out;
}

// Semua item chapter: array objek yang punya field "chapter"
function collectChapters(obj) {
    let all = [];
    walk(obj, 0, o => {
        if (Array.isArray(o) && o.length && o[0] && typeof o[0] === 'object' &&
            o[0].chapter !== undefined && o[0].chapter !== null) {
            all = all.concat(o);
        }
    });
    return all;
}

const IMG_RE = /^(https?:)?\/\/[^\s"']+\.(jpe?g|png|webp|gif|avif)(\?[^\s"']*)?$/i;

function findImages(obj) {
    let best = null;
    walk(obj, 0, o => {
        if (!Array.isArray(o)) {
            if (Array.isArray(o.imageSrc) && o.imageSrc.length) best = best && best.pref ? best : { arr: o.imageSrc, pref: true };
            return;
        }
        if (o.length && typeof o[0] === 'string') {
            const ok = o.filter(u => IMG_RE.test(String(u)));
            if (ok.length >= 2 && (!best || (!best.pref && ok.length > best.arr.length))) best = { arr: ok, pref: false };
        }
    });
    return best ? best.arr : [];
}

function imagesFromHtml(html) {
    const re = /(?:https?:)?\/\/[^\s"'\\<>()]+\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'\\<>()]*)?/gi;
    const seen = {};
    const out = [];
    let m;
    while ((m = re.exec(html))) {
        const u = m[0];
        if (seen[u] || /cover|icon|logo|avatar|banner|favicon|thumb/i.test(u)) continue;
        seen[u] = true;
        out.push(u);
    }
    return out.length >= 2 ? out : [];
}

function pageSlugOf(slug) {
    return /-bahasa-indonesia$/.test(slug) ? slug : slug + '-bahasa-indonesia';
}

function mapRows(rows) {
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
    return list;
}

const _firstSlug = {}; // slug pertama halaman 1 per query, untuk mendeteksi halaman yang sama berulang

async function listFallback(p, q) {
    // 1) endpoint pencarian milik situs sendiri (tanpa token)
    if (q) {
        try {
            const r = await httpGet(SITE + '/api/content/search?name=' + enc(q) + (p > 1 ? '&page=' + p : ''), siteJsonHeaders);
            if (String(r.text || '').trim()) {
                const rows = collectComics(parseJson(r.text));
                // Endpoint menjawab valid: kosong berarti memang tidak ada hasil, jangan jatuh ke daftar umum
                return rows;
            } else {
                note('search: kosong (status ' + r.status + ')');
            }
        } catch (e) {
            note('search: ' + errMsg(e).slice(0, 60));
        }
    }
    // 2) halaman daftar (SSR) -> __NEXT_DATA__
    const qs = (p > 1 ? 'page=' + p : '') + (q ? (p > 1 ? '&' : '') + 'name=' + enc(q) : '');
    try {
        const pg = await fetchPage(SITE + '/komik/list' + (qs ? '?' + qs : ''));
        const rows = pg.data ? collectComics(pg.data) : [];
        if (rows.length) return rows;
        note('list html: ' + (pg.data ? '0 komik' : 'tanpa NEXT_DATA') + ' len=' + pg.html.length);
    } catch (e) {
        note('list html: ' + errMsg(e).slice(0, 60));
    }
    // 3) data JSON Next.js
    try {
        const j = await fetchNextJson('/komik/list.json' + (qs ? '?' + qs : ''));
        const rows = j ? collectComics(j) : [];
        if (rows.length) return rows;
        note('next json: ' + (j ? '0 komik' : 'tidak ada'));
    } catch (e) {
        note('next json: ' + errMsg(e).slice(0, 60));
    }
    return [];
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
            let rows = null;
            const json = await tryApi(path);
            let apiOk = false;
            if (json) {
                apiOk = true;
                rows = Array.isArray(json) ? json : (json.data || []);
            }

            if (!rows || rows.length === 0) {
                if (apiOk && (q || p > 1)) return { manga_list: [] };
                const fb = await listFallback(p, q);
                if (fb.length) {
                    rows = fb;
                    // halaman >1 yang isinya sama dengan halaman 1 = fallback tidak mendukung paging
                    const key = q + '#';
                    const first = fb[0].title_slug || fb[0].slug;
                    if (p === 1) _firstSlug[key] = first;
                    else if (_firstSlug[key] === first) return { manga_list: [] };
                } else {
                    if (q || p > 1) return { manga_list: [] };
                    return debugCard('DEBUG: daftar kosong | ' + diag());
                }
            }

            const list = mapRows(rows);
            if (list.length === 0) {
                return debugCard('DEBUG: field slug tidak ketemu, keys=' + Object.keys(rows[0]).join(',').slice(0, 150));
            }
            return { manga_list: list };
        } catch (e) {
            return debugCard('ERROR: ' + errMsg(e).slice(0, 150) + ' | ' + diag());
        }
    },

    // Detail komik + semua chapter. slug = title_slug
    async getDetail(slug) {
        let comic = null;
        let pageChapters = [];
        try {
            const pg = await fetchPage(SITE + '/' + pageSlugOf(slug));
            if (pg.data) {
                comic = findComic(pg.data);
                pageChapters = collectChapters(pg.data);
            } else {
                note('detail html: tanpa NEXT_DATA len=' + pg.html.length);
            }
        } catch (e) {
            note('detail html: ' + errMsg(e).slice(0, 60));
        }
        const s = comic || {};

        let all = [];
        const ch = await tryApi('/komik/' + enc(slug) + '/chapter?limit=9999999');
        if (ch) all = [].concat(ch.chapter || [], ch.newChapter || [], ch.startChapter || []);
        if (!all.length) all = pageChapters;
        if (!all.length) {
            try {
                const j = await fetchNextJson('/' + pageSlugOf(slug) + '.json');
                if (j) all = collectChapters(j);
            } catch (e) {
                note('detail json: ' + errMsg(e).slice(0, 60));
            }
        }
        if (!all.length) {
            throw new Error('Daftar chapter kosong | ' + diag());
        }

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
        if (parts.length < 2 || !parts[1]) {
            throw new Error('ID chapter tidak valid: ' + chapterId);
        }
        const fix = u => (String(u).indexOf('//') === 0 ? 'https:' + u : String(u));

        // 1) API (butuh session)
        if (parts[2]) {
            const json = await tryApi('/komik/' + enc(parts[0]) + '/chapter/' + enc(parts[1]) + '/imgs/' + enc(parts[2]), 'chapter');
            const imgs = json && Array.isArray(json.imageSrc) ? json.imageSrc : [];
            if (imgs.length) return imgs.map(fix);
        }

        // 2) halaman reader: __NEXT_DATA__, data JSON Next.js, lalu HTML mentah
        const slugs = [pageSlugOf(parts[0]), parts[0]].filter((v, i, a) => a.indexOf(v) === i);
        for (let i = 0; i < slugs.length; i++) {
            const route = '/' + slugs[i] + '/chapter/' + parts[1];
            try {
                const pg = await fetchPage(SITE + route);
                let imgs = pg.data ? findImages(pg.data) : [];
                if (!imgs.length) imgs = imagesFromHtml(pg.html);
                if (imgs.length) return imgs.map(fix);
                note('reader ' + slugs[i].slice(0, 20) + ': ' + pg.status + ' len=' + pg.html.length + (pg.data ? '' : ' no-ND'));
            } catch (e) {
                note('reader: ' + errMsg(e).slice(0, 60));
            }
            try {
                const j = await fetchNextJson(route + '.json');
                const imgs = j ? findImages(j) : [];
                if (imgs.length) return imgs.map(fix);
            } catch (e) {}
        }
        throw new Error('Gambar chapter tidak ditemukan | ' + diag());
    }
};
  
