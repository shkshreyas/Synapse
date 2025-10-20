/**
 * Utility functions for content handling
 */

/**
 * Determine the type of page based on document metadata
 */
export function determinePageType(
  document: Document
): "article" | "documentation" | "video" | "social" | "other" {
  // Check meta tags
  const ogType = document
    .querySelector('meta[property="og:type"]')
    ?.getAttribute("content");
  if (ogType) {
    if (ogType.includes("article")) return "article";
    if (ogType.includes("video")) return "video";
  }

  // Check URL patterns
  const url = document.URL.toLowerCase();
  if (
    url.includes("docs.") ||
    url.includes("/docs/") ||
    url.includes("/documentation/")
  ) {
    return "documentation";
  }
  if (url.includes("youtube.com") || url.includes("vimeo.com")) {
    return "video";
  }
  if (
    url.includes("twitter.com") ||
    url.includes("facebook.com") ||
    url.includes("linkedin.com") ||
    url.includes("instagram.com")
  ) {
    return "social";
  }

  // Check page structure
  if (document.querySelector("article")) return "article";
  if (document.querySelector("video")) return "video";

  return "other";
}

/**
 * Calculate approximate reading time in minutes
 */
export function calculateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Extract meaningful content from various page elements
 */
export function extractPageContent(): string {
  const extractFrom = [
    "article",
    "main",
    '[role="main"]',
    ".main-content",
    ".article-content",
    ".post-content",
  ];

  for (const selector of extractFrom) {
    const element = document.querySelector(selector);
    if (element) {
      return element.textContent?.trim() || "";
    }
  }

  // Fallback to body content
  return document.body.textContent?.trim() || "";
}
