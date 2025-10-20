// Prompt API processor for concept extraction and categorization

import { ConceptExtractionResult, ExtractedConcept, PromptTemplate } from './types';
import { CapturedContent } from '../types/content';

export class PromptAPIProcessor {
    private static instance: PromptAPIProcessor;
    private promptTemplates: Map<string, PromptTemplate>;
    private isAvailable: boolean = false;

    private constructor() {
        this.promptTemplates = new Map();
        this.initializeTemplates();
        this.checkAPIAvailability();
    }

    public static getInstance(): PromptAPIProcessor {
        if (!PromptAPIProcessor.instance) {
            PromptAPIProcessor.instance = new PromptAPIProcessor();
        }
        return PromptAPIProcessor.instance;
    }

    private async checkAPIAvailability(): Promise<void> {
        try {
            // Check if Chrome AI Prompt API is available
            if ('ai' in window && 'languageModel' in (window as any).ai) {
                const capabilities = await (window as any).ai.languageModel.capabilities();
                this.isAvailable = capabilities.available === 'readily';
            } else {
                this.isAvailable = false;
            }
        } catch (error) {
            console.warn('Chrome AI Prompt API not available:', error);
            this.isAvailable = false;
        }
    }

    private initializeTemplates(): void {
        // Concept extraction template
        this.promptTemplates.set('concept-extraction', {
            name: 'concept-extraction',
            template: `Analyze the following content and extract key concepts, entities, and topics. 
            
Content Title: {{title}}
Content: {{content}}

Please identify:
1. Key concepts and topics (max {{maxConcepts}})
2. Named entities (people, organizations, locations, technologies)
3. Main themes and subjects
4. Content category

Format your response as JSON:
{
  "concepts": [
    {
      "name": "concept name",
      "confidence": 0.95,
      "category": "technology|person|organization|location|concept|other",
      "context": "brief context where this appears"
    }
  ],
  "category": "article|tutorial|news|research|documentation|entertainment|other",
  "mainThemes": ["theme1", "theme2"],
  "confidence": 0.85
}`,
            variables: ['title', 'content', 'maxConcepts'],
            description: 'Extracts key concepts and categorizes content'
        });

        // Tagging template
        this.promptTemplates.set('auto-tagging', {
            name: 'auto-tagging',
            template: `Generate relevant tags for the following content. Focus on topics, technologies, concepts, and themes that would help with future search and organization.

Content Title: {{title}}
Content: {{content}}
Extracted Concepts: {{concepts}}

Generate 5-10 relevant tags that are:
- Specific and descriptive
- Useful for search and categorization
- Not too generic (avoid tags like "content", "information")
- Include both broad topics and specific technologies/concepts

Format as JSON:
{
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.9
}`,
            variables: ['title', 'content', 'concepts'],
            description: 'Generates relevant tags for content organization'
        });

        // Category classification template
        this.promptTemplates.set('categorization', {
            name: 'categorization',
            template: `Classify the following content into the most appropriate category:

Content Title: {{title}}
Content: {{content}}

Categories:
- article: News articles, blog posts, opinion pieces
- tutorial: How-to guides, step-by-step instructions
- documentation: Technical docs, API references, manuals
- research: Academic papers, studies, research findings
- video: Video content, lectures, presentations
- social: Social media posts, discussions, forums
- entertainment: Entertainment content, reviews, media
- other: Content that doesn't fit other categories

Respond with JSON:
{
  "category": "category_name",
  "confidence": 0.95,
  "reasoning": "brief explanation of classification"
}`,
            variables: ['title', 'content'],
            description: 'Classifies content into predefined categories'
        });
    }

    public async extractConcepts(content: CapturedContent, maxConcepts: number = 10): Promise<ConceptExtractionResult> {
        const startTime = Date.now();

        if (!this.isAvailable) {
            return {
                concepts: [],
                tags: [],
                category: 'other',
                confidence: 0,
                processingTime: Date.now() - startTime,
                success: false,
                error: 'Chrome AI Prompt API not available'
            };
        }

        try {
            // Step 1: Extract concepts
            const conceptResult = await this.processConceptExtraction(content, maxConcepts);

            // Step 2: Generate tags
            const tagResult = await this.generateTags(content, conceptResult.concepts);

            // Step 3: Categorize content
            const categoryResult = await this.categorizeContent(content);

            const processingTime = Date.now() - startTime;

            return {
                concepts: conceptResult.concepts,
                tags: tagResult.tags,
                category: categoryResult.category,
                confidence: Math.min(conceptResult.confidence, tagResult.confidence, categoryResult.confidence),
                processingTime,
                success: true
            };

        } catch (error) {
            return {
                concepts: [],
                tags: [],
                category: 'other',
                confidence: 0,
                processingTime: Date.now() - startTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during concept extraction'
            };
        }
    }

