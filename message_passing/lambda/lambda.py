# import json
# import boto3
# import base64
# import os
# import random
# from datetime import datetime

# # Initialize AWS clients
# dynamodb = boto3.client('dynamodb')
# sns = boto3.client('sns')

# CONFIRMATION_TOPIC_ARN = os.environ['CONFIRMATION_TOPIC_ARN']
# CONCERN_DETAILS_TOPIC_ARN = os.environ['CONCERN_DETAILS_TOPIC_ARN']
# DYNAMODB_TABLE = os.environ['DYNAMODB_TABLE']

# # Hardcoded operator mapping
# OPERATORS = {
#     "74289488-40b1-70e9-a2a5-2c46aab86488": "unitymonkdigital@gmail.com",
#     "44086448-f011-70dd-db8e-75e4cb8c8e85": "patelekta1703@gmail.com"
# }

# def lambda_handler(event, context):
#     try:
#         print(f"Incoming Event: {json.dumps(event)}")

#         # FIXED: Better body parsing logic
#         body = {}
        
#         # Handle different event sources
#         if 'body' in event:
#             body_raw = event['body']
            
#             # Handle base64 encoding
#             if event.get('isBase64Encoded', False):
#                 try:
#                     body_raw = base64.b64decode(body_raw).decode('utf-8')
#                 except Exception as e:
#                     print(f"Base64 decode error: {e}")
                    
#             # Parse JSON
#             if body_raw:
#                 try:
#                     body = json.loads(body_raw)
#                 except json.JSONDecodeError as e:
#                     print(f"JSON parse error: {e}")
#                     print(f"Raw body: {body_raw}")
#                     return {
#                         'statusCode': 400,
#                         'headers': {'Access-Control-Allow-Origin': '*'},
#                         'body': json.dumps({
#                             'status': 'error',
#                             'message': 'Invalid JSON in request body'
#                         })
#                     }
#             else:
#                 print("Empty body received")
                
#         # DEBUG: Print what we actually received
#         print(f"Parsed body: {json.dumps(body)}")
#         print(f"Body keys: {list(body.keys()) if body else 'No keys - empty body'}")

#         # Validate required fields
#         required_fields = ['concernId', 'concernText', 'userId', 'bookingReference', 'customerEmail']
#         missing_fields = []
        
#         for field in required_fields:
#             if field not in body:
#                 missing_fields.append(f"{field} (not present)")
#             elif not body[field]:
#                 missing_fields.append(f"{field} (empty)")
                
#         if missing_fields:
#             return {
#                 'statusCode': 400,
#                 'headers': {'Access-Control-Allow-Origin': '*'},
#                 'body': json.dumps({
#                     'status': 'error', 
#                     'message': f'Missing or empty required fields: {missing_fields}',
#                     'received_fields': list(body.keys()),
#                     'debug_body': body  # Temporary for debugging
#                 })
#             }

#         # Extract fields
#         concern_id = body['concernId']
#         concern_text = body['concernText']
#         user_id = body['userId']
#         booking_reference = body['bookingReference']
#         customer_email = body['customerEmail']
#         timestamp = body.get('timestamp', datetime.utcnow().isoformat() + 'Z')

#         print(f"Processing new concern: {concern_id} from user: {user_id}")

#         # Rest of your existing code continues here...
#         # (All the DynamoDB, SNS logic remains the same)
        
#         # Randomly assign an operator
#         assigned_operator = random.choice(list(OPERATORS.keys()))
#         operator_email = OPERATORS[assigned_operator]
#         print(f"✅ Assigned operator: {assigned_operator} ({operator_email})")

