const logger = require("../config/logger");
require("dotenv").config();

/**
 * Utility to format profile image URLs consistently.
 */
class FileHelper {
  /**
   * Get the full profile image URL.
   * Handles both relative paths and old absolute URLs by cleaning them first.
   *
   * @param {string} profileImage - The path or URL stored in the database
   * @returns {string|null} - The full URL or null if no image path provided
   */
  getProfileImageUrl(profileImage) {
    if (!profileImage) return null;

    // If it's already a full URL but from a different domain/localhost,
    // strip the domain to make it relative for re-formatting.
    let path = profileImage;
    if (profileImage.startsWith("http")) {
      try {
        const url = new URL(profileImage);
        path = url.pathname;
        // If pathname starts with //, cleanup (common URL parsing quirk)
        path = path.replace(/^\/+/, "/");
      } catch (e) {
        logger.warn("Failed to parse profile image URL, using as fallback", {
          profileImage,
        });
      }
    }

    // Ensure path starts with /api/ if it's a proxy path, or handle as relative
    if (!path.startsWith("/") && !path.startsWith("http")) {
      path = "/" + path;
    }

    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";

    // Remove trailing slash from backendUrl if present
    const cleanBaseUrl = backendUrl.endsWith("/")
      ? backendUrl.slice(0, -1)
      : backendUrl;

    // Ensure path starts with / if not already
    const cleanPath = path.startsWith("/") ? path : `/${path}`;

    return `${cleanBaseUrl}${cleanPath}`;
  }
}

module.exports = new FileHelper();
