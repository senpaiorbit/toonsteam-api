import axios from "axios";
import { buildHeaders } from "./request.js";

const TIMEOUT = 15000;
const MAX_RETRIES = 2;

async function fetchPage(url, baseUrl, options = {}) {
  const { retries = MAX_RETRIES, referer = null } = options;
  const headers = buildHeaders(baseUrl, referer);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers,
        timeout: TIMEOUT,
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
      });

      if (response.status === 404) {
        const error = new Error("Page not found");
        error.status = 404;
        throw error;
      }

      return response.data;
    } catch (error) {
      if (error.status === 404) throw error;
      if (attempt === retries) throw error;
      await sleep(500 * (attempt + 1));
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default { fetchPage };
