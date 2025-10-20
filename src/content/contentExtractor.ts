import {
    ExtractedContent,
    PageMetadata,
    ContentExtractionOptions,
    ContentExtractionResult,
    ExtractedImage,
    ExtractedLink,
    ExtractedHeading
} from '../types/content.js';

/**
 * ContentExtractor - Extracts and processes content from web pages
 * Handles different page types and removes unwanted elements
 */
export class ContentExtractor {
    private readonly defaultOptions: ContentExtractionOptions = {
        includeImages: true,
        includeLinks: true,
        includeHeadings: true,
        minContentLength: 100,
        removeAds: true,
        removeNavigation: true,
        preserveFormatting: true
    };

    /**
     * Extract content from the current page
     */
    async extractContent(options?: Partial<ContentExtractionOptions>): Promise<ContentExtractionResult> {
        const startTime = performance.now();
        const extractionOptions = { ...this.defaultOptions, ...options };

        try {
            // Clean the DOM first
            const cleanedDocument = this.cleanDocument(document.cloneNode(true) as Document, extractionOptions);

            // Extract main content
            const content = this.extractMainContent(cleanedDocument);
            if (!content.text) {
                throw new Error('No content could be extracted');
            }

            // Extract metadata
            const metadata = this.extractMetadata(cleanedDocument);

            const result: ContentExtractionResult = {
                title: content.title || document.title,
                text: content.text,
                author: metadata.author,
                publishDate: metadata.publishDate,
                keywords: metadata.keywords,
                confidence: this.calculateConfidence(content, metadata)

            // Calculate confidence score
            const confidence = this.calculateConfidence(mainContent, metadata);

            const extractedContent: ExtractedContent = {
                mainContent,
                title: this.extractTitle(),
                metadata,
                images,
                links,
                headings
            };

            const processingTime = performance.now() - startTime;

            return {
                success: true,
                content: extractedContent,
                processingTime,
                confidence
            };

        } catch (error) {
            const processingTime = performance.now() - startTime;
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown extraction error',
                processingTime,
                confidence: 0
            };
        }
    }

    /**
     * Clean the document by removing unwanted elements
     */
    private cleanDocument(doc: Document, options: ContentExtractionOptions): Document {
        const elementsToRemove: Element[] = [];

        if (options.removeAds) {
            // Common ad selectors
            const adSelectors = [
                '[class*="ad"]', '[id*="ad"]', '[class*="advertisement"]',
                '[class*="banner"]', '[class*="popup"]', '[class*="modal"]',
                '.google-ads', '.adsense', '[data-ad]', '.sponsored',
                '.promo', '.promotion', '[class*="affiliate"]'
            ];

            adSelectors.forEach(selector => {
                doc.querySelectorAll(selector).forEach(el => elementsToRemove.push(el));
            });
        }

        if (options.removeNavigation) {
            // Navigation and UI elements
            const navSelectors = [
                'nav', 'header', 'footer', '.navigation', '.nav',
                '.menu', '.sidebar', '.breadcrumb', '.pagination',
                '.social-share', '.comments', '.related-posts',
                '.author-bio', '.newsletter', '.subscription'
            ];

            navSelectors.forEach(selector => {
                doc.querySelectorAll(selector).forEach(el => elementsToRemove.push(el));
            });
        }

        // Remove script and style tags
        doc.querySelectorAll('script, style, noscript').forEach(el => elementsToRemove.push(el));

        // Remove elements
        elementsToRemove.forEach(el => el.remove());

        return doc;
    }

    /**
     * Extract the main content from the page
     */
    private extractMainContent(doc: Document): string {
        // Try different strategies to find main content
        const strategies = [
            () => this.extractByArticleTag(doc),
            () => this.extractByMainTag(doc),
            () => this.extractByContentSelectors(doc),
            () => this.extractByTextDensity(doc),
            () => this.extractFallback(doc)
        ];

        for (const strategy of strategies) {
            const content = strategy();
            if (content && content.length >= this.defaultOptions.minContentLength) {
                return this.cleanText(content);
            }
        }

        return '';
    }

    /**
     * Extract content using article tag
     */
    private extractByArticleTag(doc: Document): string {
        const article = doc.querySelector('article');
        return article ? this.getTextContent(article) : '';
    }

    /**
     * Extract content using main tag
     */
    private extractByMainTag(doc: Document): string {
        const main = doc.querySelector('main');
        return main ? this.getTextContent(main) : '';
    }

