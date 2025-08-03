import json
import boto3
import uuid
from datetime import datetime
import os
import base64
from boto3.dynamodb.conditions import Key

# ✅ Use DynamoDB resource for proper query support
dynamodb = boto3.resource('dynamodb')
dynamodb_client = boto3.client('dynamodb')  # NEW: For getting concern details
sns = boto3.client('sns')  # NEW: For forwarding messages

table = dynamodb.Table(os.environ['CONVERSATIONS_TABLE'])
concern_logs_table_name = os.environ.get('CONCERN_LOGS_TABLE', 'ConcernLogs')  # NEW

# NEW: Operator mapping for forwarding
OPERATORS = {
    "74289488-40b1-70e9-a2a5-2c46aab86488": "unitymonkdigital@gmail.com",
    "44086448-f011-70dd-db8e-75e4cb8c8e85": "patelekta1703@gmail.com"
}

def lambda_handler(event, context):
    try:
        print(f"Communication Event: {json.dumps(event)}")

        # ✅ Case 1: SQS Event (System Messages)
        if "Records" in event and event["Records"][0].get("eventSource") == "aws:sqs":
            return handle_sqs_event(event)

        # ✅ Case 2: API Gateway HTTP Event
        http_method = event['requestContext']['http']['method']
        concern_id = event['pathParameters']['concernId']

        if http_method == 'POST':
            return send_message(event, concern_id)
        elif http_method == 'GET':
            return get_messages(concern_id)
        else:
            return {
                'statusCode': 405,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Method not allowed'})
            }

    except Exception as e:
        print(f"Communication Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

# ------------------------------
# ✅ UPDATED: Handles HTTP API Gateway Calls with forwarding
# ------------------------------

def send_message(event, concern_id):
    """Send a message to a conversation and forward to the other party"""
    body_raw = event.get('body', '')
    if event.get("isBase64Encoded"):
        body_raw = base64.b64decode(body_raw).decode("utf-8")

    body = json.loads(body_raw or "{}")
    sender_id = body.get('senderId', 'system')
    sender_type = body.get('senderType', 'USER')  # 'USER' or 'OPERATOR'
    message_text = body.get('message', f"Action: {body.get('action', 'NO_MESSAGE')}")

    message_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + 'Z'

    # 1️⃣ Save to DynamoDB (REQUIREMENT: logged in NoSQL database)
    table.put_item(
        Item={
            'concernId': concern_id,
            'messageId': message_id,
            'senderId': sender_id,
            'senderType': sender_type,
            'operatorId': body.get('operatorId', 'unknown'),
            'message': message_text,
            'timestamp': timestamp
        }
    )

    # 2️⃣ NEW: Forward message to the other party
    if sender_type == 'OPERATOR':
        # Operator responding → forward to customer
        forward_to_customer(concern_id, message_text, sender_id)
    else:
        # Customer responding → forward to assigned operator
        forward_to_operator(concern_id, message_text, sender_id) 

    print(f"✅ Message saved and forwarded: {concern_id} - {sender_type}")
    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'messageId': message_id, 
            'timestamp': timestamp, 
            'status': 'sent_and_forwarded'
        })
    }

# NEW FUNCTIONS: Message forwarding

def forward_to_customer(concern_id, operator_message, operator_id):
    """Forward operator's response to customer via SNS"""
    try:
        # Get customer info from concern logs
        concern_response = dynamodb_client.get_item(
            TableName=concern_logs_table_name,
            Key={'concernId': {'S': concern_id}}
        )
        
        if 'Item' not in concern_response:
            print(f"❌ Concern {concern_id} not found in logs")
            return
            
        concern = concern_response['Item']
        customer_email = concern.get('customerEmail', {}).get('S', '')
        booking_reference = concern.get('bookingReference', {}).get('S', '')
        
        if customer_email:
            # Create temporary topic for customer response
            topic_name = f"CustomerResponse-{concern_id}"
            create_response = sns.create_topic(Name=topic_name)
            temp_topic_arn = create_response['TopicArn']
            
            # Subscribe customer
            sns.subscribe(
                TopicArn=temp_topic_arn,
                Protocol='email',
                Endpoint=customer_email
            )
            
            # Send operator's response to customer
            response_message = f"""
📧 Response to your concern:

Concern ID: {concern_id}
Booking Reference: {booking_reference}

Operator Response:
{operator_message}

To follow up on this concern, use the API:
POST /concerns/{concern_id}/messages
{{
  "senderId": "your-user-id",
  "senderType": "USER",
  "message": "Your follow-up message"
}}
            """
            
            sns.publish(
                TopicArn=temp_topic_arn,
                Message=response_message,
                Subject=f"Response - Booking {booking_reference}"
            )
            
            print(f"✅ Operator response forwarded to customer: {customer_email}")
            
    except Exception as e:
        print(f"❌ Error forwarding to customer: {str(e)}")

