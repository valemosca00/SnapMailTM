import logging
import json
import requests
import azure.functions as func
from azure.storage.blob import BlobServiceClient
from azure.functions import FunctionApp
from function_app import app  # Importa l'oggetto FunctionApp esistente
from functions.configurations import MAIL_TM_API_URL, STORAGE_CONNECTION_STRING, BLOB_CONTAINER_NAME

@app.function_name(name="load_inbox")
@app.route(route="load_inbox", methods=["POST"])
def load_inbox(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Chiamata alla funzione "load_inbox".')

    try:
        # Recupera il corpo della richiesta
        req_body = req.get_json()
        email = req_body.get('email')
        token = req_body.get('token')

        # Verifica che email e token siano presenti
        if not email or not token:
            logging.warning("Email o token mancante.")
            return func.HttpResponse(
                "Email e token sono obbligatori.",
                status_code=400
            )

        logging.info(f"Email ricevuta: {email}")
        logging.info(f"Token ricevuto: {token[:6]}***")  # Mostra solo una parte del token per sicurezza

        # Header di autorizzazione
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Ottieni la lista dei messaggi
        response = requests.get(f"{MAIL_TM_API_URL}/messages", headers=headers)
        if response.status_code == 401:
            logging.error("Token non autorizzato o scaduto.")
            return func.HttpResponse(
                "Token non autorizzato o scaduto.",
                status_code=401
            )
        elif response.status_code != 200:
            logging.error(f"Errore nel recupero dei messaggi: {response.text}")
            return func.HttpResponse(
                f"Errore nel recupero dei messaggi: {response.text}",
                status_code=500
            )
        
        messages = response.json().get("hydra:member", [])
        logging.info(f"Numero di messaggi recuperati: {len(messages)}")

        # 2. Itera sui messaggi per ottenere i dettagli completi
        enriched_messages = []
        for message in messages:
            message_id = message.get("id")
            if message_id:
                message_details = get_message_details(message_id, headers)
                if message_details:
                    # Aggiungi i dettagli completi alla struttura del messaggio
                    message["full_content"] = message_details.get("text", "")
                    enriched_messages.append(message)

        # 3. Salva la "inbox" su Blob Storage
        save_inbox_to_blob(email, enriched_messages)

        return func.HttpResponse(
            body=json.dumps(enriched_messages),  # Restituisci i messaggi come JSON
            status_code=200,
            mimetype="application/json"
        )

    except ValueError as ve:
        logging.error(f"Errore nel parsing del JSON della richiesta: {ve}")
        return func.HttpResponse(
            "Errore nel parsing del JSON della richiesta.",
            status_code=400
        )
    except Exception as e:
        logging.error(f"Errore interno: {e}")
        return func.HttpResponse(f"Errore interno: {str(e)}", status_code=500)


def get_message_details(message_id, headers):
    """Ottieni i dettagli completi di un messaggio."""
    try:
        response = requests.get(f"{MAIL_TM_API_URL}/messages/{message_id}", headers=headers)
        if response.status_code == 200:
            return response.json()
        logging.error(f"Errore nel recupero del messaggio {message_id}: {response.text}")
        return None
    except Exception as e:
        logging.error(f"Errore durante il recupero del messaggio {message_id}: {e}")
        return None


def save_inbox_to_blob(email, messages):
    """Salva la inbox su Azure Blob Storage."""
    try:
        if not STORAGE_CONNECTION_STRING:
            raise ValueError("La stringa di connessione per Blob Storage non è configurata.")

        blob_service_client = BlobServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
        container_client = blob_service_client.get_container_client(BLOB_CONTAINER_NAME)

        # Assicurati che il container esista
        try:
            container_client.create_container()  # Prova a creare il container
            logging.info(f"Container '{BLOB_CONTAINER_NAME}' creato con successo.")
        except Exception as e:
            if "ContainerAlreadyExists" in str(e):  # Ignora l'errore se il container esiste già
                logging.info(f"Container '{BLOB_CONTAINER_NAME}' esiste già.")
            else:
                logging.error(f"Errore durante la creazione del container: {e}")
                raise


        # Nome del blob (usiamo l'email come identificatore)
        blob_name = f"{email.replace('@', '_').replace('.', '_')}_inbox.json"

        # Converti i messaggi in JSON
        messages_json = json.dumps(messages).encode("utf-8")

        # Salva i dati su Blob Storage
        container_client.upload_blob(name=blob_name, data=messages_json, overwrite=True)
        logging.info(f"Inbox salvata su Blob Storage con nome: {blob_name}")

    except Exception as e:
        logging.error(f"Errore durante il salvataggio su Blob Storage: {e}")
        raise
