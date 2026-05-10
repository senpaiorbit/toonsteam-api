export function normalizeImageUrl(src) {
  if (!src) return null;
  src = src.trim();
  // Protocol-relative  → https
  if (src.startsWith("//")) return "https:" + src;
  // Already absolute
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  // Relative path — prepend origin placeholder so callers know it's relative
  if (src.startsWith("/")) return "https://toonstream.vip" + src;
  return src;
}

export function extractSlugFromUrl(url) {
  if (!url) return null;
  return url.replace(/\/$/, "").split("/").pop();
}

export function parsePostCard($, el) {
  const $el = $(el);
  const url = $el.find("a.lnk-blk").attr("href") || null;
  const title = $el.find(".entry-title").text().trim();
  const image = normalizeImageUrl($el.find("img").first().attr("src"));
  const rating = $el.find(".vote").text().replace("TMDB", "").trim() || null;
  const id = $el.closest("li[id]").attr("id") || null;

  let contentType = "series";
  if (url?.includes("/movies/")) contentType = "movie";
  else if (url?.includes("/episode/")) contentType = "episode";

  const liClass = $el.closest("li").attr("class") || "";
  const categories = (liClass.match(/category-([^\s]+)/g) || [])
    .map((c) => c.replace("category-", "").replace(/-/g, " "))
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1));

  return { id, title, image, url, rating, contentType, categories };
}

export function parseEpisodeCard($, el) {
  const $el = $(el);
  const url = $el.find("a.lnk-blk").attr("href") || null;
  const title = $el.find(".entry-title").text().trim();
  const image = normalizeImageUrl($el.find("img").first().attr("src"));
  const episodeNumber = $el.find(".num-epi").text().trim();
  const time = $el.find(".time").text().trim();
  return { title, image, episodeNumber, time, url };
}

export function parsePagination($) {
  const current = parseInt($(".pagination .current, .page-numbers.current").text().trim()) || 1;
  const pages = [];
  $(".pagination a.page-numbers, .page-numbers:not(.current):not(.next):not(.prev)").each((_, el) => {
    const n = parseInt($(el).text().trim());
    if (!isNaN(n)) pages.push(n);
  });
  const totalPages = pages.length ? Math.max(...pages, current) : current;
  const hasNext = !!$(".pagination .next, .page-numbers.next").length;
  return { currentPage: current, totalPages, hasNext };
}

export default { normalizeImageUrl, extractSlugFromUrl, parsePostCard, parseEpisodeCard, parsePagination };