#         # Store in DynamoDB
#         dynamodb.put_item(
#             TableName=DYNAMODB_TABLE,
#             Item={
#                 'concernId': {'S': concern_id},
#                 'concernText': {'S': concern_text},
#                 'userId': {'S': user_id},
#                 'bookingReference': {'S': booking_reference},
#                 'customerEmail': {'S': customer_email},
#                 'assignedOperator': {'S': assigned_operator},
#                 'operatorEmail': {'S': operator_email},
#                 'status': {'S': 'ASSIGNED'},
#                 'createdAt': {'S': timestamp},
#             }
#         )

#         # SNS notifications (keep your existing code)
#         confirmation_message = f"New concern submitted!\nConcern ID: {concern_id}\nBooking: {booking_reference}"
#         sns.publish(
#             TopicArn=CONFIRMATION_TOPIC_ARN,
#             Message=confirmation_message,
#             Subject="Concern Confirmation"
#         )

#         send_concern_to_assigned_operator(
#             concern_id=concern_id,
#             operator_email=operator_email,
#             booking_reference=booking_reference,
#             concern_text=concern_text,
#             customer_email=customer_email
#         )

#         sns.publish(
#             TopicArn=CONCERN_DETAILS_TOPIC_ARN,
#             Message=json.dumps({
#                 'concernId': concern_id,
#                 'assignedOperator': assigned_operator,
#                 'operatorEmail': operator_email,
#                 'bookingReference': booking_reference,
#                 'customerEmail': customer_email,
#                 'concernText': concern_text,
#                 'userId': user_id,
#                 'timestamp': timestamp,
#                 'action': 'CONCERN_ASSIGNED'
#             })
#         )

#         # Successful response
#         return {
#             'statusCode': 200,
#             'headers': {'Access-Control-Allow-Origin': '*'},
#             'body': json.dumps({
#                 'status': 'success',
#                 'concernId': concern_id,
#                 'assignedOperator': assigned_operator,
#                 'operatorEmail': operator_email,
#                 'bookingReference': booking_reference
#             })
#         }

#     except Exception as e:
#         print(f"❌ Lambda Error: {str(e)}")
#         import traceback
#         print(traceback.format_exc())
#         return {
#             'statusCode': 500,
#             'headers': {'Access-Control-Allow-Origin': '*'},
#             'body': json.dumps({'status': 'error', 'message': str(e)})
#         }

import json
import boto3
import base64
import os
import random
from datetime import datetime

# Initialize AWS clients
dynamodb = boto3.client('dynamodb')
sns = boto3.client('sns')

CONFIRMATION_TOPIC_ARN = os.environ['CONFIRMATION_TOPIC_ARN']
CONCERN_DETAILS_TOPIC_ARN = os.environ['CONCERN_DETAILS_TOPIC_ARN']
DYNAMODB_TABLE = os.environ['DYNAMODB_TABLE']

# Hardcoded operator mapping
OPERATORS = {
    "74289488-40b1-70e9-a2a5-2c46aab86488": "unitymonkdigital@gmail.com",
    "44086448-f011-70dd-db8e-75e4cb8c8e85": "patelekta1703@gmail.com"
}

