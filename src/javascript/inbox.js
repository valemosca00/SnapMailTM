import API_ENDPOINTS from './environment.js';

// Funzione per inviare una richiesta alla Azure Function
async function callDeleteEmailFunction(partitionKey, rowKey) {
  try {
       showLoadingSpinner();
      // Corpo della richiesta
      const requestBody = {
          PartitionKey: partitionKey,
          RowKey: rowKey
      };

      // Effettua la richiesta HTTP
      const response = await fetch(API_ENDPOINTS.DELETE_EMAIL_ENDPOINT, {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
      });

      // Controlla lo stato della risposta
      if (response.ok) {
          alert("Email eliminata con successo.");
          // Reindirizza alla schermata index.html
          window.location.href = "index.html";
      } else {
          const error = await response.text();
          console.error("Errore durante l'eliminazione:", error);
          alert(`Errore durante l'eliminazione: ${error}`);
      }
  } catch (error) {
      console.error("Errore:", error);
      alert("Si è verificato un errore durante l'eliminazione. Riprova.");
      throw error;
  } finally {
    hideLoadingSpinner();
  }
}

async function loadInbox(email, token) {
  try {
    showLoadingSpinner();
    // Effettua la chiamata alla Azure Function
    const response = await fetch(API_ENDPOINTS.LOAD_INBOX_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, token }),
    });

    if (response.ok) {
      const data = await response.json(); // Ottieni i messaggi 
      console.log("Inbox caricata dal Blob Storage:", data);

      // Popola la lista delle email
      populateEmailList(data);
    } else {
      const errorData = await response.text();
      throw new Error(`Errore nella chiamata alla Azure Function: ${errorData}`);
    }
  } catch (error) {
    console.error("Errore:", error);
    alert("Si è verificato un errore: " + error.message);
    throw error;
  } finally {
    hideLoadingSpinner();
  }
}

async function downloadInbox(email, token) {
  try {
    showLoadingSpinner();
    // Effettua la chiamata alla Azure Function
    const response = await fetch(API_ENDPOINTS.LOAD_INBOX_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, token }),
    });

    if (response.ok) {
      const data = await response.json(); // Ottieni i messaggi 
      console.log("Inbox caricata dal Blob Storage:", data);
      return data;
    } else {
      const errorData = await response.text();
      throw new Error(`Errore nella chiamata alla Azure Function: ${errorData}`);
    }
  } catch (error) {
    console.error("Errore:", error);
    alert("Si è verificato un errore: " + error.message);
    throw error;
  } finally {
    hideLoadingSpinner();
  }
}

document.getElementById("reload-inbox").addEventListener("click", async function () {
  if (email && token) {
    loadInbox(email, token); // Carica i messaggi all'avvio
    updateEmailAddress(email); // Aggiorna la barra superiore
  } else {
    alert("Email e token non sono presenti nei parametri del Session Storage.");
    window.location.href = "index.html";
  }
});

document.getElementById("refresh-inbox").addEventListener("click", async function () {
  if (emailData) {
    loadInbox(email, token); // Carica i messaggi all'avvio
    updateEmailAddress(email); // Aggiorna la barra superiore
  } else {
    alert("Email e token non sono presenti nei parametri Session Storage.");
    window.location.href = "index.html";
  }
});

document.getElementById("copy-button").addEventListener("click", async function () {
  const emailText = email;
  navigator.clipboard.writeText(emailText).then(() => {
      alert('Email copiata negli appunti!');
  });
});

document.getElementById("delete-email").addEventListener("click", function () {
  const confirmed = confirm("Sei sicuro di voler eliminare questa email? Questa operazione è irreversibile.");
  if (confirmed) {
      // Avvia l'eliminazione dell'email
      const partitionKey = "Emails"; 
      const rowKey = email; 
      callDeleteEmailFunction(partitionKey, rowKey);
  }
});


document.getElementById("download-inbox").addEventListener("click", async function () {
  if (!email || !token) {
    alert("Email o token mancanti nei parametri del Session Storage.");
    return;
  }

  try {
    // Recupera i dati dell'inbox
    const data = await downloadInbox(email, token);

    if (data) {
      // Genera il nome del file JSON
      const fileName = generateFileName(email);

      // Crea un file JSON scaricabile
      const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(jsonBlob);
      downloadLink.download = fileName; // Nome del file generato dinamicamente
      downloadLink.click();
    }
  } catch (error) {
    console.error("Errore nel processo di download:", error);
    alert("Si è verificato un errore nel processo di download.");
  }
});

function generateFileName(email) {
  // Estrai il nome dell'email (prima del simbolo '@')
  const emailName = email.split("@")[0];

  // Ottieni la data e l'orario corrente
  const now = new Date();
  now.setHours(now.getHours() + 1); // Aggiunge un'ora all'oggetto Date
  const date = now.toISOString().split("T")[0]; // Formato YYYY-MM-DD
  const time = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // Formato HH-MM-SS

  // Ritorna il nome del file composto da: <nome-email>_inbox_<data>_<orario>.json
  return `${emailName}_inbox_${date}_${time}.json`;
}

