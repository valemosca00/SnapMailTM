#rendi lo script eseguibile chmod +x setup_azure_resources.sh
#!/bin/bash

# Variabili
RESOURCE_GROUP="SnapMailGroup"
LOCATION="CentralUS" 
STORAGE_ACCOUNT_NAME="snapstorage$(date +%s | tail -c 7)" 
WEB_APP_NAME="SnapMail"
APP_PLAN_NAME="ASP-SnapMail-Plan" # Nome del piano di servizio per Function App
GITHUB_REPO="https://github.com/valemosca00/SnapMailTM.git"
GITHUB_BRANCH="main"
FUNCTION_APP_NAME="SnapMailFuncApp"
EVENT_GRID_TOPIC="delete-expired-email"
TABLE_NAME="Emails"
BLOB_CONTAINER="inboxes"

# Creazione del gruppo di risorse
echo "Creazione del gruppo di risorse $RESOURCE_GROUP..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# Creazione dello storage account
echo "Creazione dello Storage Account $STORAGE_ACCOUNT_NAME..."
az storage account create \
    --name $STORAGE_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --sku Standard_LRS \
    --kind StorageV2

# Recupero della connection string dello storage account
CONNECTION_STRING=$(az storage account show-connection-string --name $STORAGE_ACCOUNT_NAME --resource-group $RESOURCE_GROUP --query connectionString -o tsv)

# Creazione della tabella e del blob
echo "Creazione della tabella $TABLE_NAME..."
az storage table create --name $TABLE_NAME --connection-string "$CONNECTION_STRING"

echo "Creazione del blob container $BLOB_CONTAINER..."
az storage container create --name $BLOB_CONTAINER --connection-string "$CONNECTION_STRING"

# Creazione della Function App
echo "Creazione della Function App $FUNCTION_APP_NAME..."
az functionapp create \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --storage-account $STORAGE_ACCOUNT_NAME \
  --runtime python \
  --runtime-version 3.10 \
  --functions-version 4 \
  --os-type Linux \
  --consumption-plan-location $LOCATION \
  --disable-app-insights

echo "Aspettando 20 secondi per consentire la propagazione delle risorse..."
sleep 20

# Configurazione della Function App con lo Storage Account
echo "Configurazione della Function App con lo storage account..."
az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings AzureWebJobsStorage=$CONNECTION_STRING

# Creazione della Static Web App
echo "Creazione della Static Web App $WEB_APP_NAME..."
az staticwebapp create \
  --resource-group $RESOURCE_GROUP \
  --name $WEB_APP_NAME \
  --source $GITHUB_REPO \
  --branch $GITHUB_BRANCH \
  --location $LOCATION \
  --app-location "./src" \
  --api-location "./az-func" \
  --output-location "." \
  --login-with-github

# Recupera l'URL della Static Web App
STATIC_WEB_APP_URL=$(az staticwebapp show \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "defaultHostname" -o tsv)

# Aggiungi l'URL ai CORS della Function App
echo "Configurazione di CORS per la Function App con l'origine: https://$STATIC_WEB_APP_URL"
az functionapp cors add \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --allowed-origins "https://$STATIC_WEB_APP_URL"

# Creazione di un argomento Event Grid
echo "Creazione dell'argomento Event Grid $EVENT_GRID_TOPIC..."
az eventgrid topic create \
  --name $EVENT_GRID_TOPIC \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --input-schema eventgridschema

# Configurazione delle variabili di ambiente per la Function App
echo "Configurazione delle variabili di ambiente per la Function App..."
EVENT_GRID_TOPIC_ENDPOINT=$(az eventgrid topic show --name $EVENT_GRID_TOPIC --resource-group $RESOURCE_GROUP --query "endpoint" -o tsv)
EVENT_GRID_TOPIC_KEY=$(az eventgrid topic key list --name $EVENT_GRID_TOPIC --resource-group $RESOURCE_GROUP --query "key1" -o tsv)

az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    AzureWebJobsStorage="$CONNECTION_STRING" \
    STORAGE_CONNECTION_STRING="$CONNECTION_STRING" \
    EVENT_GRID_TOPIC_ENDPOINT="$EVENT_GRID_TOPIC_ENDPOINT" \
    EVENT_GRID_TOPIC_KEY="$EVENT_GRID_TOPIC_KEY"


echo "Tutte le risorse sono state create con successo!"