def lambda_handler(event, context):
    try:
        print(f"Incoming Event: {json.dumps(event)}")

        # FIXED: Better body parsing logic
        body = {}
        
        # Handle different event sources
        if 'body' in event:
            body_raw = event['body']
            
            # Handle base64 encoding
            if event.get('isBase64Encoded', False):
                try:
                    body_raw = base64.b64decode(body_raw).decode('utf-8')
                except Exception as e:
                    print(f"Base64 decode error: {e}")
                    
            # Parse JSON
            if body_raw:
                try:
                    body = json.loads(body_raw)
                except json.JSONDecodeError as e:
                    print(f"JSON parse error: {e}")
                    print(f"Raw body: {body_raw}")
                    return {
                        'statusCode': 400,
                        'headers': {'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'status': 'error',
                            'message': 'Invalid JSON in request body'
                        })
                    }
            else:
                print("Empty body received")
                
        # DEBUG: Print what we actually received
        print(f"Parsed body: {json.dumps(body)}")
        print(f"Body keys: {list(body.keys()) if body else 'No keys - empty body'}")

        # FIXED: Handle field name mapping
        concern_id = body.get('concernId')
        concern_text = body.get('concernText')
        user_id = body.get('userId')
        booking_reference = body.get('bookingReference') or body.get('bookingRef')  # Handle both names
        customer_email = body.get('customerEmail', 'no-email@example.com')  # Default if missing
        
        # Validate required fields
        missing_fields = []
        if not concern_id:
            missing_fields.append('concernId')
        if not concern_text:
            missing_fields.append('concernText')
        if not user_id:
            missing_fields.append('userId')
        if not booking_reference:
            missing_fields.append('bookingReference (send as bookingReference or bookingRef)')
            
        if missing_fields:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'status': 'error', 
                    'message': f'Missing required fields: {missing_fields}'
                })
            }
        timestamp = body.get('timestamp', datetime.utcnow().isoformat() + 'Z')

        print(f"Processing new concern: {concern_id} from user: {user_id}")
        
        # Randomly assign an operator
        assigned_operator = random.choice(list(OPERATORS.keys()))
        operator_email = OPERATORS[assigned_operator]
        print(f"✅ Assigned operator: {assigned_operator} ({operator_email})")

        # Store in DynamoDB
        dynamodb.put_item(
            TableName=DYNAMODB_TABLE,
            Item={
                'concernId': {'S': concern_id},
                'concernText': {'S': concern_text},
                'userId': {'S': user_id},
                'bookingReference': {'S': booking_reference},
                'customerEmail': {'S': customer_email},
                'assignedOperator': {'S': assigned_operator},
                'operatorEmail': {'S': operator_email},
                'status': {'S': 'ASSIGNED'},
                'createdAt': {'S': timestamp},
            }
        )

        # 🔥 NEW: Send customer confirmation with follow-up link
        send_customer_confirmation_with_followup(customer_email, concern_id, booking_reference)

        # Send concern to assigned operator (with communication link)
        send_concern_to_assigned_operator(
            concern_id=concern_id,
            operator_email=operator_email,
            booking_reference=booking_reference,
            concern_text=concern_text,
            customer_email=customer_email
        )

        # Send to concern details topic (for communication Lambda)
        sns.publish(
            TopicArn=CONCERN_DETAILS_TOPIC_ARN,
            Message=json.dumps({
                'concernId': concern_id,
                'assignedOperator': assigned_operator,
                'operatorEmail': operator_email,
                'bookingReference': booking_reference,
                'customerEmail': customer_email,
                'concernText': concern_text,
                'userId': user_id,
                'timestamp': timestamp,
                'action': 'CONCERN_ASSIGNED'
            })
        )

        # Successful response
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'status': 'success',
                'concernId': concern_id,
                'assignedOperator': assigned_operator,
                'operatorEmail': operator_email,
                'bookingReference': booking_reference
            })
        }

    except Exception as e:
        print(f"❌ Lambda Error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'status': 'error', 'message': str(e)})
        }

