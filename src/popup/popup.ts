import { MessageHandler } from "../utils/messaging";
import { ContentStore } from "../storage/contentStore";
import { NaturalLanguageSearch } from "../search/naturalLanguageSearch";
import { StoredContent } from "../types/storage";

/**
 * Popup script for MindScribe Chrome extension
 * Handles the extension popup interface with search autocomplete and recent captures
 */
class PopupController {
  private searchInput?: HTMLInputElement;
  private captureButton?: HTMLButtonElement;
  private recentList?: HTMLElement | undefined;
  private statusElement?: HTMLElement | undefined;
  private autocompleteContainer?: HTMLElement;
  private contentStore: ContentStore;
  private searchEngine: NaturalLanguageSearch;
  private searchTimeout?: number;
  private currentSearchId?: string;
  private isAutocompleteVisible = false;

  constructor() {
    this.contentStore = ContentStore.getInstance();
    this.searchEngine = NaturalLanguageSearch.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log("MindScribe popup initializing...");

    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setupUI());
    } else {
      this.setupUI();
    }
  }

  private setupUI(): void {
    // Get DOM elements
    this.searchInput = document.getElementById(
      "searchInput"
    ) as HTMLInputElement;
    this.captureButton = document.getElementById(
      "captureButton"
    ) as HTMLButtonElement;
    this.recentList = document.getElementById("recentList") || undefined;
    this.statusElement = document.getElementById("status") || undefined;

    // Create autocomplete container
    this.createAutocompleteContainer();

    // Set up event listeners
    this.setupEventListeners();

    // Load initial data
    this.loadRecentCaptures();

    console.log("MindScribe popup UI initialized");
  }

  private createAutocompleteContainer(): void {
    if (!this.searchInput) return;

    this.autocompleteContainer = document.createElement("div");
    this.autocompleteContainer.className = "autocomplete-container";
    this.autocompleteContainer.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #dadce0;
      border-top: none;
      border-radius: 0 0 8px 8px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      display: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;

    // Insert after search input
    const searchSection = this.searchInput.parentElement;
    if (searchSection) {
      searchSection.style.position = "relative";
      searchSection.appendChild(this.autocompleteContainer);
    }
  }

  private setupEventListeners(): void {
    // Capture button
    if (this.captureButton) {
      this.captureButton.addEventListener("click", () => this.handleCapture());
    }

    // Search input with autocomplete
    if (this.searchInput) {
      this.searchInput.addEventListener("input", (e) => {
        const query = (e.target as HTMLInputElement).value;
        this.handleSearchInput(query);
      });

      this.searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const query = (e.target as HTMLInputElement).value;
          this.performSearch(query);
        } else if (e.key === "Escape") {
          this.hideAutocomplete();
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          this.handleAutocompleteNavigation(e.key);
          e.preventDefault();
        }
      });

      this.searchInput.addEventListener("focus", () => {
        const query = this.searchInput?.value || "";
        if (query.length > 0) {
          this.showAutocomplete(query);
        }
      });

      this.searchInput.addEventListener("blur", () => {
        // Delay hiding to allow clicking on autocomplete items
        setTimeout(() => this.hideAutocomplete(), 150);
      });
    }

    // Capture button
    if (this.captureButton) {
      this.captureButton.addEventListener("click", () => {
        this.handleCapture();
      });
    }

    // Side panel button
    const sidePanelButton = document.getElementById("sidePanelButton");
    if (sidePanelButton) {
      sidePanelButton.addEventListener("click", () => {
        this.openSidePanel();
      });
    }

    // Dashboard button
    const dashboardButton = document.getElementById("dashboardButton");
    if (dashboardButton) {
      dashboardButton.addEventListener("click", () => {
        this.openDashboard();
      });
    }

    // Settings button (add to footer)
    this.addSettingsButton();

    // Click outside to close autocomplete
    document.addEventListener("click", (e) => {
      if (
        !this.searchInput?.contains(e.target as Node) &&
        !this.autocompleteContainer?.contains(e.target as Node)
      ) {
        this.hideAutocomplete();
      }
    });
  }

  private addSettingsButton(): void {
    const footer = document.querySelector(".footer");
    if (footer) {
      const settingsButton = document.createElement("button");
      settingsButton.id = "settingsButton";
      settingsButton.className = "btn";
      settingsButton.textContent = "Settings";
      settingsButton.addEventListener("click", () => {
        this.openSettings();
      });
      footer.appendChild(settingsButton);
    }
  }

  private async handleSearchInput(query: string): Promise<void> {
    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (query.length === 0) {
      this.hideAutocomplete();
      return;
    }

    // Show autocomplete with debouncing
    this.searchTimeout = window.setTimeout(() => {
      this.showAutocomplete(query);
    }, 300);
  }

  private async showAutocomplete(query: string): Promise<void> {
    if (!this.autocompleteContainer || query.length === 0) return;

    try {
      // Get search suggestions
      const suggestions = await this.searchEngine.getSearchSuggestions(query);

      // Get recent searches that match
      const searchHistory = await this.searchEngine.getSearchHistory(5);
      const recentMatches = searchHistory
        .filter((entry) =>
          entry.query.toLowerCase().includes(query.toLowerCase())
        )
        .map((entry) => entry.query)
        .slice(0, 3);

      // Combine suggestions
      const allSuggestions = [
        ...new Set([...recentMatches, ...suggestions]),
      ].slice(0, 8);

      if (allSuggestions.length === 0) {
        this.hideAutocomplete();
        return;
      }

      // Build autocomplete HTML
      let html = "";

      if (recentMatches.length > 0) {
        html += '<div class="autocomplete-section">Recent Searches</div>';
        recentMatches.forEach((suggestion) => {
          html += `<div class="autocomplete-item recent" data-query="${this.escapeHtml(
            suggestion
          )}">
            <span class="autocomplete-icon">🕒</span>
            <span class="autocomplete-text">${this.highlightMatch(
              suggestion,
              query
            )}</span>
          </div>`;
        });
      }

      const newSuggestions = suggestions.filter(
        (s) => !recentMatches.includes(s)
      );
      if (newSuggestions.length > 0) {
        if (recentMatches.length > 0) {
          html += '<div class="autocomplete-section">Suggestions</div>';
        }
        newSuggestions.forEach((suggestion) => {
          html += `<div class="autocomplete-item suggestion" data-query="${this.escapeHtml(
            suggestion
          )}">
            <span class="autocomplete-icon">🔍</span>
            <span class="autocomplete-text">${this.highlightMatch(
              suggestion,
              query
            )}</span>
          </div>`;
        });
      }

      this.autocompleteContainer.innerHTML = html;

      // Add click listeners to autocomplete items
      this.autocompleteContainer
        .querySelectorAll(".autocomplete-item")
        .forEach((item) => {
          item.addEventListener("click", (e) => {
            const query = (e.currentTarget as HTMLElement).dataset.query;
            if (query && this.searchInput) {
              this.searchInput.value = query;
              this.performSearch(query);
              this.hideAutocomplete();
            }
          });
        });

      this.autocompleteContainer.style.display = "block";
      this.isAutocompleteVisible = true;
    } catch (error) {
      console.error("Error showing autocomplete:", error);
      this.hideAutocomplete();
    }
  }

  private hideAutocomplete(): void {
    if (this.autocompleteContainer) {
      this.autocompleteContainer.style.display = "none";
      this.isAutocompleteVisible = false;
    }
  }

  private handleAutocompleteNavigation(key: string): void {
    if (!this.isAutocompleteVisible || !this.autocompleteContainer) return;

    const items =
      this.autocompleteContainer.querySelectorAll(".autocomplete-item");
    if (items.length === 0) return;

    const currentActive = this.autocompleteContainer.querySelector(
      ".autocomplete-item.active"
    );
    let newIndex = 0;

    if (currentActive) {
      const currentIndex = Array.from(items).indexOf(currentActive);
      if (key === "ArrowDown") {
        newIndex = (currentIndex + 1) % items.length;
      } else {
        newIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
      }
      currentActive.classList.remove("active");
    }

    items[newIndex].classList.add("active");

    // Update search input with selected suggestion
    const selectedQuery = (items[newIndex] as HTMLElement).dataset.query;
    if (selectedQuery && this.searchInput) {
      this.searchInput.value = selectedQuery;
    }
  }

  private highlightMatch(text: string, query: string): string {
    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    return text.replace(regex, "<strong>$1</strong>");
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  private async performSearch(query: string): Promise<void> {
    if (!query.trim()) return;

    console.log("Performing search for:", query);
    this.updateStatus("Searching...");
    this.hideAutocomplete();

    try {
      // Generate unique search ID
      this.currentSearchId = `search_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Perform search using natural language search engine
      const searchResult = await this.searchEngine.search(query, {
        maxResults: 10,
        useSemanticSearch: true,
        minRelevanceScore: 0.1,
      });

      if (searchResult.success && searchResult.semanticMatches) {
        if (searchResult.semanticMatches.length === 0) {
          this.updateStatus(
            "No results found. Try different keywords.",
            "info"
          );
        } else {
          this.updateStatus(
            `Found ${searchResult.semanticMatches.length} results`,
            "success"
          );
          this.displaySearchResults(searchResult.semanticMatches);
        }
      } else {
        this.updateStatus(
          "Search failed: " + (searchResult.error || "Unknown error"),
          "error"
        );
      }
    } catch (error) {
      console.error("Search error:", error);
      this.updateStatus("Search error: " + (error as Error).message, "error");
    }
  }

  private displaySearchResults(results: any[]): void {
    // For now, just open dashboard with search results
    // In a full implementation, we might show a preview in the popup
    const searchQuery = this.searchInput?.value || "";
    const dashboardUrl = chrome.runtime.getURL(
      `dashboard.html?search=${encodeURIComponent(searchQuery)}`
    );
    chrome.tabs.create({ url: dashboardUrl });
    window.close();
  }

  private async handleCapture(): Promise<void> {
    console.log("Initiating content capture");
    this.updateStatus("Capturing content...");

    if (this.captureButton) {
      this.captureButton.disabled = true;
      this.captureButton.textContent = "Capturing...";
    }

    try {
      // Get current tab info
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!activeTab?.url) {
        throw new Error("No active tab found");
      }

      const response = await MessageHandler.sendToBackground({
        type: "CAPTURE_CONTENT",
        url: activeTab.url,
        manual: true,
        id: MessageHandler.generateMessageId(),
      });

      console.log("Capture response:", response);

      if (response.success) {
        this.updateStatus("Content captured successfully!", "success");
        this.loadRecentCaptures(); // Refresh recent list
      } else {
        this.updateStatus("Capture failed: " + response.error, "error");
      }
    } catch (error) {
      console.error("Capture error:", error);
      this.updateStatus("Capture error: " + (error as Error).message, "error");
    } finally {
      if (this.captureButton) {
        this.captureButton.disabled = false;
        this.captureButton.textContent = "Capture Current Page";
      }
    }
  }

  private async openSidePanel(): Promise<void> {
    try {
      await MessageHandler.sendToBackground({
        type: "OPEN_SIDE_PANEL",
        id: MessageHandler.generateMessageId(),
      });

      // Close popup after opening side panel
      window.close();
    } catch (error) {
      console.error("Error opening side panel:", error);
      this.updateStatus("Error opening side panel", "error");
    }
  }

  private openDashboard(): void {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    window.close();
  }

  private openSettings(): void {
    chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
    window.close();
  }

  private async loadRecentCaptures(): Promise<void> {
    if (!this.recentList) return;

    try {
      // Load recent captures from storage
      const recentResult = await this.contentStore.list({
        sortBy: "timestamp",
        sortDirection: "desc",
        limit: 5,
      });

      if (
        recentResult.success &&
        recentResult.data &&
        recentResult.data.length > 0
      ) {
        let html = "";

        for (const content of recentResult.data) {
          const timeAgo = this.formatTimeAgo(new Date(content.timestamp));
          const domain = this.extractDomain(content.url);

          html += `
            <div class="recent-item" data-content-id="${content.id}">
              <div class="recent-title">${this.escapeHtml(content.title)}</div>
              <div class="recent-subtitle">${domain} • ${timeAgo}</div>
            </div>
          `;
        }

        this.recentList.innerHTML = html;

        // Add click listeners to recent items
        this.recentList.querySelectorAll(".recent-item").forEach((item) => {
          item.addEventListener("click", (e) => {
            const contentId = (e.currentTarget as HTMLElement).dataset
              .contentId;
            if (contentId) {
              this.openContentInDashboard(contentId);
            }
          });
        });
      } else {
        this.recentList.innerHTML = `
          <div class="recent-item">
            <div class="recent-title">No captures yet</div>
            <div class="recent-subtitle">Capture some content to get started!</div>
          </div>
        `;
      }
    } catch (error) {
      console.error("Error loading recent captures:", error);
      if (this.recentList) {
        this.recentList.innerHTML = `
          <div class="recent-item">
            <div class="recent-title">Error loading recent captures</div>
            <div class="recent-subtitle">Please try again</div>
          </div>
        `;
      }
    }
  }

  private openContentInDashboard(contentId: string): void {
    const dashboardUrl = chrome.runtime.getURL(
      `dashboard.html?content=${contentId}`
    );
    chrome.tabs.create({ url: dashboardUrl });
    window.close();
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "Unknown";
    }
  }

  private updateStatus(
    message: string,
    type: "info" | "success" | "error" = "info"
  ): void {
    if (!this.statusElement) return;

    this.statusElement.textContent = message;
    this.statusElement.className = `status ${type}`;

    // Clear status after 3 seconds for non-error messages
    if (type !== "error") {
      setTimeout(() => {
        if (this.statusElement) {
          this.statusElement.textContent = "";
          this.statusElement.className = "status";
        }
      }, 3000);
    }
  }
}

// Initialize popup controller
new PopupController();
