const BASE_URL = "https://lunarx.to";
const API_URL = "https://api.lunarx.to";

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": `${BASE_URL}/`
};

/**
 * 1. SEARCH / GET LIST
 */
async function search(query = "", page = 1) {
  try {
    let url = `${API_URL}/api/v1/manga?page=${page}`;
    if (query && query.trim() !== "") {
      url = `${API_URL}/api/v1/manga/search?q=${encodeURIComponent(query)}&page=${page}`;
    }

    const res = await fetch(url, { headers });
    const json = await res.json();
    const items = json.data || json.items || json || [];

    const list = items.map((item) => ({
      id: String(item.slug || item.id),
      title: item.title || item.name || "Untitled",
      cover: item.cover || item.poster || item.image || "",
      url: `${BASE_URL}/manga/${item.slug || item.id}`
    }));

    return {
      status: true,
      data: list,
      hasNextPage: json.has_next || false
    };
  } catch (err) {
    return {
      status: false,
      message: err.message,
      data: []
    };
  }
}

/**
 * 2. GET DETAIL
 */
async function getDetail(mangaId) {
  try {
    const url = `${API_URL}/api/v1/manga/${mangaId}`;
    const res = await fetch(url, { headers });
    const json = await res.json();
    const data = json.data || json;

    const chapters = (data.chapters || []).map((ch) => ({
      id: String(ch.slug || ch.id || ch.number),
      title: ch.title || `Chapter ${ch.number}`,
      url: `${BASE_URL}/manga/${mangaId}/${ch.slug || ch.number}`
    }));

    return {
      status: true,
      data: {
        id: String(mangaId),
        title: data.title || "",
        cover: data.cover || data.poster || "",
        synopsis: data.synopsis || data.description || "",
        author: data.author || "Unknown",
        status: data.status || "Ongoing",
        genres: data.genres || [],
        chapters: chapters
      }
    };
  } catch (err) {
    return {
      status: false,
      message: err.message
    };
  }
}

/**
 * 3. GET PAGES / READER
 */
async function getPages(mangaId, chapterId) {
  try {
    const url = `${API_URL}/api/v1/manga/${mangaId}/chapter/${chapterId}`;
    const res = await fetch(url, { headers });
    const json = await res.json();
    const data = json.data || json;

    const pages = (data.images || data.pages || []).map((img) => {
      return typeof img === "string" ? img : img.url || img.src;
    });

    return {
      status: true,
      data: pages
    };
  } catch (err) {
    return {
      status: false,
      message: err.message,
      data: []
    };
  }
}

// FORMAT EXPORT SESUAI DENGAN WESTMANGA & WEBTOON JS
exports.default = {
  search,
  getList: search,
  getDetail,
  getPages
};
