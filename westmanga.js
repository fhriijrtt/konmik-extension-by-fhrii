// ID: ext_westmanga
// NAME: WestManga
// VERSION: 1.0.0
// COLOR: #B91C1C
// ICON: https://v1.westmanga.my/assets/logo.webp
// REFERER: https://v1.westmanga.my/

const API = 'https://data.mantweh.online';
const SITE = 'https://v1.westmanga.my';
const ACCESS_KEY = 'WM_WEB_FRONT_END';
const SECRET = 'xxxoidj';
const HMAC_MESSAGE = 'wm-api-request';

// ==========================================
// 1. SHA-256 + HMAC (JS murni, engine KonMik tidak punya crypto)
// ==========================================

function utf8(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c < 0x80) {
            out.push(c);
        } else if (c < 0x800) {
            out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        } else if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length) {
            const c2 = str.charCodeAt(++i);
            const cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
            out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        } else {
            out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        }
    }
    return out;
}

const K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256(bytes) {
    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const msg = bytes.slice();
    const bitLen = bytes.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    const hi = Math.floor(bitLen / 4294967296);
    const lo = bitLen >>> 0;
    msg.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
    msg.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

    const w = new Array(64);
    for (let off = 0; off < msg.length; off += 64) {
        for (let i = 0; i < 16; i++) {
            w[i] = ((msg[off + i * 4] << 24) | (msg[off + i * 4 + 1] << 16) | (msg[off + i * 4 + 2] << 8) | msg[off + i * 4 + 3]) | 0;
        }
        for (let i = 16; i < 64; i++) {
            const a = w[i - 15], b = w[i - 2];
            const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
            const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
        for (let i = 0; i < 64; i++) {
            const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + S1 + ch + K256[i] + w[i]) | 0;
            const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) | 0;
            hh = g; g = f; f = e; e = (d + t1) | 0;
            d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
        h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    const out = [];
    for (let i = 0; i < 8; i++) {
        out.push((h[i] >>> 24) & 255, (h[i] >>> 16) & 255, (h[i] >>> 8) & 255, h[i] & 255);
    }
    return out;
}

function toHex(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return s;
}

function hmacSha256Hex(keyStr, msgStr) {
    let key = utf8(keyStr);
    if (key.length > 64) key = sha256(key);
    while (key.length < 64) key.push(0);
    const ipad = [], opad = [];
    for (let i = 0; i < 64; i++) {
        ipad.push(key[i] ^ 0x36);
        opad.push(key[i] ^ 0x5c);
    }
    const inner = sha256(ipad.concat(utf8(msgStr)));
    return toHex(sha256(opad.concat(inner)));
}

// ==========================================
// 2. REQUEST BERTANDA TANGAN
// ==========================================

function pathOf(url) {
    // ambil pathname saja (tanpa domain dan query), sama seperti new URL(url).pathname
    let p = url.replace(/^https?:\/\/[^\/]+/, '');
    const q = p.indexOf('?');
    if (q >= 0) p = p.slice(0, q);
    const h = p.indexOf('#');
    if (h >= 0) p = p.slice(0, h);
    return p;
}

function signedHeaders(url) {
    const ts = Math.floor(Date.now() / 1000).toString();
    const key = ts + 'GET' + pathOf(url) + ACCESS_KEY + SECRET;
    const sig = hmacSha256Hex(key, HMAC_MESSAGE);
    return {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
        'Referer': SITE + '/',
        'Origin': SITE,
        'Accept': 'application/json',
        'Authorization': 'Bearer Bearer HAHAHA Jones',
        'x-wm-accses-key': ACCESS_KEY,
        'x-wm-request-time': ts,
        'x-wm-request-signature': sig
    };
}

async function api(path) {
    const url = API + path;
    const res = await fetch(url, { headers: signedHeaders(url) });
    const status = res.status || 200;
    const text = await res.text();
    if (status < 200 || status >= 300) {
        throw new Error('HTTP ' + status + ' ' + path + ' | ' + text.slice(0, 100));
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        try {
            return JSON.parse(text.replace(/^\uFEFF/, '').replace(/[\u0000-\u001F]/g, ' '));
        } catch (e2) {
            throw new Error('JSON gagal | len=' + text.length + ' | awal=' + text.slice(0, 80));
        }
    }
}

function fullUrl(u) {
    if (!u) return '';
    if (u.startsWith('http')) return u;
    return 'https://storage.westmanga.blog' + (u.startsWith('/') ? '' : '/') + u;
}

function dateText(v) {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') return v.formatted || (v.time ? new Date(v.time * (v.time < 1e12 ? 1000 : 1)).toISOString() : '');
    return String(v);
}

function debugCard(msg) {
    return { manga_list: [{ id: 'debug', title: msg, cover_url: '', rating: '0.0', views: '-' }] };
}

// ==========================================
// 3. KONTRAK WAJIB KONMIK EXTENSION
// ==========================================

const KonmikExtension = {

    async getList(page, query, filters) {
        const p = page || 1;
        let path = '/api/contents?page=' + p + '&per_page=40&project=false';
        if (query) path = '/api/contents?q=' + encodeURIComponent(query) + '&page=' + p + '&per_page=40&project=false';

        try {
            const json = await api(path);
            let rows = json.data;
            if (rows && !Array.isArray(rows) && Array.isArray(rows.data)) rows = rows.data;
            if (!Array.isArray(rows)) {
                return debugCard('DEBUG: bentuk data tak dikenal, key=' + Object.keys(json).join(','));
            }
            const list = rows.map(m => ({
                id: m.slug,
                title: m.title,
                cover_url: fullUrl(m.cover),
                rating: m.rating ? String(m.rating) : '0.0',
                views: (m.total_views || m.totalViews) ? String(m.total_views || m.totalViews) : '-'
            }));
            if (list.length === 0) return debugCard('DEBUG: data kosong (page ' + p + ')');
            return { manga_list: list };
        } catch (e) {
            return debugCard('ERROR: ' + String(e && e.message ? e.message : e).slice(0, 150));
        }
    },

    async getDetail(slug) {
        const json = await api('/api/comic/' + slug);
        const d = json.data || json;

        let rows = d.chapters || [];
        rows = rows.slice().sort((a, b) => (parseFloat(b.number) || 0) - (parseFloat(a.number) || 0));
        const chapters = rows.map(c => ({
            id: c.slug,
            title: c.title || c.name || ('Chapter ' + c.number),
            date: dateText(c.updated_at || c.created_at)
        }));

        let genres = [];
        if (Array.isArray(d.genres)) {
            genres = d.genres.map(g => (typeof g === 'string' ? g : (g.name || ''))).filter(Boolean);
        }

        return {
            title: d.title,
            cover_url: fullUrl(d.cover),
            description: (d.synopsis || d.description || 'Tidak ada deskripsi').replace(/<[^>]*>/g, '').trim(),
            rating: d.rating ? String(d.rating) : '0.0',
            views: (d.total_views || d.totalViews) ? String(d.total_views || d.totalViews) : '-',
            genres: genres,
            author: d.author || '?',
            artist: d.artist || d.author || '?',
            chapters: chapters
        };
    },

    async getChapterImages(chapterSlug) {
        const paths = ['/api/v/' + chapterSlug, '/api/chapters/' + chapterSlug, '/api/chapter/' + chapterSlug];
        const errors = [];
        for (const path of paths) {
            try {
                const json = await api(path);
                const d = json.data || json;
                let imgs = d.images || d.content_urls || d.pages || (Array.isArray(d) ? d : null);
                if (Array.isArray(imgs) && imgs.length > 0) {
                    return imgs.map(i => fullUrl(typeof i === 'string' ? i : (i.url || i.src || '')));
                }
                errors.push(path + ': tanpa gambar, key=' + Object.keys(d).join(','));
            } catch (e) {
                errors.push(path + ': ' + String(e && e.message ? e.message : e).slice(0, 80));
            }
        }
        throw new Error('Gambar tidak ditemukan | ' + errors.join(' || '));
    }
};
