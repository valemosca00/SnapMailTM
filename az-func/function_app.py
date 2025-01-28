from azure.functions import FunctionApp

# Dichiarazione della FunctionApp
app = FunctionApp()

# Importa tutte le funzioni dai file separati
from functions.generate_email import generate_email
from functions.load_inbox import load_inbox
from functions.check_email import check_email

from functions.timer_trigger import check_expired_emails
from functions.delete_expired_email import delete_expired_email
from functions.delete_email import delete_email