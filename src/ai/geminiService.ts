export class GeminiService {
  private apiKey: string = "";

  constructor() {
    this.loadApiKey();
  }

  private async loadApiKey(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["apiKey"], (result) => {
        this.apiKey = result.apiKey || "";
        resolve();
      });
    });
  }

  public async generateContent(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "API key not set. Please set your Gemini API key in the extension options."
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
}
