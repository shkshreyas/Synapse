/**
 * Content Extraction Module - Main entry point
 * Provides a unified interface for content extraction functionality
 */

import { ContentExtractor } from './contentExtractor.js';
import { MetadataCollector } from './metadataCollector.js';
import { ContentSanitizer } from './contentSanitizer.js';
import { PageTypeDetector } from './pageTypeDetector.js';
import {
    CapturedContent,
    ContentExtractionOptions,
    ContentExtractionResult
} from '../types/content.js';

/**
 * Main content extraction service
 * Orchestrates all content extraction components
 */
export class ContentExtractionService {
    private contentExtractor: ContentExtractor;
    private metadataCollector: MetadataCollector;
    private contentSanitizer: ContentSanitizer;
    private pageTypeDetector: PageTypeDetector;

    constructor() {
        this.contentExtractor = new ContentExtractor();
        this.metadataCollector = new MetadataCollector();
        this.contentSanitizer = new ContentSanitizer();
        this.pageTypeDetector = new PageTypeDetector();
    }

    /**
     * Extract content from the current page
     */
    async extractCurrentPage(options?: Partial<ContentExtractionOptions>): Promise<ContentExtractionResult> {
        try {
            // Use the content extractor to get the full extraction result
            const result = await this.contentExtractor.extractContent(options);

            if (!result.success || !result.content) {
                return result;
            }

            // Enhance with additional metadata if needed
            const enhancedMetadata = {
                ...result.content.metadata,
                // Add any additional metadata that might be missing
                url: this.metadataCollector.getCurrentUrl(),
                captureTimestamp: this.metadataCollector.getCurrentTimestamp()
            };

            return {
                ...result,
                content: {
                    ...result.content,
                    metadata: enhancedMetadata
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown extraction error',
                processingTime: 0,
                confidence: 0
            };
        }
    }

    /**
     * Create a captured content object from extraction result
     */
    createCapturedContent(
        extractionResult: ContentExtractionResult,
        captureMethod: 'manual' | 'auto' | 'highlight' = 'manual',
        screenshot?: string
    ): CapturedContent | null {
        if (!extractionResult.success || !extractionResult.content) {
            return null;
        }

        const { content } = extractionResult;

        return {
            id: this.generateContentId(),
            url: this.metadataCollector.getCurrentUrl(),
            title: content.title,
            content: content.mainContent,
            screenshot,
            metadata: content.metadata,
            captureMethod,
            timestamp: new Date()
        };
    }

    /**
     * Extract content from selected text
     */
    async extractSelectedText(
        selectedText: string,
        context?: string
    ): Promise<CapturedContent | null> {
        if (!selectedText || selectedText.trim().length < 10) {
            return null;
        }

        // Create basic metadata for selected text
        const metadata = this.metadataCollector.collectMetadata(selectedText);

        return {
            id: this.generateContentId(),
            url: this.metadataCollector.getCurrentUrl(),
            title: this.extractTitleFromSelection(selectedText),
            content: selectedText.trim(),
            metadata: {
                ...metadata,
                wordCount: this.countWords(selectedText),
                readingTime: Math.max(1, Math.ceil(this.countWords(selectedText) / 200))
            },
            captureMethod: 'highlight',
            timestamp: new Date()
        };
    }

    /**
     * Get page type detection confidence
     */
    getPageTypeConfidence(): number {
        const pageType = this.pageTypeDetector.detectPageType();
        return this.pageTypeDetector.getDetectionConfidence(pageType);
    }

    /**
     * Get extraction hints based on page type
     */
    getExtractionHints() {
        const pageType = this.pageTypeDetector.detectPageType();
        return this.pageTypeDetector.getExtractionHints(pageType);
    }

    /**
     * Validate if the current page is suitable for content extraction
     */
    isPageSuitableForExtraction(): boolean {
        // Check if page has meaningful content
        const textLength = (document.body?.textContent || '').trim().length;
        if (textLength < 100) return false;

        // Check if it's not a search results page or similar
        const url = window.location.href.toLowerCase();
        const unsuitablePatterns = [
            /\/search/, /\/results/, /\/404/, /\/error/,
            /google\.com\/search/, /bing\.com\/search/
        ];

        if (unsuitablePatterns.some(pattern => pattern.test(url))) {
            return false;
        }

        // Check page type
        const pageType = this.pageTypeDetector.detectPageType();
        const confidence = this.pageTypeDetector.getDetectionConfidence(pageType);

        return confidence > 0.3;
    }

    /**
     * Get a preview of what would be extracted
     */
    async getExtractionPreview(): Promise<{
        title: string;
        contentPreview: string;
        wordCount: number;
        pageType: string;
        confidence: number;
    }> {
        const result = await this.contentExtractor.extractContent({
            minContentLength: 50 // Lower threshold for preview
        });

        if (!result.success || !result.content) {
            return {
                title: 'Unable to extract',
                contentPreview: 'No content could be extracted from this page.',
                wordCount: 0,
                pageType: 'unknown',
                confidence: 0
            };
        }

        const preview = result.content.mainContent.length > 200
            ? result.content.mainContent.substring(0, 200) + '...'
            : result.content.mainContent;

        return {
            title: result.content.title,
            contentPreview: preview,
            wordCount: result.content.metadata.wordCount,
            pageType: result.content.metadata.pageType,
            confidence: result.confidence
        };
    }

    /**
     * Generate a unique ID for content
     */
    private generateContentId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `content_${timestamp}_${random}`;
    }

    /**
     * Extract title from selected text
     */
    private extractTitleFromSelection(text: string): string {
        // Use first sentence or first 50 characters as title
        const firstSentence = text.split(/[.!?]/)[0];
        if (firstSentence && firstSentence.length > 10 && firstSentence.length < 100) {
            return firstSentence.trim();
        }

        // Fallback to first 50 characters
        const title = text.substring(0, 50).trim();
        return title.length < text.length ? title + '...' : title;
    }

    /**
     * Count words in text
     */
    private countWords(text: string): number {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
}

// Export singleton instance
export const contentExtractionService = new ContentExtractionService();

// Export all components for individual use
export { ContentExtractor } from './contentExtractor.js';
export { MetadataCollector } from './metadataCollector.js';
export { ContentSanitizer } from './contentSanitizer.js';
export { PageTypeDetector } from './pageTypeDetector.js';

// Export types
export * from '../types/content.js';