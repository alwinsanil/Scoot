# import azure.functions as func
# from azure.cosmos import CosmosClient
# import boto3
# import os
# import uuid
# import datetime
# import json
# import random

# def main(req: func.HttpRequest) -> func.HttpResponse:
#     try:
#         data = req.get_json()
#     except:
#         return func.HttpResponse("Invalid JSON body.", status_code=400)

#     user_id = data.get("user_id", "anonymous")
#     message = data.get("message") or data.get("text")
#     booking_ref = data.get("booking_ref", f"BR-{random.randint(1000,9999)}")

#     if not message:
#         return func.HttpResponse("Missing 'message'", status_code=400)

#     # 1️⃣ Store the issue in CosmosDB
#     cosmos_endpoint = os.environ["COSMOS_ENDPOINT"]
#     cosmos_key = os.environ["COSMOS_KEY"]
#     client = CosmosClient(cosmos_endpoint, cosmos_key)
#     db = client.get_database_client("dalscooterdb")
#     container = db.get_container_client("customer_issues")

#     item_id = str(uuid.uuid4())
#     item = {
#         "id": item_id,
#         "user_id": user_id,
#         "booking_ref": booking_ref,
#         "message": message,
#         "timestamp": datetime.datetime.utcnow().isoformat()
#     }
#     container.create_item(item)

#     # 2️⃣ Publish to AWS SQS (Message Passing)
#     try:
#         sqs = boto3.client(
#             "sqs",
#             region_name="us-east-1",
#             aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
#             aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
#             aws_session_token=os.environ.get("AWS_SESSION_TOKEN")
#         )

#         queue_url = os.environ["SQS_URL"]
#         sqs.send_message(
#             QueueUrl=queue_url,
#             MessageBody=json.dumps({
#                 "concernId": item_id,
#                 "userId": user_id,
#                 "bookingRef": booking_ref,
#                 "concernText": message,
#                 "timestamp": datetime.datetime.utcnow().isoformat()
#             })
#         )
#     except Exception as e:
#         return func.HttpResponse(
#             json.dumps({ "status": "error", "message": f"Failed to publish to SQS: {str(e)}" }),
#             mimetype="application/json",
#             status_code=500
#         )

#     # 3️⃣ Return JSON for frontend
#     return func.HttpResponse(
#         json.dumps({
#             "status": "success",
#             "text": f"✅ Concern submitted! Booking Ref: {booking_ref}\nWe'll assign it to a franchise operator shortly."
#         }),
#         mimetype="application/json",
#         status_code=200
#     )

import azure.functions as func
from azure.cosmos import CosmosClient
import os, uuid, datetime, json, random, requests
from botocore.credentials import Credentials
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
import logging


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("submit_concern function triggered.")

    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=headers)

    try:
        data = req.get_json()
    except:
        return func.HttpResponse("Invalid JSON body.", status_code=400, headers=headers)

    user_id = data.get("user_id", "anonymous")
    message = data.get("message")
    booking_ref = data.get("booking_ref", f"BR-{random.randint(1000,9999)}")
    
    
    if not message:
        return func.HttpResponse("Missing 'message'", status_code=400, headers=headers)

    # Parse JSON body
    try:
        data = req.get_json()
    except Exception as e:
        logging.error(f"Invalid JSON: {e}")
        return func.HttpResponse("Invalid JSON body.", status_code=400)

    user_id = data.get("user_id", "anonymous")
    message = data.get("message") or data.get("text")
    booking_ref = data.get("booking_ref", f"BR-{random.randint(1000,9999)}")

    if not message:
        return func.HttpResponse("Missing 'message'", status_code=400)

    # 1️⃣ Log in CosmosDB
    try:
        cosmos_endpoint = os.environ["COSMOS_ENDPOINT"]
        cosmos_key = os.environ["COSMOS_KEY"]
        client = CosmosClient(cosmos_endpoint, cosmos_key)
        db = client.get_database_client("dalscooterdb")
        container = db.get_container_client("customer_issues")

        # Create unique ID for this concern
        item_id = str(uuid.uuid4())

        container.create_item({
            "id": item_id,
            "user_id": user_id,
            "booking_ref": booking_ref,
            "message": message,
            "timestamp": datetime.datetime.utcnow().isoformat()
        })

    except Exception as e:
        logging.error(f"CosmosDB error: {e}")
        return func.HttpResponse(f"Failed to log to CosmosDB: {str(e)}", status_code=500)

    # 2️⃣ Forward to AWS API Gateway (SigV4 signed request)
    try:
        aws_url = os.environ["AWS_API_GATEWAY_URL"]
        region = "us-east-1"

        payload = json.dumps({
            "concernId": item_id,
            "concernText": message,
            "userId": user_id,
            "bookingRef": booking_ref,
            "timestamp": datetime.datetime.utcnow().isoformat()
        })

        creds = Credentials(
            os.environ["AWS_ACCESS_KEY_ID"],
            os.environ["AWS_SECRET_ACCESS_KEY"],
            os.environ.get("AWS_SESSION_TOKEN")
        )

        request = AWSRequest(method="POST", url=aws_url, data=payload)
        SigV4Auth(creds, "execute-api", region).add_auth(request)
        signed_headers = dict(request.headers)

        res = requests.post(aws_url, headers=signed_headers, data=payload)
        res.raise_for_status()

    except Exception as e:
        logging.error(f"AWS forwarding failed: {e}")
        return func.HttpResponse(f"Failed to forward to AWS: {str(e)}", status_code=500)

    # ✅ Successful response
    return func.HttpResponse(
        json.dumps({
            "status": "success",
            "text": f"✅ Concern submitted! Booking Ref: {booking_ref}"
        }),
        mimetype="application/json",
        status_code=200,
        headers=headers
    )