    /**
     * Extract content using common content selectors
     */
    private extractByContentSelectors(doc: Document): string {
        const contentSelectors = [
            '.post-content', '.entry-content', '.article-content',
            '.content', '.main-content', '.post-body',
            '[role="main"]', '.article-body', '.story-body'
        ];

        for (const selector of contentSelectors) {
            const element = doc.querySelector(selector);
            if (element) {
                const content = this.getTextContent(element);
                if (content.length >= this.defaultOptions.minContentLength) {
                    return content;
                }
            }
        }

        return '';
    }

    /**
     * Extract content by analyzing text density
     */
    private extractByTextDensity(doc: Document): string {
        const candidates = doc.querySelectorAll('div, section, article');
        let bestCandidate: Element | null = null;
        let bestScore = 0;

        candidates.forEach(candidate => {
            const score = this.calculateTextDensityScore(candidate);
            if (score > bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        });

        return bestCandidate ? this.getTextContent(bestCandidate) : '';
    }

    /**
     * Fallback extraction method
     */
    private extractFallback(doc: Document): string {
        const body = doc.body;
        return body ? this.getTextContent(body) : '';
    }

    /**
     * Calculate text density score for an element
     */
    private calculateTextDensityScore(element: Element): number {
        const text = element.textContent || '';
        const textLength = text.trim().length;

        if (textLength === 0) return 0;

        // Factors that increase score
        let score = textLength;

        // Bonus for paragraphs
        const paragraphs = element.querySelectorAll('p').length;
        score += paragraphs * 50;

        // Penalty for too many links
        const links = element.querySelectorAll('a').length;
        const linkRatio = links / Math.max(paragraphs, 1);
        if (linkRatio > 0.5) {
            score *= 0.5;
        }

        // Penalty for too many images without text
        const images = element.querySelectorAll('img').length;
        const imageRatio = images / Math.max(textLength / 100, 1);
        if (imageRatio > 0.3) {
            score *= 0.7;
        }

        return score;
    }

    /**
     * Extract page metadata
     */
    private extractMetadata(doc: Document, content: string): PageMetadata {
        const wordCount = this.countWords(content);
        const readingTime = Math.ceil(wordCount / 200); // Average reading speed

        return {
            readingTime,
            pageType: this.detectPageType(doc, content),
            language: this.detectLanguage(doc),
            author: this.extractAuthor(doc),
            publishDate: this.extractPublishDate(doc),
            description: this.extractDescription(doc),
            keywords: this.extractKeywords(doc),
            wordCount,
            imageCount: doc.querySelectorAll('img').length,
            linkCount: doc.querySelectorAll('a').length
        };
    }

    /**
     * Detect the type of page
     */
    private detectPageType(doc: Document, content: string): PageMetadata['pageType'] {
        // Check for video indicators
        if (doc.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"]')) {
            return 'video';
        }

        // Check for documentation indicators
        const docIndicators = [
            '.documentation', '.docs', '.api-docs',
            '[class*="doc"]', '.reference', '.guide'
        ];
        if (docIndicators.some(selector => doc.querySelector(selector))) {
            return 'documentation';
        }

        // Check for social media indicators
        const socialIndicators = [
            '.tweet', '.post', '.status', '.update',
            '[class*="social"]', '.timeline'
        ];
        if (socialIndicators.some(selector => doc.querySelector(selector))) {
            return 'social';
        }

        // Check for article indicators
        const articleIndicators = [
            'article', '.article', '.post', '.entry',
            '[role="article"]', '.blog-post'
        ];
        if (articleIndicators.some(selector => doc.querySelector(selector)) && content.length > 500) {
            return 'article';
        }

        return 'other';
    }

    /**
     * Detect page language
     */
    private detectLanguage(doc: Document): string {
        return doc.documentElement.lang ||
            doc.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content') ||
            'en';
    }

    /**
     * Extract author information
     */
    private extractAuthor(doc: Document): string | undefined {
        const authorSelectors = [
            'meta[name="author"]',
            'meta[property="article:author"]',
            '.author', '.byline', '.writer',
            '[rel="author"]', '.post-author'
        ];

        for (const selector of authorSelectors) {
            const element = doc.querySelector(selector);
            if (element) {
                const content = element.getAttribute('content') || element.textContent;
                if (content?.trim()) {
                    return content.trim();
                }
            }
        }

        return undefined;
    }

    /**
     * Extract publish date
     */
    private extractPublishDate(doc: Document): Date | undefined {
        const dateSelectors = [
            'meta[property="article:published_time"]',
            'meta[name="date"]',
            'time[datetime]',
            '.date', '.published', '.post-date'
        ];

        for (const selector of dateSelectors) {
            const element = doc.querySelector(selector);
            if (element) {
                const dateStr = element.getAttribute('content') ||
                    element.getAttribute('datetime') ||
                    element.textContent;

                if (dateStr) {
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                }
            }
        }

        return undefined;
    }

    /**
     * Extract page description
     */
    private extractDescription(doc: Document): string | undefined {
        const descSelectors = [
            'meta[name="description"]',
            'meta[property="og:description"]',
            'meta[name="twitter:description"]'
        ];

        for (const selector of descSelectors) {
            const element = doc.querySelector(selector);
            const content = element?.getAttribute('content');
            if (content?.trim()) {
                return content.trim();
            }
        }

        return undefined;
    }

    /**
     * Extract keywords
     */
    private extractKeywords(doc: Document): string[] | undefined {
        const keywordsElement = doc.querySelector('meta[name="keywords"]');
        const keywords = keywordsElement?.getAttribute('content');

        if (keywords) {
            return keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
        }

        return undefined;
    }

    /**
     * Extract title from the page
     */
    private extractTitle(): string {
        // Try different title sources
        const titleSources = [
            () => document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
            () => document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'),
            () => document.querySelector('h1')?.textContent,
            () => document.title
        ];

        for (const source of titleSources) {
            const title = source();
            if (title?.trim()) {
                return title.trim();
            }
        }

        return 'Untitled';
    }

    /**
     * Extract images from the document
     */
    private extractImages(doc: Document): ExtractedImage[] {
        const images: ExtractedImage[] = [];
        const imgElements = doc.querySelectorAll('img');

        imgElements.forEach(img => {
            const src = img.src;
            const alt = img.alt || '';

            // Skip small images (likely icons or decorative)
            if (img.width < 50 || img.height < 50) return;

            // Find caption
            const figure = img.closest('figure');
            const caption = figure?.querySelector('figcaption')?.textContent || undefined;

            images.push({
                src,
                alt,
                caption,
                width: img.width || undefined,
                height: img.height || undefined
            });
        });

        return images;
    }

    /**
     * Extract links from the document
     */
    private extractLinks(doc: Document): ExtractedLink[] {
        const links: ExtractedLink[] = [];
        const linkElements = doc.querySelectorAll('a[href]');

        linkElements.forEach(link => {
            const href = (link as HTMLAnchorElement).href;
            const text = link.textContent?.trim() || '';

            if (!text || text.length < 2) return; // Skip empty or very short links

            const type = href.startsWith(window.location.origin) ? 'internal' : 'external';

            links.push({
                href,
                text,
                type
            });
        });

        return links;
    }

    /**
     * Extract headings from the document
     */
    private extractHeadings(doc: Document): ExtractedHeading[] {
        const headings: ExtractedHeading[] = [];
        const headingElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');

        headingElements.forEach(heading => {
            const text = heading.textContent?.trim();
            if (!text) return;

            const level = parseInt(heading.tagName.charAt(1));
            const id = heading.id || undefined;

            headings.push({
                level,
                text,
                id
            });
        });

        return headings;
    }

    /**
     * Get clean text content from an element
     */
    private getTextContent(element: Element): string {
        // Clone the element to avoid modifying the original
        const clone = element.cloneNode(true) as Element;

        // Remove unwanted elements from the clone
        clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());

        return clone.textContent || '';
    }

    /**
     * Clean and normalize text
     */
    private cleanText(text: string): string {
        return text
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
            .trim();
    }

    /**
     * Count words in text
     */
    private countWords(text: string): number {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Calculate confidence score for extraction quality
     */
    private calculateConfidence(content: string, metadata: PageMetadata): number {
        let confidence = 0.5; // Base confidence

        // Content length factor
        if (content.length > 1000) confidence += 0.2;
        else if (content.length > 500) confidence += 0.1;
        else if (content.length < 100) confidence -= 0.3;

        // Metadata completeness
        if (metadata.author) confidence += 0.1;
        if (metadata.publishDate) confidence += 0.1;
        if (metadata.description) confidence += 0.1;

        // Page type factor
        if (metadata.pageType === 'article') confidence += 0.1;
        else if (metadata.pageType === 'documentation') confidence += 0.05;

        return Math.max(0, Math.min(1, confidence));
    }
}

// Export a singleton instance
export const contentExtractor = new ContentExtractor();