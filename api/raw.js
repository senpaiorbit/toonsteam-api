module.exports = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).send(`
Usage:

/?url=https://example.com
      `);
    }

    let decodedUrl;

    try {
      decodedUrl = decodeURIComponent(url);
      new URL(decodedUrl);
    } catch {
      return res.status(400).send('Invalid URL');
    }

    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    });

    const html = await response.text();

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send(err.message || 'Internal Server Error');
  }
};
