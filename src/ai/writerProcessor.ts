// Writer API processor for enhanced content generation

import { ContentGenerationResult, Flashcard } from './types';
import { CapturedContent } from '../types/content';

export class WriterAPIProcessor {
    private static instance: WriterAPIProcessor;
    private isAvailable: boolean = false;
    private generationCache: Map<string, ContentGenerationResult> = new Map();

    private constructor() {
        this.checkAPIAvailability();
    }

    public static getInstance(): WriterAPIProcessor {
        if (!WriterAPIProcessor.instance) {
            WriterAPIProcessor.instance = new WriterAPIProcessor();
        }
        return WriterAPIProcessor.instance;
    }

    private async checkAPIAvailability(): Promise<void> {
        try {
            // Check if Chrome AI Writer API is available
            if ('ai' in window && 'writer' in (window as any).ai) {
                const capabilities = await (window as any).ai.writer.capabilities();
                this.isAvailable = capabilities.available === 'readily';
            } else {
                this.isAvailable = false;
            }
        } catch (error) {
            console.warn('Chrome AI Writer API not available:', error);
            this.isAvailable = false;
        }
    }

    public async generateEnhancedContent(content: CapturedContent): Promise<ContentGenerationResult> {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(content);

        // Check cache first
        const cached = this.generationCache.get(cacheKey);
        if (cached) {
            return {
                ...cached,
                processingTime: Date.now() - startTime
            };
        }

        if (!this.isAvailable) {
            return {
                studyQuestions: [],
                flashcards: [],
                keyPoints: [],
                confidence: 0,
                processingTime: Date.now() - startTime,
                success: false,
                error: 'Chrome AI Writer API not available'
            };
        }

        try {
            const [studyQuestions, flashcards, keyPoints] = await Promise.all([
                this.generateStudyQuestions(content),
                this.generateFlashcards(content),
                this.extractKeyPoints(content)
            ]);

            const processingTime = Date.now() - startTime;
            const confidence = this.calculateGenerationConfidence(studyQuestions, flashcards, keyPoints, content);

            const result: ContentGenerationResult = {
                studyQuestions,
                flashcards,
                keyPoints,
                confidence,
                processingTime,
                success: true
            };

            // Cache the result
            this.generationCache.set(cacheKey, result);

            return result;

        } catch (error) {
            const fallbackResult = await this.generateFallbackContent(content);

            return {
                ...fallbackResult,
                confidence: 0.3,
                processingTime: Date.now() - startTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during content generation'
            };
        }
    }

    private async generateStudyQuestions(content: CapturedContent): Promise<string[]> {
        const prompt = this.buildStudyQuestionsPrompt(content);

        const writer = await (window as any).ai.writer.create({
            tone: 'formal',
            format: 'plain-text',
            length: 'medium'
        });

        try {
            const response = await writer.write(prompt);
            return this.parseStudyQuestions(response);
        } finally {
            writer.destroy();
        }
    }

    private async generateFlashcards(content: CapturedContent): Promise<Flashcard[]> {
        const prompt = this.buildFlashcardsPrompt(content);

        const writer = await (window as any).ai.writer.create({
            tone: 'neutral',
            format: 'plain-text',
            length: 'medium'
        });

        try {
            const response = await writer.write(prompt);
            return this.parseFlashcards(response);
        } finally {
            writer.destroy();
        }
    }

    private async extractKeyPoints(content: CapturedContent): Promise<string[]> {
        const prompt = this.buildKeyPointsPrompt(content);

        const writer = await (window as any).ai.writer.create({
            tone: 'neutral',
            format: 'plain-text',
            length: 'short'
        });

        try {
            const response = await writer.write(prompt);
            return this.parseKeyPoints(response);
        } finally {
            writer.destroy();
        }
    }

    private buildStudyQuestionsPrompt(content: CapturedContent): string {
        return `Based on the following content, generate 5-8 study questions that would help someone learn and remember the key concepts. Focus on understanding, application, and critical thinking.

Title: ${content.title}

Content: ${this.truncateContent(content.content, 3000)}

Generate questions that:
- Test understanding of main concepts
- Encourage critical thinking
- Cover different aspects of the content
- Are clear and specific
- Range from basic recall to application

Format each question on a new line starting with "Q: "`;
    }

    private buildFlashcardsPrompt(content: CapturedContent): string {
        return `Create 4-6 flashcards from the following content. Each flashcard should have a clear question/prompt on the front and a concise answer on the back.

Title: ${content.title}

Content: ${this.truncateContent(content.content, 3000)}

Format each flashcard as:
FRONT: [question or prompt]
BACK: [answer or explanation]
DIFFICULTY: [easy/medium/hard]
CATEGORY: [topic category]

Focus on:
- Key definitions and concepts
- Important facts and figures
- Cause and effect relationships
- Practical applications`;
    }

    private buildKeyPointsPrompt(content: CapturedContent): string {
        return `Extract the 5-7 most important key points from the following content. Each point should be a concise, standalone statement that captures essential information.

Title: ${content.title}

Content: ${this.truncateContent(content.content, 3000)}

Format each key point as a bullet point starting with "• "

Focus on:
- Main ideas and concepts
- Important facts or statistics
- Key takeaways
- Actionable insights
- Critical information`;
    }

