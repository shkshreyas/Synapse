# Smart Content Resurfacing System

This directory contains the implementation of MindScribe's smart content resurfacing system, which intelligently suggests relevant saved content based on the user's current browsing context.

## Overview

The smart content resurfacing system consists of several interconnected components that work together to:

1. **Analyze current browsing context** - Extract and understand what the user is currently viewing
2. **Find relevant saved content** - Match current context with previously saved content
3. **Optimize timing** - Determine the best time to show suggestions
4. **Learn from user behavior** - Adapt suggestions based on user interactions
5. **Display non-intrusive notifications** - Show suggestions in a user-friendly way
6. **Collect feedback** - Continuously improve suggestion quality

## Components

### Core Analysis Components

#### `contextAnalyzer.ts`
- **Purpose**: Analyzes the current webpage context to understand what the user is viewing
- **Key Features**:
  - Extracts keywords and concepts from page content
  - Detects content category (article, documentation, etc.)
  - Calculates relevance scores with saved content
  - Supports multiple matching algorithms (keyword overlap, concept similarity, URL similarity)

#### `resurfacingTimer.ts`
- **Purpose**: Calculates optimal timing for showing content suggestions
- **Key Features**:
  - Implements forgetting curve algorithms
  - Considers user behavior patterns
  - Respects quiet hours and frequency limits
  - Adapts timing based on content importance and user engagement

#### `preferenceManager.ts`
- **Purpose**: Learns and manages user preferences for content suggestions
- **Key Features**:
  - Tracks user interactions and engagement patterns
  - Learns category, domain, and author preferences
  - Adapts suggestion thresholds based on feedback
  - Implements preference decay to prevent over-fitting

### Suggestion and Ranking

#### `suggestionRanker.ts`
- **Purpose**: Ranks and filters content suggestions based on multiple criteria
- **Key Features**:
  - Multi-factor ranking (relevance, recency, popularity, diversity, user preference)
  - Configurable filtering criteria
  - Diversity constraints to prevent similar suggestions
  - Performance analytics and optimization

#### `feedbackCollector.ts`
- **Purpose**: Collects and analyzes user feedback to improve suggestion quality
- **Key Features**:
  - Records detailed interaction metrics
  - Analyzes engagement patterns and trends
  - Identifies problem areas and improvement opportunities
  - Supports multiple feedback collection methods

### User Interface

#### `notificationSystem.ts`
- **Purpose**: Displays non-intrusive notifications for content suggestions
- **Key Features**:
  - Multiple notification styles (minimal, detailed, contextual)
  - Configurable positioning and timing
  - Animation and sound support
  - Interaction tracking and analytics

#### `suggestionSystem.ts`
- **Purpose**: Main orchestrator that integrates all components
- **Key Features**:
  - Real-time context analysis
  - Automated suggestion workflows
  - System state management
  - Performance monitoring and analytics

### Integration

#### `contextIntegration.ts`
- **Purpose**: Integrates context analysis with content storage and AI processing
- **Key Features**:
  - Session management
  - Cross-component communication
  - Analytics and reporting
  - Data export/import capabilities

## Usage

### Basic Setup

```typescript
import { suggestionSystem } from './suggestionSystem.js';

// Start the suggestion system
await suggestionSystem.start();

// The system will automatically:
// 1. Analyze the current page context
// 2. Find relevant saved content
// 3. Calculate optimal timing
// 4. Show suggestions when appropriate
// 5. Learn from user interactions
```

### Configuration

```typescript
import { suggestionSystem } from './suggestionSystem.js';

// Configure system options
suggestionSystem.updateOptions({
    enableRealTimeAnalysis: true,
    contextAnalysisInterval: 30, // seconds
    maxActiveSuggestions: 3,
    notificationOptions: {
        position: 'top-right',
        style: 'contextual',
        duration: 8000
    }
});
```

### Manual Context Analysis

```typescript
import { contextAnalyzer } from './contextAnalyzer.js';
import { ContentStore } from '../storage/contentStore.js';

const contentStore = ContentStore.getInstance();
const savedContent = await contentStore.list();

const result = await contextAnalyzer.analyzeCurrentContext(
    savedContent.data || [],
    {
        minRelevanceThreshold: 0.3,
        maxSuggestions: 5
    }
);

console.log('Relevant content:', result.relevantContent);
```

### Custom Notification Handling

```typescript
import { notificationSystem } from './notificationSystem.js';

// Listen for user interactions
notificationSystem.onInteraction((interaction) => {
    console.log('User interaction:', interaction);
    
    if (interaction.action === 'clicked') {
        // Handle click event
        window.open(interaction.contentUrl, '_blank');
    }
});
```

## Architecture

The system follows a modular architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Context        │    │  Suggestion     │    │  Notification   │
│  Analysis       │───▶│  Ranking        │───▶│  System         │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Preference     │    │  Timing         │    │  Feedback       │
│  Management     │    │  Optimization   │    │  Collection     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Key Algorithms

### Relevance Scoring
The system uses a weighted combination of multiple factors:
- **URL Similarity** (15%): Same domain or similar paths
- **Category Matching** (20%): Same content category
- **Keyword Overlap** (25%): Shared keywords and topics
- **Concept Overlap** (25%): Related concepts and themes
- **Content Similarity** (15%): Semantic text similarity

### Timing Optimization
Based on multiple factors:
- **Forgetting Curve**: Content becomes more likely to be suggested as it's forgotten
- **User Behavior**: Learns optimal times for suggestions
- **Content Importance**: Higher importance content suggested sooner
- **Context Relevance**: Highly relevant content suggested immediately

### Learning and Adaptation
The system continuously learns from:
- **User Interactions**: Clicks, dismissals, time spent
- **Timing Preferences**: When users are most receptive
- **Content Preferences**: Categories, domains, authors
- **Quality Feedback**: Explicit ratings and implicit signals

## Testing

The system includes comprehensive tests:

```bash
# Run context analyzer tests
npm test -- src/content/__tests__/contextAnalyzer.test.ts

# Run notification system tests
npm test -- src/content/__tests__/notificationSystem.test.ts

# Run integration tests
npm test -- src/content/__tests__/integration.test.ts
```

## Performance Considerations

- **Efficient Context Analysis**: Optimized for real-time analysis with minimal impact
- **Smart Caching**: Caches analysis results to avoid redundant processing
- **Throttling**: Respects user-defined limits on suggestion frequency
- **Memory Management**: Maintains bounded history sizes and cleans up resources

## Privacy and Security

- **Local Processing**: All analysis happens locally by default
- **No External Tracking**: No data sent to external services without explicit consent
- **User Control**: Complete control over suggestion frequency and content
- **Data Export**: Full data export capabilities for user ownership

## Future Enhancements

Potential areas for improvement:
- **Advanced ML Models**: Integration with more sophisticated AI models
- **Cross-Device Sync**: Synchronize preferences across devices
- **Collaborative Filtering**: Learn from similar users (with privacy protection)
- **Advanced Visualizations**: Better knowledge graph representations
- **Voice Integration**: Voice-activated content suggestions

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 4.1**: Context analysis for current browsing ✅
- **Requirement 4.2**: Non-intrusive notification display ✅
- **Requirement 4.3**: Suggestion dismissal and preference learning ✅
- **Requirement 4.4**: Timing algorithms for optimal resurfacing ✅

The system provides a comprehensive, intelligent, and user-friendly content resurfacing experience that learns and adapts to user behavior while maintaining privacy and performance.