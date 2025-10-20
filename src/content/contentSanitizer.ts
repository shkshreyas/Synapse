/**
 * ContentSanitizer - Removes unwanted elements from web pages
 * Handles ads, navigation, and other non-content elements
 */
export class ContentSanitizer {

    // Common selectors for ads and promotional content
    private readonly adSelectors = [
        // Generic ad classes and IDs
        '[class*="ad"]', '[id*="ad"]', '[class*="advertisement"]', '[id*="advertisement"]',
        '[class*="banner"]', '[id*="banner"]', '[class*="popup"]', '[id*="popup"]',
        '[class*="modal"]', '[id*="modal"]', '[class*="overlay"]', '[id*="overlay"]',

        // Specific ad networks
        '.google-ads', '.adsense', '.adsbygoogle', '[data-ad]', '[data-ad-slot]',
        '.amazon-ads', '.outbrain', '.taboola', '.revcontent', '.mgid',

        // Promotional content
        '.sponsored', '.promotion', '.promo', '[class*="affiliate"]',
        '.newsletter', '.subscription', '.signup', '.cta', '.call-to-action',

        // Social widgets
        '.social-share', '.share-buttons', '.social-media', '.follow-us',

        // Comments and related
        '.comments', '.comment-section', '.disqus', '.facebook-comments',
        '.related-posts', '.recommended', '.you-might-like', '.more-stories'
    ];

    // Navigation and UI elements
    private readonly navigationSelectors = [
        // Main navigation
        'nav', 'header', 'footer', '.navigation', '.nav', '.navbar',
        '.menu', '.main-menu', '.primary-menu', '.secondary-menu',

        // Sidebar and auxiliary content
        '.sidebar', '.side-panel', '.widget', '.widgets',

        // Breadcrumbs and pagination
        '.breadcrumb', '.breadcrumbs', '.pagination', '.pager',
        '.next-prev', '.page-numbers',

        // Author and meta information (sometimes unwanted)
        '.author-bio', '.author-info', '.byline-extended',

        // Search and filters
        '.search', '.search-form', '.filters', '.sort-options'
    ];

    // Script and style elements
    private readonly scriptStyleSelectors = [
        'script', 'style', 'noscript', 'link[rel="stylesheet"]'
    ];

    // Elements that are typically not content
    private readonly nonContentSelectors = [
        '.skip-link', '.screen-reader-text', '.visually-hidden',
        '.print-only', '.no-print', '.hidden', '.invisible'
    ];

    /**
     * Sanitize a document by removing unwanted elements
     */
    sanitizeDocument(doc: Document, options: SanitizationOptions = {}): Document {
        const {
            removeAds = true,
            removeNavigation = true,
            removeScripts = true,
            removeNonContent = true,
            preserveImages = true,
            preserveLinks = true,
            customSelectorsToRemove = []
        } = options;

        // Clone the document to avoid modifying the original
        const sanitizedDoc = doc.cloneNode(true) as Document;
        const elementsToRemove: Element[] = [];

        // Collect elements to remove
        if (removeAds) {
            this.collectElementsBySelectors(sanitizedDoc, this.adSelectors, elementsToRemove);
        }

        if (removeNavigation) {
            this.collectElementsBySelectors(sanitizedDoc, this.navigationSelectors, elementsToRemove);
        }

        if (removeScripts) {
            this.collectElementsBySelectors(sanitizedDoc, this.scriptStyleSelectors, elementsToRemove);
        }

        if (removeNonContent) {
            this.collectElementsBySelectors(sanitizedDoc, this.nonContentSelectors, elementsToRemove);
        }

        // Custom selectors
        if (customSelectorsToRemove.length > 0) {
            this.collectElementsBySelectors(sanitizedDoc, customSelectorsToRemove, elementsToRemove);
        }

        // Additional heuristic-based removal
        this.collectElementsByHeuristics(sanitizedDoc, elementsToRemove, {
            preserveImages,
            preserveLinks
        });

        // Remove collected elements
        elementsToRemove.forEach(element => {
            try {
                element.remove();
            } catch (error) {
                // Element might have already been removed as a child of another removed element
            }
        });

        // Clean up empty elements
        this.removeEmptyElements(sanitizedDoc);

        return sanitizedDoc;
    }

