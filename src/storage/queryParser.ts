// Advanced query parsing for search functionality

export interface ParsedQuery {
    terms: string[];
    filters: QueryFilters;
    operators: QueryOperator[];
    isAdvanced: boolean;
}

export interface QueryFilters {
    category?: string;
    pageType?: string;
    language?: string;
    tags?: string[];
    author?: string;
    site?: string;
    dateRange?: DateRange;
    importance?: NumberRange;
    readingTime?: NumberRange;
}

export interface DateRange {
    from?: Date;
    to?: Date;
}

export interface NumberRange {
    min?: number;
    max?: number;
}

export interface QueryOperator {
    type: 'AND' | 'OR' | 'NOT';
    terms: string[];
}

export class QueryParser {
    private static instance: QueryParser | null = null;

    static getInstance(): QueryParser {
        if (!QueryParser.instance) {
            QueryParser.instance = new QueryParser();
        }
        return QueryParser.instance;
    }

    parseQuery(query: string): ParsedQuery {
        const trimmedQuery = query.trim();

        // Check if it's an advanced query (contains special operators or filters)
        const isAdvanced = this.isAdvancedQuery(trimmedQuery);

        if (isAdvanced) {
            return this.parseAdvancedQuery(trimmedQuery);
        } else {
            return this.parseSimpleQuery(trimmedQuery);
        }
    }

