import logging
import requests
from datetime import datetime, timedelta
from azure.functions import FunctionApp
import azure.functions as func

from function_app import app  # Importa l'oggetto FunctionApp esistente
from functions.utils import generate_random_email_name, generate_random_password, authenticate_email, save_to_table, get_valid_domain
from functions.configurations import STORAGE_CONNECTION_STRING, MAIL_TM_API_URL, TABLE_NAME


@app.function_name(name="generate_email")
@app.route(route="generate_email", methods=["POST"])
def generate_email(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Chiamata alla funzione "generate_email".')

    try:
        req_body = req.get_json()
        custom_name = req_body.get('email') or generate_random_email_name()
        expiry_date = req_body.get("expiryDate")

        # Recupera un dominio valido
        domain = get_valid_domain()
        account_data = {"address": f"{custom_name}@{domain}", "password": generate_random_password()}

        # Crea l'account su Mail.tm
        response = requests.post(f"{MAIL_TM_API_URL}/accounts", json=account_data)
        if response.status_code != 201:
            logging.error(f"Errore Mail.tm: {response.text}")
            return func.HttpResponse("Errore nella generazione dell'email.", status_code=500)

        account = response.json()
        email = account["address"]
        account_id = account["id"]
        created_at = account["createdAt"]

        # Autenticazione e salvataggio
        token = authenticate_email(email, account_data["password"], MAIL_TM_API_URL)
        if not token:
            return func.HttpResponse("Errore durante l'autenticazione.", status_code=500)

        save_to_table(email, account_data["password"], account_id, created_at, token, expiry_date, STORAGE_CONNECTION_STRING, TABLE_NAME)

        logging.info(f"Email {email} generata con successo.")
        return func.HttpResponse(
            body=f'{{"email": "{email}", "token": "{token}", "expirydate": "{expiry_date}"}}',
            status_code=200,
            mimetype="application/json",
        )

    except Exception as e:
        logging.error(f"Errore interno: {e}")
        return func.HttpResponse(f"Errore interno: {str(e)}", status_code=500)