def forward_to_operator(concern_id, customer_message, customer_id):
    """Forward customer's follow-up to assigned operator via SNS"""
    try:
        # Get assigned operator info
        concern_response = dynamodb_client.get_item(
            TableName=concern_logs_table_name,
            Key={'concernId': {'S': concern_id}}
        )
        
        if 'Item' not in concern_response:
            print(f"❌ Concern {concern_id} not found in logs")
            return
            
        concern = concern_response['Item']
        assigned_operator = concern.get('assignedOperator', {}).get('S', '')
        operator_email = OPERATORS.get(assigned_operator, '')
        booking_reference = concern.get('bookingReference', {}).get('S', '')
        
        if operator_email:
            # Create temporary topic for operator follow-up
            topic_name = f"OperatorFollowup-{concern_id}"
            create_response = sns.create_topic(Name=topic_name)
            temp_topic_arn = create_response['TopicArn']
            
            # Subscribe assigned operator
            sns.subscribe(
                TopicArn=temp_topic_arn,
                Protocol='email',
                Endpoint=operator_email
            )
            
            # Send customer follow-up to operator
            followup_message = f"""
📝 Customer Follow-up:

Concern ID: {concern_id}
Booking Reference: {booking_reference}

Customer Message:
{customer_message}

To respond, use the API:
POST /concerns/{concern_id}/messages
{{
  "senderId": "{assigned_operator}",
  "senderType": "OPERATOR",
  "message": "Your response here"
}}
            """
            
            sns.publish(
                TopicArn=temp_topic_arn,
                Message=followup_message,
                Subject=f"Customer Follow-up - {concern_id}"
            )
            
            print(f"✅ Customer follow-up forwarded to operator: {operator_email}")
            
    except Exception as e:
        print(f"❌ Error forwarding to operator: {str(e)}")

# KEEP ALL YOUR EXISTING FUNCTIONS BELOW (no changes needed)

def get_messages(concern_id):
    """Retrieve all messages for a concern (paginated if >1MB)"""
    last_evaluated_key = None
    messages = []

    while True:
        kwargs = {
            'KeyConditionExpression': Key('concernId').eq(concern_id),
        }
        if last_evaluated_key:
            kwargs['ExclusiveStartKey'] = last_evaluated_key

        response = table.query(**kwargs)

        for item in response.get('Items', []):
            messages.append({
                'messageId': item['messageId'],
                'senderId': item['senderId'],
                'senderType': item['senderType'],
                'operatorId': item.get('operatorId', 'unknown'),
                'message': item['message'],
                'timestamp': item['timestamp']
            })

        last_evaluated_key = response.get('LastEvaluatedKey')
        if not last_evaluated_key:
            break

    # Sort by timestamp (ISO8601-safe)
    messages.sort(key=lambda x: x['timestamp'])

    print(f"✅ Retrieved {len(messages)} messages for concern {concern_id}")
    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'concernId': concern_id, 'messages': messages})
    }

# def handle_sqs_event(event):
#     """Process SQS messages from SNS (ConcernDetailsTopic)"""
#     for record in event['Records']:
#         body = json.loads(record['body'])
        
#         # ✅ If SQS is subscribed to SNS, parse inner Message
#         message = json.loads(body.get('Message', '{}'))

#         concern_id = message['concernId']
#         message_id = str(uuid.uuid4())
#         timestamp = datetime.utcnow().isoformat() + 'Z'

#         # Save system message to DynamoDB
#         table.put_item(
#             Item={
#                 'concernId': concern_id,
#                 'messageId': message_id,
#                 'senderId': message.get('assignedOperator', 'system'),
#                 'senderType': 'SYSTEM',
#                 'operatorId': message.get('assignedOperator', 'unknown'),
#                 'message': f"Action: {message.get('action', 'CONCERN_ASSIGNED')}",
#                 'timestamp': timestamp
#             }
#         )

#         print(f"✅ SQS message saved for {concern_id}")

#     return {"statusCode": 200, "body": json.dumps({"status": "processed"})}

def handle_sqs_event(event):
    """Process SQS messages from SNS (ConcernDetailsTopic)"""
    for record in event['Records']:
        body = json.loads(record['body'])
        
        # ✅ If SQS is subscribed to SNS, parse inner Message
        message = json.loads(body.get('Message', '{}'))

        concern_id = message['concernId']
        message_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + 'Z'

        # Save system message to DynamoDB
        table.put_item(
            Item={
                'concernId': concern_id,
                'messageId': message_id,
                'senderId': message.get('assignedOperator', 'system'),
                'senderType': 'SYSTEM',
                'operatorId': message.get('assignedOperator', 'unknown'),
                'message': f"Action: {message.get('action', 'CONCERN_ASSIGNED')}",
                'timestamp': timestamp
            }
        )

        print(f"✅ SQS message saved for {concern_id}")

    return {
        "statusCode": 200,
        "body": json.dumps({"status": "processed"})
    }
