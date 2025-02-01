import API_ENDPOINTS from './environment.js';

//Controlla se l'email esiste su Table Storage
async function checkEmail(email) {
  try {
    showLoadingSpinner();
    const response = await fetch(`${API_ENDPOINTS.CHECK_EMAIL_ENDPOINT}&email=${encodeURIComponent(email)}`, {
      method: "GET",
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log("Email trovata:", responseData);
      return responseData;
    } else if (response.status === 404) {
      console.warn("Email non trovata.");
      alert("L'email non esiste in Table Storage.");
      return null;
    } else {
      const errorData = await response.text();
      console.error("Errore dal server:", errorData);
      throw new Error(`Errore nella chiamata alla Azure Function: ${errorData}`);
    }
  } catch (error) {
    console.error("Errore:", error);
    alert("Si è verificato un errore durante il controllo dell'email.");
    throw error;
  } finally {
    hideLoadingSpinner(); // Nasconde la rotellina al termine
  }
}

async function generateEmail(endpoint, email = null, expiryDate = null) {
  try {
    showLoadingSpinner();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, expiryDate }),
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log("Risposta dal server:", responseData);
      return responseData;
    } else {
      const errorData = await response.text();
      console.error("Errore dal server:", errorData);
      throw new Error(`Errore nella chiamata alla Azure Function: ${errorData}`);
    }
  } catch (error) {
    console.error("Errore:", error);
    alert("Si è verificato un errore: " + error.message);
    throw error;
  } finally {
    hideLoadingSpinner(); // Nasconde la rotellina al termine
  }
}

document.getElementById("generate-custom-email").addEventListener("click", async function () {
  const customName = document.getElementById("custom-name").value.trim();
  const expiryDateInput = document.getElementById("expiry-date").value;

  // Ottieni una data di scadenza valida
  const { isValid, expiryDate, error } = getValidExpiryDate(expiryDateInput);

  if (!isValid) {
    alert(error); 
    return;
  }

  if (!customName) {
    alert("Per favore, inserisci un nome per l'email!");
    return;
  }
  
  // Valida il nome personalizzato
  if (!/^[a-zA-Z0-9]+$/.test(customName)) {
    alert("Il nome deve contenere solo lettere e numeri!");
    return;
  }

  try {
    // Disabilita i pulsanti e mostra il cursore di caricamento
    document.getElementById("generate-custom-email").disabled = true;
    document.getElementById("generate-random-email").disabled = true;
    document.body.style.cursor = "wait";

    const randomDigits = Math.floor(1000 + Math.random() * 9000); // Genera 4 cifre casuali
    const customNameRand = `${customName}${randomDigits}`;
    const emailData = await generateEmail
  (API_ENDPOINTS.GENERATE_EMAIL_ENDPOINT, customNameRand, expiryDate);

    if (emailData) {
      populateSessionStorage(emailData);
    }
  } finally {
    // Riabilita i pulsanti e ripristina il cursore
    document.getElementById("generate-custom-email").disabled = false;
    document.getElementById("generate-random-email").disabled = false;
    document.body.style.cursor = "default";
  }
});

document.getElementById("generate-random-email").addEventListener("click", async function () {
  const expiryDateInput = document.getElementById("expiry-date").value;

  // Ottieni una data di scadenza valida
  const { isValid, expiryDate, error } = getValidExpiryDate(expiryDateInput);

  if (!isValid) {
    alert(error); 
    return;
  }

  try {
    // Disabilita i pulsanti e mostra il cursore di caricamento
    document.getElementById("generate-custom-email").disabled = true;
    document.getElementById("generate-random-email").disabled = true;
    document.body.style.cursor = "wait";

    const emailData = await generateEmail(API_ENDPOINTS.GENERATE_EMAIL_ENDPOINT, null, expiryDate);

    if (emailData) {
      populateSessionStorage(emailData);
    }
  } finally {
    // Riabilita i pulsanti e ripristina il cursore
    document.getElementById("generate-custom-email").disabled = false;
    document.getElementById("generate-random-email").disabled = false;
    document.body.style.cursor = "default";
  }
});

//Event Listener per il bottone di controllo email
document.getElementById("check-email-btn").addEventListener("click", async function () {
  const email = document.getElementById("check-email").value.trim();

  if (!email) {
    alert("Per favore, inserisci un'email!");
    return;
  }

  // Valida il formato dell'email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert("Inserisci un'email valida!");
    return;
  }

  try {
    document.getElementById("check-email-btn").disabled = true;

    const emailData = await checkEmail(email);

    if (emailData) {
      console.log("Email esistente:", emailData);
      populateSessionStorage(emailData);
    }
  } catch (error) {
    console.error("Errore durante il controllo dell'email:", error);
  } finally {
    document.getElementById("check-email-btn").disabled = false;
  }
});

function populateSessionStorage(emailData) {
  sessionStorage.setItem("emailData", JSON.stringify(emailData));
  window.location.href = "inbox.html";
}

function getValidExpiryDate(expiryDateInput) {
  const now = new Date(); // Ottieni la data e l'ora attuali
  const maxDate = new Date(now); // Copia la data attuale
  maxDate.setDate(now.getDate() + 7); // Calcola la data massima consentita (7 giorni da oggi)

  console.log("NOW (UTC):", now.toISOString());
  console.log("MAX DATE (UTC):", maxDate.toISOString());
  console.log("EXPIRY DATE INPUT (RAW):", expiryDateInput);

  if (!expiryDateInput) {
    // Se il campo expiryDate è vuoto, imposta la scadenza a un giorno dopo
    const defaultExpiryDate = new Date(now);
    defaultExpiryDate.setDate(now.getDate() + 1); // Aggiungi 1 giorno alla data corrente
    console.log("DEFAULT EXPIRY DATE:", defaultExpiryDate.toISOString());
    return { isValid: true, expiryDate: defaultExpiryDate.toISOString() };
  }

  // Prova a convertire la data di input in un oggetto Date
  const inputDate = new Date(expiryDateInput);
  if (isNaN(inputDate.getTime())) {
    // Se la data inserita non è valida
    return { isValid: false, expiryDate: null, error: "La data inserita non è valida!" };
  }

  // Correggi il fuso orario applicando l'offset
  const convertedDate = new Date(inputDate.getTime() - inputDate.getTimezoneOffset() * 60000);
  console.log("EXPIRY DATE (CONVERTED):", convertedDate.toISOString());

  if (convertedDate < now) {
    // Controlla se la data inserita è nel passato
    return { isValid: false, expiryDate: null, error: "La data di scadenza non può essere nel passato!" };
  }

  if (convertedDate > maxDate) {
    // Controlla se la data inserita è maggiore di 7 giorni rispetto a oggi
    return { isValid: false, expiryDate: null, error: "La data di scadenza non può essere maggiore di 7 giorni rispetto a oggi!" };
  }

  // Ritorna la data valida
  return { isValid: true, expiryDate: convertedDate.toISOString() };
}

// Elemento della rotellina di caricamento
const loadingSpinner = document.getElementById('loading-spinner');

// Mostra la rotellina
function showLoadingSpinner() {
  loadingSpinner.classList.remove('hidden');
  document.body.classList.add('disable-click');
}

// Nasconde la rotellina
function hideLoadingSpinner() {
  loadingSpinner.classList.add('hidden');
  document.body.classList.remove('disable-click');
}

document.addEventListener('DOMContentLoaded', () => {
  const loadingSpinner = document.getElementById('loading-spinner');
  if (loadingSpinner) {
    loadingSpinner.classList.add('hidden');
  }
});
