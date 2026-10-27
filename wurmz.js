// ID: ext_wurmz
// NAME: Wurmz
// VERSION: 1.5.0
// COLOR: #FF5722
// ICON: https://wurmz.net/favicon.ico
// REFERER: https://wurmz.net/

var BASE = 'https://wurmz.net';
var headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': BASE + '/'
};

async function fetchHtml(url) {
  var res = await fetch(url, { headers: headers });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.text();
}

var KonmikExtension = {
  async getList(page, query, filters) {
    var p = page || 1;
    var url = query ? BASE + '/page/' + p + '/?s=' + encodeURIComponent(query) : BASE + '/manga/?page=' + p + '&order=update';
    
    try {
      var html = await fetchHtml(url);
      var htmlLower = html.toLowerCase();
      
      // Deteksi proteksi
      if (htmlLower.indexOf('cloudflare') !== -1 || htmlLower.indexOf('just a moment') !== -1) {
        return { manga_list: [{ id: 'debug', title: 'TERBLOKIR: Kena Cloudflare/Anti-bot', cover_url: '', rating: '0.0', views: '-' }] };
      }
      
      // Ambil 60 karakter pertama HTML untuk diintip
      var snippet = html.substring(0, 60).replace(/\s+/g, ' ').replace(/</g, '[').replace(/>/g, ']');
      return { manga_list: [{ id: 'debug', title: 'Isi HTML: ' + snippet, cover_url: '', rating: '0.0', views: '-' }] };
      
    } catch (e) {
      return { manga_list: [{ id: 'debug', title: 'ERROR: ' + e.message, cover_url: '', rating: '0.0', views: '-' }] };
    }
  },
  
  async getDetail(urlPath) { return { title: 'Test', chapters: [] }; },
  async getChapterImages(chapterUrl) { return []; }
};
