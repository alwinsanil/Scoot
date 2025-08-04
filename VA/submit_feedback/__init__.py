import azure.functions as func
from azure.cosmos import CosmosClient
import os
import uuid
import datetime
import json
import logging

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')
    
    # Enable CORS for local development
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-functions-key',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json'
    }
    
    # Handle preflight OPTIONS request
    if req.method == 'OPTIONS':
        return func.HttpResponse(
            "",
            status_code=200,
            headers=headers
        )
    
    try:
        # Get request body
        req_body = req.get_body()
        logging.info(f'Request body: {req_body}')
        
        if not req_body:
            return func.HttpResponse(
                json.dumps({"error": "Empty request body"}),
                status_code=400,
                headers=headers
            )
        
        data = json.loads(req_body.decode('utf-8'))
        user_id = data.get("user_id", "anonymous")
        message = data.get("message")
        
        logging.info(f'Received feedback from user: {user_id}, message: {message}')
        
    except json.JSONDecodeError as e:
        logging.error(f'JSON decode error: {str(e)}')
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON format"}),
            status_code=400,
            headers=headers
        )
    except Exception as e:
        logging.error(f'Error parsing request: {str(e)}')
        return func.HttpResponse(
            json.dumps({"error": f"Request parsing error: {str(e)}"}),
            status_code=400,
            headers=headers
        )

    if not message:
        return func.HttpResponse(
            json.dumps({"error": "Missing 'message' field"}),
            status_code=400,
            headers=headers
        )

    try:
        # Get environment variables
        cosmos_endpoint = os.environ.get("COSMOS_ENDPOINT")
        cosmos_key = os.environ.get("COSMOS_KEY")
        
        logging.info(f'Cosmos endpoint: {cosmos_endpoint}')
        logging.info(f'Cosmos key exists: {bool(cosmos_key)}')
        
        if not cosmos_endpoint or not cosmos_key:
            logging.error("Missing Cosmos DB configuration")
            return func.HttpResponse(
                json.dumps({"error": "Database configuration missing"}),
                status_code=500,
                headers=headers
            )
        
        # Connect to Cosmos DB
        client = CosmosClient(cosmos_endpoint, cosmos_key)
        db = client.get_database_client("dalscooterdb")
        container = db.get_container_client("customer_issues")

        # Create item
        item_id = str(uuid.uuid4())
        item = {
            "id": item_id,
            "user_id": user_id,
            "message": message,
            "type": "feedback",
            "timestamp": datetime.datetime.utcnow().isoformat()
        }

        logging.info(f'Creating item: {item}')
        container.create_item(item)
        logging.info(f'Successfully stored feedback with ID: {item_id}')

        return func.HttpResponse(
            json.dumps({
                "status": "success", 
                "message": "Thank you for your feedback! We appreciate your input and will use it to improve our service.",
                "feedback_id": item_id
            }),
            status_code=200,
            headers=headers
        )
        
    except Exception as e:
        logging.error(f'Error saving to Cosmos DB: {str(e)}')
        logging.error(f'Exception type: {type(e).__name__}')
        return func.HttpResponse(
            json.dumps({"error": f"Database error: {str(e)}"}),
            status_code=500,
            headers=headers
        )