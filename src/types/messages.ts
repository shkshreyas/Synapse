// Message types for communication between extension components

export interface BaseMessage {
  type: string;
  id?: string;
}

export interface CaptureContentMessage extends BaseMessage {
  type: 'CAPTURE_CONTENT';
  url: string;
  manual: boolean;
}

export interface ContentCapturedMessage extends BaseMessage {
  type: 'CONTENT_CAPTURED';
  success: boolean;
  contentId?: string;
  error?: string;
}

export interface SearchMessage extends BaseMessage {
  type: 'SEARCH';
  query: string;
}

export interface SearchResultsMessage extends BaseMessage {
  type: 'SEARCH_RESULTS';
  results: SearchResult[];
}

export interface GetRelatedContentMessage extends BaseMessage {
  type: 'GET_RELATED_CONTENT';
  url: string;
}

export interface RelatedContentMessage extends BaseMessage {
  type: 'RELATED_CONTENT';
  content: RelatedContent[];
}

export interface OpenSidePanelMessage extends BaseMessage {
  type: 'OPEN_SIDE_PANEL';
}

export interface UpdateBadgeMessage extends BaseMessage {
  type: 'UPDATE_BADGE';
  text: string;
  color?: string;
}

// Data types
export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
  timestamp: Date;
  relevanceScore: number;
}

export interface RelatedContent {
  id: string;
  title: string;
  summary: string;
  url: string;
  relationshipType: string;
  strength: number;
}

// Union type for all messages
export type ExtensionMessage = 
  | CaptureContentMessage
  | ContentCapturedMessage
  | SearchMessage
  | SearchResultsMessage
  | GetRelatedContentMessage
  | RelatedContentMessage
  | OpenSidePanelMessage
  | UpdateBadgeMessage;