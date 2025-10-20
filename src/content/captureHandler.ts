import { ContentExtractor } from "./contentExtractor";
import { ContentStore } from "../storage/contentStore";
import { StoredContent } from "../types/storage";
import { determinePageType, calculateReadingTime } from "./contentUtils";

// Handle content capture message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CAPTURE_CONTENT") {
    // Create a port for reliable communication
    const port = chrome.runtime.connect({ name: 'capture-handler' });
    
    handleCapture()
      .then(result => {
        // Send response through both channels for reliability
        sendResponse(result);
        port.postMessage({ type: 'CAPTURE_RESULT', data: result });
      })
      .catch((error) => {
        const errorResponse = { error: error.message };
        sendResponse(errorResponse);
        port.postMessage({ type: 'CAPTURE_ERROR', data: errorResponse });
      });
    return true; // Will respond asynchronously
  }
});

// Also listen for direct port connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'capture-handler') {
    port.onMessage.addListener((msg) => {
      if (msg.type === 'CAPTURE_CONTENT') {
        handleCapture()
          .then(result => port.postMessage({ type: 'CAPTURE_RESULT', data: result }))
          .catch(error => port.postMessage({ type: 'CAPTURE_ERROR', data: { error: error.message } }));
      }
    });
  }
});

async function handleCapture() {
  try {
    const store = ContentStore.getInstance();
    const currentDate = new Date();
    
    // Extract and clean the content
    const content = document.body.innerText.trim();
    if (!content || content.length < 100) {
      throw new Error("No significant content found on this page");
    }

    const pageType = determinePageType(document);
    const readingTime = calculateReadingTime(content);
    
    const storedContent: StoredContent = {
      captureMethod: 'manual' as const,
      id: crypto.randomUUID(),
      url: window.location.href,
      title: document.title,
      content,
      category: pageType,
      importance: 3,
      timesAccessed: 1,
      timestamp: currentDate,
      lastAccessed: currentDate,
      lastModified: currentDate,
      storageSize: new Blob([content]).size,
      version: 1,
      syncedToCloud: false,
      cloudAnalysisComplete: false,
      metadata: {
        author: document.querySelector('meta[name="author"]')?.getAttribute('content') || 'Unknown',
        publishDate: currentDate,
        pageType,
        readingTime,
        language: document.documentElement.lang || "en",
        keywords: Array.from(document.querySelectorAll('meta[name="keywords"]')).map(el => el.getAttribute('content') || '').join(',').split(',').map(k => k.trim()).filter(Boolean),
        wordCount: content.split(/\s+/).length,
        imageCount: document.images.length,
        linkCount: document.links.length
      },
    });

    const result = await store.create(storedContent);
    if (!result.success) {
      throw new Error(result.error || 'Failed to store content');
    }
    return { success: true, content: result.data };
  } catch (error) {
    console.error("Content capture failed:", error);
    throw error;
  }
}

// Export for testing
export { handleCapture };