def send_concern_to_assigned_operator(concern_id, operator_email, booking_reference, concern_text, customer_email):
    """Send concern details ONLY to the assigned operator using temporary SNS topic"""
    try:
        # 🔥 LOCALHOST COMMUNICATION PAGE URL
        COMMUNICATION_PAGE_URL = "http://localhost:5173/communication-test.html"
        
        # Create temporary topic for this specific concern and operator
        topic_name = f"Concern-{concern_id}-Details"
        create_response = sns.create_topic(Name=topic_name)
        temp_topic_arn = create_response['TopicArn']
        
        # Subscribe ONLY the assigned operator
        sns.subscribe(
            TopicArn=temp_topic_arn,
            Protocol='email',
            Endpoint=operator_email
        )
        
        # Send detailed concern with direct communication link
        concern_details = f"""
🎯 CONCERN ASSIGNED TO YOU

Concern ID: {concern_id}
Booking Reference: {booking_reference}
Customer Email: {customer_email}

Concern Details:
{concern_text}

🔗 RESPOND TO CUSTOMER DIRECTLY:
{COMMUNICATION_PAGE_URL}

Instructions:
1. Click the link above (make sure your local server is running)
2. The concern ID ({concern_id}) is already pre-filled
3. Select your operator name from dropdown
4. Type your response message
5. Click "Send Response to Customer"

The customer will automatically receive your response via email and can follow up using the same page.

---
Advanced: You can also use the API directly:
POST http://localhost:7071/api/concerns/{concern_id}/messages
        """
        
        sns.publish(
            TopicArn=temp_topic_arn,
            Message=concern_details,
            Subject=f"🚨 New Concern - {booking_reference}"
        )
        
        print(f"✅ Concern details with communication link sent to: {operator_email}")
        
    except Exception as e:
        print(f"❌ Error sending concern to operator: {str(e)}")

def send_customer_confirmation_with_followup(customer_email, concern_id, booking_reference):
    """Send confirmation to customer with follow-up link"""
    try:
        # 🔥 LOCALHOST COMMUNICATION PAGE URL
        COMMUNICATION_PAGE_URL = "http://localhost:5173/communication-test.html"
        
        confirmation_message = f"""
✅ CONCERN SUBMITTED SUCCESSFULLY

Your Concern ID: {concern_id}
Booking Reference: {booking_reference}

We have received your concern and assigned it to our support team.
You will receive a response via email shortly.

Need to follow up or add more information?
🔗 {COMMUNICATION_PAGE_URL}

Instructions for follow-up:
1. Click the link above (make sure the page is accessible)
2. Enter your concern ID: {concern_id}
3. In the "Customer Follow-up" section, type your message
4. Click "Send Follow-up Message"

Your assigned operator will receive your follow-up via email.
        """
        
        # Create temporary topic for customer confirmation
        topic_name = f"Customer-Confirmation-{concern_id}"
        create_response = sns.create_topic(Name=topic_name)
        temp_topic_arn = create_response['TopicArn']
        
        sns.subscribe(
            TopicArn=temp_topic_arn,
            Protocol='email',
            Endpoint=customer_email
        )
        
        sns.publish(
            TopicArn=temp_topic_arn,
            Message=confirmation_message,
            Subject=f"Concern Submitted - {concern_id}"
        )
        
        print(f"✅ Customer confirmation with follow-up link sent to: {customer_email}")
        
    except Exception as e:
        print(f"❌ Error sending customer confirmation: {str(e)}")


# import json
# import boto3
# import base64
# import os
# import random
# from datetime import datetime

# # Initialize AWS clients
# dynamodb = boto3.client('dynamodb')
# sns = boto3.client('sns')

# CONFIRMATION_TOPIC_ARN = os.environ['CONFIRMATION_TOPIC_ARN']
# CONCERN_DETAILS_TOPIC_ARN = os.environ['CONCERN_DETAILS_TOPIC_ARN']
# DYNAMODB_TABLE = os.environ['DYNAMODB_TABLE']

# # Hardcoded operator mapping
# OPERATORS = {
#     "74289488-40b1-70e9-a2a5-2c46aab86488": "unitymonkdigital@gmail.com",
#     "44086448-f011-70dd-db8e-75e4cb8c8e85": "patelekta1703@gmail.com"
# }

# def lambda_handler(event, context):
#     try:
#         print(f"Incoming Event: {json.dumps(event)}")

#         # FIXED: Better body parsing logic
#         body = {}
        
#         # Handle different event sources
#         if 'body' in event:
#             body_raw = event['body']
            
#             # Handle base64 encoding
#             if event.get('isBase64Encoded', False):
#                 try:
#                     body_raw = base64.b64decode(body_raw).decode('utf-8')
#                 except Exception as e:
#                     print(f"Base64 decode error: {e}")
                    
