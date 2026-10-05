// ID: ext_softkomik
// NAME: Softkomik
// VERSION: 1.0.0
// COLOR: #F59E0B
// ICON: https://softkomik.co/icon.jpg
// REFERER: https://softkomik.co/

const SITE = 'https://softkomik.co';
const API = 'https://api.softkomik.org';
const COVER_BASE = 'https://cover.softdevices.my.id/softkomik-cover';
const SUFFIX = '-bahasa-indonesia';
const SAMPLE_SLUG = 'the-demon-king-s-friend';

// Token terikat ke User-Agent, jadi UA yang sama dipakai di semua request
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';

const apiHeaders = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Referer': SITE + '/komik/list',
    'Origin': SITE
};

// Endpoint di softkomik.co sendiri (same-origin GET, browser tidak mengirim Origin)
const siteJsonHeaders = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': SITE + '/komik/list',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty'
};

const htmlHeaders = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': SITE + '/'
};

const jsHeaders = {
    'User-Agent': UA,
    'Accept': '*/*',
    'Referer': SITE + '/'
};

// ==========================================
// 1. UTIL
// ==========================================

function parseJson(text) {
    try {
        return JSON.parse(text);
    } catch (e1) {
        try {
            return JSON.parse(String(text).replace(/^\uFEFF/, '').replace(/[\u0000-\u001F]/g, ' '));
        } catch (e2) {
            throw new Error('JSON gagal: ' + errMsg(e2) + ' | len=' + String(text).length + ' | awal=' + String(text).slice(0, 80));
        }
    }
}

function enc(s) {
    return encodeURIComponent(String(s == null ? '' : s));
}

function errMsg(e) {
    return String(e && e.message ? e.message : e);
}

function decodeEntities(s) {
    return String(s || '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ');
}

