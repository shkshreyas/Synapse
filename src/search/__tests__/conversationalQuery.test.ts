// Tests for conversational query functionality

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ConversationalQuery, ConversationMessage, ConversationContext } from '../conversationalQuery';
import { NaturalLanguageSearch } from '../naturalLanguageSearch';
import { SearchRanking } from '../searchRanking';
import { getDatabase } from '../../storage/database';

// Mock dependencies
vi.mock('../naturalLanguageSearch');
vi.mock('../searchRanking');
vi.mock('../../storage/database');

const mockNaturalLanguageSearch = NaturalLanguageSearch as unknown as {
    getInstance: Mock;
    prototype: {
        search: Mock;
    };
};

const mockSearchRanking = SearchRanking as unknown as {
    getInstance: Mock;
};

const mockGetDatabase = getDatabase as Mock;

describe('ConversationalQuery', () => {
    let conversationalQuery: ConversationalQuery;
    let mockNLSearchInstance: any;
    let mockRankingInstance: any;
    let mockDatabase: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup mock instances
        mockNLSearchInstance = {
            search: vi.fn()
        };

        mockRankingInstance = {};

        mockDatabase = {
            getDatabase: vi.fn().mockReturnValue({
                transaction: vi.fn().mockReturnValue({
                    objectStore: vi.fn().mockReturnValue({
                        get: vi.fn().mockReturnValue({
                            onsuccess: null,
                            onerror: null,
                            result: null
                        }),
                        put: vi.fn().mockReturnValue({
                            onsuccess: null,
                            onerror: null
                        }),
                        getAll: vi.fn().mockReturnValue({
                            onsuccess: null,
                            onerror: null,
                            result: []
                        })
                    })
                })
            })
        };

        // Setup mock returns
        mockNaturalLanguageSearch.getInstance.mockReturnValue(mockNLSearchInstance);
        mockSearchRanking.getInstance.mockReturnValue(mockRankingInstance);
        mockGetDatabase.mockResolvedValue(mockDatabase);

        // Create instance
        conversationalQuery = ConversationalQuery.getInstance();
    });

    describe('Question Asking', () => {
        it('should handle a simple question', async () => {
            const query = 'What is machine learning?';
            const mockSearchResult = {
                success: true,
                semanticMatches: [
                    {
                        contentId: '1',
                        title: 'Introduction to Machine Learning',
                        snippet: 'Machine learning is a subset of artificial intelligence that enables computers to learn without being explicitly programmed.',
                        semanticScore: 0.9,
                        keywordScore: 0.8,
                        combinedScore: 0.85,
                        matchType: 'semantic',
                        matchedConcepts: ['machine learning', 'artificial intelligence']
                    }
                ],
                queryIntent: {
                    type: 'definition',
                    confidence: 0.9,
                    entities: ['machine learning'],
                    keywords: ['what', 'machine', 'learning']
                }
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);

            // Mock database content retrieval
            const mockContent = {
                id: '1',
                title: 'Introduction to Machine Learning',
                url: 'https://example.com/ml-intro',
                content: 'Machine learning is a subset of artificial intelligence...'
            };

            const mockTransaction = mockDatabase.getDatabase().transaction();
            const mockStore = mockTransaction.objectStore();
            const mockGetRequest = mockStore.get();

            // Simulate successful database retrieval
            setTimeout(() => {
                mockGetRequest.result = mockContent;
                if (mockGetRequest.onsuccess) mockGetRequest.onsuccess();
            }, 0);

            const response = await conversationalQuery.askQuestion(query);

            expect(response.message.type).toBe('assistant');
            expect(response.message.content).toContain('machine learning');
            expect(response.sources).toHaveLength(1);
            expect(response.sources[0].title).toBe('Introduction to Machine Learning');
            expect(response.confidence).toBeGreaterThan(0.5);
            expect(response.suggestedFollowUps).toHaveLength(3);
        });

        it('should handle how-to questions', async () => {
            const query = 'How to create a neural network?';
            const mockSearchResult = {
                success: true,
                semanticMatches: [
                    {
                        contentId: '2',
                        title: 'Building Neural Networks Step by Step',
                        snippet: 'To create a neural network: 1. Define the architecture 2. Initialize weights 3. Train the model',
                        semanticScore: 0.8,
                        keywordScore: 0.9,
                        combinedScore: 0.85,
                        matchType: 'exact',
                        matchedConcepts: ['neural network', 'deep learning']
                    }
                ],
                queryIntent: {
                    type: 'howto',
                    confidence: 0.95,
                    entities: ['neural network'],
                    keywords: ['how', 'create', 'neural', 'network']
                }
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);

            const response = await conversationalQuery.askQuestion(query);

            expect(response.message.content).toContain('steps');
            expect(response.suggestedFollowUps.some(s => s.includes('mistakes'))).toBe(true);
        });

        it('should handle comparison questions', async () => {
            const query = 'React vs Vue comparison';
            const mockSearchResult = {
                success: true,
                semanticMatches: [
                    {
                        contentId: '3',
                        title: 'React vs Vue: A Detailed Comparison',
                        snippet: 'React is more flexible while Vue is easier to learn. React has a larger ecosystem but Vue has better documentation.',
                        semanticScore: 0.85,
                        keywordScore: 0.8,
                        combinedScore: 0.825,
                        matchType: 'semantic',
                        matchedConcepts: ['react', 'vue', 'comparison']
                    }
                ],
                queryIntent: {
                    type: 'comparison',
                    confidence: 0.9,
                    entities: ['React', 'Vue'],
                    keywords: ['react', 'vue', 'comparison']
                }
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);

            const response = await conversationalQuery.askQuestion(query);

            expect(response.message.content).toContain('React');
            expect(response.message.content).toContain('Vue');
            expect(response.suggestedFollowUps.some(s => s.includes('choose'))).toBe(true);
        });
    });

    describe('Conversation Context', () => {
        it('should maintain conversation context across questions', async () => {
            const firstQuery = 'What is JavaScript?';
            const secondQuery = 'How do I use it for web development?';

            // First question
            mockNLSearchInstance.search.mockResolvedValueOnce({
                success: true,
                semanticMatches: [{
                    contentId: '1',
                    title: 'JavaScript Basics',
                    snippet: 'JavaScript is a programming language...',
                    semanticScore: 0.8,
                    keywordScore: 0.8,
                    combinedScore: 0.8,
                    matchType: 'semantic',
                    matchedConcepts: ['javascript']
                }],
                queryIntent: {
                    type: 'definition',
                    confidence: 0.9,
                    entities: ['JavaScript'],
                    keywords: ['what', 'javascript']
                }
            });

            const firstResponse = await conversationalQuery.askQuestion(firstQuery);
            const conversationId = firstResponse.message.id.split('_')[0]; // Extract conversation ID

            // Second question in same conversation
            mockNLSearchInstance.search.mockResolvedValueOnce({
                success: true,
                semanticMatches: [{
                    contentId: '2',
                    title: 'JavaScript for Web Development',
                    snippet: 'Use JavaScript to create interactive web pages...',
                    semanticScore: 0.85,
                    keywordScore: 0.8,
                    combinedScore: 0.825,
                    matchType: 'semantic',
                    matchedConcepts: ['javascript', 'web development']
                }],
                queryIntent: {
                    type: 'howto',
                    confidence: 0.8,
                    entities: [],
                    keywords: ['how', 'use', 'web', 'development']
                }
            });

            // The search should be enhanced with context from the first question
            mockNLSearchInstance.search.mockImplementation((enhancedQuery) => {
                expect(enhancedQuery).toContain('javascript');
                return Promise.resolve({
                    success: true,
                    semanticMatches: [],
                    queryIntent: { type: 'howto', confidence: 0.8, entities: [], keywords: [] }
                });
            });

            await conversationalQuery.askQuestion(secondQuery, conversationId);

            expect(mockNLSearchInstance.search).toHaveBeenCalledTimes(2);
        });

        it('should generate contextual follow-up suggestions', async () => {
            const query = 'What is React?';
            const mockSearchResult = {
                success: true,
                semanticMatches: [{
                    contentId: '1',
                    title: 'React Introduction',
                    snippet: 'React is a JavaScript library for building user interfaces...',
                    semanticScore: 0.9,
                    keywordScore: 0.8,
                    combinedScore: 0.85,
                    matchType: 'semantic',
                    matchedConcepts: ['react', 'javascript', 'ui']
                }],
                queryIntent: {
                    type: 'definition',
                    confidence: 0.9,
                    entities: ['React'],
                    keywords: ['what', 'react']
                }
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);

            const response = await conversationalQuery.askQuestion(query);

            expect(response.suggestedFollowUps).toHaveLength(3);
            expect(response.suggestedFollowUps[0]).toContain('React');
        });
    });

    describe('Response Generation', () => {
        it('should generate appropriate responses for different intents', async () => {
            const testCases = [
                {
                    intent: 'definition',
                    query: 'What is TypeScript?',
                    expectedContent: ['TypeScript', 'defined as', 'refers to']
                },
                {
                    intent: 'howto',
                    query: 'How to install Node.js?',
                    expectedContent: ['steps', 'process', 'how to']
                },
                {
                    intent: 'summary',
                    query: 'Summarize machine learning',
                    expectedContent: ['summary', 'key points', 'about']
                }
            ];

            for (const testCase of testCases) {
                mockNLSearchInstance.search.mockResolvedValue({
                    success: true,
                    semanticMatches: [{
                        contentId: '1',
                        title: 'Test Content',
                        snippet: 'Test content snippet...',
                        semanticScore: 0.8,
                        keywordScore: 0.8,
                        combinedScore: 0.8,
                        matchType: 'semantic',
                        matchedConcepts: ['test']
                    }],
                    queryIntent: {
                        type: testCase.intent,
                        confidence: 0.9,
                        entities: [],
                        keywords: []
                    }
                });

                const response = await conversationalQuery.askQuestion(testCase.query);

                const hasExpectedContent = testCase.expectedContent.some(content =>
                    response.message.content.toLowerCase().includes(content.toLowerCase())
                );
                expect(hasExpectedContent).toBe(true);
            }
        });

        it('should include source citations', async () => {
            const query = 'What is AI?';
            const mockSearchResult = {
                success: true,
                semanticMatches: [{
                    contentId: '1',
                    title: 'Artificial Intelligence Overview',
                    snippet: 'AI is the simulation of human intelligence...',
                    semanticScore: 0.9,
                    keywordScore: 0.8,
                    combinedScore: 0.85,
                    matchType: 'semantic',
                    matchedConcepts: ['ai', 'artificial intelligence']
                }],
                queryIntent: {
                    type: 'definition',
                    confidence: 0.9,
                    entities: ['AI'],
                    keywords: ['what', 'ai']
                }
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);

            const response = await conversationalQuery.askQuestion(query);

            expect(response.message.content).toContain('Sources:');
            expect(response.message.content).toContain('[1]');
            expect(response.sources).toHaveLength(1);
            expect(response.sources[0].citationIndex).toBe(1);
        });

        it('should handle no results gracefully', async () => {
            const query = 'What is nonexistent technology?';
            const mockSearchResult = {
                success: true,
                semanticMatches: [],
                queryIntent: {
                    type: 'definition',
                    confidence: 0.7,
                    entities: [],
                    keywords: ['what', 'nonexistent', 'technology']
                }
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);

            const response = await conversationalQuery.askQuestion(query);

            expect(response.message.content).toContain("couldn't find");
            expect(response.sources).toHaveLength(0);
            expect(response.confidence).toBeLessThan(0.5);
            expect(response.suggestedFollowUps).toHaveLength(3);
        });
    });

    describe('Response Styles', () => {
        it('should generate concise responses when requested', async () => {
            const query = 'What is Python?';
            const mockSearchResult = {
                success: true,
                semanticMatches: [{
                    contentId: '1',
                    title: 'Python Programming Language',
                    snippet: 'Python is a high-level programming language known for its simplicity and readability.',
                    semanticScore: 0.9,
                    keywordScore: 0.8,
                    combinedScore: 0.85,
                    matchType: 'semantic',
                    matchedConcepts: ['python', 'programming']
                }],
                queryIntent: {
                    type: 'definition',
                    confidence: 0.9,
                    entities: ['Python'],
                    keywords: ['what', 'python']
                }
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);

            const response = await conversationalQuery.askQuestion(query, undefined, {
                responseStyle: 'concise'
            });

            // Concise responses should be shorter
            expect(response.message.content.length).toBeLessThan(200);
            expect(response.message.content).not.toContain('Based on your saved content');
        });

        it('should generate academic responses when requested', async () => {
            const query = 'What is machine learning?';
            const mockSearchResult = {
                success: true,
                semanticMatches: [{
                    contentId: '1',
                    title: 'Machine Learning Fundamentals',
                    snippet: 'Machine learning is a method of data analysis that automates analytical model building.',
                    semanticScore: 0.9,
                    keywordScore: 0.8,
                    combinedScore: 0.85,
                    matchType: 'semantic',
                    matchedConcepts: ['machine learning', 'data analysis']
                }],
                queryIntent: {
                    type: 'definition',
                    confidence: 0.9,
                    entities: ['machine learning'],
                    keywords: ['what', 'machine', 'learning']
                }
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);

            const response = await conversationalQuery.askQuestion(query, undefined, {
                responseStyle: 'academic'
            });

            // Academic responses should use formal language
            expect(response.message.content).toContain('The following represents');
        });
    });

    describe('Conversation Management', () => {
        it('should retrieve conversation history', async () => {
            // Create a conversation first
            const query = 'Test question';
            mockNLSearchInstance.search.mockResolvedValue({
                success: true,
                semanticMatches: [],
                queryIntent: { type: 'question', confidence: 0.5, entities: [], keywords: [] }
            });

            const response = await conversationalQuery.askQuestion(query);
            const conversationId = response.message.id.split('_')[0];

            const history = await conversationalQuery.getConversationHistory(conversationId);

            expect(history).toHaveLength(2); // User message + assistant response
            expect(history[0].type).toBe('user');
            expect(history[1].type).toBe('assistant');
        });

        it('should list all conversations', async () => {
            // Create multiple conversations
            mockNLSearchInstance.search.mockResolvedValue({
                success: true,
                semanticMatches: [],
                queryIntent: { type: 'question', confidence: 0.5, entities: [], keywords: [] }
            });

            await conversationalQuery.askQuestion('First question');
            await conversationalQuery.askQuestion('Second question');

            const conversations = await conversationalQuery.getAllConversations();

            expect(conversations.length).toBeGreaterThanOrEqual(2);
            expect(conversations[0].lastUpdated.getTime()).toBeGreaterThanOrEqual(
                conversations[1].lastUpdated.getTime()
            );
        });

        it('should delete conversations', async () => {
            // Create a conversation
            mockNLSearchInstance.search.mockResolvedValue({
                success: true,
                semanticMatches: [],
                queryIntent: { type: 'question', confidence: 0.5, entities: [], keywords: [] }
            });

            const response = await conversationalQuery.askQuestion('Test question');
            const conversationId = response.message.id.split('_')[0];

            // Delete the conversation
            await conversationalQuery.deleteConversation(conversationId);

            // Verify it's deleted
            const history = await conversationalQuery.getConversationHistory(conversationId);
            expect(history).toHaveLength(0);
        });

        it('should clear all conversations', async () => {
            // Create conversations
            mockNLSearchInstance.search.mockResolvedValue({
                success: true,
                semanticMatches: [],
                queryIntent: { type: 'question', confidence: 0.5, entities: [], keywords: [] }
            });

            await conversationalQuery.askQuestion('First question');
            await conversationalQuery.askQuestion('Second question');

            // Clear all
            await conversationalQuery.clearAllConversations();

            // Verify all are cleared
            const conversations = await conversationalQuery.getAllConversations();
            expect(conversations).toHaveLength(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle search failures gracefully', async () => {
            const query = 'Test question';
            mockNLSearchInstance.search.mockRejectedValue(new Error('Search failed'));

            const response = await conversationalQuery.askQuestion(query);

            expect(response.message.type).toBe('assistant');
            expect(response.message.content).toContain("I'm sorry");
            expect(response.confidence).toBeLessThan(0.5);
            expect(response.sources).toHaveLength(0);
        });

        it('should handle database errors gracefully', async () => {
            const query = 'Test question';
            mockNLSearchInstance.search.mockResolvedValue({
                success: true,
                semanticMatches: [{
                    contentId: '1',
                    title: 'Test',
                    snippet: 'Test snippet',
                    semanticScore: 0.8,
                    keywordScore: 0.8,
                    combinedScore: 0.8,
                    matchType: 'semantic',
                    matchedConcepts: []
                }],
                queryIntent: { type: 'question', confidence: 0.8, entities: [], keywords: [] }
            });

            // Mock database error
            mockGetDatabase.mockRejectedValue(new Error('Database error'));

            const response = await conversationalQuery.askQuestion(query);

            // Should still provide a response, but with limited sources
            expect(response.message.type).toBe('assistant');
            expect(response.sources).toHaveLength(0);
        });
    });
});