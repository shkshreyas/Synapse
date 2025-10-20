// AI Processing Pipeline - orchestrates all AI processors

import { PromptAPIProcessor } from './promptProcessor';
import { SummarizerAPIProcessor } from './summarizerProcessor';
import { WriterAPIProcessor } from './writerProcessor';
import { TranslatorAPIProcessor } from './translatorProcessor';
import { AIProcessingResult, AIProcessingOptions, AIAPIUsage } from './types';
import { CapturedContent } from '../types/content';
import { StoredContent } from '../types/storage';

export class AIProcessingPipeline {
    private static instance: AIProcessingPipeline;
    private promptProcessor: PromptAPIProcessor;
    private summarizerProcessor: SummarizerAPIProcessor;
    private writerProcessor: WriterAPIProcessor;
    private translatorProcessor: TranslatorAPIProcessor;
    private apiUsage: AIAPIUsage = {
        promptApi: 0,
        summarizerApi: 0,
        writerApi: 0,
        translatorApi: 0,
        totalCalls: 0,
        totalTokens: 0
    };

    private constructor() {
        this.promptProcessor = PromptAPIProcessor.getInstance();
        this.summarizerProcessor = SummarizerAPIProcessor.getInstance();
        this.writerProcessor = WriterAPIProcessor.getInstance();
        this.translatorProcessor = TranslatorAPIProcessor.getInstance();
        this.resetAPIUsage();
    }

    public static getInstance(): AIProcessingPipeline {
        if (!AIProcessingPipeline.instance) {
            AIProcessingPipeline.instance = new AIProcessingPipeline();
        }
        return AIProcessingPipeline.instance;
    }

    public async processContent(
        content: CapturedContent,
        options: AIProcessingOptions = this.getDefaultOptions()
    ): Promise<AIProcessingResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        const result: AIProcessingResult = {
            totalProcessingTime: 0,
            success: true,
            errors: []
        };