function stripHtml(s) {
    return decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Buang blok <script>...</script> / <style>...</style> tanpa regex malas
function removeBlocks(html, tag) {
    let s = String(html || '');
    const open = '<' + tag;
    const close = '</' + tag + '>';
    let out = '';
    while (true) {
        const i = s.indexOf(open);
        if (i < 0) {
            out += s;
            break;
        }
        out += s.slice(0, i);
        const j = s.indexOf(close, i);
        if (j < 0) break;
        s = s.slice(j + close.length);
    }
    return out;
}

function textOf(html) {
    return stripHtml(removeBlocks(removeBlocks(html, 'script'), 'style'));
}

// Ambil nilai atribut dari string tag pembuka, mis. attr('<a href="/x">', 'href')
function attr(tag, name) {
    const key = ' ' + name + '=';
    const i = String(tag).indexOf(key);
    if (i < 0) return '';
    const start = i + key.length;
    const q = tag.charAt(start);
    if (q !== '"' && q !== "'") return '';
    const j = tag.indexOf(q, start + 1);
    if (j < 0) return '';
    return decodeEntities(tag.slice(start + 1, j));
}

function metaContent(html, prop) {
    const parts = String(html).split('<meta ');
    for (let i = 1; i < parts.length; i++) {
        const gt = parts[i].indexOf('>');
        if (gt < 0) continue;
        const tag = '<meta ' + parts[i].slice(0, gt + 1);
        if (attr(tag, 'property') === prop || attr(tag, 'name') === prop) return attr(tag, 'content');
    }
    return '';
}

// Iterasi semua <a ...>isi</a>
function eachAnchor(html, fn) {
    const parts = String(html).split('<a ');
    for (let i = 1; i < parts.length; i++) {
        const chunk = parts[i];
        const gt = chunk.indexOf('>');
        if (gt < 0) continue;
        const end = chunk.indexOf('</a>', gt);
        const inner = end < 0 ? chunk.slice(gt + 1, gt + 600) : chunk.slice(gt + 1, end);
        fn(attr('<a ' + chunk.slice(0, gt + 1), 'href'), inner);
    }
}

function baseSlug(slug) {
    const s = String(slug || '');
    const n = s.length - SUFFIX.length;
    if (n > 0 && s.lastIndexOf(SUFFIX) === n) return s.slice(0, n);
    return s;
}

function pageSlugOf(slug) {
    return baseSlug(slug) + SUFFIX;
}

function slugFromHref(href) {
    let h = String(href || '');
    if (h.indexOf(SITE) === 0) h = h.slice(SITE.length);
    if (h.charAt(0) === '/') h = h.slice(1);
    if (!h || h.indexOf('/') >= 0 || h.indexOf('?') >= 0 || h.indexOf('#') >= 0) return '';
    const n = h.length - SUFFIX.length;
    if (n <= 0 || h.lastIndexOf(SUFFIX) !== n) return '';
    return h.slice(0, n);
}

function humanize(slug) {
    return baseSlug(slug).replace(/-/g, ' ');
}

// /_next/image?url=<encoded>&w=640 -> url asli
function unwrapImg(u) {
    const s = decodeEntities(u);
    const k = s.indexOf('/_next/image');
    if (k >= 0) {
        const q = s.indexOf('url=', k);
        if (q >= 0) {
            let v = s.slice(q + 4);
            const amp = v.indexOf('&');
            if (amp >= 0) v = v.slice(0, amp);
            try {
                return decodeURIComponent(v);
            } catch (e) {
                return v;
            }
        }
    }
    return s;
}

function coverUrl(m) {
    const raw = (m && (m.gambar || m.cover || m.cover_url || m.thumbnail || m.image)) || '';
    const p = unwrapImg(raw);
    if (!p) return '';
    if (p.indexOf('http') === 0) return p;
    if (p.indexOf('//') === 0) return 'https:' + p;
    return COVER_BASE + (p.charAt(0) === '/' ? '' : '/') + p;
}

// URL reader memakai nomor 3 digit: 1 -> 001, 88.1 -> 088.1
function pad3(n) {
    const s = String(n);
    const m = s.match(/^(\d+)(\.\d+)?$/);
    if (!m) return s;
    let i = m[1];
    while (i.length < 3) i = '0' + i;
    return i + (m[2] || '');
}

// 082 -> 82, 009.2 -> 9.2, 000 -> 0 (untuk tampilan)
function unpad(n) {
    let s = String(n);
    while (s.length > 1 && s.charAt(0) === '0' && s.charAt(1) !== '.') s = s.slice(1);
    return s;
}

function debugCard(text) {
    return { manga_list: [{ id: 'debug', title: '[Softkomik] ' + text, cover_url: '', rating: '0.0', views: '-' }] };
}

// Catatan diagnosa singkat, ikut tampil di kartu error supaya penyebabnya kelihatan
const _diag = [];
function note(s) {
    _diag.push(String(s).slice(0, 150));
    if (_diag.length > 8) _diag.shift();
}
function diag() {
    return _diag.join(' ; ');
}

// ==========================================
// 2. HTTP
// ==========================================

async function httpGet(url, headers) {
    const res = await fetch(url, { headers: headers || apiHeaders });
    const status = res.status || 200;
    const text = await res.text();
    return { status: status, text: String(text || '') };
}

// ==========================================
// 3. SESSION (token + sign) untuk API
// ==========================================

const SESSION_URLS = {
    list: SITE + '/api/session/aksjkas',
    chapter: SITE + '/api/session/chapter/oaisos'
};

const _sess = {};
let _apiDownUntil = 0; // setelah session gagal, API dilewati sebentar agar fallback langsung jalan
let _discovered = false;
let _lastSlug = SAMPLE_SLUG;

function tryParseSession(r) {
    const body = String(r.text || '');
    if (r.status < 200 || r.status >= 300 || !body.trim()) return null;
    try {
        const d = JSON.parse(body);
        if (d && d.token && d.sign) return d;
    } catch (e) {}
    return null;
}

function scriptSrcs(html) {
    const parts = String(html).split('<script');
    const out = [];
    for (let i = 1; i < parts.length; i++) {
        const gt = parts[i].indexOf('>');
        if (gt < 0) continue;
        const src = attr('<script' + parts[i].slice(0, gt + 1), 'src');
        if (!src || src.indexOf('/_next/static/') < 0) continue;
        out.push(src.charAt(0) === '/' ? SITE + src : src);
    }
    return out;
}

// Path session bisa berganti tiap build situs. Baca dari file JS situs sendiri.
async function discoverSession() {
    _discovered = true;
    const pages = [SITE + '/komik/list', SITE + '/' + pageSlugOf(_lastSlug) + '/chapter/001'];
    const seenJs = {};
    let count = 0;
    for (let p = 0; p < pages.length; p++) {
        let html = '';
        try {
            html = (await httpGet(pages[p], htmlHeaders)).text;
        } catch (e) {
            note('disc page: ' + errMsg(e).slice(0, 50));
            continue;
        }
        const srcs = scriptSrcs(html);
        for (let i = 0; i < srcs.length && count < 24; i++) {
            const u = srcs[i];
            if (seenJs[u]) continue;
            seenJs[u] = true;
            if (u.indexOf('framework') >= 0 || u.indexOf('polyfills') >= 0 || u.indexOf('webpack') >= 0) continue;
            count++;
            try {
                const r = await httpGet(u, jsHeaders);
                const found = r.text.match(/\/api\/session[A-Za-z0-9_\/\-]*/g) || [];
                for (let k = 0; k < found.length; k++) {
                    const sp = found[k];
                    if (sp.length < 14 || sp.charAt(sp.length - 1) === '/') continue;
                    if (sp.indexOf('chapter') >= 0) SESSION_URLS.chapter = SITE + sp;
                    else SESSION_URLS.list = SITE + sp;
                }
            } catch (e) {}
        }
    }
    note('disc: list=' + SESSION_URLS.list.slice(SITE.length) + ' ch=' + SESSION_URLS.chapter.slice(SITE.length) + ' js=' + count);
}

async function getSession(kind, force) {
    const cur = _sess[kind];
    if (!force && cur && Number(cur.ex) > Date.now() + 5000) return cur;

    let url = SESSION_URLS[kind];
    let r = await httpGet(url, siteJsonHeaders);
    let d = tryParseSession(r);

    if (!d && !_discovered) {
        await discoverSession();
        if (SESSION_URLS[kind] !== url) {
            url = SESSION_URLS[kind];
            r = await httpGet(url, siteJsonHeaders);
            d = tryParseSession(r);
        }
    }
    if (!d) {
        _apiDownUntil = Date.now() + 90000;
        throw new Error('SESSION ' + kind + ' ditolak (status ' + r.status + ' len=' + String(r.text || '').length + ')');
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
        Object.keys(apiHeaders).forEach(function (n) { h[n] = apiHeaders[n]; });
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

// ==========================================
// 4. JALUR TANPA API: HTML halaman web
// ==========================================

let _buildId = '';

function extractNextData(html) {
    const k = html.indexOf('id="__NEXT_DATA__"');
    if (k < 0) return null;
    const a = html.indexOf('>', k);
    const b = html.indexOf('</script>', a);
    if (a < 0 || b < 0) return null;
    try {
        return parseJson(html.slice(a + 1, b));
    } catch (e) {
        return null;
    }
}

async function fetchPage(url) {
    const r = await httpGet(url, htmlHeaders);
    const data = extractNextData(r.text);
    if (data && data.buildId) _buildId = data.buildId;
    return { status: r.status, html: r.text, data: data };
}

// Data mentah Next.js (/_next/data/<buildId>/...json), butuh buildId dari salah satu halaman
async function fetchNextJson(route) {
    if (!_buildId) {
        try { await fetchPage(SITE + '/komik/list'); } catch (e) {}
    }
    if (!_buildId) return null;
    const h = {};
    Object.keys(siteJsonHeaders).forEach(function (k) { h[k] = siteJsonHeaders[k]; });
    h['x-nextjs-data'] = '1';
    const r = await httpGet(SITE + '/_next/data/' + _buildId + route, h);
    if (!r.text.trim()) return null;
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
    walk(obj, 0, function (o) {
        if (!found && !Array.isArray(o) && o.title_slug && o.title) found = o;
    });
    return found;
}

// Semua objek komik (daftar / hasil pencarian)
function collectComics(obj) {
    const out = [];
    const seen = {};
    walk(obj, 0, function (o) {
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
    walk(obj, 0, function (o) {
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
    walk(obj, 0, function (o) {
        if (!Array.isArray(o)) {
            if (Array.isArray(o.imageSrc) && o.imageSrc.length) {
                best = (best && best.pref) ? best : { arr: o.imageSrc, pref: true };
            }
            return;
        }
        if (o.length && typeof o[0] === 'string') {
            const ok = o.filter(function (u) { return IMG_RE.test(String(u)); });
            if (ok.length >= 2 && (!best || (!best.pref && ok.length > best.arr.length))) {
                best = { arr: ok, pref: false };
            }
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

// Kartu komik dari link <a href="/slug-bahasa-indonesia"> di halaman daftar / home
function parseCards(html) {
    const order = [];
    const map = {};
    eachAnchor(html, function (href, inner) {
        const slug = slugFromHref(href);
        if (!slug) return;
        let rec = map[slug];
        if (!rec) {
            rec = { title_slug: slug, title: '', cover: '', _alt: '' };
            map[slug] = rec;
            order.push(slug);
        }
        const im = inner.indexOf('<img');
        if (im >= 0) {
            const end = inner.indexOf('>', im);
            const tag = inner.slice(im, end < 0 ? inner.length : end + 1);
            const src = attr(tag, 'src') || attr(tag, 'data-src');
            if (src && !rec.cover) rec.cover = unwrapImg(src);
            const alt = attr(tag, 'alt');
            if (alt && !rec._alt) rec._alt = alt.replace(/^Cover\s+/i, '');
        }
        const txt = stripHtml(inner);
        if (txt && !rec.title) rec.title = txt;
    });
    return order.map(function (s) {
        const r = map[s];
        return { title_slug: r.title_slug, title: r.title || r._alt || humanize(r.title_slug), cover: r.cover };
    });
}

// JSON yang tertanam di HTML (Next.js pages / RSC): cari "title_slug" lalu field terdekat
function nearestField(t, idx, name) {
    const key = '"' + name + '":"';
    const lo = Math.max(0, idx - 600);
    const hi = Math.min(t.length, idx + 900);
    let best = -1;
    let bestDist = 1e9;
    let from = lo;
    while (true) {
        const i = t.indexOf(key, from);
        if (i < 0 || i > hi) break;
        const d = Math.abs(i - idx);
        if (d < bestDist) {
            bestDist = d;
            best = i;
        }
        from = i + key.length;
    }
    if (best < 0) return '';
    const start = best + key.length;
    const end = t.indexOf('"', start);
    return end < 0 ? '' : t.slice(start, end);
}

function scanInline(html) {
    const t = String(html).replace(/\\"/g, '"');
    const key = '"title_slug":"';
    const out = [];
    const seen = {};
    let from = 0;
    while (true) {
        const i = t.indexOf(key, from);
        if (i < 0) break;
        from = i + key.length;
        const end = t.indexOf('"', from);
        if (end < 0) break;
        const slug = baseSlug(t.slice(from, end));
        if (!slug || seen[slug]) continue;
        seen[slug] = true;
        out.push({
            title_slug: slug,
            title: nearestField(t, i, 'title') || humanize(slug),
            gambar: nearestField(t, i, 'gambar')
        });
    }
    return out;
}

function parseListHtml(html) {
    let rows = parseCards(html);
    const inl = scanInline(html);
    if (!rows.length) return inl;
    const cov = {};
    for (let i = 0; i < inl.length; i++) {
        if (inl[i].gambar) cov[inl[i].title_slug] = inl[i].gambar;
    }
    for (let j = 0; j < rows.length; j++) {
        if (!rows[j].cover && cov[rows[j].title_slug]) rows[j].cover = cov[rows[j].title_slug];
    }
    return rows;
}

// "Prev 1 / 359 Next" -> 359
function totalPagesOf(html) {
    const m = textOf(html).match(/Prev\s*(\d+)\s*\/\s*(\d+)/i);
    return m ? parseInt(m[2], 10) : 0;
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

const _firstSlug = {}; // slug pertama halaman 1, untuk mendeteksi halaman yang sama berulang

async function listFallback(p, q, category) {
    // 1) pencarian: endpoint situs sendiri (tanpa token)
    if (q) {
        try {
            const r = await httpGet(SITE + '/api/content/search?name=' + enc(q) + (p > 1 ? '&page=' + p : ''), siteJsonHeaders);
            if (r.text.trim()) {
                return { rows: collectComics(parseJson(r.text)), total: 0 };
            }
            note('search: kosong (status ' + r.status + ')');
        } catch (e) {
        
