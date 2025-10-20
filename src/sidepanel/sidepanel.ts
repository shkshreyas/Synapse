import { MessageHandler } from '../utils/messaging';
import { ContentStore } from '../storage/contentStore';
import { NaturalLanguageSearch } from '../search/naturalLanguageSearch';
import { StoredContent } from '../types/storage';

/**
 * Side panel script for MindScribe Chrome extension
 * Handles context-aware content suggestions, related content display, and quick chat interface
 */
class SidePanelController {
  private relatedContent?: HTMLElement | undefined;
  private chatInterface?: HTMLElement | undefined;
  private chatInput?: HTMLTextAreaElement;
  private chatMessages?: HTMLElement | undefined;
  private statusElement?: HTMLElement | undefined;
  private contentStore: ContentStore;
  private searchEngine: NaturalLanguageSearch;
  private currentPageUrl?: string;
  private currentPageTitle?: string;
  private chatHistory: Array<{ message: string, sender: 'user' | 'assistant', timestamp: Date }> = [];

  constructor() {
    this.contentStore = ContentStore.getInstance();
    this.searchEngine = NaturalLanguageSearch.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log('MindScribe side panel initializing...');

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupUI());
    } else {
      this.setupUI();
    }
  }

  private setupUI(): void {
    // Get DOM elements
    this.relatedContent = document.getElementById('relatedContent') || undefined;
    this.chatInterface = document.getElementById('chatInterface') || undefined;
    this.chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
    this.chatMessages = document.getElementById('chatMessages') || undefined;
    this.statusElement = document.getElementById('status') || undefined;

    // Set up event listeners
    this.setupEventListeners();

    // Load contextual content for current page
    this.loadContextualContent();

    // Set up auto-refresh for related content
    this.setupAutoRefresh();

    console.log('MindScribe side panel UI initialized');
  }

  private setupEventListeners(): void {
    // Chat input with auto-resize
    if (this.chatInput) {
      this.chatInput.addEventListener('input', () => {
        this.autoResizeTextarea();
      });

      this.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const message = this.chatInput!.value.trim();
          if (message) {
            this.handleChatMessage(message);
            this.chatInput!.value = '';
            this.autoResizeTextarea();
          }
        }
      });
    }

    // Chat send button
    const chatSendButton = document.getElementById('chatSendButton');
    if (chatSendButton) {
      chatSendButton.addEventListener('click', () => {
        if (this.chatInput) {
          const message = this.chatInput.value.trim();
          if (message) {
            this.handleChatMessage(message);
            this.chatInput.value = '';
            this.autoResizeTextarea();
          }
        }
      });
    }

    // Quick capture button
    const quickCaptureButton = document.getElementById('quickCaptureButton');
    if (quickCaptureButton) {
      quickCaptureButton.addEventListener('click', () => {
        this.handleQuickCapture();
      });
    }

    // Refresh related content button
    const refreshButton = document.getElementById('refreshRelatedButton');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        this.loadContextualContent();
      });
    }

    // Listen for tab changes to update related content
    chrome.tabs.onActivated.addListener(() => {
      this.loadContextualContent();
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === 'complete') {
        this.loadContextualContent();
      }
    });
  }

  private autoResizeTextarea(): void {
    if (!this.chatInput) return;

    this.chatInput.style.height = 'auto';
    this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 60) + 'px';
  }

  private setupAutoRefresh(): void {
    // Refresh related content every 30 seconds if the page has changed
    setInterval(async () => {
      try {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        });

        if (activeTab?.url && activeTab.url !== this.currentPageUrl) {
          this.loadContextualContent();
        }
      } catch (error) {
        console.error('Auto-refresh error:', error);
      }
    }, 30000);
  }

  private async loadContextualContent(): Promise<void> {
    if (!this.relatedContent) return;

    this.updateStatus('Loading related content...');

    try {
      // Get current tab info
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      if (!activeTab?.url) {
        throw new Error('No active tab found');
      }

      this.currentPageUrl = activeTab.url;
      this.currentPageTitle = activeTab.title || 'Unknown';

      // Get related content based on current page
      const relatedContent = await this.findRelatedContent(activeTab.url, activeTab.title || '');

      // Get context-aware suggestions
      const suggestions = await this.getContextAwareSuggestions(activeTab.url, activeTab.title || '');

      // Build the related content HTML
      let html = '';

      // Current page info
      html += `
        <div class="related-section">
          <div class="section-title">Current Page</div>
          <div class="related-item current-page">
            <div class="related-title">${this.escapeHtml(this.currentPageTitle)}</div>
            <div class="related-subtitle">${this.extractDomain(activeTab.url)}</div>
          </div>
        </div>
      `;

      // Related saved content
      if (relatedContent.length > 0) {
        html += `
          <div class="related-section">
            <div class="section-title">
              Related Content
              <span class="count">${relatedContent.length}</span>
            </div>
        `;

        relatedContent.forEach(content => {
          const timeAgo = this.formatTimeAgo(new Date(content.timestamp));
          html += `
            <div class="related-item" data-content-id="${content.id}">
              <div class="related-title">${this.escapeHtml(content.title)}</div>
              <div class="related-subtitle">${this.extractDomain(content.url)} • ${timeAgo}</div>
              <div class="related-summary">${this.escapeHtml(content.summaries?.tldr || '')}</div>
            </div>
          `;
        });

        html += '</div>';
      }

      // Context-aware suggestions
      if (suggestions.length > 0) {
        html += `
          <div class="related-section">
            <div class="section-title">
              Suggestions
              <span class="count">${suggestions.length}</span>
            </div>
        `;

        suggestions.forEach(suggestion => {
          const timeAgo = this.formatTimeAgo(new Date(suggestion.timestamp));
          html += `
            <div class="related-item suggestion" data-content-id="${suggestion.id}">
              <div class="related-title">${this.escapeHtml(suggestion.title)}</div>
              <div class="related-subtitle">${this.extractDomain(suggestion.url)} • ${timeAgo}</div>
              <div class="suggestion-reason">${suggestion.reason}</div>
            </div>
          `;
        });

        html += '</div>';
      }

      // If no related content found
      if (relatedContent.length === 0 && suggestions.length === 0) {
        html += `
          <div class="related-section">
            <div class="section-title">Related Content</div>
            <div class="related-item empty">
              <div class="related-title">No related content found</div>
              <div class="related-subtitle">Capture some content to see connections!</div>
            </div>
          </div>
        `;
      }

      this.relatedContent.innerHTML = html;

      // Add click listeners to related items
      this.relatedContent.querySelectorAll('.related-item[data-content-id]').forEach(item => {
        item.addEventListener('click', (e) => {
          const contentId = (e.currentTarget as HTMLElement).dataset.contentId;
          if (contentId) {
            this.openContentPreview(contentId);
          }
        });
      });

      this.updateStatus('');

    } catch (error) {
      console.error('Error loading contextual content:', error);
      this.updateStatus('Error loading related content', 'error');

      if (this.relatedContent) {
        this.relatedContent.innerHTML = `
          <div class="error-message">
            Unable to load related content. Please try again.
          </div>
        `;
      }
    }
  }

  private async findRelatedContent(url: string, title: string): Promise<StoredContent[]> {
    try {
      // Extract keywords from current page title and URL
      const keywords = this.extractKeywords(title + ' ' + url);

      if (keywords.length === 0) {
        return [];
      }

      // Search for related content using natural language search
      const searchResult = await this.searchEngine.search(keywords.join(' '), {
        maxResults: 5,
        useSemanticSearch: true,
        minRelevanceScore: 0.2
      });

      if (searchResult.success && searchResult.semanticMatches) {
        // Get full content details for the matches
        const relatedContent: StoredContent[] = [];

        for (const match of searchResult.semanticMatches) {
          const contentResult = await this.contentStore.read(match.contentId);
          if (contentResult.success && contentResult.data) {
            relatedContent.push(contentResult.data);
          }
        }

        return relatedContent;
      }

      return [];

    } catch (error) {
      console.error('Error finding related content:', error);
      return [];
    }
  }

  private async getContextAwareSuggestions(url: string, title: string): Promise<Array<StoredContent & { reason: string }>> {
    try {
      // Get recent content that might be contextually relevant
      const recentResult = await this.contentStore.list({
        sortBy: 'lastAccessed',
        sortDirection: 'desc',
        limit: 20
      });

      if (!recentResult.success || !recentResult.data) {
        return [];
      }

      const suggestions: Array<StoredContent & { reason: string }> = [];
      const domain = this.extractDomain(url);
      const keywords = this.extractKeywords(title);

      for (const content of recentResult.data) {
        let reason = '';
        let score = 0;

        // Same domain
        if (this.extractDomain(content.url) === domain) {
          reason = 'Same website';
          score += 0.4;
        }

        // Similar keywords
        const contentKeywords = this.extractKeywords(content.title + ' ' + content.content);
        const commonKeywords = keywords.filter(k => contentKeywords.includes(k));
        if (commonKeywords.length > 0) {
          reason = reason ? `${reason} • Similar topics` : 'Similar topics';
          score += (commonKeywords.length / keywords.length) * 0.3;
        }

        // Recently accessed
        const daysSinceAccess = (Date.now() - new Date(content.lastAccessed).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceAccess < 7) {
          reason = reason ? `${reason} • Recently viewed` : 'Recently viewed';
          score += 0.2;
        }

        // Same category
        if (content.category && this.inferPageCategory(title, url) === content.category) {
          reason = reason ? `${reason} • Same category` : 'Same category';
          score += 0.1;
        }

        if (score > 0.3 && reason) {
          suggestions.push({
            ...content,
            reason
          });
        }
      }

      // Sort by relevance score and return top 3
      return suggestions
        .sort((a, b) => b.timesAccessed - a.timesAccessed)
        .slice(0, 3);

    } catch (error) {
      console.error('Error getting context-aware suggestions:', error);
      return [];
    }
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'how', 'what', 'when', 'where', 'why', 'who']);

    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Limit to top 10 keywords
  }

  private inferPageCategory(title: string, url: string): string {
    const text = (title + ' ' + url).toLowerCase();

    if (text.includes('github') || text.includes('code') || text.includes('programming')) return 'code';
    if (text.includes('tutorial') || text.includes('guide') || text.includes('how-to')) return 'tutorial';
    if (text.includes('documentation') || text.includes('docs') || text.includes('api')) return 'documentation';
    if (text.includes('news') || text.includes('article') || text.includes('blog')) return 'article';
    if (text.includes('video') || text.includes('youtube') || text.includes('watch')) return 'video';
    if (text.includes('stackoverflow') || text.includes('forum') || text.includes('discussion')) return 'forum';

    return 'other';
  }

  private async openContentPreview(contentId: string): Promise<void> {
    try {
      const contentResult = await this.contentStore.read(contentId);

      if (contentResult.success && contentResult.data) {
        // For now, open in dashboard. In a full implementation, we might show an inline preview
        const dashboardUrl = chrome.runtime.getURL(`dashboard.html?content=${contentId}`);
        chrome.tabs.create({ url: dashboardUrl });
      }
    } catch (error) {
      console.error('Error opening content preview:', error);
      this.updateStatus('Error opening content', 'error');
    }
  }

  private async handleChatMessage(message: string): Promise<void> {
    console.log('Chat message:', message);

    // Add user message to chat
    this.addChatMessage(message, 'user');
    this.chatHistory.push({ message, sender: 'user', timestamp: new Date() });

    // Show typing indicator
    this.addChatMessage('Thinking...', 'assistant', true);

    try {
      // Analyze the message to determine intent
      const intent = this.analyzeChatIntent(message);
      let response = '';

      switch (intent.type) {
        case 'search':
          response = await this.handleSearchQuery(message, intent.keywords);
          break;
        case 'current_page':
          response = await this.handleCurrentPageQuery(message);
          break;
        case 'related':
          response = await this.handleRelatedContentQuery(message);
          break;
        case 'summary':
          response = await this.handleSummaryRequest(message, intent.keywords);
          break;
        default:
          response = await this.handleGeneralQuery(message);
      }

      // Remove typing indicator and add response
      this.removeChatMessage();
      this.addChatMessage(response, 'assistant');
      this.chatHistory.push({ message: response, sender: 'assistant', timestamp: new Date() });

    } catch (error) {
      console.error('Chat error:', error);
      this.removeChatMessage();
      this.addChatMessage('Sorry, there was an error processing your message. Please try again.', 'assistant');
    }
  }

  private analyzeChatIntent(message: string): { type: string, keywords: string[] } {
    const lowerMessage = message.toLowerCase();
    const keywords = this.extractKeywords(message);

    if (lowerMessage.includes('search') || lowerMessage.includes('find') || lowerMessage.includes('look for')) {
      return { type: 'search', keywords };
    }

    if (lowerMessage.includes('current page') || lowerMessage.includes('this page') || lowerMessage.includes('about this')) {
      return { type: 'current_page', keywords };
    }

    if (lowerMessage.includes('related') || lowerMessage.includes('similar') || lowerMessage.includes('connected')) {
      return { type: 'related', keywords };
    }

    if (lowerMessage.includes('summary') || lowerMessage.includes('summarize') || lowerMessage.includes('tldr')) {
      return { type: 'summary', keywords };
    }

    return { type: 'general', keywords };
  }

  private async handleSearchQuery(message: string, keywords: string[]): Promise<string> {
    try {
      const searchResult = await this.searchEngine.search(keywords.join(' '), {
        maxResults: 3,
        useSemanticSearch: true,
        minRelevanceScore: 0.2
      });

      if (searchResult.success && searchResult.semanticMatches && searchResult.semanticMatches.length > 0) {
        let response = `I found ${searchResult.semanticMatches.length} relevant items:\n\n`;

        for (const match of searchResult.semanticMatches.slice(0, 3)) {
          const contentResult = await this.contentStore.read(match.contentId);
          if (contentResult.success && contentResult.data) {
            response += `• **${contentResult.data.title}**\n`;
            response += `  ${contentResult.data.summaries?.tldr || 'No summary available'}\n\n`;
          }
        }

        return response;
      } else {
        return `I couldn't find any content matching "${keywords.join(' ')}". Try different keywords or capture more content first.`;
      }
    } catch (error) {
      return 'Sorry, I encountered an error while searching. Please try again.';
    }
  }

  private async handleCurrentPageQuery(message: string): Promise<string> {
    if (!this.currentPageUrl || !this.currentPageTitle) {
      return "I don't have information about the current page. Please make sure you're on a valid webpage.";
    }

    const domain = this.extractDomain(this.currentPageUrl);
    const relatedContent = await this.findRelatedContent(this.currentPageUrl, this.currentPageTitle);

    let response = `You're currently on **${this.currentPageTitle}** (${domain}).\n\n`;

    if (relatedContent.length > 0) {
      response += `I found ${relatedContent.length} related items in your knowledge base:\n\n`;
      relatedContent.slice(0, 2).forEach(content => {
        response += `• ${content.title}\n`;
      });
    } else {
      response += "I don't have any related content for this page yet. Would you like to capture it?";
    }

    return response;
  }

  private async handleRelatedContentQuery(message: string): Promise<string> {
    if (!this.currentPageUrl || !this.currentPageTitle) {
      return "I need to know what page you're on to find related content.";
    }

    const relatedContent = await this.findRelatedContent(this.currentPageUrl, this.currentPageTitle);

    if (relatedContent.length > 0) {
      let response = `Here are ${relatedContent.length} items related to the current page:\n\n`;

      relatedContent.forEach(content => {
        response += `• **${content.title}**\n`;
        response += `  ${content.summaries?.tldr || 'No summary available'}\n\n`;
      });

      return response;
    } else {
      return "I don't have any related content for this page. Try capturing some content first!";
    }
  }

  private async handleSummaryRequest(message: string, keywords: string[]): Promise<string> {
    try {
      if (keywords.length === 0) {
        return "What would you like me to summarize? Please specify a topic or search term.";
      }

      const searchResult = await this.searchEngine.search(keywords.join(' '), {
        maxResults: 1,
        useSemanticSearch: true,
        minRelevanceScore: 0.3
      });

      if (searchResult.success && searchResult.semanticMatches && searchResult.semanticMatches.length > 0) {
        const match = searchResult.semanticMatches[0];
        const contentResult = await this.contentStore.read(match.contentId);

        if (contentResult.success && contentResult.data && contentResult.data.summaries) {
          return `Here's a summary of "${contentResult.data.title}":\n\n${contentResult.data.summaries.detailed}`;
        }
      }

      return `I couldn't find content about "${keywords.join(' ')}" to summarize. Try searching for something else.`;
    } catch (error) {
      return 'Sorry, I encountered an error while creating the summary.';
    }
  }

  private async handleGeneralQuery(message: string): Promise<string> {
    // For general queries, provide helpful suggestions
    const suggestions = [
      "Try asking me to search for specific topics",
      "Ask about the current page you're viewing",
      "Request a summary of saved content",
      "Ask for related content suggestions"
    ];

    return `I'm here to help you with your saved content! Here are some things you can ask me:\n\n${suggestions.map(s => `• ${s}`).join('\n')}`;
  }

  private addChatMessage(message: string, sender: 'user' | 'assistant', isTyping = false): void {
    if (!this.chatMessages) return;

    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${sender}${isTyping ? ' typing' : ''}`;

    if (isTyping) {
      messageElement.id = 'typing-indicator';
      messageElement.textContent = message;
    } else {
      // Support basic markdown formatting
      messageElement.innerHTML = this.formatChatMessage(message);
    }

    this.chatMessages.appendChild(messageElement);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private formatChatMessage(message: string): string {
    return message
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  private removeChatMessage(): void {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  private async handleQuickCapture(): Promise<void> {
    console.log('Quick capture initiated from side panel');
    this.updateStatus('Capturing current page...');

    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      if (!activeTab?.url) {
        throw new Error('No active tab found');
      }

      const response = await MessageHandler.sendToBackground({
        type: 'CAPTURE_CONTENT',
        url: activeTab.url,
        manual: true,
        id: MessageHandler.generateMessageId()
      });

      if (response.success) {
        this.updateStatus('Content captured successfully!', 'success');
        // Refresh related content to include the new capture
        setTimeout(() => this.loadContextualContent(), 1000);

        // Add a chat message about the capture
        this.addChatMessage(`✅ Successfully captured "${activeTab.title || 'current page'}"!`, 'assistant');
      } else {
        this.updateStatus('Capture failed: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Quick capture error:', error);
      this.updateStatus('Capture error: ' + (error as Error).message, 'error');
    }
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private updateStatus(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    if (!this.statusElement) return;

    this.statusElement.textContent = message;
    this.statusElement.className = `status ${type}`;

    // Clear status after 3 seconds for non-error messages
    if (type !== 'error' && message) {
      setTimeout(() => {
        if (this.statusElement) {
          this.statusElement.textContent = '';
          this.statusElement.className = 'status';
        }
      }, 3000);
    }
  }
}

// Initialize side panel controller
new SidePanelController();