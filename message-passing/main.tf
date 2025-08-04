provider "aws" {
  region = "us-east-1"
}

# ------------------------
# API Gateway
# ------------------------
resource "aws_apigatewayv2_api" "lambda_api" {
  name          = "ConcernSubmissionAPI"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["content-type", "x-amz-date", "authorization", "x-api-key", "x-amz-security-token", "x-amz-user-agent", "accept"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"]
    allow_origins     = ["*"]
    expose_headers    = ["date", "keep-alive"]
    max_age           = 86400
  }
}

resource "aws_apigatewayv2_stage" "api_stage" {
  api_id      = aws_apigatewayv2_api.lambda_api.id
  name        = "$default"
  auto_deploy = true
}

# ------------------------
# DynamoDB Tables
# ------------------------
resource "aws_dynamodb_table" "concern_logs" {
  name         = "ConcernLogs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "concernId"

  attribute {
    name = "concernId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "conversations" {
  name         = "Conversations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "concernId"
  range_key    = "messageId"

  attribute {
    name = "concernId"
    type = "S"
  }

  attribute {
    name = "messageId"
    type = "S"
  }
}

# ------------------------
# SNS Topics
# ------------------------
# Topic 1: Confirmation emails (all operators)
resource "aws_sns_topic" "confirmation_notifications" {
  name = "ConfirmationNotificationTopic"
}

# Topic 2: Concern details (for assigned operator)
resource "aws_sns_topic" "concern_details" {
  name = "ConcernDetailsNotificationTopic"
}

# Email subscriptions for confirmation (all operators)
resource "aws_sns_topic_subscription" "operator1_confirmation" {
  topic_arn = aws_sns_topic.confirmation_notifications.arn
  protocol  = "email"
  endpoint  = "unitymonkdigital@gmail.com"
}

resource "aws_sns_topic_subscription" "operator2_confirmation" {
  topic_arn = aws_sns_topic.confirmation_notifications.arn
  protocol  = "email"
  endpoint  = "patelekta1703@gmail.com"
}

# ------------------------
# SQS Queue for Lambda Processing
# ------------------------
resource "aws_sqs_queue" "concern_queue" {
  name = "ConcernNotificationQueue"
}

# Subscribe SQS to ConcernDetails topic
resource "aws_sns_topic_subscription" "sqs_subscription" {
  topic_arn = aws_sns_topic.concern_details.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.concern_queue.arn
}

# Allow SNS to publish to SQS
resource "aws_sqs_queue_policy" "concern_queue_policy" {
  queue_url = aws_sqs_queue.concern_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action   = "SQS:SendMessage"
        Resource = aws_sqs_queue.concern_queue.arn
        Condition = {
          ArnEquals = { "aws:SourceArn" = aws_sns_topic.concern_details.arn }
        }
      }
    ]
  })
}

# ------------------------
# Lambda: Message Handler
# ------------------------
resource "aws_lambda_function" "message_handler" {
  filename         = "/Users/ektapatel/Desktop/serverlesss/Team-5-DALScooter/Backend/message_passing/lambda.zip"
  function_name    = "MessageHandlerFunction"
  role             = "arn:aws:iam::244634821279:role/LabRole"
  handler          = "lambda.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = filebase64sha256("/Users/ektapatel/Desktop/serverlesss/Team-5-DALScooter/Backend/message_passing/lambda.zip")

  environment {
    variables = {
      DYNAMODB_TABLE            = aws_dynamodb_table.concern_logs.name
      CONVERSATIONS_TABLE       = aws_dynamodb_table.conversations.name
      CONFIRMATION_TOPIC_ARN    = aws_sns_topic.confirmation_notifications.arn
      CONCERN_DETAILS_TOPIC_ARN = aws_sns_topic.concern_details.arn
    }
  }
}

# API Gateway -> Lambda integration
resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.lambda_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.message_handler.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "lambda_route" {
  api_id    = aws_apigatewayv2_api.lambda_api.id
  route_key = "POST /submit"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_lambda_permission" "apigw_invoke_lambda" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.message_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.lambda_api.execution_arn}/*/*"
}

# ------------------------
# Lambda: Communication Handler
# ------------------------
resource "aws_lambda_function" "communication_handler" {
  filename         = "/Users/ektapatel/Desktop/serverlesss/Team-5-DALScooter/Backend/message_passing/communication.zip"
  function_name    = "CommunicationHandlerFunction"
  role             = "arn:aws:iam::244634821279:role/LabRole"
  handler          = "communication.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = filebase64sha256("/Users/ektapatel/Desktop/serverlesss/Team-5-DALScooter/Backend/message_passing/communication.zip")

  environment {
    variables = {
      CONVERSATIONS_TABLE = aws_dynamodb_table.conversations.name
      CONCERN_LOGS_TABLE  = aws_dynamodb_table.concern_logs.name
    }
  }
}

# Attach SQS as Event Source to Communication Lambda
resource "aws_lambda_event_source_mapping" "communication_sqs_trigger" {
  event_source_arn  = aws_sqs_queue.concern_queue.arn
  function_name     = aws_lambda_function.communication_handler.arn
  batch_size        = 10
  enabled           = true
}

# API Gateway Integration for Chat
resource "aws_apigatewayv2_integration" "communication_integration" {
  api_id                 = aws_apigatewayv2_api.lambda_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.communication_handler.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "send_message_route" {
  api_id    = aws_apigatewayv2_api.lambda_api.id
  route_key = "POST /concerns/{concernId}/messages"
  target    = "integrations/${aws_apigatewayv2_integration.communication_integration.id}"
}

resource "aws_apigatewayv2_route" "get_messages_route" {
  api_id    = aws_apigatewayv2_api.lambda_api.id
  route_key = "GET /concerns/{concernId}/messages"
  target    = "integrations/${aws_apigatewayv2_integration.communication_integration.id}"
}

resource "aws_lambda_permission" "apigw_invoke_communication" {
  statement_id  = "AllowAPIGatewayInvokeComm"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.communication_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.lambda_api.execution_arn}/*/*"
}

# ------------------------
# Outputs
# ------------------------
output "api_gateway_submit_url" {
  value = "${aws_apigatewayv2_api.lambda_api.api_endpoint}/submit"
}

output "communication_post_url" {
  value = "${aws_apigatewayv2_api.lambda_api.api_endpoint}/concerns/{concernId}/messages (POST)"
}

output "communication_get_url" {
  value = "${aws_apigatewayv2_api.lambda_api.api_endpoint}/concerns/{concernId}/messages (GET)"
}