    /**
     * Collect elements by CSS selectors
     */
    private collectElementsBySelectors(
        doc: Document,
        selectors: string[],
        elementsToRemove: Element[]
    ): void {
        selectors.forEach(selector => {
            try {
                const elements = doc.querySelectorAll(selector);
                elements.forEach(element => {
                    if (!elementsToRemove.includes(element)) {
                        elementsToRemove.push(element);
                    }
                });
            } catch (error) {
                // Invalid selector, skip
                console.warn(`Invalid selector: ${selector}`);
            }
        });
    }

    /**
     * Collect elements using heuristic analysis
     */
    private collectElementsByHeuristics(
        doc: Document,
        elementsToRemove: Element[],
        options: { preserveImages: boolean; preserveLinks: boolean }
    ): void {
        const allElements = doc.querySelectorAll('*');

        allElements.forEach(element => {
            if (elementsToRemove.includes(element)) return;

            // Skip if already marked for removal or is a child of an element to be removed
            if (this.isChildOfElementToRemove(element, elementsToRemove)) return;

            // Check for ad-like characteristics
            if (this.isLikelyAd(element)) {
                elementsToRemove.push(element);
                return;
            }

            // Check for navigation-like characteristics
            if (this.isLikelyNavigation(element)) {
                elementsToRemove.push(element);
                return;
            }

            // Check for low-value content
            if (this.isLowValueContent(element, options)) {
                elementsToRemove.push(element);
                return;
            }
        });
    }

    /**
     * Check if element is a child of an element marked for removal
     */
    private isChildOfElementToRemove(element: Element, elementsToRemove: Element[]): boolean {
        let parent = element.parentElement;
        while (parent) {
            if (elementsToRemove.includes(parent)) {
                return true;
            }
            parent = parent.parentElement;
        }
        return false;
    }

    /**
     * Heuristic to identify ad-like elements
     */
    private isLikelyAd(element: Element): boolean {
        const className = element.className.toLowerCase();
        const id = element.id.toLowerCase();
        const textContent = (element.textContent || '').toLowerCase();

        // Check class and ID patterns
        const adPatterns = [
            /\bad\b/, /advertisement/, /banner/, /sponsor/, /promo/,
            /affiliate/, /monetiz/, /revenue/, /adsense/
        ];

        if (adPatterns.some(pattern => pattern.test(className) || pattern.test(id))) {
            return true;
        }

        // Check for ad-like text content
        const adTextPatterns = [
            /advertisement/, /sponsored/, /promoted/, /affiliate/,
            /click here/, /buy now/, /limited time/, /special offer/
        ];

        if (adTextPatterns.some(pattern => pattern.test(textContent))) {
            return true;
        }

        // Check for suspicious attributes
        if (element.hasAttribute('data-ad') ||
            element.hasAttribute('data-ad-slot') ||
            element.hasAttribute('data-google-ad')) {
            return true;
        }

        return false;
    }

    /**
     * Heuristic to identify navigation-like elements
     */
    private isLikelyNavigation(element: Element): boolean {
        const tagName = element.tagName.toLowerCase();
        const className = element.className.toLowerCase();
        const id = element.id.toLowerCase();

        // Navigation tags
        if (['nav', 'header', 'footer'].includes(tagName)) {
            return true;
        }

        // Navigation patterns in class/id
        const navPatterns = [
            /\bnav\b/, /navigation/, /menu/, /breadcrumb/, /pagination/,
            /sidebar/, /widget/, /footer/, /header/
        ];

        if (navPatterns.some(pattern => pattern.test(className) || pattern.test(id))) {
            return true;
        }

        // Check for high link density (likely navigation)
        const links = element.querySelectorAll('a');
        const textLength = (element.textContent || '').trim().length;

        if (links.length > 3 && textLength > 0) {
            const linkTextLength = Array.from(links)
                .reduce((total, link) => total + (link.textContent || '').length, 0);

            const linkDensity = linkTextLength / textLength;
            if (linkDensity > 0.8) {
                return true;
            }
        }

        return false;
    }

