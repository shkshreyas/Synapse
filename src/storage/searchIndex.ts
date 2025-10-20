// Full-text search indexing system for Synapse

import { getDatabase } from "./database";
import {
  StoredContent,
  SearchIndexEntry,
  SearchableMetadata,
} from "../types/storage";
import { validateSearchQuery } from "./validators";

export class SearchIndex {
  private static instance: SearchIndex | null = null;
  private stopWords: Set<string>;

  constructor() {
    // Common English stop words
    this.stopWords = new Set([
      "a",
      "an",
      "and",
      "are",
      "as",
      "at",
      "be",
      "by",
      "for",
      "from",
      "has",
      "he",
      "in",
      "is",
      "it",
      "its",
      "of",
      "on",
      "that",
      "the",
      "to",
      "was",
      "will",
      "with",
      "would",
      "you",
      "your",
      "have",
      "had",
      "this",
      "these",
      "they",
      "were",
      "been",
      "their",
      "said",
      "each",
      "which",
      "she",
      "do",
      "how",
      "if",
      "up",
      "out",
      "many",
      "then",
      "them",
      "can",
      "could",
      "should",
      "would",
      "about",
      "after",
      "all",
      "also",
      "am",
      "another",
      "any",
      "because",
      "before",
      "being",
      "between",
      "both",
      "but",
      "came",
      "come",
      "did",
      "each",
      "even",
      "every",
      "get",
      "got",
      "had",
      "has",
      "have",
      "having",
      "here",
      "him",
      "his",
      "how",
      "i",
      "into",
      "just",
      "like",
      "make",
      "me",
      "most",
      "my",
      "no",
      "now",
      "only",
      "or",
      "other",
      "our",
      "over",
      "own",
      "see",
      "so",
      "some",
      "such",
      "than",
      "through",
      "time",
      "two",
      "very",
      "way",
      "we",
      "well",
      "what",
      "when",
      "where",
      "who",
      "why",
      "work",
      "year",
      "years",
    ]);
  }

  static getInstance(): SearchIndex {
    if (!SearchIndex.instance) {
      SearchIndex.instance = new SearchIndex();
    }
    return SearchIndex.instance;
  }

