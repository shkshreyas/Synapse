// Content-related type definitions for MindScribe

export interface CapturedContent {
    id: string;
    url: string;
    title: string;
    content: string;
    screenshot?: string | undefined;
    metadata: PageMetadata;
    captureMethod: 'manual' | 'auto' | 'highlight';
    timestamp: Date;
}

export interface PageMetadata {
    readingTime: number;
    pageType: 'article' | 'video' | 'documentation' | 'social' | 'other';
    language: string;
    author?: string | undefined;
    publishDate?: Date | undefined;
    description?: string | undefined;
    keywords?: string[] | undefined;
    wordCount: number;
    imageCount: number;
    linkCount: number;
}

export interface ExtractedContent {
    mainContent: string;
    title: string;
    metadata: PageMetadata;
    images: ExtractedImage[];
    links: ExtractedLink[];
    headings: ExtractedHeading[];
}

export interface ExtractedImage {
    src: string;
    alt: string;
    caption?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
}

export interface ExtractedLink {
    href: string;
    text: string;
    type: 'internal' | 'external';
}

export interface ExtractedHeading {
    level: number; // 1-6 for h1-h6
    text: string;
    id?: string | undefined;
}

export interface ContentExtractionOptions {
    includeImages: boolean;
    includeLinks: boolean;
    includeHeadings: boolean;
    minContentLength: number;
    removeAds: boolean;
    removeNavigation: boolean;
    preserveFormatting: boolean;
}

export interface ContentExtractionResult {
    success: boolean;
    content?: ExtractedContent;
    error?: string;
    processingTime: number;
    confidence: number; // 0-1 score for extraction quality
}