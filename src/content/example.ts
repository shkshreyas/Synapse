/**
 * Example usage of the Content Extraction System
 * This file demonstrates how to use the content extraction functionality
 */

import { contentExtractionService } from './index.js';

/**
 * Example: Extract content from the current page
 */
async function extractCurrentPageExample() {
    console.log('🔍 Extracting content from current page...');

    // Check if page is suitable for extraction
    if (!contentExtractionService.isPageSuitableForExtraction()) {
        console.log('❌ Page is not suitable for content extraction');
        return;
    }

    // Get a preview first
    const preview = await contentExtractionService.getExtractionPreview();
    console.log('📋 Preview:', {
        title: preview.title,
        wordCount: preview.wordCount,
        pageType: preview.pageType,
        confidence: preview.confidence
    });

    // Extract full content
    const result = await contentExtractionService.extractCurrentPage({
        includeImages: true,
        includeLinks: true,
        includeHeadings: true,
        removeAds: true,
        removeNavigation: true
    });

    if (result.success && result.content) {
        console.log('✅ Content extracted successfully!');
        console.log('📄 Title:', result.content.title);
        console.log('📝 Content length:', result.content.mainContent.length);
        console.log('🏷️ Page type:', result.content.metadata.pageType);
        console.log('⏱️ Reading time:', result.content.metadata.readingTime, 'minutes');
        console.log('🖼️ Images found:', result.content.images.length);
        console.log('🔗 Links found:', result.content.links.length);
        console.log('📊 Confidence:', result.confidence);

        // Create captured content object
        const capturedContent = contentExtractionService.createCapturedContent(
            result,
            'manual' // or 'auto' or 'highlight'
        );

        if (capturedContent) {
            console.log('💾 Captured content created:', {
                id: capturedContent.id,
                url: capturedContent.url,
                timestamp: capturedContent.timestamp
            });
        }
    } else {
        console.log('❌ Content extraction failed:', result.error);
    }
}

/**
 * Example: Extract selected text
 */
async function extractSelectedTextExample() {
    console.log('🔍 Extracting selected text...');

    // Simulate selected text (in real usage, this would come from user selection)
    const selectedText = window.getSelection()?.toString();

    if (!selectedText) {
        console.log('❌ No text selected');
        return;
    }

    const capturedContent = await contentExtractionService.extractSelectedText(
        selectedText,
        'User selected this text on the page' // optional context
    );

    if (capturedContent) {
        console.log('✅ Selected text extracted successfully!');
        console.log('📄 Title:', capturedContent.title);
        console.log('📝 Content:', capturedContent.content);
        console.log('📊 Word count:', capturedContent.metadata.wordCount);
        console.log('⏱️ Reading time:', capturedContent.metadata.readingTime, 'minutes');
    } else {
        console.log('❌ Selected text extraction failed');
    }
}

/**
 * Example: Get extraction hints based on page type
 */
function getExtractionHintsExample() {
    console.log('🔍 Getting extraction hints...');

    const hints = contentExtractionService.getExtractionHints();
    const confidence = contentExtractionService.getPageTypeConfidence();

    console.log('💡 Extraction hints:', {
        contentSelectors: hints.contentSelectors,
        excludeSelectors: hints.excludeSelectors,
        preserveFormatting: hints.preserveFormatting,
        includeImages: hints.includeImages,
        includeLinks: hints.includeLinks,
        confidence: confidence
    });
}

/**
 * Example: Run all extraction examples
 */
export async function runExamples() {
    console.log('🚀 Running Content Extraction Examples...\n');

    try {
        // Example 1: Extract current page
        await extractCurrentPageExample();
        console.log('\n' + '='.repeat(50) + '\n');

        // Example 2: Get extraction hints
        getExtractionHintsExample();
        console.log('\n' + '='.repeat(50) + '\n');

        // Example 3: Extract selected text (if any)
        await extractSelectedTextExample();

    } catch (error) {
        console.error('❌ Error running examples:', error);
    }
}

// Auto-run examples if this file is loaded directly
if (typeof window !== 'undefined') {
    // Add a global function for easy testing in browser console
    (window as any).runContentExtractionExamples = runExamples;

    console.log('💡 Content extraction examples loaded!');
    console.log('💡 Run "runContentExtractionExamples()" in the console to test');
}