        try {
            // Step 1: Concept extraction and categorization
            if (options.enableConceptExtraction) {
                try {
                    const conceptResult = await this.promptProcessor.extractConcepts(
                        content,
                        options.maxConcepts || 10
                    );
                    result.conceptExtraction = conceptResult;
                    this.apiUsage.promptApi += 3; // Typically 3 API calls for concept extraction

                    if (!conceptResult.success) {
                        errors.push(`Concept extraction failed: ${conceptResult.error}`);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown concept extraction error';
                    errors.push(`Concept extraction error: ${errorMessage}`);
                }
            }

            // Step 2: Summary generation
            if (options.enableSummaryGeneration) {
                try {
                    const summaryResult = await this.summarizerProcessor.generateSummaries(content);
                    result.summaryGeneration = summaryResult;
                    this.apiUsage.summarizerApi += 3; // 3 summaries (TL;DR, quick, detailed)

                    if (!summaryResult.success) {
                        errors.push(`Summary generation failed: ${summaryResult.error}`);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown summary generation error';
                    errors.push(`Summary generation error: ${errorMessage}`);
                }
            }

            // Step 3: Enhanced content generation (study questions, flashcards, etc.)
            if (options.enableContentGeneration) {
                try {
                    const contentResult = await this.writerProcessor.generateEnhancedContent(content);
                    result.contentGeneration = contentResult;
                    this.apiUsage.writerApi += 3; // 3 types of content generation

                    if (!contentResult.success) {
                        errors.push(`Content generation failed: ${contentResult.error}`);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown content generation error';
                    errors.push(`Content generation error: ${errorMessage}`);
                }
            }

            // Step 4: Translation (if needed)
            if (options.enableTranslation && options.targetLanguage) {
                try {
                    const translationResult = await this.translatorProcessor.translateContent(
                        content,
                        options.targetLanguage
                    );
                    result.translation = translationResult;
                    this.apiUsage.translatorApi += 1;

                    if (!translationResult.success) {
                        errors.push(`Translation failed: ${translationResult.error}`);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown translation error';
                    errors.push(`Translation error: ${errorMessage}`);
                }
            }

            result.totalProcessingTime = Date.now() - startTime;
            result.errors = errors;
            result.success = errors.length === 0 || this.hasAnySuccessfulProcessing(result);

            // Update total API usage
            this.apiUsage.totalCalls = this.apiUsage.promptApi + this.apiUsage.summarizerApi +
                this.apiUsage.writerApi + this.apiUsage.translatorApi;

            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown pipeline error';
            return {
                totalProcessingTime: Date.now() - startTime,
                success: false,
                errors: [errorMessage]
            };
        }
    }

    public async createStoredContent(
        capturedContent: CapturedContent,
        processingResult: AIProcessingResult
    ): Promise<StoredContent> {
        const now = new Date();

        const storedContent: StoredContent = {
            ...capturedContent,

            // AI-generated metadata
            summaries: processingResult.summaryGeneration?.summaries || undefined,
            concepts: processingResult.conceptExtraction?.concepts.map(c => c.name) || undefined,
            tags: processingResult.conceptExtraction?.tags || undefined,
            category: processingResult.conceptExtraction?.category || undefined,
            importance: this.calculateImportance(processingResult),

            // User interaction data
            timesAccessed: 0,
            lastAccessed: now,
            userNotes: undefined,
            userRating: undefined,

            // Knowledge graph data
            graphPosition: undefined,
            clusterGroup: undefined,

            // Sync data
            syncedToCloud: false,
            cloudAnalysisComplete: false,
            lastModified: now,

            // Storage metadata
            storageSize: this.calculateStorageSize(capturedContent, processingResult),
            version: 1
        };

        return storedContent;
    }

    public async processMultipleContents(
        contents: CapturedContent[],
        options: AIProcessingOptions = this.getDefaultOptions()
    ): Promise<AIProcessingResult[]> {
        const results: AIProcessingResult[] = [];

        // Process contents in batches to avoid overwhelming the APIs
        const batchSize = 3;
        for (let i = 0; i < contents.length; i += batchSize) {
            const batch = contents.slice(i, i + batchSize);
            const batchPromises = batch.map(content => this.processContent(content, options));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Small delay between batches to be respectful to the APIs
            if (i + batchSize < contents.length) {
                await this.delay(500);
            }
        }

        return results;
    }

    public async synthesizeRelatedContents(contents: CapturedContent[]): Promise<{
        synthesis: string;
        connections: string[];
        confidence: number;
    }> {
        if (contents.length < 2) {
            return {
                synthesis: '',
                connections: [],
                confidence: 0
            };
        }

        try {
            const result = await this.writerProcessor.synthesizeRelatedContent(contents);
            this.apiUsage.writerApi += 1;
            return result;
        } catch (error) {
            return {
                synthesis: '',
                connections: [],
                confidence: 0
            };
        }
    }

    public getAPIAvailability(): {
        promptAPI: boolean;
        summarizerAPI: boolean;
        writerAPI: boolean;
        translatorAPI: boolean;
        overallAvailability: boolean;
    } {
        const availability = {
            promptAPI: this.promptProcessor.isAPIAvailable(),
            summarizerAPI: this.summarizerProcessor.isAPIAvailable(),
            writerAPI: this.writerProcessor.isAPIAvailable(),
            translatorAPI: this.translatorProcessor.isAPIAvailable(),
            overallAvailability: false
        };

        // Overall availability is true if at least one API is available
        availability.overallAvailability = availability.promptAPI ||
            availability.summarizerAPI ||
            availability.writerAPI ||
            availability.translatorAPI;

        return availability;
    }

    public getAPIUsage(): AIAPIUsage {
        return { ...this.apiUsage };
    }

    public resetAPIUsage(): void {
        this.apiUsage = {
            promptApi: 0,
            summarizerApi: 0,
            writerApi: 0,
            translatorApi: 0,
            totalCalls: 0,
            totalTokens: 0
        };
    }

    public clearAllCaches(): void {
        this.summarizerProcessor.clearCache();
        this.writerProcessor.clearCache();
        this.translatorProcessor.clearCache();
    }

    public getCacheSizes(): {
        summarizerCache: number;
        writerCache: number;
        translatorCache: { translations: number; detections: number };
    } {
        return {
            summarizerCache: this.summarizerProcessor.getCacheSize(),
            writerCache: this.writerProcessor.getCacheSize(),
            translatorCache: this.translatorProcessor.getCacheSize()
        };
    }

    private getDefaultOptions(): AIProcessingOptions {
        return {
            enableConceptExtraction: true,
            enableSummaryGeneration: true,
            enableContentGeneration: true,
            enableTranslation: false,
            maxConcepts: 10,
            summaryLengths: {
                tldr: 150,
                quick: 300,
                detailed: 600
            }
        };
    }

    private hasAnySuccessfulProcessing(result: AIProcessingResult): boolean {
        return !!(
            (result.conceptExtraction?.success) ||
            (result.summaryGeneration?.success) ||
            (result.contentGeneration?.success) ||
            (result.translation?.success)
        );
    }

    private calculateImportance(processingResult: AIProcessingResult): number {
        let importance = 5; // Base importance (1-10 scale)

        // Boost importance based on concept extraction confidence
        if (processingResult.conceptExtraction?.success) {
            importance += processingResult.conceptExtraction.confidence * 2;
        }

        // Boost importance based on summary quality
        if (processingResult.summaryGeneration?.success) {
            importance += processingResult.summaryGeneration.confidence * 1.5;
        }

        // Boost importance based on content generation success
        if (processingResult.contentGeneration?.success) {
            const studyQuestionsCount = processingResult.contentGeneration.studyQuestions.length;
            const flashcardsCount = processingResult.contentGeneration.flashcards.length;
            importance += Math.min((studyQuestionsCount + flashcardsCount) * 0.1, 1);
        }

        return Math.min(Math.max(Math.round(importance), 1), 10);
    }

    private calculateStorageSize(content: CapturedContent, processingResult: AIProcessingResult): number {
        let size = 0;

        // Base content size
        size += content.content.length * 2; // Assuming UTF-16 encoding
        size += content.title.length * 2;
        size += JSON.stringify(content.metadata).length * 2;

        // AI processing results size
        if (processingResult.summaryGeneration?.summaries) {
            const summaries = processingResult.summaryGeneration.summaries;
            size += (summaries.tldr.length + summaries.quick.length + summaries.detailed.length) * 2;
        }

        if (processingResult.conceptExtraction?.concepts) {
            size += JSON.stringify(processingResult.conceptExtraction.concepts).length * 2;
        }

        if (processingResult.contentGeneration) {
            size += JSON.stringify(processingResult.contentGeneration).length * 2;
        }

        if (processingResult.translation?.translatedContent) {
            size += processingResult.translation.translatedContent.length * 2;
        }

        return size;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public async validateProcessingResult(result: AIProcessingResult): Promise<{
        isValid: boolean;
        issues: string[];
        recommendations: string[];
    }> {
        const issues: string[] = [];
        const recommendations: string[] = [];

        // Validate concept extraction
        if (result.conceptExtraction) {
            if (result.conceptExtraction.success && result.conceptExtraction.concepts.length === 0) {
                issues.push('Concept extraction succeeded but found no concepts');
                recommendations.push('Consider adjusting concept extraction parameters');
            }

            if (result.conceptExtraction.confidence < 0.3) {
                issues.push('Low confidence in concept extraction');
                recommendations.push('Content may need manual review for concept accuracy');
            }
        }

        // Validate summary generation
        if (result.summaryGeneration) {
            if (result.summaryGeneration.success) {
                const summaryValidation = await this.summarizerProcessor.validateSummaryQuality(
                    result.summaryGeneration.summaries,
                    '' // We don't have original content here, but validation can still check structure
                );

                if (!summaryValidation.isValid) {
                    issues.push(...summaryValidation.issues);
                    recommendations.push('Consider regenerating summaries with different parameters');
                }
            }
        }

        // Validate content generation
        if (result.contentGeneration) {
            if (result.contentGeneration.success) {
                if (result.contentGeneration.studyQuestions.length === 0 &&
                    result.contentGeneration.flashcards.length === 0) {
                    issues.push('Content generation succeeded but produced no study materials');
                    recommendations.push('Content may not be suitable for study material generation');
                }
            }
        }

        // Overall processing validation
        if (!this.hasAnySuccessfulProcessing(result)) {
            issues.push('All AI processing steps failed');
            recommendations.push('Check API availability and content quality');
        }

        return {
            isValid: issues.length === 0,
            issues,
            recommendations
        };
    }
}