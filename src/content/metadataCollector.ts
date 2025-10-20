import { PageMetadata } from '../types/content.js';

/**
 * MetadataCollector - Specialized utility for collecting page metadata
 * Handles various metadata sources and formats
 */
export class MetadataCollector {

    /**
     * Collect comprehensive metadata from the current page
     */
    collectMetadata(content: string): PageMetadata {
        const wordCount = this.countWords(content);
        const readingTime = this.calculateReadingTime(wordCount);

        return {
            readingTime,
            pageType: this.detectPageType(),
            language: this.detectLanguage(),
            author: this.extractAuthor(),
            publishDate: this.extractPublishDate(),
            description: this.extractDescription(),
            keywords: this.extractKeywords(),
            wordCount,
            imageCount: document.querySelectorAll('img').length,
            linkCount: document.querySelectorAll('a[href]').length
        };
    }

    /**
     * Calculate reading time based on word count
     * Uses average reading speed of 200 words per minute
     */
    private calculateReadingTime(wordCount: number): number {
        const wordsPerMinute = 200;
        return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
    }

    /**
     * Count words in text content
     */
    private countWords(text: string): number {
        if (!text || text.trim().length === 0) return 0;

        return text
            .trim()
            .split(/\s+/)
            .filter(word => word.length > 0 && /\w/.test(word))
            .length;
    }

    /**
     * Detect the type of page based on various indicators
     */
    private detectPageType(): PageMetadata['pageType'] {
        // Check URL patterns first
        const url = window.location.href.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();

        // Video platforms
        if (url.includes('youtube.com') || url.includes('vimeo.com') ||
            url.includes('twitch.tv') || pathname.includes('/video/')) {
            return 'video';
        }

        // Documentation sites
        if (url.includes('docs.') || pathname.includes('/docs/') ||
            pathname.includes('/documentation/') || pathname.includes('/api/') ||
            url.includes('developer.') || pathname.includes('/guide/')) {
            return 'documentation';
        }

        // Social media platforms
        if (url.includes('twitter.com') || url.includes('facebook.com') ||
            url.includes('linkedin.com') || url.includes('instagram.com') ||
            url.includes('reddit.com') || pathname.includes('/post/')) {
            return 'social';
        }

        // Check DOM structure
        const hasVideo = document.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="twitch"]');
        if (hasVideo) return 'video';

        const hasDocStructure = document.querySelector('.documentation, .docs, .api-docs, [class*="doc"], .reference, .guide, .manual');
        if (hasDocStructure) return 'documentation';

        const hasSocialStructure = document.querySelector('.tweet, .post, .status, .update, [class*="social"], .timeline, .feed');
        if (hasSocialStructure) return 'social';

        // Check for article indicators
        const hasArticleStructure = document.querySelector('article, .article, .post, .entry, [role="article"], .blog-post');
        const hasArticleMetadata = document.querySelector('meta[property="article:author"], meta[property="article:published_time"]');

        if (hasArticleStructure || hasArticleMetadata) {
            // Additional check for sufficient content length
            const mainContent = this.getMainContentLength();
            if (mainContent > 300) {
                return 'article';
            }
        }

