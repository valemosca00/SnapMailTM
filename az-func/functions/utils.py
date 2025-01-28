import random
import string
import logging
import requests
from azure.data.tables import TableServiceClient, TableClient
from azure.storage.blob import BlobServiceClient

from functions.configurations import STORAGE_CONNECTION_STRING, TABLE_NAME, BLOB_CONTAINER_NAME, MAIL_TM_API_URL

# Parole inglesi per la generazione di nomi casuali
WORDS = [
    "apple", "banana", "cherry", "dragon", "eagle", "forest", "galaxy",
    "honey", "island", "jungle", "koala", "lemon", "mountain", "nebula",
    "ocean", "parrot", "quartz", "river", "sunset", "tiger", "unicorn",
    "volcano", "whale", "xenon", "yellow", "zebra"
]

def get_valid_domain():
    response = requests.get(f"{MAIL_TM_API_URL}/domains")
    if response.status_code == 200:
        domains = response.json()["hydra:member"]
        if domains:
            return domains[0]["domain"]  # Usa il primo dominio disponibile
    raise Exception("Nessun dominio valido trovato.")

def delete_record_from_table(partition_key, row_key):
    """
    Elimina un record da Azure Table Storage.
    """
    logging.info(f"Eliminazione del record: PartitionKey={partition_key}, RowKey={row_key}")
    client = TableClient.from_connection_string(STORAGE_CONNECTION_STRING, table_name=TABLE_NAME)
    client.delete_entity(partition_key=partition_key, row_key=row_key)
    logging.info("Record eliminato con successo.")

def delete_blob(blob_name):
    """
    Elimina un blob da Azure Blob Storage.
    """
    logging.info(f"Eliminazione del blob: BlobName={blob_name}")
    blob_service_client = BlobServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
    container_client = blob_service_client.get_container_client(BLOB_CONTAINER_NAME)
    container_client.delete_blob(blob_name)
    logging.info("Blob eliminato con successo.")

def calculate_blob_name(email: str) -> str:
    #Calcola il nome del blob a partire dall'email.Esempio: 'apple5539@freesourcecodes.com' -> 'apple5539_freesourcecodes_com_inbox.json'

    # Dividi l'email in username e dominio
    username, domain = email.split('@')
    # Sostituisci i punti nel dominio con underscore
    domain = domain.replace('.', '_')
    # Combina username e dominio con '_inbox.json'
    blob_name = f"{username}_{domain}_inbox.json"
    return blob_name

def generate_random_email_name():
    """Genera un nome casuale per l'email combinando una parola e 4 numeri casuali."""
    random_word = random.choice(WORDS)
    random_digits = ''.join(random.choices(string.digits, k=4))
    return f"{random_word}{random_digits}"

def generate_random_password(length=12):
    """Genera una password randomica di lunghezza specificata."""
    characters = string.ascii_letters + string.digits + string.punctuation
    return ''.join(random.choice(characters) for i in range(length))

def authenticate_email(email, password, api_url):
    """Autenticati su Mail.tm per ottenere il token."""
    try:
        response = requests.post(f"{api_url}/token", json={"address": email, "password": password})
        if response.status_code == 200:
            return response.json()["token"]
        logging.error(f"Errore durante l'autenticazione: {response.text}")
        return None
    except Exception as e:
        logging.error(f"Errore durante l'autenticazione: {e}")
        return None

def save_to_table(email, password, account_id, created_at, token, expiry_date, connection_string, table_name):
    try:
        table_service = TableServiceClient.from_connection_string(connection_string)
        table_client = table_service.get_table_client(table_name=table_name)

        entity = {
            "PartitionKey": "Emails",
            "RowKey": email,
            "Password": password,
            "AccountID": account_id,
            "CreatedAt": created_at,
            "Token": token,
            "ExpiryDate": expiry_date  # Salva la data di scadenza
        }

        table_client.create_entity(entity)
        logging.info(f"Email {email} salvata con scadenza {expiry_date}.")
    except Exception as e:
        logging.error(f"Errore durante il salvataggio su Table Storage: {e}")
        raise