#             # Parse JSON
#             if body_raw:
#                 try:
#                     body = json.loads(body_raw)
#                 except json.JSONDecodeError as e:
#                     print(f"JSON parse error: {e}")
#                     print(f"Raw body: {body_raw}")
#                     return {
#                         'statusCode': 400,
#                         'headers': {'Access-Control-Allow-Origin': '*'},
#                         'body': json.dumps({
#                             'status': 'error',
#                             'message': 'Invalid JSON in request body'
#                         })
#                     }
#             else:
#                 print("Empty body received")
                
#         # DEBUG: Print what we actually received
#         print(f"Parsed body: {json.dumps(body)}")
#         print(f"Body keys: {list(body.keys()) if body else 'No keys - empty body'}")

#         # FIXED: Handle field name mapping
#         concern_id = body.get('concernId')
#         concern_text = body.get('concernText')
#         user_id = body.get('userId')
#         booking_reference = body.get('bookingReference') or body.get('bookingRef')  # Handle both names
#         customer_email = body.get('customerEmail', 'no-email@example.com')  # Default if missing
        
#         # Validate required fields
#         missing_fields = []
#         if not concern_id:
#             missing_fields.append('concernId')
#         if not concern_text:
#             missing_fields.append('concernText')
#         if not user_id:
#             missing_fields.append('userId')
#         if not booking_reference:
#             missing_fields.append('bookingReference (send as bookingReference or bookingRef)')
            
#         if missing_fields:
#             return {
#                 'statusCode': 400,
#                 'headers': {'Access-Control-Allow-Origin': '*'},
#                 'body': json.dumps({
#                     'status': 'error', 
#                     'message': f'Missing required fields: {missing_fields}'
#                 })
#             }
#         timestamp = body.get('timestamp', datetime.utcnow().isoformat() + 'Z')

#         print(f"Processing new concern: {concern_id} from user: {user_id}")
        
#         # Randomly assign an operator
#         assigned_operator = random.choice(list(OPERATORS.keys()))
#         operator_email = OPERATORS[assigned_operator]
#         print(f"✅ Assigned operator: {assigned_operator} ({operator_email})")

#         # Store in DynamoDB
#         dynamodb.put_item(
#             TableName=DYNAMODB_TABLE,
#             Item={
#                 'concernId': {'S': concern_id},
#                 'concernText': {'S': concern_text},
#                 'userId': {'S': user_id},
#                 'bookingReference': {'S': booking_reference},
#                 'customerEmail': {'S': customer_email},
#                 'assignedOperator': {'S': assigned_operator},
#                 'operatorEmail': {'S': operator_email},
#                 'status': {'S': 'ASSIGNED'},
#                 'createdAt': {'S': timestamp},
#             }
#         )

#         # 🔥 NEW: Send customer confirmation with follow-up link
#         send_customer_confirmation_with_followup(customer_email, concern_id, booking_reference)

#         # Send concern to assigned operator (with communication link)
#         send_concern_to_assigned_operator(
#             concern_id=concern_id,
#             operator_email=operator_email,
#             booking_reference=booking_reference,
#             concern_text=concern_text,
#             customer_email=customer_email
#         )

#         # Send to concern details topic (for communication Lambda)
#         sns.publish(
#             TopicArn=CONCERN_DETAILS_TOPIC_ARN,
#             Message=json.dumps({
#                 'concernId': concern_id,
#                 'assignedOperator': assigned_operator,
#                 'operatorEmail': operator_email,
#                 'bookingReference': booking_reference,
#                 'customerEmail': customer_email,
#                 'concernText': concern_text,
#                 'userId': user_id,
#                 'timestamp': timestamp,
#                 'action': 'CONCERN_ASSIGNED'
#             })
#         )