        return 'other';
    }

    /**
     * Get approximate main content length for page type detection
     */
    private getMainContentLength(): number {
        const contentSelectors = [
            'article', 'main', '.content', '.post-content',
            '.entry-content', '.article-content', '.main-content'
        ];

        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.textContent || '';
                return text.trim().length;
            }
        }

        return (document.body?.textContent || '').trim().length;
    }

    /**
     * Detect the language of the page
     */
    private detectLanguage(): string {
        // Check HTML lang attribute
        const htmlLang = document.documentElement.lang;
        if (htmlLang) return htmlLang.toLowerCase();

        // Check meta tags
        const contentLangMeta = document.querySelector('meta[http-equiv="content-language"]');
        if (contentLangMeta) {
            const lang = contentLangMeta.getAttribute('content');
            if (lang) return lang.toLowerCase();
        }

        const ogLocaleMeta = document.querySelector('meta[property="og:locale"]');
        if (ogLocaleMeta) {
            const locale = ogLocaleMeta.getAttribute('content');
            if (locale) return locale.toLowerCase().split('_')[0]!;
        }

        // Default to English
        return 'en';
    }

    /**
     * Extract author information from various sources
     */
    private extractAuthor(): string | undefined {
        const authorSources = [
            // Meta tags
            () => document.querySelector('meta[name="author"]')?.getAttribute('content'),
            () => document.querySelector('meta[property="article:author"]')?.getAttribute('content'),
            () => document.querySelector('meta[name="twitter:creator"]')?.getAttribute('content'),

            // JSON-LD structured data
            () => this.extractFromJsonLd('author'),

            // Common author selectors
            () => document.querySelector('.author')?.textContent,
            () => document.querySelector('.byline')?.textContent,
            () => document.querySelector('.writer')?.textContent,
            () => document.querySelector('[rel="author"]')?.textContent,
            () => document.querySelector('.post-author')?.textContent,
            () => document.querySelector('.article-author')?.textContent,

            // Microdata
            () => document.querySelector('[itemprop="author"]')?.textContent,
        ];

        for (const source of authorSources) {
            try {
                const author = source();
                if (author && typeof author === 'string' && author.trim().length > 0) {
                    return this.cleanAuthorName(author.trim());
                }
            } catch (error) {
                // Continue to next source if this one fails
                continue;
            }
        }

        return undefined;
    }

    /**
     * Clean and normalize author name
     */
    private cleanAuthorName(author: string): string {
        return author
            .replace(/^(by|author:?)\s*/i, '') // Remove "by" or "author:" prefix
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Extract publish date from various sources
     */
    private extractPublishDate(): Date | undefined {
        const dateSources = [
            // Meta tags
            () => document.querySelector('meta[property="article:published_time"]')?.getAttribute('content'),
            () => document.querySelector('meta[property="article:modified_time"]')?.getAttribute('content'),
            () => document.querySelector('meta[name="date"]')?.getAttribute('content'),
            () => document.querySelector('meta[name="publish_date"]')?.getAttribute('content'),
            () => document.querySelector('meta[name="publication_date"]')?.getAttribute('content'),

            // Time elements
            () => document.querySelector('time[datetime]')?.getAttribute('datetime'),
            () => document.querySelector('time[pubdate]')?.getAttribute('datetime'),

            // JSON-LD structured data
            () => this.extractFromJsonLd('datePublished'),
            () => this.extractFromJsonLd('dateCreated'),

            // Common date selectors
            () => document.querySelector('.date')?.textContent,
            () => document.querySelector('.published')?.textContent,
            () => document.querySelector('.post-date')?.textContent,
            () => document.querySelector('.article-date')?.textContent,
            () => document.querySelector('.publish-date')?.textContent,

            // Microdata
            () => document.querySelector('[itemprop="datePublished"]')?.getAttribute('content'),
            () => document.querySelector('[itemprop="datePublished"]')?.textContent,
        ];

        for (const source of dateSources) {
            try {
                const dateStr = source();
                if (dateStr && typeof dateStr === 'string') {
                    const date = this.parseDate(dateStr.trim());
                    if (date && !isNaN(date.getTime())) {
                        return date;
                    }
                }
            } catch (error) {
                // Continue to next source if this one fails
                continue;
            }
        }

        return undefined;
    }

    /**
     * Parse date string with multiple format support
     */
    private parseDate(dateStr: string): Date | null {
        if (!dateStr) return null;

        // Try ISO format first
        let date = new Date(dateStr);
        if (!isNaN(date.getTime())) return date;

        // Try common date patterns
        const patterns = [
            /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
            /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
            /(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY
            /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // Month DD, YYYY
        ];

        for (const pattern of patterns) {
            const match = dateStr.match(pattern);
            if (match) {
                date = new Date(dateStr);
                if (!isNaN(date.getTime())) return date;
            }
        }

        return null;
    }

    /**
     * Extract description from meta tags
     */
    private extractDescription(): string | undefined {
        const descSources = [
            () => document.querySelector('meta[name="description"]')?.getAttribute('content'),
            () => document.querySelector('meta[property="og:description"]')?.getAttribute('content'),
            () => document.querySelector('meta[name="twitter:description"]')?.getAttribute('content'),
            () => this.extractFromJsonLd('description'),
        ];

        for (const source of descSources) {
            try {
                const desc = source();
                if (desc && typeof desc === 'string' && desc.trim().length > 0) {
                    return desc.trim();
                }
            } catch (error) {
                continue;
            }
        }

        return undefined;
    }

    /**
     * Extract keywords from meta tags
     */
    private extractKeywords(): string[] | undefined {
        const keywordsSources = [
            () => document.querySelector('meta[name="keywords"]')?.getAttribute('content'),
            () => document.querySelector('meta[property="article:tag"]')?.getAttribute('content'),
        ];

        for (const source of keywordsSources) {
            try {
                const keywords = source();
                if (keywords && typeof keywords === 'string') {
                    const keywordList = keywords
                        .split(/[,;]/)
                        .map(k => k.trim())
                        .filter(k => k.length > 0 && k.length < 50); // Filter out empty and overly long keywords

                    if (keywordList.length > 0) {
                        return keywordList;
                    }
                }
            } catch (error) {
                continue;
            }
        }

        return undefined;
    }

    /**
     * Extract data from JSON-LD structured data
     */
    private extractFromJsonLd(property: string): string | undefined {
        try {
            const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');

            for (let i = 0; i < jsonLdScripts.length; i++) {
                const script = jsonLdScripts[i];
                if (!script) continue;
                const content = script.textContent;
                if (!content) continue;

                const data = JSON.parse(content);
                const value = this.getNestedProperty(data, property);

                if (value && typeof value === 'string') {
                    return value;
                }
            }
        } catch (error) {
            // JSON parsing failed, continue
        }

        return undefined;
    }

    /**
     * Get nested property from object (supports dot notation)
     */
    private getNestedProperty(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Get current timestamp
     */
    getCurrentTimestamp(): Date {
        return new Date();
    }

    /**
     * Get current URL
     */
    getCurrentUrl(): string {
        return window.location.href;
    }

    /**
     * Get page title with fallbacks
     */
    getPageTitle(): string {
        const titleSources = [
            () => document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
            () => document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'),
            () => document.querySelector('h1')?.textContent,
            () => document.title
        ];

        for (const source of titleSources) {
            try {
                const title = source();
                if (title && typeof title === 'string' && title.trim().length > 0) {
                    return title.trim();
                }
            } catch (error) {
                continue;
            }
        }

        return 'Untitled';
    }
}

// Export singleton instance
export const metadataCollector = new MetadataCollector();