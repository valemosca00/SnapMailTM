import logging
from azure.data.tables import TableClient
from azure.storage.blob import BlobServiceClient
import azure.functions as func
from function_app import app
from functions.utils import calculate_blob_name, delete_record_from_table, delete_blob

@app.function_name(name="delete_email")
@app.route(route="delete_email", methods=["POST"])
def delete_email(req: func.HttpRequest) -> func.HttpResponse:
    """
    HTTP Trigger per eliminare un'email (record e blob) basandosi su PartitionKey e RowKey.
    """
    logging.info("Richiesta ricevuta per eliminare un'email.")

    try:
        # Ottieni i dati dalla richiesta
        data = req.get_json()
        partition_key = data.get("PartitionKey")
        row_key = data.get("RowKey")

        # Controlla che PartitionKey e RowKey siano forniti
        if not partition_key or not row_key:
            return func.HttpResponse(
                "PartitionKey e RowKey sono obbligatori.",
                status_code=400
            )

        # Calcola il nome del blob
        blob_name = calculate_blob_name(row_key)

        # Elimina il record da Table Storage
        delete_record_from_table(partition_key, row_key)

        # Elimina il blob da Blob Storage
        delete_blob(blob_name)

        logging.info(f"Record e blob eliminati: PartitionKey={partition_key}, RowKey={row_key}, BlobName={blob_name}")
        return func.HttpResponse(
            "Email eliminata con successo.",
            status_code=200
        )

    except Exception as e:
        logging.error(f"Errore durante l'eliminazione: {e}")
        return func.HttpResponse(
            f"Errore durante l'eliminazione: {e}",
            status_code=500
        )
