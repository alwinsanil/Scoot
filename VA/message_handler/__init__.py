import azure.functions as func
from azure.cosmos import CosmosClient
import os
import uuid
import datetime
import json
import requests  # <-- Add this to forward concerns to AWS

AWS_API_GATEWAY_URL = "https://llcrjx8j5c.execute-api.us-east-1.amazonaws.com/submit"

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        activity = req.get_json()
        user_message = activity.get("text", "").lower()
    except Exception:
        return func.HttpResponse("Invalid Bot Framework request.", status_code=400)

    cosmos_endpoint = os.environ["COSMOS_ENDPOINT"]
    cosmos_key = os.environ["COSMOS_KEY"]
    client = CosmosClient(cosmos_endpoint, cosmos_key)
    db = client.get_database_client("dalscooterdb")

    # 1️⃣ Booking Lookup
    if user_message.startswith("ref="):
        booking_ref = user_message.replace("ref=", "").strip()
        container = db.get_container_client("bookings")
        query = f"SELECT * FROM c WHERE LOWER(c.booking_id) = '{booking_ref.lower()}'"
        items = list(container.query_items(query=query, enable_cross_partition_query=True))
        reply_text = (
            f"Booking found:\nBike: {items[0]['bike_id']}\n"
            f"Access Code: {items[0]['access_code']}\n"
            f"Duration: {items[0]['duration']}"
        ) if items else "Booking reference not found."

    # 2️⃣ Feedback Submission (stored in CosmosDB)
    elif user_message.startswith("feedback:"):
        message = user_message.replace("feedback:", "").strip()
        container = db.get_container_client("customer_issues")
        container.create_item({
            "id": str(uuid.uuid4()),
            "user_id": "anonymous",
            "message": message,
            "timestamp": datetime.datetime.utcnow().isoformat()
        })
        reply_text = "Thank you for your feedback! We've noted your issue."

    # 3️⃣ Concern Submission → Forward to AWS API Gateway
    elif "concern" in user_message or "issue" in user_message:
        try:
            payload = {
                "concernId": f"C{int(datetime.datetime.utcnow().timestamp())}",
                "concernText": user_message,
                "userId": "anonymous",
                "timestamp": datetime.datetime.utcnow().isoformat()
            }
            resp = requests.post(AWS_API_GATEWAY_URL, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                reply_text = (
                    f"✅ Concern submitted successfully!\n"
                    f"Assigned to: {data.get('assignedOperator', 'Pending')}\n"
                    f"Ticket ID: {payload['concernId']}"
                )
            else:
                reply_text = "❌ Failed to submit your concern. Please try again later."
        except Exception as e:
            reply_text = f"⚠️ Error submitting concern: {str(e)}"

    # 4️⃣ Registration Help
    elif "register" in user_message:
        reply_text = (
            "To register, visit the signup page and complete the 3-step login:\n"
            "1. Email + Password\n"
            "2. Security Question\n"
            "3. Caesar Cipher challenge"
        )

    # 5️⃣ Greeting
    elif "hi" in user_message or "hello" in user_message:
        reply_text = "Hi there! How can I help you today?"

    # 6️⃣ Default Fallback
    else:
        reply_text = (
            "Sorry, I didn’t understand that. You can say things like:\n"
            "- ref=123ABC\n"
            "- feedback: the scooter was broken\n"
            "- I have a concern about my scooter\n"
            "- how do I register?"
        )

    return func.HttpResponse(
        json.dumps({ "type": "message", "text": reply_text }),
        mimetype="application/json"
    )
