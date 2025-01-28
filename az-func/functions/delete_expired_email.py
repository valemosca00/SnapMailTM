import logging
from azure.data.tables import TableClient
from azure.storage.blob import BlobServiceClient
import azure.functions as func
from function_app import app
from functions.utils import calculate_blob_name, delete_record_from_table, delete_blob

@app.function_name(name="delete_expired_email")
@app.event_grid_trigger(arg_name="event")
def delete_expired_email(event: func.EventGridEvent):
    """
    Event Grid Trigger per eliminare un'email scaduta (record e blob).
    """
    logging.info("Evento ricevuto da Event Grid.")

    data = event.get_json()
    partition_key = data.get("PartitionKey")
    row_key = data.get("RowKey")
    blob_name = calculate_blob_name(row_key)

    try:
        # Elimina il record da Table Storage
        delete_record_from_table(partition_key, row_key)

        # Elimina il blob da Blob Storage
        delete_blob(blob_name)

        logging.info(f"Record e blob eliminati: PartitionKey={partition_key}, RowKey={row_key}, BlobName={blob_name}")
    except Exception as e:
        logging.error(f"Errore durante l'eliminazione: {e}")
