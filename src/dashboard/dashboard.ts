import { ContentStore } from "../storage/contentStore";
import { NaturalLanguageSearch } from "../search/naturalLanguageSearch";
import {
  StoredContent,
  ContentRelationship,
  ContentMetadata,
} from "../types/storage";
import {
  InteractiveKnowledgeGraph,
  GraphNode,
  GraphEdge,
  GraphCluster,
} from "./knowledgeGraph";
import { AnalyticsEngine, AnalyticsData, ChartRenderer } from "./analytics";
import { ContentManager, ContentFilter, BulkOperation } from "./contentManager";
import { addSampleContent, addSampleRelationships } from "../utils/sampleData";

/**
 * Dashboard controller for Synapse Chrome extension
 * Handles the main dashboard interface with knowledge graph, search, and content management
 */
class DashboardController {
  private contentStore: ContentStore;
  private searchEngine: NaturalLanguageSearch;
  private currentView: "list" | "grid" | "graph" | "analytics" = "list";
  private currentContent: StoredContent[] = [];
  private filteredContent: StoredContent[] = [];
  private searchTimeout?: number;
  private knowledgeGraph: InteractiveKnowledgeGraph | null = null;
  private analyticsEngine: AnalyticsEngine;
  private contentManager: ContentManager;
  private analyticsData: AnalyticsData | null = null;
  private selectedContentIds: Set<string> = new Set();

  // DOM elements
  private globalSearch?: HTMLInputElement | null;
  private listView?: HTMLElement | null;
  private gridView?: HTMLElement | null;
  private graphView?: HTMLElement | null;
  private analyticsView?: HTMLElement | null;
  private loadingState?: HTMLElement | null;
  private emptyState?: HTMLElement | null;
  private contentTitle?: HTMLElement | null;
  private typeFilter?: HTMLSelectElement | null;
  private timeFilter?: HTMLSelectElement | null;
  private sortFilter?: HTMLSelectElement | null;
  private totalItemsEl?: HTMLElement | null;
  private thisWeekEl?: HTMLElement | null;

  constructor() {
    this.contentStore = ContentStore.getInstance();
    this.searchEngine = NaturalLanguageSearch.getInstance();
    this.analyticsEngine = AnalyticsEngine.getInstance();
    this.contentManager = ContentManager.getInstance();
    this.initializeEventListeners();
    this.initializeDOMElements();

    // Load sample data for testing
    this.initializeSampleData().catch((error: Error) => {
      console.error("Error loading sample data:", error);
    });
  }

  private async initializeSampleData(): Promise<void> {
    try {
      await addSampleContent();
      await addSampleRelationships();
      await this.refreshContent(); // Refresh content after adding samples
    } catch (error) {
      console.error("Failed to initialize sample data:", error);
      throw error;
    }
  }

  private async refreshContent(): Promise<void> {
    try {
      // Show loading state
      if (this.loadingState) {
        this.loadingState.style.display = "block";
      }
      if (this.emptyState) {
        this.emptyState.style.display = "none";
      }

      // Fetch all content
      const allContent = await this.contentStore.list();
      this.currentContent = allContent.data || [];
      this.filteredContent = this.currentContent;

      // Update UI elements
      if (this.totalItemsEl) {
        this.totalItemsEl.textContent = this.currentContent.length.toString();
      }

      // Count items from this week
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const thisWeekCount = this.currentContent.filter(
        (item) => new Date(item.timestamp) > oneWeekAgo
      ).length;

      if (this.thisWeekEl) {
        this.thisWeekEl.textContent = thisWeekCount.toString();
      }

      // Hide loading state and show content
      if (this.loadingState) {
        this.loadingState.style.display = "none";
      }

      // Show empty state if no content
      if (this.emptyState && this.currentContent.length === 0) {
        this.emptyState.style.display = "block";
      }

      // Update current view
      await this.updateView();
    } catch (error) {
      console.error("Error loading content:", error);
      throw error;
    }
  }

  private async updateView(): Promise<void> {
    this.renderCurrentView();
  }

  private initializeEventListeners(): void {
    document.addEventListener("DOMContentLoaded", () => {
      this.initializeDOMElements();
      this.setupEventHandlers();
    });
  }

