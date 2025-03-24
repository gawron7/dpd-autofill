// background.js

// Nasłuchiwanie zdarzenia instalacji rozszerzenia
chrome.runtime.onInstalled.addListener(() => {
  console.log("Rozszerzenie zainstalowane.");
});

// Nasłuchiwanie wiadomości od innych skryptów (popup.js, itp.)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "paste") {
    console.log('Otrzymano dane z popupu:', message.text);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: fillForm,
          args: [message.text]
        });
      } else {
        console.error('Nie udało się uzyskać aktywnej karty.');
      }
    });
  }

  if (message.action === "fixcity") {
    console.log('Otrzymano dane z popupu:', message.text);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: fixCity,
          args: [message.text]
        });
      } else {
        console.error('Nie udało się uzyskać aktywnej karty.');
      }
    });
  }
});

// Zmienne przechowujące stany ustawień
let enableCtrlV = false;
let salesManagementTemplate = false;

// Wczytujemy stan checkboxów przy starcie
chrome.storage.local.get(["enableCtrlV", "salesManagementTemplate"], (data) => {
  enableCtrlV = data.enableCtrlV || false;
  salesManagementTemplate = data.salesManagementTemplate || false;
  console.log("Stan checkboxów wczytany w background.js:", { enableCtrlV, salesManagementTemplate });
});

// Nasłuchiwanie wiadomości od popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleCtrlV") {
    enableCtrlV = message.enableCtrlV;
    chrome.storage.local.set({ enableCtrlV }); // Zapisujemy stan checkboxa
    console.log("Stan checkboxa 'Wklejanie za pomocą Ctrl + V' zaktualizowany:", enableCtrlV);

    // Wysyłamy wiadomość do skryptu na stronie, aby włączyć/wyłączyć nasłuchiwanie Ctrl + V
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url.includes("https://online.dpd.com.pl/shipment/editPackagePrepare.do")) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: toggleCtrlVListener,
          args: [enableCtrlV],
        });
      }
    });
  } else if (message.action === "toggleSalesManagementTemplate") {
    salesManagementTemplate = message.salesManagementTemplate;
    chrome.storage.local.set({ salesManagementTemplate }); // Zapisujemy stan checkboxa
    console.log("Stan checkboxa 'Szablon SALES AND MANAGEMENT' zaktualizowany:", salesManagementTemplate);
  } else if (message.action === "paste") {
    // Przekazujemy wiadomość do aktywnej karty
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: fillForm,
          args: [message.text, salesManagementTemplate], // Przekazujemy stan szablonu
        });
      }
    });
  }
});

// Funkcja do wstrzykiwania skryptu na stronę DPD
function injectCtrlVHandler(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    function: handleCtrlV,
    args: [enableCtrlV], // Przekazujemy stan checkboxa
  });
}

// Funkcja do obsługi Ctrl + V (Windows/Linux) i Cmd + V (macOS) na stronie DPD
function handleCtrlV(enableCtrlV) {
  const handlePaste = (event) => {
    // Sprawdzamy, czy naciśnięto Ctrl + V (Windows/Linux) lub Cmd + V (macOS)
    if ((event.ctrlKey || event.metaKey) && event.key === "v") {
      console.log("Ctrl + V (Windows/Linux) lub Cmd + V (macOS) wykryte na stronie DPD.");
      navigator.clipboard.readText().then((text) => {
        chrome.runtime.sendMessage({ action: "paste", text });
      }).catch((err) => {
        console.error("Błąd podczas odczytywania schowka:", err);
      });
    }
  };

  if (enableCtrlV) {
    console.log("Nasłuchiwanie Ctrl + V (Windows/Linux) lub Cmd + V (macOS) włączone.");
    document.addEventListener("keydown", handlePaste);
  } else {
    console.log("Nasłuchiwanie Ctrl + V (Windows/Linux) lub Cmd + V (macOS) wyłączone.");
    document.removeEventListener("keydown", handlePaste);
  }
}

