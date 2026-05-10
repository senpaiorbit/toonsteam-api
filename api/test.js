export default async function handler(req, res) {
  try {
    const { url } = req.query;

    // Check URL
    if (!url) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(400).send("Missing ?url=");
    }

    // Validate URL
    let targetUrl;

    try {
      targetUrl = new URL(url);
    } catch {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(400).send("Invalid URL");
    }

    // Fetch target page
    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",

        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

        Referer: targetUrl.origin,

        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    // Get raw HTML
    const html = await response.text();

    // Return as plain text
    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Optional extra headers
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Send raw HTML as text
    return res.status(200).send(html);
  } catch (error) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    return res.status(500).send(
`Scraper Error

${error.message}`
    );
  }
}
