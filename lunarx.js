const BASE_URL = "https://lunarx.to";
const API_URL = "https://api.lunarx.to";

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Referer": `${BASE_URL}/`
};

// 1. Ubah atau alias-kan fungsi menjadi 'getList'
async function getList(page = 1, query = "") {
  try {
    let url = `${API_URL}/api/v1/manga?page=${page}`;
    if (query) {
      url = `${API_URL}/api/v1/manga/search?q=${encodeURIComponent(query)}&page=${page}`;
    }

    const response = await fetch(url, { headers });
    const json = await response.json();

    const mangaList = (json.data || json.items || json).map((item) => ({
      id: item.slug || item.id,
      title: item.title || item.name,
      cover: item.cover || item.poster || item.image,
      url: `${BASE_URL}/manga/${item.slug || item.id}`
    }));

    return {
      success: true,
      data: mangaList,
      hasNextPage: json.has_next || false
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 2. Sesuaikan juga nama fungsi detail dan reader jika diperlukan oleh aplikasi
async function getDetail(mangaId) {
  // ... kode detail manga ...
}

async function getPages(mangaId, chapterId) {
  // ... kode reader chapter ...
}

// Pastikan mengekspor fungsi dengan nama 'getList'
module.exports = {
  getList,       // <-- Sesuai yang dicari oleh aplikasi
  getDetail,     // <-- Sesuaikan dengan kebutuhan app reader-mu
  getPages       // <-- Sesuaikan dengan kebutuhan app reader-mu
};
