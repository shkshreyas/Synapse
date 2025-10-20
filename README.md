# Synapse Chrome Extension

Your personal second brain - capture, organize, and rediscover web content with AI.

## Project Structure

```
synapse-chrome-extension/
├── manifest.json              # Extension manifest
├── package.json              # Node.js dependencies
├── tsconfig.json             # TypeScript configuration
├── webpack.config.js         # Build configuration
├── popup.html                # Extension popup interface
├── sidepanel.html           # Side panel interface
├── icons/                   # Extension icons
├── src/                     # Source code
│   ├── background/          # Background script
│   ├── content/            # Content scripts
│   ├── popup/              # Popup interface logic
│   ├── sidepanel/          # Side panel logic
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Shared utilities
└── dist/                   # Built files (generated)
```

## Development Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the extension:

   ```bash
   npm run build
   ```

3. Load the extension in Chrome:

   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

4. For development with auto-rebuild:
   ```bash
   npm run dev
   ```

## Features (Implementation Status)

### ✅ Task 1: Foundation (COMPLETED)

- [x] Chrome extension manifest with AI API permissions
- [x] TypeScript configuration and build system
- [x] Basic extension popup, background script, and content script
- [x] Message passing system between components

### 🚧 Upcoming Tasks

- [ ] Task 2.1: Content extraction engine
- [ ] Task 2.2: Screenshot capture system
- [ ] Task 2.3: Automatic content detection
- [ ] And many more...

## Architecture

The extension uses a modular architecture with:

- **Background Script**: Coordinates between components and handles extension lifecycle
- **Content Script**: Runs on web pages to capture content and detect user interactions
- **Popup Interface**: Quick access for search and capture actions
- **Side Panel**: Contextual content suggestions and chat interface
- **Message Passing**: Type-safe communication between all components

## Chrome AI APIs

The extension is designed to use Chrome's built-in AI APIs:

- Prompt API for concept extraction
- Summarizer API for content summaries
- Writer API for enhanced content generation
- Translator API for multilingual support

## Privacy

Synapse prioritizes privacy by:

- Processing content locally using Chrome's built-in AI APIs by default
- Storing data locally in IndexedDB
- Offering optional cloud features with explicit user consent
- Providing complete data export capabilities

## License

[Add your license here]
