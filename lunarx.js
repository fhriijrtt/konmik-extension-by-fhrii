const BASE_URL = "https://lunarx.to";
const API_URL = "https://api.lunarx.to"; // Subdomain API utama

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": `${BASE_URL}/`
};

/**
 * 1. MANGA LIST SCREEN
 * Mengambil daftar manga (populer/terbaru/search/filter)
 */
async function getMangaList(page = 1, query = "") {
  try {
    let url = `${API_URL}/api/v1/manga?page=${page}`;
    if (query) {
      url = `${API_URL}/api/v1/manga/search?q=${encodeURIComponent(query)}&page=${page}`;
    }

    const response = await fetch(url, { headers });
    const json = await response.json();

    // Mapping response JSON ke format standar ekstensi
    const mangaList = (json.data || json.items || json).map((item) => ({
      id: item.slug || item.id,
      title: item.title || item.name,
      cover: item.cover || item.poster || item.image,
      url: `${BASE_URL}/manga/${item.slug || item.id}`,
      type: item.type || "Manga",
      latestChapter: item.latest_chapter || item.lastChapter || ""
    }));

    return {
      success: true,
      data: mangaList,
      hasNextPage: json.has_next || json.page < json.total_pages
    };
  } catch (error) {
    console.error("Error fetching Manga List:", error);
    return { success: false, error: error.message };
  }
}

/**
 * 2. MANGA DETAIL SCREEN
 * Mengambil detail manga (sinopsis, status, genre, & list chapter)
 */
async function getMangaDetail(mangaId) {
  try {
    const url = `${API_URL}/api/v1/manga/${mangaId}`;
    const response = await fetch(url, { headers });
    const json = await response.json();

    const data = json.data || json;

    // Mapping detail manga & daftar chapter
    const detail = {
      id: mangaId,
      title: data.title,
      cover: data.cover || data.poster,
      author: data.author || "Unknown",
      status: data.status || "Ongoing", // Ongoing / Completed
      synopsis: data.synopsis || data.description || "",
      genres: data.genres || [],
      chapters: (data.chapters || []).map((ch) => ({
        id: ch.slug || ch.id || ch.number,
        title: ch.title || `Chapter ${ch.number}`,
        number: ch.number,
        updatedAt: ch.created_at || ch.date || "",
        url: `${BASE_URL}/manga/${mangaId}/${ch.slug || ch.number}`
      }))
    };

    return {
      success: true,
      data: detail
    };
  } catch (error) {
    console.error("Error fetching Manga Detail:", error);
    return { success: false, error: error.message };
  }
}

/**
 * 3. READER SCREEN
 * Mengambil daftar URL gambar halaman dari suatu chapter
 */
async function getReader(mangaId, chapterId) {
  try {
    const url = `${API_URL}/api/v1/manga/${mangaId}/chapter/${chapterId}`;
    const response = await fetch(url, { headers });
    const json = await response.json();

    const data = json.data || json;

    // Menarik daftar URL gambar
    const images = (data.images || data.pages || []).map((img, index) => {
      // Jika response hanya berupa string URL
      if (typeof img === "string") return img;
      // Jika response berupa object
      return img.url || img.src;
    });

    return {
      success: true,
      mangaId: mangaId,
      chapterId: chapterId,
      pagesCount: images.length,
      images: images // Array URL gambar halaman manga
    };
  } catch (error) {
    console.error("Error fetching Chapter Images:", error);
    return { success: false, error: error.message };
  }
}

// Export module untuk dipakai di runtime ekstensi kamu
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getMangaList,
    getMangaDetail,
    getReader
  };
}
