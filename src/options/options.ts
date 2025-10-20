interface Settings {
  apiKey: string;
}

// Save settings to chrome.storage
const saveSettings = () => {
  const apiKey = (document.getElementById("api-key") as HTMLInputElement).value;

  chrome.storage.sync.set({ apiKey }, () => {
    // Update status to let user know options were saved
    const status = document.getElementById("status")!;
    if (chrome.runtime.lastError) {
      status.textContent =
        "Error saving settings: " + chrome.runtime.lastError.message;
      status.className = "error";
    } else {
      status.textContent = "Settings saved successfully!";
      status.className = "success";
    }
    status.style.display = "block";

    setTimeout(() => {
      status.style.display = "none";
    }, 3000);
  });
};

// Restore settings from chrome.storage
const restoreSettings = () => {
  chrome.storage.sync.get({ apiKey: "" } as Settings, (items: Settings) => {
    (document.getElementById("api-key") as HTMLInputElement).value =
      items.apiKey;
  });
};

// Event listeners
document.addEventListener("DOMContentLoaded", restoreSettings);
document.getElementById("save")?.addEventListener("click", saveSettings);
