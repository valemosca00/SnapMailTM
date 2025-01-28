#!/bin/bash

# Variabili
RESOURCE_GROUP="SnapMailGroup"

# Conferma prima di procedere
read -p "Sei sicuro di voler eliminare il gruppo di risorse $RESOURCE_GROUP e tutte le risorse associate? (s/n): " confirm
if [[ $confirm != "s" && $confirm != "S" ]]; then
    echo "Operazione annullata."
    exit 1
fi

# Eliminazione del gruppo di risorse
echo "Eliminazione del gruppo di risorse $RESOURCE_GROUP..."
az group delete --name $RESOURCE_GROUP --yes --no-wait

echo "L'eliminazione è stata avviata. Controlla il portale Azure per confermare che tutte le risorse siano state rimosse."