    /**
     * Heuristic to identify low-value content
     */
    private isLowValueContent(
        element: Element,
        options: { preserveImages: boolean; preserveLinks: boolean }
    ): boolean {
        const textContent = (element.textContent || '').trim();
        const tagName = element.tagName.toLowerCase();

        // Very short content that's not an image or important element
        if (textContent.length < 10 &&
            !['img', 'video', 'audio', 'iframe'].includes(tagName)) {
            return true;
        }

        // Elements with only whitespace
        if (textContent.length === 0 &&
            !element.querySelector('img, video, audio, iframe, canvas, svg')) {
            return true;
        }

        // High ratio of punctuation/symbols (likely decorative)
        if (textContent.length > 0) {
            const symbolCount = (textContent.match(/[^\w\s]/g) || []).length;
            const symbolRatio = symbolCount / textContent.length;

            if (symbolRatio > 0.5 && textContent.length < 50) {
                return true;
            }
        }

        return false;
    }

    /**
     * Remove empty elements after sanitization
     */
    private removeEmptyElements(doc: Document): void {
        const emptyElements: Element[] = [];

        // Find empty elements (multiple passes may be needed)
        let foundEmpty = true;
        while (foundEmpty) {
            foundEmpty = false;
            const allElements = doc.querySelectorAll('*');

            allElements.forEach(element => {
                if (this.isEmptyElement(element) && !emptyElements.includes(element)) {
                    emptyElements.push(element);
                    foundEmpty = true;
                }
            });

            // Remove found empty elements
            emptyElements.forEach(element => {
                try {
                    element.remove();
                } catch (error) {
                    // Element might have already been removed
                }
            });
        }
    }

    /**
     * Check if an element is empty and can be removed
     */
    private isEmptyElement(element: Element): boolean {
        const tagName = element.tagName.toLowerCase();

        // Don't remove self-closing or media elements
        if (['img', 'br', 'hr', 'input', 'meta', 'link', 'video', 'audio', 'iframe', 'canvas', 'svg'].includes(tagName)) {
            return false;
        }

        // Check if element has meaningful content
        const textContent = (element.textContent || '').trim();
        const hasMediaContent = element.querySelector('img, video, audio, iframe, canvas, svg');
        const hasFormContent = element.querySelector('input, button, select, textarea');

        return textContent.length === 0 && !hasMediaContent && !hasFormContent;
    }

    /**
     * Get a clean text representation of the sanitized content
     */
    getCleanText(element: Element): string {
        // Clone to avoid modifying original
        const clone = element.cloneNode(true) as Element;

        // Remove any remaining unwanted elements
        clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());

        const text = clone.textContent || '';

        // Normalize whitespace
        return text
            .replace(/\s+/g, ' ') // Multiple spaces to single space
            .replace(/\n\s*\n/g, '\n\n') // Multiple newlines to double newline
            .trim();
    }

    /**
     * Validate that sanitization preserved important content
     */
    validateSanitization(original: Document, sanitized: Document): SanitizationValidation {
        const originalText = (original.body?.textContent || '').trim();
        const sanitizedText = (sanitized.body?.textContent || '').trim();

        const originalLength = originalText.length;
        const sanitizedLength = sanitizedText.length;

        const retentionRatio = originalLength > 0 ? sanitizedLength / originalLength : 0;

        return {
            originalLength,
            sanitizedLength,
            retentionRatio,
            isValid: retentionRatio > 0.1 && retentionRatio < 0.95, // Should remove some content but not too much
            warnings: this.generateValidationWarnings(retentionRatio, sanitizedLength)
        };
    }

    /**
     * Generate warnings based on sanitization results
     */
    private generateValidationWarnings(retentionRatio: number, sanitizedLength: number): string[] {
        const warnings: string[] = [];

        if (retentionRatio < 0.1) {
            warnings.push('Too much content was removed - may have over-sanitized');
        }

        if (retentionRatio > 0.95) {
            warnings.push('Very little content was removed - sanitization may be ineffective');
        }

        if (sanitizedLength < 100) {
            warnings.push('Resulting content is very short - may not be meaningful');
        }

        return warnings;
    }
}

// Types for sanitization options and validation
export interface SanitizationOptions {
    removeAds?: boolean;
    removeNavigation?: boolean;
    removeScripts?: boolean;
    removeNonContent?: boolean;
    preserveImages?: boolean;
    preserveLinks?: boolean;
    customSelectorsToRemove?: string[];
}

export interface SanitizationValidation {
    originalLength: number;
    sanitizedLength: number;
    retentionRatio: number;
    isValid: boolean;
    warnings: string[];
}

// Export singleton instance
export const contentSanitizer = new ContentSanitizer();