#         # Successful response
#         return {
#             'statusCode': 200,
#             'headers': {'Access-Control-Allow-Origin': '*'},
#             'body': json.dumps({
#                 'status': 'success',
#                 'concernId': concern_id,
#                 'assignedOperator': assigned_operator,
#                 'operatorEmail': operator_email,
#                 'bookingReference': booking_reference
#             })
#         }

#     except Exception as e:
#         print(f"❌ Lambda Error: {str(e)}")
#         import traceback
#         print(traceback.format_exc())
#         return {
#             'statusCode': 500,
#             'headers': {'Access-Control-Allow-Origin': '*'},
#             'body': json.dumps({'status': 'error', 'message': str(e)})
#         }

# def send_concern_to_assigned_operator(concern_id, operator_email, booking_reference, concern_text, customer_email):
#     """Send concern details to the assigned operator using existing permanent topic"""
#     try:
#         # 🔥 LOCALHOST COMMUNICATION PAGE URL
#         COMMUNICATION_PAGE_URL = "http://localhost:7071/communication-test.h"
        
#         # Create concern details message
#         concern_details = f"""
# 🎯 CONCERN ASSIGNED TO: {operator_email}

# Concern ID: {concern_id}
# Booking Reference: {booking_reference}
# Customer Email: {customer_email}

# Concern Details:
# {concern_text}

# 🔗 RESPOND TO CUSTOMER DIRECTLY:
# {COMMUNICATION_PAGE_URL}

# Instructions:
# 1. Click the link above (make sure your local server is running)
# 2. The concern ID ({concern_id}) is already pre-filled
# 3. Select your operator name from dropdown
# 4. Type your response message
# 5. Click "Send Response to Customer"

# The customer will automatically receive your response via email and can follow up using the same page.

# ---
# Advanced: You can also use the API directly:
# POST http://localhost:7071/api/concerns/{concern_id}/messages

# ASSIGNED TO: {operator_email}
#         """
        
#         # 🔥 FIX: Use the existing permanent topic instead of creating temporary ones
#         sns.publish(
#             TopicArn=CONCERN_DETAILS_TOPIC_ARN,  # Use permanent topic
#             Message=concern_details,
#             Subject=f"🚨 New Concern - {booking_reference} - FOR: {operator_email}"
#         )
        
#         print(f"✅ Concern details sent via permanent topic to: {operator_email}")
        
#     except Exception as e:
#         print(f"❌ Error sending concern to operator: {str(e)}")

# def send_customer_confirmation_with_followup(customer_email, concern_id, booking_reference):
#     """Send confirmation to customer using permanent topic"""
#     try:
#         # 🔥 LOCALHOST COMMUNICATION PAGE URL
#         COMMUNICATION_PAGE_URL = "http://localhost:7071/communication-test.html"
        
#         confirmation_message = f"""
# ✅ CONCERN SUBMITTED SUCCESSFULLY

# Your Concern ID: {concern_id}
# Booking Reference: {booking_reference}

# We have received your concern and assigned it to our support team.
# You will receive a response via email shortly.

# Need to follow up or add more information?
# 🔗 {COMMUNICATION_PAGE_URL}

# Instructions for follow-up:
# 1. Click the link above (make sure the page is accessible)
# 2. Enter your concern ID: {concern_id}
# 3. In the "Customer Follow-up" section, type your message
# 4. Click "Send Follow-up Message"

# Your assigned operator will receive your follow-up via email.

# FOR CUSTOMER: {customer_email}
#         """
        
#         # 🔥 FIX: Use permanent confirmation topic
#         sns.publish(
#             TopicArn=CONFIRMATION_TOPIC_ARN,  # Use permanent topic
#             Message=confirmation_message,
#             Subject=f"Concern Submitted - {concern_id} - FOR: {customer_email}"
#         )
        
#         print(f"✅ Customer confirmation sent via permanent topic to: {customer_email}")
        
#     except Exception as e:
#         print(f"❌ Error sending customer confirmation: {str(e)}")