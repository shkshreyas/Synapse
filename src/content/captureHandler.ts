import { ContentExtractor } from "./contentExtractor";
import { ContentStore } from "../storage/contentStore";

// Handle content capture message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CAPTURE_CONTENT") {
    handleCapture()
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true; // Will respond asynchronously
  }
});

async function handleCapture() {
  try {
    const extractor = new ContentExtractor();
    const content = await extractor.extractContent();

    if (!content.mainContent || content.mainContent.length < 100) {
      throw new Error("No significant content found on this page");
    }

    // Store the captured content
    const store = ContentStore.getInstance();
    await store.addContent({
      url: window.location.href,
      title: document.title,
      content: content.mainContent,
      timestamp: new Date(),
      metadata: {
        author: content.metadata.author,
        datePublished: content.metadata.datePublished,
        pageType: content.metadata.pageType,
        readingTime: content.metadata.readingTime,
        summary: content.metadata.summary,
        tags: content.metadata.tags || [],
        language: content.metadata.language || "en",
      },
    });

    return { success: true, content };
  } catch (error) {
    console.error("Content capture failed:", error);
    throw error;
  }
}