    private parseStudyQuestions(response: string): string[] {
        const questions: string[] = [];
        const lines = response.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('Q:') || trimmed.match(/^\d+\./)) {
                const question = trimmed
                    .replace(/^Q:\s*/, '')
                    .replace(/^\d+\.\s*/, '')
                    .trim();

                if (question.length > 10 && question.length < 200) {
                    questions.push(question);
                }
            } else if (trimmed.includes('?') && trimmed.length > 10 && trimmed.length < 200) {
                // Catch questions that don't follow the exact format
                questions.push(trimmed);
            }
        }

        return questions.slice(0, 8); // Limit to 8 questions
    }

    private parseFlashcards(response: string): Flashcard[] {
        const flashcards: Flashcard[] = [];
        const sections = response.split(/(?=FRONT:|(?=\d+\.))/i);

        for (const section of sections) {
            const frontMatch = section.match(/FRONT:\s*(.+?)(?=BACK:|$)/is);
            const backMatch = section.match(/BACK:\s*(.+?)(?=DIFFICULTY:|$)/is);
            const difficultyMatch = section.match(/DIFFICULTY:\s*(easy|medium|hard)/i);
            const categoryMatch = section.match(/CATEGORY:\s*(.+?)(?=\n|$)/i);

            if (frontMatch && backMatch) {
                const front = frontMatch[1].trim();
                const back = backMatch[1].trim();
                const difficulty = (difficultyMatch?.[1]?.toLowerCase() as 'easy' | 'medium' | 'hard') || 'medium';
                const category = categoryMatch?.[1]?.trim() || 'general';

                if (front.length > 5 && back.length > 5) {
                    flashcards.push({
                        front,
                        back,
                        difficulty,
                        category
                    });
                }
            }
        }

        return flashcards.slice(0, 6); // Limit to 6 flashcards
    }

    private parseKeyPoints(response: string): string[] {
        const keyPoints: string[] = [];
        const lines = response.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.match(/^\d+\./)) {
                const point = trimmed
                    .replace(/^[•\-]\s*/, '')
                    .replace(/^\d+\.\s*/, '')
                    .trim();

                if (point.length > 10 && point.length < 300) {
                    keyPoints.push(point);
                }
            }
        }

        return keyPoints.slice(0, 7); // Limit to 7 key points
    }

    private calculateGenerationConfidence(
        studyQuestions: string[],
        flashcards: Flashcard[],
        keyPoints: string[],
        content: CapturedContent
    ): number {
        let confidence = 0.5; // Base confidence

        // Check quantity of generated content
        if (studyQuestions.length >= 3) confidence += 0.1;
        if (flashcards.length >= 2) confidence += 0.1;
        if (keyPoints.length >= 3) confidence += 0.1;

        // Check quality indicators
        const allGeneratedText = [
            ...studyQuestions,
            ...flashcards.map(f => f.front + ' ' + f.back),
            ...keyPoints
        ].join(' ').toLowerCase();

        const contentWords = content.content.toLowerCase().split(/\s+/);
        const importantWords = contentWords.filter(word =>
            word.length > 4 &&
            !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'would', 'could', 'should'].includes(word)
        );

        const matchedWords = importantWords.filter(word => allGeneratedText.includes(word));
        if (matchedWords.length > importantWords.length * 0.1) {
            confidence += 0.2;
        }

        // Check for question marks in study questions
        const questionsWithMarks = studyQuestions.filter(q => q.includes('?')).length;
        if (questionsWithMarks > studyQuestions.length * 0.7) {
            confidence += 0.1;
        }

        return Math.min(confidence, 1.0);
    }

    private async generateFallbackContent(content: CapturedContent): Promise<Omit<ContentGenerationResult, 'confidence' | 'processingTime' | 'success' | 'error'>> {
        // Simple rule-based content generation as fallback
        const sentences = this.extractSentences(content.content);
        const studyQuestions = this.generateFallbackQuestions(content, sentences);
        const flashcards = this.generateFallbackFlashcards(content, sentences);
        const keyPoints = this.generateFallbackKeyPoints(sentences);

        return {
            studyQuestions,
            flashcards,
            keyPoints
        };
    }

    private generateFallbackQuestions(content: CapturedContent, sentences: string[]): string[] {
        const questions: string[] = [];

        // Generate basic questions from title and content
        questions.push(`What is the main topic of "${content.title}"?`);

        if (sentences.length > 0) {
            questions.push(`What are the key points discussed in this content?`);
        }

        // Look for definitions or explanations
        const definitionSentences = sentences.filter(s =>
            s.includes(' is ') || s.includes(' are ') || s.includes(' means ')
        );

        for (const sentence of definitionSentences.slice(0, 3)) {
            const words = sentence.split(' ');
            if (words.length > 5) {
                const subject = words.slice(0, 3).join(' ');
                questions.push(`What ${subject.toLowerCase()}?`);
            }
        }

        return questions.slice(0, 5);
    }

    private generateFallbackFlashcards(content: CapturedContent, sentences: string[]): Flashcard[] {
        const flashcards: Flashcard[] = [];

        // Create a basic flashcard from the title
        flashcards.push({
            front: `What is ${content.title} about?`,
            back: sentences[0] || content.title,
            difficulty: 'easy',
            category: 'general'
        });

        // Look for definition-like sentences
        const definitionSentences = sentences.filter(s =>
            s.includes(' is ') || s.includes(' are ') || s.includes(' means ')
        );

        for (const sentence of definitionSentences.slice(0, 3)) {
            const parts = sentence.split(/ is | are | means /);
            if (parts.length >= 2) {
                flashcards.push({
                    front: `What is ${parts[0].trim()}?`,
                    back: parts[1].trim(),
                    difficulty: 'medium',
                    category: 'definition'
                });
            }
        }

        return flashcards.slice(0, 4);
    }

    private generateFallbackKeyPoints(sentences: string[]): string[] {
        // Select the most important-looking sentences as key points
        const scoredSentences = sentences.map(sentence => ({
            sentence,
            score: this.scoreSentenceImportance(sentence)
        })).sort((a, b) => b.score - a.score);

        return scoredSentences
            .slice(0, 5)
            .map(s => s.sentence);
    }

    private scoreSentenceImportance(sentence: string): number {
        let score = 0;

        // Length scoring (prefer medium-length sentences)
        const length = sentence.length;
        if (length > 50 && length < 200) score += 0.3;

        // Keyword scoring
        const importantKeywords = [
            'important', 'key', 'main', 'primary', 'essential', 'significant',
            'crucial', 'major', 'fundamental', 'critical', 'vital'
        ];

        const lowerSentence = sentence.toLowerCase();
        for (const keyword of importantKeywords) {
            if (lowerSentence.includes(keyword)) {
                score += 0.2;
                break;
            }
        }

        // Structure scoring (sentences with colons often introduce lists or explanations)
        if (sentence.includes(':')) score += 0.1;
        if (sentence.includes('because') || sentence.includes('therefore')) score += 0.1;

        return score;
    }

    private extractSentences(text: string): string[] {
        return text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 20 && s.length < 300)
            .slice(0, 15); // Limit to first 15 sentences
    }

    private truncateContent(content: string, maxLength: number): string {
        if (content.length <= maxLength) {
            return content;
        }

        const truncated = content.substring(0, maxLength);
        const lastSentence = truncated.lastIndexOf('.');
        if (lastSentence > maxLength * 0.8) {
            return truncated.substring(0, lastSentence + 1);
        }

        return truncated + '...';
    }

    private generateCacheKey(content: CapturedContent): string {
        const contentHash = this.simpleHash(content.content + content.title);
        return `generation_${content.id}_${contentHash}`;
    }

    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    public isAPIAvailable(): boolean {
        return this.isAvailable;
    }

    public clearCache(): void {
        this.generationCache.clear();
    }

    public getCacheSize(): number {
        return this.generationCache.size;
    }

    public async synthesizeRelatedContent(contents: CapturedContent[]): Promise<{ synthesis: string, connections: string[], confidence: number }> {
        if (!this.isAvailable || contents.length < 2) {
            return {
                synthesis: '',
                connections: [],
                confidence: 0
            };
        }

        try {
            const prompt = this.buildSynthesisPrompt(contents);

            const writer = await (window as any).ai.writer.create({
                tone: 'neutral',
                format: 'plain-text',
                length: 'medium'
            });

            const response = await writer.write(prompt);
            writer.destroy();

            const synthesis = this.extractSynthesis(response);
            const connections = this.extractConnections(response);

            return {
                synthesis,
                connections,
                confidence: 0.7
            };

        } catch (error) {
            return {
                synthesis: '',
                connections: [],
                confidence: 0
            };
        }
    }

    private buildSynthesisPrompt(contents: CapturedContent[]): string {
        const contentSummaries = contents.map((content, index) =>
            `Content ${index + 1}: ${content.title}\n${this.truncateContent(content.content, 500)}`
        ).join('\n\n');

        return `Analyze the following related content pieces and create a synthesis that identifies common themes, connections, and insights.

${contentSummaries}

Please provide:
1. A synthesis paragraph that connects the main ideas across all content pieces
2. A list of specific connections between the content pieces

Format your response as:
SYNTHESIS: [synthesis paragraph]

CONNECTIONS:
- [connection 1]
- [connection 2]
- [connection 3]`;
    }

    private extractSynthesis(response: string): string {
        const synthesisMatch = response.match(/SYNTHESIS:\s*(.+?)(?=CONNECTIONS:|$)/is);
        return synthesisMatch?.[1]?.trim() || '';
    }

    private extractConnections(response: string): string[] {
        const connectionsMatch = response.match(/CONNECTIONS:\s*(.+?)$/is);
        if (!connectionsMatch) return [];

        return connectionsMatch[1]
            .split('\n')
            .map(line => line.replace(/^[-•]\s*/, '').trim())
            .filter(line => line.length > 10)
            .slice(0, 5);
    }
}