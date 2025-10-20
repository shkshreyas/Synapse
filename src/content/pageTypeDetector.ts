import { PageMetadata } from '../types/content.js';

/**
 * PageTypeDetector - Detects the type of web page for optimized content extraction
 * Supports articles, documentation, social media, videos, and other page types
 */
export class PageTypeDetector {

    /**
     * Detect the type of the current page
     */
    detectPageType(): PageMetadata['pageType'] {
        // Use multiple detection strategies
        const strategies = [
            () => this.detectByUrl(),
            () => this.detectByMetadata(),
            () => this.detectByStructure(),
            () => this.detectByContent()
        ];

        // Try each strategy and return the first confident result
        for (const strategy of strategies) {
            const result = strategy();
            if (result && result !== 'other') {
                return result;
            }
        }

        return 'other';
    }

    /**
     * Detect page type by URL patterns
     */
    private detectByUrl(): PageMetadata['pageType'] | null {
        const url = window.location.href.toLowerCase();
        const hostname = window.location.hostname.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();

        // Video platforms
        const videoHosts = [
            'youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv',
            'dailymotion.com', 'wistia.com', 'brightcove.com'
        ];

        if (videoHosts.some(host => hostname.includes(host))) {
            return 'video';
        }

        const videoPatterns = [
            /\/watch/, /\/video/, /\/videos/, /\/v\//, /\/embed/,
            /\/player/, /\/stream/, /\/live/
        ];

        if (videoPatterns.some(pattern => pattern.test(pathname))) {
            return 'video';
        }

        // Documentation sites
        const docHosts = [
            'docs.', 'developer.', 'api.', 'reference.', 'guide.',
            'manual.', 'wiki.', 'help.', 'support.'
        ];

        if (docHosts.some(host => hostname.startsWith(host))) {
            return 'documentation';
        }

        const docPatterns = [
            /\/docs/, /\/documentation/, /\/api/, /\/reference/,
            /\/guide/, /\/manual/, /\/wiki/, /\/help/,
            /\/tutorial/, /\/getting-started/, /\/quickstart/
        ];

        if (docPatterns.some(pattern => pattern.test(pathname))) {
            return 'documentation';
        }

        // Social media platforms
        const socialHosts = [
            'twitter.com', 'x.com', 'facebook.com', 'linkedin.com',
            'instagram.com', 'reddit.com', 'pinterest.com',
            'tumblr.com', 'medium.com', 'dev.to'
        ];

        if (socialHosts.some(host => hostname.includes(host))) {
            return 'social';
        }

        const socialPatterns = [
            /\/post/, /\/status/, /\/tweet/, /\/story/,
            /\/profile/, /\/user/, /\/u\//, /\/r\//
        ];

        if (socialPatterns.some(pattern => pattern.test(pathname))) {
            return 'social';
        }

        // Blog/article patterns
        const articlePatterns = [
            /\/blog/, /\/article/, /\/post/, /\/news/,
            /\/story/, /\/press/, /\/insights/, /\/opinion/
        ];

        if (articlePatterns.some(pattern => pattern.test(pathname))) {
            return 'article';
        }

        return null;
    }

    /**
     * Detect page type by metadata
     */
    private detectByMetadata(): PageMetadata['pageType'] | null {
        // Check Open Graph type
        const ogType = document.querySelector('meta[property="og:type"]')?.getAttribute('content');
        if (ogType) {
            switch (ogType.toLowerCase()) {
                case 'article':
                case 'blog':
                    return 'article';
                case 'video':
                case 'video.movie':
                case 'video.episode':
                    return 'video';
                case 'website':
                    // Could be documentation or other
                    break;
            }
        }

        // Check for article-specific metadata
        const articleMeta = [
            'meta[property="article:author"]',
            'meta[property="article:published_time"]',
            'meta[property="article:section"]',
            'meta[name="author"]'
        ];

        if (articleMeta.some(selector => document.querySelector(selector))) {
            return 'article';
        }

        // Check for video metadata
        const videoMeta = [
            'meta[property="og:video"]',
            'meta[property="video:duration"]',
            'meta[name="twitter:player"]'
        ];

        if (videoMeta.some(selector => document.querySelector(selector))) {
            return 'video';
        }

        // Check JSON-LD structured data
        const jsonLdType = this.getJsonLdType();
        if (jsonLdType) {
            switch (jsonLdType.toLowerCase()) {
                case 'article':
                case 'newsarticle':
                case 'blogposting':
                    return 'article';
                case 'videoobject':
                    return 'video';
                case 'socialmediaposting':
                    return 'social';
            }
        }

        return null;
    }

