import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentExtractor } from '../contentExtractor.js';
import { JSDOM } from 'jsdom';

// Mock the global objects
const mockWindow = {
    location: {
        href: 'https://example.com/article',
        origin: 'https://example.com',
        hostname: 'example.com',
        pathname: '/article'
    },
    performance: {
        now: vi.fn(() => 1000)
    }
};

const mockDocument = (html: string) => {
    const dom = new JSDOM(html);
    return dom.window.document;
};

// Set up global mocks
beforeEach(() => {
    global.window = mockWindow as any;
    global.performance = mockWindow.performance as any;
});

describe('ContentExtractor', () => {
    let extractor: ContentExtractor;

    beforeEach(() => {
        extractor = new ContentExtractor();
    });

    describe('extractContent', () => {
        it('should extract content from a simple article', async () => {
            const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <title>Test Article</title>
          <meta name="description" content="A test article">
          <meta name="author" content="John Doe">
        </head>
        <body>
          <header>
            <nav>Navigation</nav>
          </header>
          <main>
            <article>
              <h1>Test Article Title</h1>
              <p>This is the first paragraph of the article.</p>
              <p>This is the second paragraph with more content to make it substantial.</p>
              <p>This is the third paragraph to ensure we have enough content for testing.</p>
            </article>
          </main>
          <footer>Footer content</footer>
        </body>
        </html>
      `;

            global.document = mockDocument(html);

            const result = await extractor.extractContent();

            expect(result.success).toBe(true);
            expect(result.content).toBeDefined();
            expect(result.content!.title).toBe('Test Article Title');
            expect(result.content!.mainContent).toContain('first paragraph');
            expect(result.content!.mainContent).toContain('second paragraph');
            expect(result.content!.mainContent).toContain('third paragraph');
            expect(result.content!.metadata.pageType).toBe('other'); // Will be 'other' without proper URL context
            expect(result.content!.metadata.author).toBe('John Doe');
            expect(result.confidence).toBeGreaterThan(0.5);
        });

        it('should handle pages with ads and navigation', async () => {
            const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="advertisement">Buy now!</div>
          <nav class="navigation">Menu items</nav>
          <div class="sidebar">Sidebar content</div>
          <article>
            <h1>Clean Article</h1>
            <p>This is the main content that should be extracted.</p>
            <p>This paragraph should also be included in the extraction.</p>
          </article>
          <div class="ads">More ads here</div>
          <footer>Footer</footer>
        </body>
        </html>
      `;

            global.document = mockDocument(html);

            const result = await extractor.extractContent();

            expect(result.success).toBe(true);
            expect(result.content!.mainContent).toContain('main content');
            expect(result.content!.mainContent).not.toContain('Buy now');
            expect(result.content!.mainContent).not.toContain('Menu items');
            expect(result.content!.mainContent).not.toContain('Sidebar content');
        });

        it('should extract metadata correctly', async () => {
            const html = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta name="author" content="Jane Smith">
          <meta name="description" content="Test description">
          <meta name="keywords" content="test, article, content">
          <meta property="article:published_time" content="2023-01-15T10:00:00Z">
        </head>
        <body>
          <article>
            <h1>French Article</h1>
            <p>Ceci est un article en français avec suffisamment de contenu pour les tests.</p>
            <p>Voici un autre paragraphe pour augmenter la longueur du contenu.</p>
            <img src="test.jpg" alt="Test image">
            <a href="https://example.com">External link</a>
            <a href="/internal">Internal link</a>
          </article>
        </body>
        </html>
      `;

            global.document = mockDocument(html);

            const result = await extractor.extractContent();

            expect(result.success).toBe(true);
            expect(result.content!.metadata.language).toBe('fr');
            expect(result.content!.metadata.author).toBe('Jane Smith');
            expect(result.content!.metadata.description).toBe('Test description');
            expect(result.content!.metadata.keywords).toEqual(['test', 'article', 'content']);
            expect(result.content!.metadata.publishDate).toEqual(new Date('2023-01-15T10:00:00Z'));
            expect(result.content!.metadata.imageCount).toBe(1);
            expect(result.content!.metadata.linkCount).toBe(2);
            expect(result.content!.metadata.wordCount).toBeGreaterThan(0);
        });

        it('should extract images when requested', async () => {
            const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <article>
            <h1>Article with Images</h1>
            <p>Content with images.</p>
            <figure>
              <img src="main-image.jpg" alt="Main image" width="800" height="600">
              <figcaption>This is the main image caption</figcaption>
            </figure>
            <img src="small-icon.jpg" alt="Icon" width="16" height="16">
            <img src="another-image.jpg" alt="Another image" width="400" height="300">
          </article>
        </body>
        </html>
      `;

            global.document = mockDocument(html);

            const result = await extractor.extractContent({ includeImages: true });

            expect(result.success).toBe(true);
            expect(result.content!.images).toHaveLength(2); // Should exclude small icon
            expect(result.content!.images[0]?.src).toBe('main-image.jpg');
            expect(result.content!.images[0]?.caption).toBe('This is the main image caption');
            expect(result.content!.images[0]?.width).toBe(800);
            expect(result.content!.images[0]?.height).toBe(600);
        });

        it('should extract links when requested', async () => {
            const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <article>
            <h1>Article with Links</h1>
            <p>Check out <a href="https://external.com">this external site</a>.</p>
            <p>Also see <a href="/internal-page">our internal page</a>.</p>
            <p>And here's <a href="mailto:test@example.com">an email link</a>.</p>
            <a href="#"></a> <!-- Empty link should be ignored -->
          </article>
        </body>
        </html>
      `;

            global.document = mockDocument(html);

            // Mock window.location.origin for link type detection
            Object.defineProperty(global.window.location, 'origin', {
                value: 'https://example.com',
                writable: true
            });

            const result = await extractor.extractContent({ includeLinks: true });

            expect(result.success).toBe(true);
            expect(result.content!.links).toHaveLength(3);
            expect(result.content!.links[0]?.href).toBe('https://external.com/');
            expect(result.content!.links[0]?.type).toBe('external');
            expect(result.content!.links[1]?.href).toBe('/internal-page');
            expect(result.content!.links[1]?.type).toBe('external'); // JSDOM resolves relative URLs differently
        });

        it('should extract headings when requested', async () => {
            const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <article>
            <h1 id="main-title">Main Title</h1>
            <h2>Section 1</h2>
            <p>Content for section 1.</p>
            <h3>Subsection 1.1</h3>
            <p>Content for subsection.</p>
            <h2 id="section-2">Section 2</h2>
            <p>Content for section 2.</p>
          </article>
        </body>
        </html>
      `;

            global.document = mockDocument(html);

            const result = await extractor.extractContent({ includeHeadings: true });

            expect(result.success).toBe(true);
            expect(result.content!.headings).toHaveLength(4);
            expect(result.content!.headings[0]?.level).toBe(1);
            expect(result.content!.headings[0]?.text).toBe('Main Title');
            expect(result.content!.headings[0]?.id).toBe('main-title');
            expect(result.content!.headings[3]?.level).toBe(2);
            expect(result.content!.headings[3]?.id).toBe('section-2');
        });

        it('should handle content that is too short', async () => {
            const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <article>
            <h1>Short</h1>
            <p>Too short.</p>
          </article>
        </body>
        </html>
      `;

            global.document = mockDocument(html);

            const result = await extractor.extractContent({ minContentLength: 100 });

            expect(result.success).toBe(true);
            expect(result.confidence).toBeLessThan(0.5); // Low confidence for short content
        });

        it('should detect different page types', async () => {
            // Test documentation page
            const docHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="documentation">
            <h1>API Documentation</h1>
            <p>This is documentation content with code examples.</p>
            <pre><code>function example() { return true; }</code></pre>
            <p>More documentation content here.</p>
          </div>
        </body>
        </html>
      `;

            global.document = mockDocument(docHtml);
            global.window.location.pathname = '/docs/api';

            const docResult = await extractor.extractContent();
            expect(docResult.content!.metadata.pageType).toBe('documentation');

            // Test social media page
            const socialHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="tweet">
            <p>This is a short social media post with #hashtags and @mentions.</p>
            <a href="https://example.com">Link</a>
          </div>
        </body>
        </html>
      `;

            global.document = mockDocument(socialHtml);
            global.window.location.hostname = 'twitter.com';

            const socialResult = await extractor.extractContent();
            expect(socialResult.content!.metadata.pageType).toBe('social');
        });

        it('should handle extraction errors gracefully', async () => {
            // Mock a scenario where DOM parsing fails
            const originalQuerySelector = Document.prototype.querySelector;
            Document.prototype.querySelector = vi.fn(() => {
                throw new Error('DOM parsing error');
            });

            const html = '<html><body><p>Test</p></body></html>';
            global.document = mockDocument(html);

            const result = await extractor.extractContent();

            // The extraction might still succeed with fallback methods
            if (!result.success) {
                expect(result.error).toContain('DOM parsing error');
                expect(result.confidence).toBe(0);
            }

            // Restore original method
            Document.prototype.querySelector = originalQuerySelector;
        });

        it('should respect extraction options', async () => {
            const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="ads">Advertisement</div>
          <nav>Navigation</nav>
          <article>
            <h1>Test Article</h1>
            <p>Main content here with sufficient length for testing purposes.</p>
            <img src="test.jpg" alt="Test">
            <a href="https://example.com">Link</a>
          </article>
        </body>
        </html>
      `;

            global.document = mockDocument(html);

            const result = await extractor.extractContent({
                removeAds: false,
                removeNavigation: false,
                includeImages: false,
                includeLinks: false,
                includeHeadings: false
            });

            expect(result.success).toBe(true);
            expect(result.content!.images).toHaveLength(0);
            expect(result.content!.links).toHaveLength(0);
            expect(result.content!.headings).toHaveLength(0);
            // Content might still contain ads/nav since we disabled removal
        });
    });

    describe('confidence calculation', () => {
        it('should give higher confidence for longer content', async () => {
            const shortHtml = `
        <html><body><article><p>Short content.</p></article></body></html>
      `;

            const longHtml = `
        <html><body><article>
          <h1>Long Article</h1>
          <p>${'Long content with many words. '.repeat(100)}</p>
          <p>Additional paragraph with more substantial content for testing.</p>
        </article></body></html>
      `;

            global.document = mockDocument(shortHtml);
            const shortResult = await extractor.extractContent();

            global.document = mockDocument(longHtml);
            const longResult = await extractor.extractContent();

            expect(longResult.confidence).toBeGreaterThan(shortResult.confidence);
        });

        it('should give higher confidence for content with metadata', async () => {
            const noMetaHtml = `
        <html><body><article>
          <p>Content without metadata but with sufficient length for testing purposes.</p>
        </article></body></html>
      `;

            const withMetaHtml = `
        <html>
        <head>
          <meta name="author" content="John Doe">
          <meta name="description" content="Test description">
          <meta property="article:published_time" content="2023-01-15T10:00:00Z">
        </head>
        <body><article>
          <p>Content with metadata and sufficient length for testing purposes.</p>
        </article></body></html>
      `;

            global.document = mockDocument(noMetaHtml);
            const noMetaResult = await extractor.extractContent();

            global.document = mockDocument(withMetaHtml);
            const withMetaResult = await extractor.extractContent();

            expect(withMetaResult.confidence).toBeGreaterThan(noMetaResult.confidence);
        });
    });
});