import logging
from datetime import datetime, timezone
from azure.data.tables import TableClient
import requests
import azure.functions as func
from zoneinfo import ZoneInfo

from function_app import app
from functions.configurations import STORAGE_CONNECTION_STRING, TABLE_NAME, EVENT_GRID_TOPIC_ENDPOINT, EVENT_GRID_TOPIC_KEY

def send_event_to_event_grid(partition_key, row_key):
    
    #Invia un evento a Event Grid per notificare l'eliminazione di un'email scaduta.
    
    event = {
        "id": f"{partition_key}-{row_key}",
        "eventType": "EmailExpired",
        "subject": f"/emails/{partition_key}/{row_key}",
        "eventTime": datetime.now().isoformat(),
        "data": {
            "PartitionKey": partition_key,
            "RowKey": row_key
        },
        "dataVersion": "1.0"
    }

    headers = {
        "aeg-sas-key": EVENT_GRID_TOPIC_KEY,
        "Content-Type": "application/json"
    }

    response = requests.post(EVENT_GRID_TOPIC_ENDPOINT, headers=headers, json=[event])

    if response.status_code == 200:
        logging.info("Evento inviato con successo a Event Grid.")
    else:
        logging.error(f"Errore nell'invio dell'evento: {response.status_code} - {response.text}")

@app.function_name(name="check_expired_emails")
@app.schedule(schedule="0 0 */6 * * *", arg_name="timer", run_on_startup=True, use_monitor=True) #ogni 6 ore "0 0 */6 * * *" #ogni minuto "0 */1 * * * *"
def check_expired_emails(timer: func.TimerRequest):
    
    #Timer Trigger per controllare email scadute e inviare eventi a Event Grid.
    
    logging.info("Timer Trigger avviato per controllare le email scadute.")

    try:
        # Connessione a Table Storage
        logging.info("Connettendo a Table Storage...")
        table_client = TableClient.from_connection_string(STORAGE_CONNECTION_STRING, table_name=TABLE_NAME)
        entities = table_client.list_entities()
        logging.info("Entità recuperate con successo.")

        for entity in entities:
            logging.info(f"Processando entità: {entity}")
            #expiry_date = datetime.strptime(entity["ExpiryDate"], "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=timezone.utc)
            #current_time = datetime.now(timezone.utc)

            expiry_date = datetime.strptime(entity["ExpiryDate"], "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=ZoneInfo("Europe/Rome"))
            current_time = datetime.now(ZoneInfo("Europe/Rome"))

            if expiry_date <= current_time:
                send_event_to_event_grid(entity["PartitionKey"], entity["RowKey"])
                logging.info(f"Inviato evento per email scaduta: PartitionKey={entity['PartitionKey']}, RowKey={entity['RowKey']}")
    except Exception as e:
        logging.error(f"Errore nell'esecuzione del Timer Trigger: {e}")
