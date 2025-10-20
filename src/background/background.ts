import { MessageHandler } from "../utils/messaging";
import { ExtensionMessage } from "../types/messages";

/**
 * Background script for MindScribe Chrome extension
 * Handles extension lifecycle, message routing, and core coordination
 */
class BackgroundService {
  constructor() {
    this.initialize();
  }

  private initialize(): void {
    console.log("MindScribe background service starting...");

    // Set up message listeners
    this.setupMessageHandlers();

    // Set up extension event listeners
    this.setupExtensionEvents();

    // Set up connection listeners
    this.setupConnectionHandlers();

    console.log("MindScribe background service initialized");
  }

  private setupConnectionHandlers(): void {
    chrome.runtime.onConnect.addListener((port) => {
      console.log("Connection established from:", port.name);

      port.onMessage.addListener(async (message: ExtensionMessage) => {
        console.log("Received port message:", message.type);

        try {
          let response;
          switch (message.type) {
            case "CAPTURE_CONTENT":
              response = await this.handleCaptureContent(message, port.sender);
              break;
            default:
              response = { error: "Unknown message type" };
          }

          port.postMessage(response);
        } catch (error) {
          port.postMessage({ error: error.message });
        }
      });

      port.onDisconnect.addListener(() => {
        console.log("Port disconnected:", port.name);
      });
    });
  }

  private setupMessageHandlers(): void {
    MessageHandler.addListener(
      async (message: ExtensionMessage, sender, sendResponse) => {
        console.log("Background received message:", message.type);

        try {
          switch (message.type) {
            case "CAPTURE_CONTENT":
              return await this.handleCaptureContent(message, sender);

            case "SEARCH":
              return await this.handleSearch(message);

            case "GET_RELATED_CONTENT":
              return await this.handleGetRelatedContent(message);

            case "OPEN_SIDE_PANEL":
              return await this.handleOpenSidePanel(sender);

            case "UPDATE_BADGE":
              return await this.handleUpdateBadge(message, sender);

            default:
              console.warn("Unknown message type:", message.type);
              return { error: "Unknown message type" };
          }
        } catch (error) {
          console.error("Error handling message:", error);
          return { error: (error as Error).message };
        }
      }
    );
  }

  private setupExtensionEvents(): void {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      console.log("MindScribe installed:", details.reason);

      if (details.reason === "install") {
        this.handleFirstInstall();
      } else if (details.reason === "update") {
        this.handleUpdate(details.previousVersion);
      }
    });

    // Handle tab updates for context analysis
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url) {
        this.handleTabComplete(tabId, tab);
      }
    });

    // Handle extension icon clicks
    chrome.action.onClicked.addListener((tab) => {
      this.handleActionClick(tab);
    });
  }

  private async handleCaptureContent(
    message: any,
    sender: chrome.runtime.MessageSender
  ): Promise<any> {
    console.log("Handling content capture request");

    // For now, just acknowledge the request
    // This will be expanded in later tasks
    return {
      success: true,
      message: "Content capture initiated",
      contentId: MessageHandler.generateMessageId(),
    };
  }

  private async handleSearch(message: any): Promise<any> {
    console.log("Handling search request:", message.query);

    // Placeholder for search functionality
    return {
      results: [],
      message: "Search functionality will be implemented in later tasks",
    };
  }

  private async handleGetRelatedContent(message: any): Promise<any> {
    console.log("Handling related content request for:", message.url);

    // Placeholder for related content functionality
    return {
      content: [],
      message:
        "Related content functionality will be implemented in later tasks",
    };
  }

  private async handleOpenSidePanel(
    sender: chrome.runtime.MessageSender
  ): Promise<any> {
    if (sender.tab?.id) {
      try {
        await chrome.sidePanel.open({ tabId: sender.tab.id });
        return { success: true };
      } catch (error) {
        console.error("Error opening side panel:", error);
        return { success: false, error: (error as Error).message };
      }
    }
    return { success: false, error: "No tab ID available" };
  }

  private async handleUpdateBadge(
    message: any,
    sender: chrome.runtime.MessageSender
  ): Promise<any> {
    if (sender.tab?.id) {
      try {
        await chrome.action.setBadgeText({
          text: message.text,
          tabId: sender.tab.id,
        });

        if (message.color) {
          await chrome.action.setBadgeBackgroundColor({
            color: message.color,
            tabId: sender.tab.id,
          });
        }

        return { success: true };
      } catch (error) {
        console.error("Error updating badge:", error);
        return { success: false, error: (error as Error).message };
      }
    }
    return { success: false, error: "No tab ID available" };
  }

  private handleFirstInstall(): void {
    console.log("First install - setting up default configuration");

    // Set default badge
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setBadgeBackgroundColor({ color: "#4285f4" });
  }

  private handleUpdate(previousVersion?: string): void {
    console.log("Extension updated from version:", previousVersion);
    // Handle any migration logic here
  }

  private handleTabComplete(tabId: number, tab: chrome.tabs.Tab): void {
    // This will be used for automatic content detection in later tasks
    console.log("Tab completed loading:", tab.url);
  }

  private handleActionClick(tab: chrome.tabs.Tab): void {
    console.log("Extension icon clicked on tab:", tab.url);
    // The popup will handle the UI, this is just for logging
  }
}

// Initialize the background service
new BackgroundService();
