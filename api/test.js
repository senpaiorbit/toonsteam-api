export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).send("Missing ?url=");
    }

    // Validate URL
    let targetUrl;

    try {
      targetUrl = new URL(url);
    } catch {
      return res.status(400).send("Invalid URL");
    }

    // Fetch target page
    const response = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        Referer: targetUrl.origin,
      },
    });

    const html = await response.text();

    // Return raw HTML
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    // Optional CORS
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).send(html);
  } catch (err) {
    return res.status(500).send(`
      <h1>Scraper Error</h1>
      <pre>${err.message}</pre>
    `);
  }
}
