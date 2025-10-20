// AI processing type definitions

export interface ConceptExtractionResult {
    concepts: ExtractedConcept[];
    tags: string[];
    category: string;
    confidence: number;
    processingTime: number;
    success: boolean;
    error?: string;
}

export interface ExtractedConcept {
    name: string;
    confidence: number;
    category: 'person' | 'organization' | 'location' | 'technology' | 'concept' | 'other';
    context?: string;
}

export interface SummaryGenerationResult {
    summaries: {
        tldr: string;
        quick: string;
        detailed: string;
    };
    confidence: number;
    processingTime: number;
    success: boolean;
    error?: string;
}

export interface ContentGenerationResult {
    studyQuestions: string[];
    flashcards: Flashcard[];
    keyPoints: string[];
    confidence: number;
    processingTime: number;
    success: boolean;
    error?: string;
}

export interface Flashcard {
    front: string;
    back: string;
    difficulty: 'easy' | 'medium' | 'hard';
    category: string;
}

export interface TranslationResult {
    translatedContent: string;
    detectedLanguage: string;
    targetLanguage: string;
    confidence: number;
    processingTime: number;
    success: boolean;
    error?: string;
}

export interface AIProcessingResult {
    conceptExtraction?: ConceptExtractionResult;
    summaryGeneration?: SummaryGenerationResult;
    contentGeneration?: ContentGenerationResult;
    translation?: TranslationResult;
    totalProcessingTime: number;
    success: boolean;
    errors: string[];
}

export interface AIProcessingOptions {
    enableConceptExtraction: boolean;
    enableSummaryGeneration: boolean;
    enableContentGeneration: boolean;
    enableTranslation: boolean;
    targetLanguage?: string;
    maxConcepts?: number;
    summaryLengths?: {
        tldr: number;
        quick: number;
        detailed: number;
    };
}

export interface PromptTemplate {
    name: string;
    template: string;
    variables: string[];
    description: string;
}

export interface AIAPIUsage {
    promptApi: number;
    summarizerApi: number;
    writerApi: number;
    translatorApi: number;
    totalCalls: number;
    totalTokens?: number;
}