  private initializeDOMElements(): void {
    this.globalSearch = document.getElementById(
      "globalSearch"
    ) as HTMLInputElement;
    this.listView = document.getElementById("listView");
    this.gridView = document.getElementById("gridView");
    this.graphView = document.getElementById("graphView");
    this.analyticsView = document.getElementById("analyticsView");
    this.loadingState = document.getElementById("loadingState");
    this.emptyState = document.getElementById("emptyState");
    this.contentTitle = document.getElementById("contentTitle");
    this.typeFilter = document.getElementById(
      "typeFilter"
    ) as HTMLSelectElement;
    this.timeFilter = document.getElementById(
      "timeFilter"
    ) as HTMLSelectElement;
    this.sortFilter = document.getElementById(
      "sortFilter"
    ) as HTMLSelectElement;
    this.totalItemsEl = document.getElementById("totalItems");
    this.thisWeekEl = document.getElementById("thisWeek");

    // Initialize view buttons
    document.querySelectorAll(".view-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const viewType = (e.currentTarget as HTMLElement).dataset.view as
          | "list"
          | "grid"
          | "graph"
          | "analytics";
        if (viewType) {
          this.switchView(viewType);
        }
      });
    });

    // Initialize settings button
    const settingsBtn = document.getElementById("settingsBtn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
      });
    }
  }

  private setupEventHandlers(): void {
    // Search functionality
    if (this.globalSearch) {
      this.globalSearch.addEventListener("input", (e) => {
        const query = (e.target as HTMLInputElement).value;
        this.handleSearch(query);
      });
    }

    // View toggle buttons
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const view = (e.target as HTMLElement).dataset.view as
          | "list"
          | "grid"
          | "graph";
        if (view) {
          this.switchView(view);
        }
      });
    });

    // Filter controls
    if (this.typeFilter) {
      this.typeFilter.addEventListener("change", () => this.applyFilters());
    }
    if (this.timeFilter) {
      this.timeFilter.addEventListener("change", () => this.applyFilters());
    }
    if (this.sortFilter) {
      this.sortFilter.addEventListener("change", () => this.applyFilters());
    }

    // Action buttons
    const captureBtn = document.getElementById("captureBtn");
    if (captureBtn) {
      captureBtn.addEventListener("click", () => this.handleCapturePage());
    }

    const exportBtn = document.getElementById("exportBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.handleExportData());
    }

    const analyticsBtn = document.getElementById("analyticsBtn");
    if (analyticsBtn) {
      analyticsBtn.addEventListener("click", () =>
        this.switchView("analytics")
      );
    }

    // Content management controls
    const selectAllBtn = document.getElementById("selectAllBtn");
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", () => this.selectAllContent());
    }

    const clearSelectionBtn = document.getElementById("clearSelectionBtn");
    if (clearSelectionBtn) {
      clearSelectionBtn.addEventListener("click", () => this.clearSelection());
    }

    const executeBulkActionBtn = document.getElementById("executeBulkAction");
    if (executeBulkActionBtn) {
      executeBulkActionBtn.addEventListener("click", () =>
        this.showBulkActionModal()
      );
    }

    // Graph controls
    const zoomInBtn = document.getElementById("zoomIn");
    const zoomOutBtn = document.getElementById("zoomOut");
    const resetViewBtn = document.getElementById("resetView");

    if (zoomInBtn)
      zoomInBtn.addEventListener("click", () => this.handleGraphZoom("in"));
    if (zoomOutBtn)
      zoomOutBtn.addEventListener("click", () => this.handleGraphZoom("out"));
    if (resetViewBtn)
      resetViewBtn.addEventListener("click", () => this.handleGraphReset());
  }

  private async loadInitialData(): Promise<void> {
    this.showLoading();

    try {
      const result = await this.contentStore.list({
        sortBy: "timestamp",
        sortDirection: "desc",
      });

      if (result.success && result.data) {
        this.currentContent = result.data;
        this.filteredContent = [...this.currentContent];

        await this.updateStats();
        await this.initializeKnowledgeGraph();
        await this.loadAnalyticsData();

        this.renderCurrentView();
        this.hideLoading();

        if (this.currentContent.length === 0) {
          this.showEmptyState();
        }
      } else {
        console.error("Failed to load content:", result.error);
        this.hideLoading();
        this.showEmptyState();
      }
    } catch (error) {
      console.error("Error loading initial data:", error);
      this.hideLoading();
      this.showEmptyState();
    }
  }

  private async handleSearch(query: string): Promise<void> {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = window.setTimeout(async () => {
      if (!query.trim()) {
        this.filteredContent = [...this.currentContent];
        this.applyFilters();
        return;
      }

      try {
        const searchResult = await this.searchEngine.search(query, {
          useSemanticSearch: true,
          maxResults: 100,
        });

        if (searchResult.success && searchResult.semanticMatches) {
          // Convert semantic matches back to StoredContent
          const matchedIds = new Set(
            searchResult.semanticMatches.map((m) => m.contentId)
          );
          this.filteredContent = this.currentContent.filter((content) =>
            matchedIds.has(content.id)
          );

          // Sort by search relevance
          const scoreMap = new Map(
            searchResult.semanticMatches.map((m) => [
              m.contentId,
              m.combinedScore,
            ])
          );
          this.filteredContent.sort(
            (a, b) => (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0)
          );
        } else {
          this.filteredContent = [];
        }

        this.applyFilters();
      } catch (error) {
        console.error("Search failed:", error);
        this.filteredContent = [];
        this.renderCurrentView();
      }
    }, 300);
  }

  private applyFilters(): void {
    let filtered = [...this.filteredContent];

    // Apply type filter
    if (this.typeFilter?.value) {
      filtered = filtered.filter(
        (content) => content.metadata.pageType === this.typeFilter!.value
      );
    }

    // Apply time filter
    if (this.timeFilter?.value) {
      const now = new Date();
      const filterDate = new Date();

      switch (this.timeFilter.value) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          filterDate.setDate(now.getDate() - 7);
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case "year":
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          filterDate.setTime(0);
      }

      filtered = filtered.filter(
        (content) => new Date(content.timestamp) >= filterDate
      );
    }

    // Apply sorting
    if (this.sortFilter?.value) {
      const sortBy = this.sortFilter.value as keyof StoredContent;
      filtered.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];

        if (aVal instanceof Date && bVal instanceof Date) {
          return bVal.getTime() - aVal.getTime();
        }
        if (typeof aVal === "number" && typeof bVal === "number") {
          return bVal - aVal;
        }
        if (typeof aVal === "string" && typeof bVal === "string") {
          return aVal.localeCompare(bVal);
        }
        return 0;
      });
    }

    this.filteredContent = filtered;
    this.renderCurrentView();
  }

  private switchView(view: "list" | "grid" | "graph" | "analytics"): void {
    this.currentView = view;

    // Update active button
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.getAttribute("data-view") === view) {
        btn.classList.add("active");
      }
    });

    // Handle analytics button separately
    if (view === "analytics") {
      document
        .querySelectorAll(".view-btn")
        .forEach((btn) => btn.classList.remove("active"));
    }

    this.renderCurrentView();
  }

  private renderCurrentView(): void {
    this.hideAllViews();

    switch (this.currentView) {
      case "list":
        this.renderListView();
        break;
      case "grid":
        this.renderGridView();
        break;
      case "graph":
        this.renderGraphView();
        break;
      case "analytics":
        this.renderAnalyticsView();
        break;
    }

    this.updateContentTitle();
  }

  private hideAllViews(): void {
    if (this.listView) this.listView.style.display = "none";
    if (this.gridView) this.gridView.style.display = "none";
    if (this.graphView) this.graphView.style.display = "none";
    if (this.analyticsView) this.analyticsView.style.display = "none";
  }

  private renderListView(): void {
    if (!this.listView) return;

    this.listView.style.display = "block";
    this.listView.innerHTML = `
      <div class="content-list">
        ${
          this.filteredContent.length === 0
            ? this.getEmptyStateHTML()
            : this.filteredContent
                .map((content) => this.createListItemHTML(content))
                .join("")
        }
      </div>
    `;
  }

  private createListItemHTML(content: StoredContent): string {
    const date = new Date(content.timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const concepts = content.concepts || [];
    const tags = concepts
      .slice(0, 3)
      .map((concept) => `<span class="tag">${concept}</span>`)
      .join("");

    const relationships = Array.isArray(content.relationships)
      ? content.relationships
      : [];
    const relationshipBadges = relationships
      .slice(0, 3)
      .map(
        (rel) =>
          `<span class="relationship-badge">${rel.type}: ${
            rel.targetTitle || "Connected Content"
          }</span>`
      )
      .join("");

    return `
      <div class="content-item">
        <div class="content-main">
          <div class="content-header">
            <h3 class="content-title">${content.title}</h3>
            <div class="content-meta">
              <span>${date}</span>
              <span>${content.category || "Uncategorized"}</span>
            </div>
          </div>
          <p class="content-preview">${
            content.preview || "No preview available"
          }</p>
          ${
            concepts.length > 0 ? `<div class="content-tags">${tags}</div>` : ""
          }
          ${
            relationships.length > 0
              ? `<div class="relationships">${relationshipBadges}</div>`
              : ""
          }
        </div>
        <div class="content-stats">
          <div class="stat-item">
            <div class="stat-value">${content.timesAccessed || 0}</div>
            <div class="stat-label">Views</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${content.importance || 0}</div>
            <div class="stat-label">Importance</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderGridView(): void {
    if (!this.gridView) return;

    this.gridView.style.display = "block";
    this.gridView.innerHTML = `
      <div class="content-grid">
        ${
          this.filteredContent.length === 0
            ? this.getEmptyStateHTML()
            : this.filteredContent
                .map((content) => this.createGridCardHTML(content))
                .join("")
        }
      </div>
    `;
  }

  private createGridCardHTML(content: StoredContent): string {
    const date = new Date(content.timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const concepts = content.concepts || [];
    const tags = concepts
      .slice(0, 2)
      .map((concept) => `<span class="tag">${concept}</span>`)
      .join("");

    return `
      <div class="grid-card">
        <div class="card-header">
          <div class="card-category">${
            content.category || "Uncategorized"
          }</div>
          <h3 class="card-title">${content.title}</h3>
        </div>
        <div class="card-content">
          <div class="card-preview">${
            content.text?.substring(0, 150) || "No content available"
          }...</div>
          ${concepts.length > 0 ? `<div class="card-tags">${tags}</div>` : ""}
        </div>
        <div class="card-footer">
          <div class="card-meta">
            <span class="card-date">${date}</span>
            <span class="card-views">${content.timesAccessed || 0} views</span>
          </div>
          ${this.getImportanceIndicatorHTML(content.importance || 0)}
        </div>
      </div>
    `;
  }

  private getImportanceIndicatorHTML(importance: number): string {
    const maxDots = 5;
    const filledDots = Math.min(Math.round(importance), maxDots);
    const dots = Array(maxDots)
      .fill(0)
      .map(
        (_, i) =>
          `<span class="importance-dot ${
            i < filledDots ? "filled" : ""
          }"></span>`
      )
      .join("");

    return `
      <div class="importance-indicator">
        <div class="importance-dots">${dots}</div>
        <span class="importance-label">Importance</span>
      </div>
    `;
  }

  private getEmptyStateHTML(): string {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📚</div>
        <h3>No Content Found</h3>
        <p>Try adjusting your filters or add some new content to get started.</p>
      </div>
    `;
  }

  private async renderGraphView(): Promise<void> {
    if (!this.graphView) return;

    this.graphView.style.display = "block";
    this.graphView.innerHTML = `
      <div class="graph-container">
        <div id="knowledgeGraph"></div>
        <div class="graph-controls">
          <button class="control-btn zoom-in">+</button>
          <button class="control-btn zoom-out">-</button>
          <button class="control-btn reset">Reset</button>
          <select class="layout-select">
            <option value="force">Force</option>
            <option value="radial">Radial</option>
            <option value="hierarchical">Hierarchical</option>
          </select>
        </div>
        <div class="graph-legend">
          <div class="legend-title">Categories</div>
          <div class="legend-items">
            ${this.getCategoryLegendHTML()}
          </div>
        </div>
      </div>
    `;

    if (!this.knowledgeGraph) {
      await this.initializeKnowledgeGraph();
    }

    if (this.knowledgeGraph) {
      await this.updateKnowledgeGraphData();
      this.setupGraphControls();
    }
  }

  private getCategoryLegendHTML(): string {
    const categories = [
      ...new Set(this.filteredContent.map((c) => c.category || "other")),
    ];
    return categories
      .map(
        (category) => `
      <div class="legend-item">
        <span class="legend-color" style="background: ${this.getCategoryColor(
          category
        )}"></span>
        <span class="legend-label">${
          category.charAt(0).toUpperCase() + category.slice(1)
        }</span>
      </div>
    `
      )
      .join("");
  }

  private setupGraphControls(): void {
    const container = this.graphView?.querySelector(".graph-container");
    if (!container || !this.knowledgeGraph) return;

    const zoomIn = container.querySelector(".zoom-in");
    const zoomOut = container.querySelector(".zoom-out");
    const reset = container.querySelector(".reset");
    const layoutSelect = container.querySelector(
      ".layout-select"
    ) as HTMLSelectElement;

    zoomIn?.addEventListener("click", () => this.knowledgeGraph?.zoomIn());
    zoomOut?.addEventListener("click", () => this.knowledgeGraph?.zoomOut());
    reset?.addEventListener("click", () => this.knowledgeGraph?.resetView());
    layoutSelect?.addEventListener("change", (e) => {
      const layout = (e.target as HTMLSelectElement).value;
      this.knowledgeGraph?.setLayout(layout);
    });
  }

  private renderAnalyticsView(): void {
    if (!this.analyticsView) return;

    this.analyticsView.style.display = "block";

    if (this.analyticsData) {
      this.updateAnalyticsDisplay(this.analyticsData);
    }
  }

  private createListItem(content: StoredContent): HTMLElement {
    const item = document.createElement("div");
    item.className = "content-item";
    item.dataset.contentId = content.id;

    const summary =
      content.summaries?.quick || content.content.substring(0, 200) + "...";

    const tags =
      content.tags
        ?.slice(0, 5)
        .map((tag) => `<span class="tag">${tag}</span>`)
        .join("") || "";

    const timeAgo = this.formatTimeAgo(new Date(content.timestamp));
    const readingTime = content.metadata.readingTime || 0;

    item.innerHTML = `
      <div class="content-item-header">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <input type="checkbox" class="content-checkbox" data-content-id="${content.id}" 
                 onchange="dashboard.toggleContentSelection('${content.id}')"
                 style="margin-top: 4px;">
          <div>
            <div class="content-item-title">${content.title}</div>
            <div class="content-item-meta">
              <span>${timeAgo}</span>
              <span>•</span>
              <span>${readingTime} min read</span>
              <span>•</span>
              <span>${content.metadata.pageType}</span>
              <span>•</span>
              <span>Accessed ${content.timesAccessed} times</span>
            </div>
          </div>
        </div>
        <div class="content-item-actions">
          <button class="action-btn" onclick="dashboard.openContent('${content.id}')">Open</button>
          <button class="action-btn" onclick="dashboard.editContent('${content.id}')">Edit</button>
          <button class="action-btn" onclick="dashboard.deleteContent('${content.id}')">Delete</button>
        </div>
      </div>
      <div class="content-item-summary">${summary}</div>
      <div class="content-item-tags">${tags}</div>
    `;

    item.addEventListener("click", (e) => {
      if (!(e.target as HTMLElement).closest(".content-item-actions")) {
        this.openContent(content.id);
      }
    });

    return item;
  }

  private createGridCard(content: StoredContent): HTMLElement {
    const card = document.createElement("div");
    card.className = "content-card";
    card.dataset.contentId = content.id;

    const summary =
      content.summaries?.tldr || content.content.substring(0, 150) + "...";

    const timeAgo = this.formatTimeAgo(new Date(content.timestamp));
    const readingTime = content.metadata.readingTime || 0;

    card.innerHTML = `
      <div class="content-card-image">
        ${
          content.screenshot
            ? `<img src="${content.screenshot}" alt="Screenshot" style="width: 100%; height: 100%; object-fit: cover;">`
            : `<span>📄 ${content.metadata.pageType}</span>`
        }
      </div>
      <div class="content-card-body">
        <div class="content-card-title">${content.title}</div>
        <div class="content-card-summary">${summary}</div>
        <div class="content-card-meta">
          <span>${timeAgo}</span>
          <span>${readingTime}m</span>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      this.openContent(content.id);
    });

    return card;
  }

  private async initializeKnowledgeGraph(): Promise<void> {
    try {
      const container = document.getElementById("knowledgeGraph");
      if (!container) return;

      // Initialize the interactive knowledge graph with enhanced options
      this.knowledgeGraph = new InteractiveKnowledgeGraph(container, {
        width: container.clientWidth,
        height: container.clientHeight || 600,
        showLabels: true,
        showClusters: true,
        enableDrag: true,
        enableZoom: true,
        defaultZoom: 0.8,
        nodeSize: {
          min: 10,
          max: 30,
          defaultSize: 20,
          property: "importance",
        },
        edgeWidth: {
          min: 1,
          max: 5,
          defaultWidth: 2,
          property: "strength",
        },
        colors: {
          node: this.getCategoryColor.bind(this),
          edge: "#9aa0a6",
          cluster: {
            article: "#e8f0fe",
            documentation: "#e6f4ea",
            video: "#fce8e6",
            social: "#fff7e6",
            other: "#f1f3f4",
          },
        },
        onNodeClick: (nodeId) => this.openContent(nodeId),
        onNodeHover: (nodeId) => {
          const content = this.filteredContent.find((c) => c.id === nodeId);
          if (content) {
            // Show tooltip with content details
            const tooltip = document.createElement("div");
            tooltip.className = "graph-tooltip";
            tooltip.innerHTML = `
              <h4>${content.title}</h4>
              <p>${content.category || "Uncategorized"}</p>
              <div class="tooltip-stats">
                <span>Views: ${content.timesAccessed || 0}</span>
                <span>Importance: ${content.importance || 0}</span>
              </div>
            `;
            // Position tooltip near mouse
            // Implementation depends on your tooltip system
          }
        },
        layout: {
          name: "force",
          options: {
            gravity: -50,
            linkDistance: 100,
            linkStrength: 1,
            friction: 0.9,
            charge: -500,
          },
        },
      });

      // Initialize with current data
      await this.updateKnowledgeGraphData();

      // Add window resize handler
      window.addEventListener("resize", () => {
        if (this.knowledgeGraph && container) {
          this.knowledgeGraph.setSize(
            container.clientWidth,
            container.clientHeight
          );
        }
      });
    } catch (error) {
      console.error("Failed to initialize knowledge graph:", error);
      throw error;
    }
  }

  private async updateKnowledgeGraphData(): Promise<void> {
    if (!this.knowledgeGraph) return;

    try {
      // Load relationships from storage
      const relationships = await this.loadContentRelationships();

      // Create nodes from current content
      const nodes: GraphNode[] = this.currentContent.map((content) => ({
        id: content.id,
        title: content.title,
        category: content.category || "other",
        importance: content.importance || 5,
        timesAccessed: content.timesAccessed,
        concepts: content.concepts || [],
        position: content.graphPosition || this.generateRandomPosition(),
      }));

      // Create edges from relationships
      const edges: GraphEdge[] = relationships.map((rel) => ({
        source: rel.sourceId,
        target: rel.targetId,
        type: rel.type as GraphEdge["type"],
        strength: rel.strength,
        confidence: rel.confidence,
      }));

      // Generate clusters
      const clusters: GraphCluster[] = this.generateClusters(nodes);

      // Update the graph
      this.knowledgeGraph.setData(nodes, edges, clusters);
    } catch (error) {
      console.error("Failed to update knowledge graph data:", error);
    }
  }

  private async loadContentRelationships(): Promise<ContentRelationship[]> {
    // This would typically load from the relationships store
    // For now, return empty array as relationships are handled by other tasks
    return [];
  }

  private generateRandomPosition(): { x: number; y: number } {
    return {
      x: Math.random() * 800 + 100,
      y: Math.random() * 600 + 100,
    };
  }

  private generateClusters(nodes: GraphNode[]): GraphCluster[] {
    // Simple clustering by category
    const clusters = new Map<string, GraphNode[]>();

    nodes.forEach((node) => {
      const category = node.category || "other";
      if (!clusters.has(category)) {
        clusters.set(category, []);
      }
      clusters.get(category)!.push(node);
    });

    return Array.from(clusters.entries()).map(([category, clusterNodes]) => ({
      id: category,
      name: category.charAt(0).toUpperCase() + category.slice(1),
      nodes: clusterNodes.map((n) => n.id),
      color: this.getCategoryColor(category),
    }));
  }

  private getCategoryColor(category: string): string {
    const colors = {
      article: "#4285f4",
      documentation: "#34a853",
      video: "#ea4335",
      social: "#fbbc04",
      other: "#9aa0a6",
    } as const;
    return colors[category as keyof typeof colors] ?? colors.other;
  }

  private async loadAnalyticsData(): Promise<void> {
    try {
      this.analyticsData = this.analyticsEngine.generateAnalytics(
        this.currentContent
      );
    } catch (error) {
      console.error("Failed to load analytics data:", error);
      this.analyticsData = {
        totalItems: 0,
        thisWeekItems: 0,
        thisMonthItems: 0,
        mostActiveDay: null,
        topCategory: null,
        searchCount: 0,
        captureActivity: [],
        categoryDistribution: [],
        readingTimeStats: { total: 0, average: 0, median: 0 },
        accessPatterns: {
          mostAccessed: [],
          recentlyAccessed: [],
          neverAccessed: [],
        },
        contentGrowth: [],
        languageDistribution: [],
        importanceDistribution: [],
      };
    }
  }

  private updateAnalyticsDisplay(data: AnalyticsData): void {
    // Update analytics cards
    const totalEl = document.getElementById("analyticsTotal");
    const mostActiveEl = document.getElementById("analyticsMostActive");
    const mostActiveCountEl = document.getElementById(
      "analyticsMostActiveCount"
    );
    const topCategoryEl = document.getElementById("analyticsTopCategory");
    const topCategoryCountEl = document.getElementById(
      "analyticsTopCategoryCount"
    );
    const searchesEl = document.getElementById("analyticsSearches");

    if (totalEl) totalEl.textContent = data.totalItems.toString();
    if (mostActiveEl && data.mostActiveDay) {
      mostActiveEl.textContent = new Date(
        data.mostActiveDay.date
      ).toLocaleDateString("en-US", { weekday: "long" });
    }
    if (mostActiveCountEl && data.mostActiveDay) {
      mostActiveCountEl.textContent = `${data.mostActiveDay.count} captures`;
    }
    if (topCategoryEl && data.topCategory) {
      topCategoryEl.textContent = data.topCategory.name;
    }
    if (topCategoryCountEl && data.topCategory) {
      topCategoryCountEl.textContent = `${data.topCategory.count} items`;
    }
    if (searchesEl) searchesEl.textContent = data.searchCount.toString();

    // Render charts
    this.renderAnalyticsCharts(data);
  }

  private renderAnalyticsCharts(data: AnalyticsData): void {
    // Render capture activity chart
    const chartContainer = document.querySelector(".chart-container");
    if (chartContainer && data.captureActivity.length > 0) {
      const chartRenderer = new ChartRenderer(chartContainer as HTMLElement, {
        width: 600,
        height: 200,
      });
      chartRenderer.renderLineChart(
        data.captureActivity,
        "Capture Activity (Last 30 Days)"
      );
    }

    // Add more charts as needed
    // Could add category distribution pie chart, reading time histogram, etc.
  }

  private async updateStats(): Promise<void> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalItems = this.currentContent.length;
    const thisWeekItems = this.currentContent.filter(
      (content) => new Date(content.timestamp) >= sevenDaysAgo
    ).length;

    if (this.totalItemsEl)
      this.totalItemsEl.textContent = totalItems.toString();
    if (this.thisWeekEl) this.thisWeekEl.textContent = thisWeekItems.toString();
  }

  private updateContentTitle(): void {
    if (!this.contentTitle) return;

    const count = this.filteredContent.length;
    const total = this.currentContent.length;

    let title = "Your Knowledge Base";
    if (count !== total) {
      title += ` (${count} of ${total})`;
    } else if (count > 0) {
      title += ` (${count} items)`;
    }

    this.contentTitle.textContent = title;
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }

  private showLoading(): void {
    if (this.loadingState) this.loadingState.style.display = "flex";
    if (this.emptyState) this.emptyState.style.display = "none";
    this.hideAllViews();
  }

  private hideLoading(): void {
    if (this.loadingState) this.loadingState.style.display = "none";
  }

  private showEmptyState(): void {
    if (this.emptyState) this.emptyState.style.display = "block";
    this.hideAllViews();
  }

  // Public methods for global access
  async openContent(contentId: string): Promise<void> {
    try {
      const result = await this.contentStore.read(contentId);
      if (result.success && result.data) {
        // Open content in a new tab or modal
        window.open(result.data.url, "_blank");
      }
    } catch (error) {
      console.error("Failed to open content:", error);
    }
  }

  async editContent(contentId: string): Promise<void> {
    // Implementation for editing content
    console.log("Edit content:", contentId);
  }

  async deleteContent(contentId: string): Promise<void> {
    if (confirm("Are you sure you want to delete this content?")) {
      try {
        const result = await this.contentStore.delete(contentId);
        if (result.success) {
          // Remove from current arrays
          this.currentContent = this.currentContent.filter(
            (c) => c.id !== contentId
          );
          this.filteredContent = this.filteredContent.filter(
            (c) => c.id !== contentId
          );

          // Remove from selection
          this.selectedContentIds.delete(contentId);

          // Refresh display
          await this.updateStats();
          this.renderCurrentView();
          this.updateSelectionUI();
        }
      } catch (error) {
        console.error("Failed to delete content:", error);
      }
    }
  }

  toggleContentSelection(contentId: string): void {
    if (this.selectedContentIds.has(contentId)) {
      this.selectedContentIds.delete(contentId);
    } else {
      this.selectedContentIds.add(contentId);
    }
    this.updateSelectionUI();
  }

  private async handleCapturePage(): Promise<void> {
    // Send message to background script to capture current page
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id!, { action: "captureContent" });
      }
    } catch (error) {
      console.error("Failed to capture page:", error);
    }
  }

  private async handleExportData(): Promise<void> {
    try {
      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        content: this.currentContent.map((content) => ({
          ...content,
          // Remove binary data for export
          screenshot: content.screenshot
            ? "[Screenshot data removed]"
            : undefined,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `synapse-export-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export data:", error);
    }
  }

  private handleGraphZoom(direction: "in" | "out"): void {
    if (!this.knowledgeGraph) return;

    if (direction === "in") {
      this.knowledgeGraph.zoomIn();
    } else {
      this.knowledgeGraph.zoomOut();
    }
  }

  private handleGraphReset(): void {
    if (!this.knowledgeGraph) return;
    this.knowledgeGraph.resetView();
  }

  // Content Management Methods
  private selectAllContent(): void {
    this.selectedContentIds.clear();
    this.filteredContent.forEach((content) => {
      this.selectedContentIds.add(content.id);
    });
    this.updateSelectionUI();
  }

  private clearSelection(): void {
    this.selectedContentIds.clear();
    this.updateSelectionUI();
  }

  private updateSelectionUI(): void {
    const count = this.selectedContentIds.size;
    const bulkActionsDropdown = document.getElementById("bulkActionsDropdown");
    const bulkActionsBtn = document.getElementById("bulkActionsBtn");

    if (bulkActionsDropdown) {
      bulkActionsDropdown.style.display = count > 0 ? "block" : "none";
    }
    if (bulkActionsBtn) {
      bulkActionsBtn.style.display = count > 0 ? "inline-flex" : "none";
      bulkActionsBtn.textContent = `📋 ${count} Selected`;
    }

    // Update checkboxes in content items
    document.querySelectorAll(".content-checkbox").forEach((checkbox) => {
      const contentId = (checkbox as HTMLInputElement).dataset.contentId;
      if (contentId) {
        (checkbox as HTMLInputElement).checked =
          this.selectedContentIds.has(contentId);
      }
    });
  }

  private showBulkActionModal(): void {
    const bulkActionSelect = document.getElementById(
      "bulkActionSelect"
    ) as HTMLSelectElement;
    if (!bulkActionSelect || !bulkActionSelect.value) {
      alert("Please select an action first.");
      return;
    }

    const actionType = bulkActionSelect.value;
    const modal = document.getElementById("bulkActionsModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalContent = document.getElementById("modalContent");

    if (!modal || !modalTitle || !modalContent) return;

    modalTitle.textContent = this.getBulkActionTitle(actionType);
    modalContent.innerHTML = this.getBulkActionContent(actionType);

    modal.style.display = "flex";

    // Setup confirm button
    const confirmBtn = document.getElementById("confirmBulkAction");
    if (confirmBtn) {
      confirmBtn.onclick = () => this.executeBulkAction(actionType);
    }
  }

  private getBulkActionTitle(actionType: string): string {
    const titles: Record<string, string> = {
      delete: "Delete Selected Content",
      updateCategory: "Change Category",
      addTags: "Add Tags",
      removeTags: "Remove Tags",
      updateImportance: "Set Importance Level",
      export: "Export Selected Content",
    };
    return titles[actionType] || "Bulk Action";
  }

  private getBulkActionContent(actionType: string): string {
    const count = this.selectedContentIds.size;

    switch (actionType) {
      case "delete":
        return `
                    <div class="selected-count">${count} items selected</div>
                    <p>Are you sure you want to delete the selected content? This action cannot be undone.</p>
                `;

      case "updateCategory":
        return `
                    <div class="selected-count">${count} items selected</div>
                    <div class="form-group">
                        <label class="form-label">New Category</label>
                        <select id="newCategory" class="form-input">
                            <option value="article">Article</option>
                            <option value="documentation">Documentation</option>
                            <option value="video">Video</option>
                            <option value="social">Social Media</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                `;

      case "addTags":
        return `
                    <div class="selected-count">${count} items selected</div>
                    <div class="form-group">
                        <label class="form-label">Tags to Add (comma-separated)</label>
                        <input type="text" id="newTags" class="form-input" placeholder="tag1, tag2, tag3">
                    </div>
                `;

      case "removeTags":
        return `
                    <div class="selected-count">${count} items selected</div>
                    <div class="form-group">
                        <label class="form-label">Tags to Remove (comma-separated)</label>
                        <input type="text" id="tagsToRemove" class="form-input" placeholder="tag1, tag2, tag3">
                    </div>
                `;

      case "updateImportance":
        return `
                    <div class="selected-count">${count} items selected</div>
                    <div class="form-group">
                        <label class="form-label">Importance Level (1-10)</label>
                        <input type="range" id="importanceLevel" class="form-input" min="1" max="10" value="5">
                        <div style="text-align: center; margin-top: 8px;">
                            <span id="importanceValue">5</span>
                        </div>
                    </div>
                    <script>
                        document.getElementById('importanceLevel').addEventListener('input', function() {
                            document.getElementById('importanceValue').textContent = this.value;
                        });
                    </script>
                `;

      case "export":
        return `
                    <div class="selected-count">${count} items selected</div>
                    <p>Export the selected content as a JSON file.</p>
                    <div class="form-group">
                        <label class="form-label">Export Format</label>
                        <select id="exportFormat" class="form-input">
                            <option value="json">JSON</option>
                            <option value="markdown">Markdown</option>
                            <option value="csv">CSV</option>
                        </select>
                    </div>
                `;

      default:
        return "<p>Unknown action type.</p>";
    }
  }

  private async executeBulkAction(actionType: string): Promise<void> {
    const contentIds = Array.from(this.selectedContentIds);
    let operation: BulkOperation;

    try {
      switch (actionType) {
        case "delete":
          operation = { type: "delete", contentIds };
          break;

        case "updateCategory":
          const newCategory = (
            document.getElementById("newCategory") as HTMLSelectElement
          )?.value;
          if (!newCategory) throw new Error("Please select a category");
          operation = {
            type: "updateCategory",
            contentIds,
            parameters: { category: newCategory },
          };
          break;

        case "addTags":
          const newTagsInput = (
            document.getElementById("newTags") as HTMLInputElement
          )?.value;
          if (!newTagsInput) throw new Error("Please enter tags to add");
          const newTags = newTagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag);
          operation = {
            type: "addTags",
            contentIds,
            parameters: { tags: newTags },
          };
          break;

        case "removeTags":
          const removeTagsInput = (
            document.getElementById("tagsToRemove") as HTMLInputElement
          )?.value;
          if (!removeTagsInput) throw new Error("Please enter tags to remove");
          const tagsToRemove = removeTagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag);
          operation = {
            type: "removeTags",
            contentIds,
            parameters: { tags: tagsToRemove },
          };
          break;

        case "updateImportance":
          const importance = parseInt(
            (document.getElementById("importanceLevel") as HTMLInputElement)
              ?.value || "5"
          );
          operation = {
            type: "updateImportance",
            contentIds,
            parameters: { importance },
          };
          break;

        case "export":
          await this.exportSelectedContent(contentIds);
          this.closeBulkActionsModal();
          return;

        default:
          throw new Error("Unknown action type");
      }

      // Show loading state
      const confirmBtn = document.getElementById("confirmBulkAction");
      if (confirmBtn) {
        confirmBtn.textContent = "Processing...";
        confirmBtn.setAttribute("disabled", "true");
      }

      // Execute the operation
      const result = await this.contentManager.performBulkOperation(operation);

      // Show results
      if (result.failed > 0) {
        alert(
          `Operation completed with ${result.success} successes and ${
            result.failed
          } failures.\n\nErrors:\n${result.errors.join("\n")}`
        );
      } else {
        alert(
          `Operation completed successfully! ${result.success} items processed.`
        );
      }

      // Refresh the content
      await this.loadInitialData();
      this.clearSelection();
      this.closeBulkActionsModal();
    } catch (error) {
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async exportSelectedContent(contentIds: string[]): Promise<void> {
    const format =
      (document.getElementById("exportFormat") as HTMLSelectElement)?.value ||
      "json";

    // Get the selected content
    const selectedContent = this.currentContent.filter((content) =>
      contentIds.includes(content.id)
    );

    let exportData: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case "json":
        exportData = JSON.stringify(
          {
            version: "1.0",
            exportDate: new Date().toISOString(),
            count: selectedContent.length,
            content: selectedContent.map((content) => ({
              ...content,
              screenshot: content.screenshot
                ? "[Screenshot data removed]"
                : undefined,
            })),
          },
          null,
          2
        );
        filename = `synapse-export-${
          new Date().toISOString().split("T")[0]
        }.json`;
        mimeType = "application/json";
        break;

      case "markdown":
        exportData = selectedContent
          .map(
            (content) => `
# ${content.title}

**URL:** ${content.url}
**Date:** ${new Date(content.timestamp).toLocaleDateString()}
**Category:** ${content.category || "Other"}
**Tags:** ${content.tags?.join(", ") || "None"}

## Summary
${content.summaries?.quick || "No summary available"}

## Content
${content.content}

---
`
          )
          .join("\n");
        filename = `synapse-export-${
          new Date().toISOString().split("T")[0]
        }.md`;
        mimeType = "text/markdown";
        break;

      case "csv":
        const csvHeaders = [
          "Title",
          "URL",
          "Date",
          "Category",
          "Tags",
          "Summary",
        ];
        const csvRows = selectedContent.map((content) => [
          `"${content.title.replace(/"/g, '""')}"`,
          `"${content.url}"`,
          `"${new Date(content.timestamp).toLocaleDateString()}"`,
          `"${content.category || "Other"}"`,
          `"${content.tags?.join(", ") || ""}"`,
          `"${(content.summaries?.quick || "").replace(/"/g, '""')}"`,
        ]);
        exportData = [
          csvHeaders.join(","),
          ...csvRows.map((row) => row.join(",")),
        ].join("\n");
        filename = `synapse-export-${
          new Date().toISOString().split("T")[0]
        }.csv`;
        mimeType = "text/csv";
        break;

      default:
        throw new Error("Unsupported export format");
    }

    // Download the file
    const blob = new Blob([exportData], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public closeBulkActionsModal(): void {
    const modal = document.getElementById("bulkActionsModal");
    if (modal) {
      modal.style.display = "none";
    }

    // Reset confirm button
    const confirmBtn = document.getElementById("confirmBulkAction");
    if (confirmBtn) {
      confirmBtn.textContent = "Confirm";
      confirmBtn.removeAttribute("disabled");
    }
  }
}

// Initialize dashboard when script loads
const dashboard = new DashboardController();

// Make dashboard available globally for HTML onclick handlers
(window as any).dashboard = dashboard;
