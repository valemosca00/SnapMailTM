import logging
import json
from azure.data.tables import TableServiceClient
import azure.functions as func
from azure.functions import FunctionApp
from function_app import app  # Importa l'oggetto FunctionApp esistente
from functions.configurations import STORAGE_CONNECTION_STRING, TABLE_NAME

@app.function_name(name="check_email")
@app.route(route="check_email", methods=["GET"])
def check_email(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Controllo email in Table Storage.")

    try:
        # Recupera l'email dalla query string
        email = req.params.get("email")

        if not email:
            return func.HttpResponse("Email mancante.", status_code=400)

        # Connettiti a Table Storage
        table_service = TableServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
        table_client = table_service.get_table_client(table_name=TABLE_NAME)

        # Cerca l'email
        query_filter = f"RowKey eq '{email}'"
        entities = list(table_client.query_entities(query_filter))

        if entities:
            entity = entities[0]  # Primo risultato
            logging.info(f"Email trovata: {entity['RowKey']}")
            return func.HttpResponse(
                body=json.dumps({
                    "email": entity["RowKey"],
                    "token": entity["Token"],
                    "expirydate": entity["ExpiryDate"]
                }),
                status_code=200,
                mimetype="application/json"
            )

        logging.info("Email non trovata.")
        return func.HttpResponse("Email non trovata.", status_code=404)

    except Exception as e:
        logging.error(f"Errore interno: {e}")
        return func.HttpResponse("Errore interno.", status_code=500)
