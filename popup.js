// popup.js

// Funkcja do zapisywania stanu checkboxa
function saveCheckboxState(enableCtrlV, salesManagementTemplate) {
  chrome.storage.local.set({ enableCtrlV, salesManagementTemplate }, () => {
    console.log("Stan checkboxów zapisany:", { enableCtrlV, salesManagementTemplate });
  });
}

// Funkcja do odczytywania stanu checkboxa
function loadCheckboxState() {
  chrome.storage.local.get(["enableCtrlV", "salesManagementTemplate"], (data) => {
    const enableCtrlV = data.enableCtrlV || false; 
    const salesManagementTemplate = data.salesManagementTemplate || false;

    document.getElementById("enableCtrlV").checked = enableCtrlV;
    document.getElementById("salesManagementTemplate").checked = salesManagementTemplate;

    console.log("Stan checkboxów wczytany:", { enableCtrlV, salesManagementTemplate });
  });
}

// Obsługa przycisku "Wklej dane"
document.getElementById("pasteData").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    chrome.runtime.sendMessage({ action: "paste", text });
  } catch (error) {
    console.error("Błąd podczas odczytu schowka:", error);
  }
});

// Obsługa checkboxa "Wklejanie za pomocą Ctrl + V"
document.getElementById("enableCtrlV").addEventListener("change", (event) => {
  const enableCtrlV = event.target.checked;
  saveCheckboxState(enableCtrlV, document.getElementById("salesManagementTemplate").checked);
  chrome.runtime.sendMessage({ action: "toggleCtrlV", enableCtrlV });
});

// Obsługa checkboxa "Szablon SALES AND MANAGEMENT"
document.getElementById("salesManagementTemplate").addEventListener("change", (event) => {
  const salesManagementTemplate = event.target.checked;
  saveCheckboxState(document.getElementById("enableCtrlV").checked, salesManagementTemplate);
  chrome.runtime.sendMessage({ action: "toggleSalesManagementTemplate", salesManagementTemplate });
});

// Wczytujemy stan checkboxów po załadowaniu popupu
document.addEventListener("DOMContentLoaded", loadCheckboxState);