    private isAdvancedQuery(query: string): boolean {
        const advancedPatterns = [
            /\b(AND|OR|NOT)\b/i,
            /\w+:/,  // field:value patterns
            /"[^"]+"/,  // quoted phrases
            /\([^)]+\)/,  // parentheses
            /-\w+/,  // negation with dash
            /\+\w+/  // required terms with plus
        ];

        return advancedPatterns.some(pattern => pattern.test(query));
    }

    private parseSimpleQuery(query: string): ParsedQuery {
        const terms = this.extractSimpleTerms(query);

        return {
            terms,
            filters: {},
            operators: [],
            isAdvanced: false
        };
    }

    private parseAdvancedQuery(query: string): ParsedQuery {
        const filters: QueryFilters = {};
        const operators: QueryOperator[] = [];
        let remainingQuery = query;

        // Extract field filters (field:value)
        const fieldMatches = remainingQuery.match(/(\w+):([^\s"]+|"[^"]*")/g);
        if (fieldMatches) {
            for (const match of fieldMatches) {
                const [field, value] = match.split(':');
                const cleanValue = value.replace(/"/g, '');

                switch (field.toLowerCase()) {
                    case 'category':
                    case 'cat':
                        filters.category = cleanValue;
                        break;
                    case 'type':
                    case 'pagetype':
                        filters.pageType = cleanValue;
                        break;
                    case 'lang':
                    case 'language':
                        filters.language = cleanValue;
                        break;
                    case 'tag':
                    case 'tags':
                        filters.tags = filters.tags || [];
                        filters.tags.push(cleanValue);
                        break;
                    case 'author':
                        filters.author = cleanValue;
                        break;
                    case 'site':
                    case 'domain':
                        filters.site = cleanValue;
                        break;
                    case 'importance':
                        filters.importance = this.parseNumberRange(cleanValue);
                        break;
                    case 'reading':
                    case 'readingtime':
                        filters.readingTime = this.parseNumberRange(cleanValue);
                        break;
                    case 'date':
                    case 'created':
                        filters.dateRange = this.parseDateRange(cleanValue);
                        break;
                }

                // Remove processed filter from query
                remainingQuery = remainingQuery.replace(match, '').trim();
            }
        }

        // Extract quoted phrases
        const quotedPhrases = remainingQuery.match(/"[^"]+"/g) || [];
        const phrases = quotedPhrases.map(phrase => phrase.replace(/"/g, ''));

        // Remove quoted phrases from remaining query
        for (const phrase of quotedPhrases) {
            remainingQuery = remainingQuery.replace(phrase, '').trim();
        }

        // Parse boolean operators
        const operatorMatches = remainingQuery.match(/\b(AND|OR|NOT)\s+([^\s]+)/gi);
        if (operatorMatches) {
            for (const match of operatorMatches) {
                const parts = match.split(/\s+/);
                const operator = parts[0].toUpperCase() as 'AND' | 'OR' | 'NOT';
                const term = parts[1];

                operators.push({
                    type: operator,
                    terms: [term]
                });

                remainingQuery = remainingQuery.replace(match, '').trim();
            }
        }

        // Extract remaining terms
        const remainingTerms = this.extractSimpleTerms(remainingQuery);
        const allTerms = [...phrases, ...remainingTerms];

        return {
            terms: allTerms,
            filters,
            operators,
            isAdvanced: true
        };
    }

    private extractSimpleTerms(query: string): string[] {
        return query
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(term => term.length > 0);
    }

    private parseNumberRange(value: string): NumberRange {
        // Handle ranges like "5-10", ">5", "<10", "5"
        if (value.includes('-')) {
            const [min, max] = value.split('-').map(v => parseInt(v.trim()));
            return { min: isNaN(min) ? undefined : min, max: isNaN(max) ? undefined : max };
        } else if (value.startsWith('>')) {
            const min = parseInt(value.substring(1));
            return { min: isNaN(min) ? undefined : min };
        } else if (value.startsWith('<')) {
            const max = parseInt(value.substring(1));
            return { max: isNaN(max) ? undefined : max };
        } else {
            const exact = parseInt(value);
            return { min: isNaN(exact) ? undefined : exact, max: isNaN(exact) ? undefined : exact };
        }
    }

    private parseDateRange(value: string): DateRange {
        // Handle date ranges like "2024-01-01", "2024-01-01:2024-12-31", "last7days", "thismonth"
        const now = new Date();

        // Handle relative dates
        switch (value.toLowerCase()) {
            case 'today':
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                return { from: today, to: new Date(today.getTime() + 24 * 60 * 60 * 1000) };

            case 'yesterday':
                const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                return { from: yesterday, to: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000) };

            case 'thisweek':
                const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
                return { from: weekStart, to: now };

            case 'lastweek':
                const lastWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7);
                const lastWeekEnd = new Date(lastWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
                return { from: lastWeekStart, to: lastWeekEnd };

            case 'thismonth':
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                return { from: monthStart, to: now };

            case 'lastmonth':
                const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                return { from: lastMonthStart, to: lastMonthEnd };
        }

        // Handle relative day ranges
        const dayMatch = value.match(/last(\d+)days?/i);
        if (dayMatch) {
            const days = parseInt(dayMatch[1]);
            const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            return { from, to: now };
        }

        // Handle absolute dates
        if (value.includes(':')) {
            const [fromStr, toStr] = value.split(':');
            return {
                from: this.parseDate(fromStr),
                to: this.parseDate(toStr)
            };
        } else {
            const date = this.parseDate(value);
            if (date) {
                const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
                return { from: date, to: nextDay };
            }
        }

        return {};
    }

    private parseDate(dateStr: string): Date | undefined {
        try {
            // Try parsing ISO format first
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return new Date(dateStr + 'T00:00:00');
            }

            // Try parsing other common formats
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? undefined : date;
        } catch {
            return undefined;
        }
    }

    buildSearchQuery(parsedQuery: ParsedQuery): string {
        const parts: string[] = [];

        // Add basic terms
        if (parsedQuery.terms.length > 0) {
            parts.push(parsedQuery.terms.join(' '));
        }

        // Add filters
        const filters = parsedQuery.filters;

        if (filters.category) {
            parts.push(`category:${filters.category}`);
        }

        if (filters.pageType) {
            parts.push(`type:${filters.pageType}`);
        }

        if (filters.language) {
            parts.push(`lang:${filters.language}`);
        }

        if (filters.tags && filters.tags.length > 0) {
            filters.tags.forEach(tag => parts.push(`tag:${tag}`));
        }

        if (filters.author) {
            parts.push(`author:${filters.author}`);
        }

        if (filters.site) {
            parts.push(`site:${filters.site}`);
        }

        if (filters.importance) {
            const range = filters.importance;
            if (range.min !== undefined && range.max !== undefined && range.min === range.max) {
                parts.push(`importance:${range.min}`);
            } else if (range.min !== undefined && range.max !== undefined) {
                parts.push(`importance:${range.min}-${range.max}`);
            } else if (range.min !== undefined) {
                parts.push(`importance:>${range.min}`);
            } else if (range.max !== undefined) {
                parts.push(`importance:<${range.max}`);
            }
        }

        // Add operators
        parsedQuery.operators.forEach(op => {
            parts.push(`${op.type} ${op.terms.join(' ')}`);
        });

        return parts.join(' ').trim();
    }

    getQuerySuggestions(partialQuery: string): string[] {
        const suggestions: string[] = [];

        // Field suggestions
        const fieldSuggestions = [
            'category:', 'type:', 'lang:', 'tag:', 'author:', 'site:',
            'importance:', 'reading:', 'date:', 'created:'
        ];

        // Date suggestions
        const dateSuggestions = [
            'date:today', 'date:yesterday', 'date:thisweek', 'date:lastweek',
            'date:thismonth', 'date:lastmonth', 'date:last7days', 'date:last30days'
        ];

        // Type suggestions
        const typeSuggestions = [
            'type:article', 'type:video', 'type:documentation', 'type:social', 'type:other'
        ];

        // Language suggestions
        const langSuggestions = [
            'lang:en', 'lang:es', 'lang:fr', 'lang:de', 'lang:it', 'lang:pt', 'lang:ru', 'lang:zh', 'lang:ja'
        ];

        const lastWord = partialQuery.split(' ').pop()?.toLowerCase() || '';

        if (lastWord.includes(':')) {
            // Suggest values for specific fields
            const [field] = lastWord.split(':');
            switch (field) {
                case 'type':
                    suggestions.push(...typeSuggestions.filter(s => s.startsWith(lastWord)));
                    break;
                case 'lang':
                case 'language':
                    suggestions.push(...langSuggestions.filter(s => s.startsWith(lastWord)));
                    break;
                case 'date':
                case 'created':
                    suggestions.push(...dateSuggestions.filter(s => s.startsWith(lastWord)));
                    break;
            }
        } else {
            // Suggest fields
            suggestions.push(...fieldSuggestions.filter(s => s.startsWith(lastWord)));

            // Suggest operators
            if (partialQuery.length > 0) {
                ['AND ', 'OR ', 'NOT '].forEach(op => {
                    if (op.toLowerCase().startsWith(lastWord)) {
                        suggestions.push(partialQuery.replace(new RegExp(lastWord + '$'), op));
                    }
                });
            }
        }

        return suggestions.slice(0, 10); // Limit to 10 suggestions
    }
}