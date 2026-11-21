/**
 * Resolves candidate ingest URLs depending on the environment.
 * In production (e.g. on Vercel), local /api/v1/ingest proxy does not exist
 * and returns 404, so only the direct backendUrl is returned.
 * In development, local proxy is tried first, then direct backendUrl.
 * Trailing slashes on backendUrl are stripped.
 *
 * @param {Object} options
 * @param {boolean} options.isProd
 * @param {string} options.backendUrl
 * @returns {string[]} List of ingest URLs to try in order
 */
export function getIngestUrls({ isProd, backendUrl }) {
  const cleanBackend = (backendUrl || "").replace(/\/+$/, "");
  const directUrl = `${cleanBackend}/v1/ingest`;

  if (isProd) {
    return [directUrl];
  }

  return ["/api/v1/ingest", directUrl];
}
