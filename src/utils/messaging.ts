import { ExtensionMessage } from "../types/messages";

/**
 * Utility class for handling message passing between extension components
 */
export class MessageHandler {
  private static initialized = false;

  /**
   * Initialize message handlers
   */
  static initialize() {
    if (this.initialized) return;

    // Setup connection listener
    chrome.runtime.onConnect.addListener((port) => {
      console.log("New connection established:", port.name);
      port.onMessage.addListener((msg) => {
        console.log("Received message on port:", msg);
      });
    });

    this.initialized = true;
  }

  /**
   * Send a message to the background script
   */
  static async sendToBackground<T extends ExtensionMessage>(
    message: T
  ): Promise<any> {
    this.initialize();
    try {
      // Create a connection if needed
      const port = chrome.runtime.connect({ name: "content-script" });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Message timeout"));
        }, 5000);

        // Send message
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            console.error("Runtime error:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      console.error("Error sending message to background:", error);
      throw error;
    }
  }

  /**
   * Send a message to a specific tab
   */
  static async sendToTab<T extends ExtensionMessage>(
    tabId: number,
    message: T
  ): Promise<any> {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      console.error(`Error sending message to tab ${tabId}:`, error);
      throw error;
    }
  }

  /**
   * Send a message to the active tab
   */
  static async sendToActiveTab<T extends ExtensionMessage>(
    message: T
  ): Promise<any> {
    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!activeTab?.id) {
        throw new Error("No active tab found");
      }

      return await this.sendToTab(activeTab.id, message);
    } catch (error) {
      console.error("Error sending message to active tab:", error);
      throw error;
    }
  }

  /**
   * Set up a message listener with type safety
   */
  static addListener<T extends ExtensionMessage>(
    handler: (
      message: T,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => boolean | void | Promise<any>
  ): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        const result = handler(message as T, sender, sendResponse);

        // Handle async responses
        if (result instanceof Promise) {
          result.then(sendResponse).catch((error) => {
            console.error("Error in message handler:", error);
            sendResponse({ error: error.message });
          });
          return true; // Keep the message channel open for async response
        }

        return result;
      } catch (error) {
        console.error("Error in message handler:", error);
        sendResponse({ error: (error as Error).message });
        return false;
      }
    });
  }

  /**
   * Generate a unique message ID
   */
  static generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