// Funkcja do przełączania nasłuchiwania Ctrl + V (Windows/Linux) lub Cmd + V (macOS)
function toggleCtrlVListener(enableCtrlV) {
  handleCtrlV(enableCtrlV);
}

// Sprawdzamy, czy użytkownik jest na stronie DPD, i wstrzykujemy skrypt
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes("https://online.dpd.com.pl/shipment/editPackagePrepare.do")) {
    console.log("Użytkownik jest na stronie DPD. Wstrzykuję skrypt obsługi Ctrl + V (Windows/Linux) lub Cmd + V (macOS).");
    injectCtrlVHandler(tabId);
  }
});

// Funkcja do odczytu schowka i wypełnienia formularza
function readClipboardAndFillForm() {
  navigator.clipboard.readText().then((text) => {
    // Wysyłamy wiadomość do skryptu tła z danymi ze schowka
    chrome.runtime.sendMessage({ action: "paste", text });
  }).catch((err) => {
    console.error("Błąd podczas odczytywania schowka:", err);
  });
}

function fillForm(text, salesManagementTemplate) {
  const lines = text.split('\t');
  const [companyName, , details, phone, email] = lines;

  // Wyciągamy pełne imię i nazwisko
  let fullName = "";
  let nameMatch = details.match(/^(.+?)\s(?:\d{11}|\w{3}\d{6})/);
  if (nameMatch) {
    fullName = nameMatch[1].trim();
  }

  // Czyszczenie pełnego imienia i nazwiska
  fullName = fullName.replace(/[^A-Za-zĄĆĘŁŃÓŚŹŻąąćęłńóśźż\s-]/g, "").trim();

  // Czyszczenie części adresowej
  let addressPart = details
    .replace(/^.+?\s(?:\d{11}|\w{3}\d{6})/, "") // Usuwamy imię, nazwisko i numer
    .replace(/\b(?:\d{11}|\w{3}\d{6})\b/g, "") // Usuwamy dodatkowe numery
    .replace(/\s{2,}/g, " ") // Usuwamy podwójne spacje
    .trim();

  // Usuwamy tekst w nawiasach oraz wszystko po nich
  addressPart = addressPart.replace(/\s?\(.*?\)\s*/g, "").trim(); // Usuwamy tekst w nawiasach
  addressPart = addressPart.replace(/\s*-\s*[^-]*$/, "").trim(); // Usuwamy wszystko po "-" (ale zachowujemy kod pocztowy i miasto)
  addressPart = addressPart.replace(/^[.\s]+/, "").trim(); // Usuwamy kropki i spacje na początku
  addressPart = addressPart.replace(/\s*OMNI.*/, "").trim(); // Usuwamy "OMNI" i wszystko, co po nim następuje

  console.log("Adres po czyszczeniu:", addressPart);

  // Rozdzielamy adres na ulicę, kod pocztowy i miasto
  let streetAndNumber = "";
  let postalCode = "";
  let city = "";

  const addressMatch = addressPart.match(/(.+?)\s(\d{2}-\d{3})\s(.+)/);
  if (addressMatch) {
    streetAndNumber = addressMatch[1].trim();
    postalCode = addressMatch[2];
    city = addressMatch[3].trim();
  }

  // Czyszczenie e-maila
  let cleanedEmail = email ? email.replace(/\"/g, "").trim() : "";

  console.log("E-mail:", cleanedEmail);
  console.log("Ulica:", streetAndNumber);
  console.log("Kod pocztowy:", postalCode);
  console.log("Miasto:", city);

  // Funkcja do ustawiania wartości i symulowania zdarzeń
  const setValueAndTriggerEvent = (elementId, value) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.value = value; // Ustawiamy wartość
      // Symulujemy zdarzenia
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  };

  // 1. Najpierw wypełniamy kod pocztowy i symulujemy ręczne wprowadzenie
  const postalCodeInput = document.getElementById("receiver-postal-code__input");
  if (postalCodeInput) {
    // Ustawiamy wartość kodu pocztowego
    postalCodeInput.value = postalCode;

    // Symulujemy zdarzenia
    postalCodeInput.dispatchEvent(new Event('input', { bubbles: true }));
    postalCodeInput.dispatchEvent(new Event('change', { bubbles: true }));
    postalCodeInput.dispatchEvent(new Event('blur', { bubbles: true }));

    console.log('Kod pocztowy wypełniony i zatwierdzony.');
  } else {
    console.error('Pole kodu pocztowego nie znalezione.');
  }

  // 2. Czekamy 0,5 sekundy przed wypełnieniem reszty danych
  setTimeout(() => {
    // 3. Wypełniamy pole miasta
    const cityInput = document.getElementById("receiver-city__input");
    if (cityInput) {
      cityInput.value = city; // Ustawiamy wartość miasta
      // Symulujemy zdarzenia
      cityInput.dispatchEvent(new Event('input', { bubbles: true }));
      cityInput.dispatchEvent(new Event('change', { bubbles: true }));
      cityInput.dispatchEvent(new Event('blur', { bubbles: true }));
      console.log('Pole miasta wypełnione przez skrypt:', city);
    } else {
      console.error('Pole miasta nie znalezione.');
    }

    // 4. Wypełniamy resztę danych
    setValueAndTriggerEvent("receiver-company__input", companyName);
    setValueAndTriggerEvent("receiver-name__input", fullName);
    setValueAndTriggerEvent("receiver-street__input", streetAndNumber);
    setValueAndTriggerEvent("receiver-telephone__input", phone);

    if (cleanedEmail) {
      setValueAndTriggerEvent("receiver-email__input", cleanedEmail);
    }

    console.log("Reszta danych wypełniona.");

    // 5. Zaznaczamy checkboxy i wypełniamy pola zgodnie z szablonem SALES AND MANAGEMENT
    if (salesManagementTemplate) {
      const checkAndTriggerAngular = (checkboxId) => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
          checkbox.checked = true; // Zaznaczamy checkbox
          // Wywołujemy zdarzenia Angulara
          const event = new Event('change', { bubbles: true });
          checkbox.dispatchEvent(event);
          console.log(`Checkbox ${checkboxId} zaznaczony.`);
        } else {
          console.error(`Checkbox ${checkboxId} nie znaleziony.`);
        }
      };

      // Zaznaczamy checkboxy
      checkAndTriggerAngular("ROD-checkbox");
      checkAndTriggerAngular("IN_PERS-checkbox");

      // Wypełniamy pole tekstowe (textarea) z id="contents__input"
      const contentsInput = document.getElementById("contents__input");
      if (contentsInput) {
        contentsInput.value = "DOKUMENTY ORANGE"; // Ustawiamy wartość
        // Symulujemy zdarzenia
        contentsInput.dispatchEvent(new Event('input', { bubbles: true }));
        contentsInput.dispatchEvent(new Event('change', { bubbles: true }));
        contentsInput.dispatchEvent(new Event('blur', { bubbles: true }));
        console.log('Pole "contents__input" wypełnione tekstem "DOKUMENTY ORANGE".');
      } else {
        console.error('Pole "contents__input" nie znalezione.');
      }

      // Wypełniamy pole wagi (input) z formcontrolname="weight"
      const weightInput = document.querySelector('input[formcontrolname="weight"]');
      if (weightInput) {
        weightInput.value = "0.1"; // Ustawiamy wartość
        // Symulujemy zdarzenia
        weightInput.dispatchEvent(new Event('input', { bubbles: true }));
        weightInput.dispatchEvent(new Event('change', { bubbles: true }));
        weightInput.dispatchEvent(new Event('blur', { bubbles: true }));
        console.log('Pole wagi wypełnione wartością "0.1".');
      } else {
        console.error('Pole wagi nie znalezione.');
      }
    }
  }, 500); // Czekamy 0,5 sekundy przed wypełnieniem reszty danych
}