function populateEmailList(messages) {
  const emailList = document.querySelector(".email-list");
  emailList.innerHTML = ""; // Svuota la lista esistente

  if (messages.length === 0) {
    emailList.innerHTML = "<p>Non ci sono email nella tua inbox.</p>";
    return;
  }

  messages.forEach((message) => {
    const emailItem = document.createElement("li");
    emailItem.classList.add("email-item");

    const formattedContent = formatEmailContent(message.full_content || "Nessun contenuto disponibile");
    const previewContent = formattedContent.split("<br>").slice(0, 2).join("<br>");
    const isShortMessage = formattedContent.length <= previewContent.length;

    // Aggiungi puntini solo se necessario
    const displayPreview = isShortMessage ? previewContent : previewContent + "...";

    emailItem.innerHTML = `
    <div class="email-header">
      <div class="email-info">
        <div class="sender-info">
          <span class="sender-name">${message.from?.name || "Mittente sconosciuto"}</span>
          <span class="sender-email">&lt;${message.from?.address || "N/A"}&gt;</span>
          ${isShortMessage ? "" : `<span class="material-icons arrow">keyboard_arrow_right</span>`}
        </div>
        <span class="email-subject">${message.subject || "Nessun oggetto"}</span>
      </div>
    </div>
    <div class="email-preview">${displayPreview}</div>
    <div class="email-full-content" style="display: none;">${formattedContent}</div>
    <span class="time">${new Date(message.createdAt).toLocaleTimeString()}</span>
  `;

    if (!isShortMessage) {
      const arrow = emailItem.querySelector(".arrow");
      arrow.addEventListener("click", (event) => {
        event.stopPropagation(); // Evita propagazione al contenitore principale
        const fullContent = emailItem.querySelector(".email-full-content");
        const preview = emailItem.querySelector(".email-preview");

        if (fullContent.style.display === "none") {
          fullContent.style.display = "block";
          preview.style.display = "none";
          arrow.textContent = "keyboard_arrow_down";
        } else {
          fullContent.style.display = "none";
          preview.style.display = "block";
          arrow.textContent = "keyboard_arrow_right";
        }
      });
    }

    emailList.appendChild(emailItem);
  });
}

function formatEmailContent(rawContent) {
  return rawContent
    // Trasforma i link Markdown "[Testo](url)" in link HTML
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s]+?)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Riconosce immagini Markdown "![alt](url)" e le trasforma in <img>
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s]+?)\)/g, '<img src="$2" alt="$1" />')
    // Trasforma i link in formato "https://..." in link cliccabili
    .replace(/(^|\s)(https?:\/\/[^\s]+)/g, '$1<a href="$2" target="_blank">$2</a>')
    // Evidenzia codici (esempio: "CODICE: ABC123")
    .replace(/CODICE:\s*([\w\d]+)/g, '<span class="email-code">CODICE: <strong>$1</strong></span>')
    // Riconosce i paragrafi (\n\n) e aggiunge <br><br>
    .replace(/\n\n/g, "<br><br>")
    // Riconosce i singoli \n e aggiunge <br>
    .replace(/\n/g, "<br>");
}

function updateEmailAddress(email) {
  const emailAddressElement = document.querySelector(".email-address");
  if (emailAddressElement) {
    emailAddressElement.textContent = email; // Imposta l'indirizzo email nella barra superiore
  }
}

function updateExpiryDate(expiryDate) {
  const expirySpan = document.querySelector(".expiry-date");
        const formattedExpiryDate = new Date(expiryDate).toLocaleString(); // Converte la data in un formato leggibile
        expirySpan.textContent = `(Scade il: ${formattedExpiryDate})`;
}

function getSessionStorage() {
  const emailData = JSON.parse(sessionStorage.getItem("emailData"));
  return emailData
}

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

//Inizializzazione
// Elemento della rotellina di caricamento
const loadingSpinner = document.getElementById('loading-spinner');

// Recupera i dati dal sessionStorage
const emailData = getSessionStorage();
let email = null;
let token = null;
let expiryDate = null;

if (emailData) {
  email = emailData.email;
  token = emailData.token;
  expiryDate = emailData.expirydate;

  // Usa i dati per popolare la pagina
  loadInbox(email, token); // Carica i messaggi all'avvio
  updateEmailAddress(email); // Aggiorna la barra superiore
  updateExpiryDate(expiryDate); // Aggiorna la data di scadenza
} else {
  alert("I dati dell'email non sono disponibili. Torna alla schermata principale.");
  window.location.href = "index.html";
}