    /**
     * Detect page type by DOM structure
     */
    private detectByStructure(): PageMetadata['pageType'] | null {
        // Video indicators
        const videoElements = [
            'video',
            'iframe[src*="youtube"]',
            'iframe[src*="vimeo"]',
            'iframe[src*="twitch"]',
            'iframe[src*="dailymotion"]',
            '.video-player',
            '.player',
            '[class*="video"]'
        ];

        if (videoElements.some(selector => document.querySelector(selector))) {
            return 'video';
        }

        // Documentation indicators
        const docElements = [
            '.documentation', '.docs', '.api-docs', '.reference',
            '.guide', '.manual', '.tutorial', '.getting-started',
            '.toc', '.table-of-contents', '.sidebar-nav',
            '.code-example', '.api-reference'
        ];

        if (docElements.some(selector => document.querySelector(selector))) {
            return 'documentation';
        }

        // Social media indicators
        const socialElements = [
            '.tweet', '.post', '.status', '.update',
            '.timeline', '.feed', '.social-post',
            '.comment', '.reply', '.share',
            '.like', '.retweet', '.favorite'
        ];

        if (socialElements.some(selector => document.querySelector(selector))) {
            return 'social';
        }

        // Article indicators
        const articleElements = [
            'article', '.article', '.post', '.entry',
            '.blog-post', '.news-article', '.story',
            '[role="article"]', '.content-article'
        ];

        if (articleElements.some(selector => document.querySelector(selector))) {
            // Additional check for sufficient content
            const mainContent = this.getMainContentElement();
            if (mainContent && this.getTextLength(mainContent) > 300) {
                return 'article';
            }
        }

        return null;
    }

    /**
     * Detect page type by content analysis
     */
    private detectByContent(): PageMetadata['pageType'] | null {
        const mainContent = this.getMainContentElement();
        if (!mainContent) return null;

        const textLength = this.getTextLength(mainContent);
        const headingCount = mainContent.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
        const paragraphCount = mainContent.querySelectorAll('p').length;
        const linkCount = mainContent.querySelectorAll('a').length;
        const codeCount = mainContent.querySelectorAll('code, pre').length;

        // Documentation characteristics
        if (codeCount > 3 && headingCount > 3 && textLength > 1000) {
            const codeRatio = codeCount / Math.max(paragraphCount, 1);
            if (codeRatio > 0.3) {
                return 'documentation';
            }
        }

        // Article characteristics
        if (textLength > 500 && paragraphCount > 3 && headingCount > 0) {
            const linkRatio = linkCount / Math.max(paragraphCount, 1);
            // Articles typically have lower link density than navigation pages
            if (linkRatio < 0.5) {
                return 'article';
            }
        }

        // Social media characteristics (short, high link density)
        if (textLength < 500 && linkCount > 2) {
            const linkRatio = linkCount / Math.max(textLength / 100, 1);
            if (linkRatio > 0.5) {
                return 'social';
            }
        }

        return null;
    }

    /**
     * Get the main content element
     */
    private getMainContentElement(): Element | null {
        const contentSelectors = [
            'main', 'article', '.content', '.main-content',
            '.post-content', '.entry-content', '.article-content',
            '[role="main"]', '.primary-content'
        ];

        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }

        return document.body;
    }

    /**
     * Get text length of an element
     */
    private getTextLength(element: Element): number {
        return (element.textContent || '').trim().length;
    }

    /**
     * Extract type from JSON-LD structured data
     */
    private getJsonLdType(): string | null {
        try {
            const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');

            for (let i = 0; i < jsonLdScripts.length; i++) {
                const script = jsonLdScripts[i];
                if (!script) continue;
                const content = script.textContent;
                if (!content) continue;

                const data = JSON.parse(content);

                // Handle both single objects and arrays
                const items = Array.isArray(data) ? data : [data];

                for (const item of items) {
                    if (item['@type']) {
                        return item['@type'];
                    }
                }
            }
        } catch (error) {
            // JSON parsing failed
        }

        return null;
    }

    /**
     * Get page type specific extraction hints
     */
    getExtractionHints(pageType: PageMetadata['pageType']): ExtractionHints {
        switch (pageType) {
            case 'article':
                return {
                    contentSelectors: [
                        'article', '.article', '.post-content', '.entry-content',
                        '.article-content', '.story-body', '.post-body'
                    ],
                    excludeSelectors: [
                        '.author-bio', '.related-posts', '.comments',
                        '.social-share', '.newsletter-signup'
                    ],
                    preserveFormatting: true,
                    includeImages: true,
                    includeLinks: true
                };

            case 'documentation':
                return {
                    contentSelectors: [
                        'main', '.documentation', '.docs', '.content',
                        '.api-docs', '.reference', '.guide'
                    ],
                    excludeSelectors: [
                        '.sidebar', '.toc', '.navigation', '.breadcrumb'
                    ],
                    preserveFormatting: true,
                    includeImages: true,
                    includeLinks: true,
                    includeCode: true
                };

            case 'social':
                return {
                    contentSelectors: [
                        '.tweet', '.post', '.status', '.update',
                        '.social-post', '.timeline-item'
                    ],
                    excludeSelectors: [
                        '.sidebar', '.recommended', '.trending',
                        '.ads', '.promoted'
                    ],
                    preserveFormatting: false,
                    includeImages: true,
                    includeLinks: true,
                    includeHashtags: true
                };

            case 'video':
                return {
                    contentSelectors: [
                        '.video-description', '.description', '.about',
                        '.video-info', '.player-description'
                    ],
                    excludeSelectors: [
                        '.comments', '.related-videos', '.recommendations',
                        '.ads', '.sidebar'
                    ],
                    preserveFormatting: false,
                    includeImages: true,
                    includeLinks: true,
                    includeTranscript: true
                };

            default:
                return {
                    contentSelectors: [
                        'main', 'article', '.content', '.main-content'
                    ],
                    excludeSelectors: [
                        'nav', 'header', 'footer', '.sidebar', '.ads'
                    ],
                    preserveFormatting: true,
                    includeImages: true,
                    includeLinks: true
                };
        }
    }

    /**
     * Check if the page type detection is confident
     */
    getDetectionConfidence(pageType: PageMetadata['pageType']): number {
        const indicators = this.getTypeIndicators(pageType);
        const totalIndicators = indicators.url + indicators.metadata + indicators.structure + indicators.content;

        // Confidence based on number of positive indicators
        if (totalIndicators >= 3) return 0.9;
        if (totalIndicators >= 2) return 0.7;
        if (totalIndicators >= 1) return 0.5;
        return 0.3;
    }

    /**
     * Get indicators for each detection method
     */
    private getTypeIndicators(pageType: PageMetadata['pageType']): TypeIndicators {
        return {
            url: this.detectByUrl() === pageType ? 1 : 0,
            metadata: this.detectByMetadata() === pageType ? 1 : 0,
            structure: this.detectByStructure() === pageType ? 1 : 0,
            content: this.detectByContent() === pageType ? 1 : 0
        };
    }
}

// Types for extraction hints and indicators
export interface ExtractionHints {
    contentSelectors: string[];
    excludeSelectors: string[];
    preserveFormatting: boolean;
    includeImages: boolean;
    includeLinks: boolean;
    includeCode?: boolean;
    includeHashtags?: boolean;
    includeTranscript?: boolean;
}

interface TypeIndicators {
    url: number;
    metadata: number;
    structure: number;
    content: number;
}

// Export singleton instance
export const pageTypeDetector = new PageTypeDetector();