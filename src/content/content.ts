import { MessageHandler } from '../utils/messaging';
import { ExtensionMessage } from '../types/messages';

/**
 * Content script for MindScribe Chrome extension
 * Runs on all web pages to enable content capture and interaction
 */
class ContentScript {
  private isInitialized = false;
  private pageLoadTime: number;
  private highlightListener?: (event: Event) => void;

  constructor() {
    this.pageLoadTime = Date.now();
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) return;
    
    console.log('MindScribe content script initializing on:', window.location.href);
    
    // Set up message listeners
    this.setupMessageHandlers();
    
    // Set up page interaction listeners
    this.setupPageListeners();
    
    // Notify background that content script is ready
    this.notifyReady();
    
    this.isInitialized = true;
    console.log('MindScribe content script initialized');
  }

  private setupMessageHandlers(): void {
    MessageHandler.addListener(async (message: ExtensionMessage, sender, sendResponse) => {
      console.log('Content script received message:', message.type);
      
      try {
        switch (message.type) {
          case 'CAPTURE_CONTENT':
            return await this.handleCaptureContent(message);
            
          default:
            console.warn('Unknown message type in content script:', message.type);
            return { error: 'Unknown message type' };
        }
      } catch (error) {
        console.error('Error handling message in content script:', error);
        return { error: (error as Error).message };
      }
    });
  }

  private setupPageListeners(): void {
    // Listen for text selection/highlighting
    this.highlightListener = (event: Event) => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 10) {
        this.handleTextHighlight(selection.toString());
      }
    };
    
    document.addEventListener('mouseup', this.highlightListener);
    document.addEventListener('keyup', this.highlightListener);
    
    // Listen for page visibility changes (for time tracking)
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });
  }

  private async notifyReady(): Promise<void> {
    try {
      await MessageHandler.sendToBackground({
        type: 'CONTENT_SCRIPT_READY' as any,
        url: window.location.href,
        title: document.title,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error notifying background of content script ready:', error);
    }
  }

  private async handleCaptureContent(message: any): Promise<any> {
    console.log('Capturing content for:', window.location.href);
    
    try {
      // Extract basic page information
      const pageData = this.extractPageData();
      
      // For now, return basic page data
      // Content extraction will be implemented in task 2.1
      return {
        success: true,
        data: pageData,
        message: 'Basic page data captured - full content extraction will be implemented in task 2.1'
      };
    } catch (error) {
      console.error('Error capturing content:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  private extractPageData(): any {
    return {
      url: window.location.href,
      title: document.title,
      timestamp: new Date(),
      pageLoadTime: this.pageLoadTime,
      timeOnPage: Date.now() - this.pageLoadTime,
      // Basic metadata
      meta: {
        description: this.getMetaContent('description'),
        keywords: this.getMetaContent('keywords'),
        author: this.getMetaContent('author'),
        language: document.documentElement.lang || 'en'
      }
    };
  }

  private getMetaContent(name: string): string | null {
    const meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    return meta ? meta.content : null;
  }

  private handleTextHighlight(selectedText: string): void {
    console.log('Text highlighted:', selectedText.substring(0, 50) + '...');
    
    // This will trigger content capture suggestion in later tasks
    // For now, just log the event
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      console.log('Page hidden - time on page:', Date.now() - this.pageLoadTime, 'ms');
    } else {
      console.log('Page visible again');
      this.pageLoadTime = Date.now(); // Reset timer
    }
  }

  // Cleanup method
  public cleanup(): void {
    if (this.highlightListener) {
      document.removeEventListener('mouseup', this.highlightListener);
      document.removeEventListener('keyup', this.highlightListener);
    }
  }
}

// Initialize content script
const contentScript = new ContentScript();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  contentScript.cleanup();
});