    private async processConceptExtraction(content: CapturedContent, maxConcepts: number): Promise<{ concepts: ExtractedConcept[], confidence: number }> {
        const template = this.promptTemplates.get('concept-extraction');
        if (!template) {
            throw new Error('Concept extraction template not found');
        }

        const prompt = this.fillTemplate(template.template, {
            title: content.title,
            content: this.truncateContent(content.content, 4000), // Limit content length
            maxConcepts: maxConcepts.toString()
        });

        const session = await (window as any).ai.languageModel.create({
            temperature: 0.3,
            topK: 40
        });

        const response = await session.prompt(prompt);
        session.destroy();

        try {
            const parsed = JSON.parse(response);
            return {
                concepts: parsed.concepts || [],
                confidence: parsed.confidence || 0.5
            };
        } catch (parseError) {
            // Fallback: extract concepts from response text
            return this.fallbackConceptExtraction(response);
        }
    }

    private async generateTags(content: CapturedContent, concepts: ExtractedConcept[]): Promise<{ tags: string[], confidence: number }> {
        const template = this.promptTemplates.get('auto-tagging');
        if (!template) {
            throw new Error('Auto-tagging template not found');
        }

        const conceptNames = concepts.map(c => c.name).join(', ');
        const prompt = this.fillTemplate(template.template, {
            title: content.title,
            content: this.truncateContent(content.content, 3000),
            concepts: conceptNames
        });

        const session = await (window as any).ai.languageModel.create({
            temperature: 0.4,
            topK: 50
        });

        const response = await session.prompt(prompt);
        session.destroy();

        try {
            const parsed = JSON.parse(response);
            return {
                tags: parsed.tags || [],
                confidence: parsed.confidence || 0.5
            };
        } catch (parseError) {
            // Fallback: extract tags from response text
            return this.fallbackTagExtraction(response);
        }
    }

    private async categorizeContent(content: CapturedContent): Promise<{ category: string, confidence: number }> {
        const template = this.promptTemplates.get('categorization');
        if (!template) {
            throw new Error('Categorization template not found');
        }

        const prompt = this.fillTemplate(template.template, {
            title: content.title,
            content: this.truncateContent(content.content, 2000)
        });

        const session = await (window as any).ai.languageModel.create({
            temperature: 0.2,
            topK: 30
        });

        const response = await session.prompt(prompt);
        session.destroy();

        try {
            const parsed = JSON.parse(response);
            return {
                category: parsed.category || 'other',
                confidence: parsed.confidence || 0.5
            };
        } catch (parseError) {
            // Fallback: basic categorization based on content
            return this.fallbackCategorization(content);
        }
    }

    private fillTemplate(template: string, variables: Record<string, string>): string {
        let filled = template;
        for (const [key, value] of Object.entries(variables)) {
            filled = filled.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        return filled;
    }

    private truncateContent(content: string, maxLength: number): string {
        if (content.length <= maxLength) {
            return content;
        }
        return content.substring(0, maxLength) + '...';
    }

    private fallbackConceptExtraction(response: string): { concepts: ExtractedConcept[], confidence: number } {
        // Simple fallback: extract potential concepts from response
        const concepts: ExtractedConcept[] = [];
        const lines = response.split('\n');

        for (const line of lines) {
            if (line.includes(':') && line.length < 100) {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const name = parts[0].trim().replace(/^[-*•]\s*/, '');
                    if (name.length > 2 && name.length < 50) {
                        concepts.push({
                            name,
                            confidence: 0.6,
                            category: 'concept',
                            context: parts[1].trim()
                        });
                    }
                }
            }
        }

        return {
            concepts: concepts.slice(0, 10),
            confidence: 0.6
        };
    }

    private fallbackTagExtraction(response: string): { tags: string[], confidence: number } {
        // Extract potential tags from response
        const tags: string[] = [];
        const words = response.toLowerCase().match(/\b\w+\b/g) || [];

        // Look for technical terms, proper nouns, etc.
        const potentialTags = words.filter(word =>
            word.length > 3 &&
            word.length < 20 &&
            !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'would', 'could', 'should'].includes(word)
        );

        // Remove duplicates and take top 8
        const uniqueTags = [...new Set(potentialTags)].slice(0, 8);

        return {
            tags: uniqueTags,
            confidence: 0.4
        };
    }

    private fallbackCategorization(content: CapturedContent): { category: string, confidence: number } {
        const title = content.title.toLowerCase();
        const contentText = content.content.toLowerCase();

        // Simple keyword-based categorization
        if (title.includes('tutorial') || title.includes('how to') || contentText.includes('step 1') || contentText.includes('instructions')) {
            return { category: 'tutorial', confidence: 0.7 };
        }

        if (title.includes('documentation') || title.includes('api') || title.includes('reference')) {
            return { category: 'documentation', confidence: 0.7 };
        }

        if (title.includes('research') || title.includes('study') || contentText.includes('abstract') || contentText.includes('methodology')) {
            return { category: 'research', confidence: 0.7 };
        }

        if (content.metadata.pageType === 'video') {
            return { category: 'video', confidence: 0.8 };
        }

        if (content.metadata.pageType === 'social') {
            return { category: 'social', confidence: 0.8 };
        }

        return { category: 'article', confidence: 0.5 };
    }

    public isAPIAvailable(): boolean {
        return this.isAvailable;
    }

    public getTemplate(name: string): PromptTemplate | undefined {
        return this.promptTemplates.get(name);
    }

    public addTemplate(template: PromptTemplate): void {
        this.promptTemplates.set(template.name, template);
    }
}