  async indexContent(content: StoredContent): Promise<IndexingResult> {
    const startTime = performance.now();

    try {
      // Extract searchable terms
      const terms = this.extractSearchTerms(content);

      // Create search index entry
      const indexEntry: SearchIndexEntry = {
        id: `index_${content.id}`,
        contentId: content.id,
        terms,
        title: content.title,
        content: this.truncateContent(content.content),
        metadata: this.extractSearchableMetadata(content),
        lastUpdated: new Date(),
      };

      // Store in database
      const db = await getDatabase();
      const database = db.getDatabase();

      return new Promise((resolve) => {
        const transaction = database.transaction(["searchIndex"], "readwrite");
        const store = transaction.objectStore("searchIndex");
        const request = store.put(indexEntry);

        request.onsuccess = () => {
          resolve({
            success: true,
            contentId: content.id,
            termsIndexed: terms.length,
            operationTime: performance.now() - startTime,
          });
        };

        request.onerror = () => {
          resolve({
            success: false,
            contentId: content.id,
            error: `Failed to index content: ${request.error?.message}`,
            operationTime: performance.now() - startTime,
          });
        };
      });
    } catch (error) {
      return {
        success: false,
        contentId: content.id,
        error: `Indexing error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        operationTime: performance.now() - startTime,
      };
    }
  }

  async removeFromIndex(contentId: string): Promise<IndexingResult> {
    const startTime = performance.now();

    try {
      const db = await getDatabase();
      const database = db.getDatabase();

      return new Promise((resolve) => {
        const transaction = database.transaction(["searchIndex"], "readwrite");
        const store = transaction.objectStore("searchIndex");
        const index = store.index("contentId");
        const request = index.getKey(contentId);

        request.onsuccess = () => {
          if (request.result) {
            const deleteRequest = store.delete(request.result);
            deleteRequest.onsuccess = () => {
              resolve({
                success: true,
                contentId,
                operationTime: performance.now() - startTime,
              });
            };
            deleteRequest.onerror = () => {
              resolve({
                success: false,
                contentId,
                error: `Failed to remove from index: ${deleteRequest.error?.message}`,
                operationTime: performance.now() - startTime,
              });
            };
          } else {
            resolve({
              success: true,
              contentId,
              operationTime: performance.now() - startTime,
            });
          }
        };

        request.onerror = () => {
          resolve({
            success: false,
            contentId,
            error: `Failed to find index entry: ${request.error?.message}`,
            operationTime: performance.now() - startTime,
          });
        };
      });
    } catch (error) {
      return {
        success: false,
        contentId,
        error: `Remove error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        operationTime: performance.now() - startTime,
      };
    }
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const startTime = performance.now();

    try {
      // Validate query
      const validation = validateSearchQuery(query);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid query: ${validation.errors
            .map((e) => e.message)
            .join(", ")}`,
          results: [],
          totalResults: 0,
          operationTime: performance.now() - startTime,
        };
      }

      const searchTerms = this.extractQueryTerms(query);
      const db = await getDatabase();
      const database = db.getDatabase();

      return new Promise((resolve) => {
        const transaction = database.transaction(["searchIndex"], "readonly");
        const store = transaction.objectStore("searchIndex");
        const request = store.getAll();

        request.onsuccess = () => {
          const allEntries: SearchIndexEntry[] = request.result || [];
          const scoredResults = this.scoreSearchResults(
            allEntries,
            searchTerms,
            options
          );

          // Apply filters
          let filteredResults = scoredResults;
          if (options?.filters) {
            filteredResults = this.applyFilters(scoredResults, options.filters);
          }

          // Sort by relevance score
          filteredResults.sort((a, b) => b.score - a.score);

          // Apply pagination
          const totalResults = filteredResults.length;
          const startIndex = (options?.page || 0) * (options?.pageSize || 20);
          const endIndex = startIndex + (options?.pageSize || 20);
          const paginatedResults = filteredResults.slice(startIndex, endIndex);

          resolve({
            success: true,
            results: paginatedResults,
            totalResults,
            operationTime: performance.now() - startTime,
            query: query,
            searchTerms,
          });
        };

        request.onerror = () => {
          resolve({
            success: false,
            error: `Search failed: ${request.error?.message}`,
            results: [],
            totalResults: 0,
            operationTime: performance.now() - startTime,
          });
        };
      });
    } catch (error) {
      return {
        success: false,
        error: `Search error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        results: [],
        totalResults: 0,
        operationTime: performance.now() - startTime,
      };
    }
  }

  async rebuildIndex(): Promise<RebuildResult> {
    const startTime = performance.now();

    try {
      const db = await getDatabase();
      const database = db.getDatabase();

      // Clear existing index
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(["searchIndex"], "readwrite");
        const store = transaction.objectStore("searchIndex");
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Get all content
      const allContent = await new Promise<StoredContent[]>(
        (resolve, reject) => {
          const transaction = database.transaction(["content"], "readonly");
          const store = transaction.objectStore("content");
          const request = store.getAll();

          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
        }
      );

      // Reindex all content
      let successCount = 0;
      let failureCount = 0;
      const errors: string[] = [];

      for (const content of allContent) {
        const result = await this.indexContent(content);
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
          if (result.error) {
            errors.push(`${content.id}: ${result.error}`);
          }
        }
      }

      return {
        success: failureCount === 0,
        totalItems: allContent.length,
        successCount,
        failureCount,
        errors: errors.slice(0, 10), // Limit error messages
        operationTime: performance.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        totalItems: 0,
        successCount: 0,
        failureCount: 0,
        errors: [
          `Rebuild failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
        operationTime: performance.now() - startTime,
      };
    }
  }

  private extractSearchTerms(content: StoredContent): string[] {
    const terms = new Set<string>();

    // Extract from title (higher weight)
    this.tokenize(content.title).forEach((term) => {
      terms.add(term);
      terms.add(`title:${term}`); // Prefix for title-specific searches
    });

    // Extract from content
    this.tokenize(content.content).forEach((term) => {
      terms.add(term);
    });

    // Extract from tags
    if (content.tags) {
      content.tags.forEach((tag) => {
        this.tokenize(tag).forEach((term) => {
          terms.add(term);
          terms.add(`tag:${term}`);
        });
      });
    }

    // Extract from concepts
    if (content.concepts) {
      content.concepts.forEach((concept) => {
        this.tokenize(concept).forEach((term) => {
          terms.add(term);
          terms.add(`concept:${term}`);
        });
      });
    }

    // Extract from metadata
    if (content.category) {
      terms.add(`category:${content.category.toLowerCase()}`);
    }

    if (content.metadata.author) {
      this.tokenize(content.metadata.author).forEach((term) => {
        terms.add(`author:${term}`);
      });
    }

    terms.add(`type:${content.metadata.pageType}`);
    terms.add(`lang:${content.metadata.language}`);

    return Array.from(terms);
  }

  private extractQueryTerms(query: string): string[] {
    return this.tokenize(query);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
      .split(/\s+/)
      .filter((term) => term.length > 2 && !this.stopWords.has(term))
      .map((term) => this.stemWord(term));
  }

  private stemWord(word: string): string {
    // Simple stemming - remove common suffixes
    const suffixes = [
      "ing",
      "ed",
      "er",
      "est",
      "ly",
      "tion",
      "sion",
      "ness",
      "ment",
    ];

    for (const suffix of suffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.slice(0, -suffix.length);
      }
    }

    return word;
  }

  private scoreSearchResults(
    entries: SearchIndexEntry[],
    searchTerms: string[],
    options?: SearchOptions
  ): ScoredSearchResult[] {
    return entries
      .map((entry) => {
        let score = 0;
        let matchedTerms = 0;

        for (const searchTerm of searchTerms) {
          const termMatches = entry.terms.filter(
            (indexTerm) =>
              indexTerm.includes(searchTerm) || searchTerm.includes(indexTerm)
          ).length;

          if (termMatches > 0) {
            matchedTerms++;

            // Base score for term match
            score += termMatches;

            // Boost for title matches
            if (entry.title.toLowerCase().includes(searchTerm)) {
              score += 3;
            }

            // Boost for exact matches
            if (entry.terms.includes(searchTerm)) {
              score += 2;
            }

            // Boost for tag/concept matches
            if (
              entry.terms.includes(`tag:${searchTerm}`) ||
              entry.terms.includes(`concept:${searchTerm}`)
            ) {
              score += 2;
            }
          }
        }

        // Boost for multiple term matches
        if (matchedTerms > 1) {
          score *= 1 + matchedTerms * 0.2;
        }

        // Apply metadata boosts
        if (entry.metadata.importance) {
          score *= 1 + entry.metadata.importance * 0.1;
        }

        // Recency boost (content from last 30 days gets boost)
        const daysSinceCreation =
          (Date.now() - new Date(entry.lastUpdated).getTime()) /
          (1000 * 60 * 60 * 24);
        if (daysSinceCreation < 30) {
          score *= 1 + (30 - daysSinceCreation) * 0.01;
        }

        return {
          contentId: entry.contentId,
          title: entry.title,
          snippet: this.generateSnippet(entry.content, searchTerms),
          score,
          matchedTerms,
          metadata: entry.metadata,
        };
      })
      .filter((result) => result.score > 0);
  }

  private applyFilters(
    results: ScoredSearchResult[],
    filters: SearchFilters
  ): ScoredSearchResult[] {
    return results.filter((result) => {
      if (filters.category && result.metadata.category !== filters.category) {
        return false;
      }

      if (filters.pageType && result.metadata.pageType !== filters.pageType) {
        return false;
      }

      if (filters.language && result.metadata.language !== filters.language) {
        return false;
      }

      if (filters.tags && filters.tags.length > 0) {
        const resultTags = result.metadata.tags || [];
        const hasMatchingTag = filters.tags.some((tag) =>
          resultTags.some((resultTag) =>
            resultTag.toLowerCase().includes(tag.toLowerCase())
          )
        );
        if (!hasMatchingTag) {
          return false;
        }
      }

      if (
        filters.minImportance &&
        (!result.metadata.importance ||
          result.metadata.importance < filters.minImportance)
      ) {
        return false;
      }

      if (
        filters.maxReadingTime &&
        result.metadata.readingTime > filters.maxReadingTime
      ) {
        return false;
      }

      return true;
    });
  }

  private generateSnippet(content: string, searchTerms: string[]): string {
    const maxLength = 200;
    const words = content.split(/\s+/);

    // Find the first occurrence of any search term
    let startIndex = 0;
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase();
      if (searchTerms.some((term) => word.includes(term))) {
        startIndex = Math.max(0, i - 10); // Start 10 words before the match
        break;
      }
    }

    // Extract snippet
    const snippetWords = words.slice(startIndex, startIndex + 40);
    let snippet = snippetWords.join(" ");

    if (snippet.length > maxLength) {
      snippet = snippet.substring(0, maxLength) + "...";
    }

    // Highlight search terms
    for (const term of searchTerms) {
      const regex = new RegExp(`\\b${term}\\b`, "gi");
      snippet = snippet.replace(regex, `<mark>$&</mark>`);
    }

    return snippet;
  }

  private extractSearchableMetadata(
    content: StoredContent
  ): SearchableMetadata {
    return {
      category: content.category,
      tags: content.tags,
      concepts: content.concepts,
      author: content.metadata.author,
      pageType: content.metadata.pageType,
      language: content.metadata.language,
      readingTime: content.metadata.readingTime,
      importance: content.importance,
    };
  }

  private truncateContent(content: string): string {
    // Store only first 1000 characters for search snippets
    return content.length > 1000 ? content.substring(0, 1000) + "..." : content;
  }
}

// Types and interfaces
export interface SearchOptions {
  filters?: SearchFilters;
  page?: number;
  pageSize?: number;
  sortBy?: "relevance" | "date" | "title";
  sortDirection?: "asc" | "desc";
}

export interface SearchFilters {
  category?: string;
  pageType?: string;
  language?: string;
  tags?: string[];
  minImportance?: number;
  maxReadingTime?: number;
}

export interface SearchResult {
  success: boolean;
  results: ScoredSearchResult[];
  totalResults: number;
  operationTime: number;
  error?: string;
  query?: string;
  searchTerms?: string[];
}

export interface ScoredSearchResult {
  contentId: string;
  title: string;
  snippet: string;
  score: number;
  matchedTerms: number;
  metadata: SearchableMetadata;
}

export interface IndexingResult {
  success: boolean;
  contentId: string;
  termsIndexed?: number;
  error?: string;
  operationTime: number;
}

export interface RebuildResult {
  success: boolean;
  totalItems: number;
  successCount: number;
  failureCount: number;
  errors: string[];
  operationTime: number;
}
