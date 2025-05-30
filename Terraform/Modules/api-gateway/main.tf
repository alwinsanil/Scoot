# modules/api-gateway/main.tf

data "aws_region" "current" {}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "dalscooter_api" {
  name        = "${var.project_name}-${var.environment}-api"
  description = "Dalscooter API Gateway with Cognito auth"
  endpoint_configuration { types = ["REGIONAL"] }
  
  tags = {
    Project     = var.project_name
    Environment = var.environment
    Component   = "api-gateway"
  }
}

# Cognito Authorizer
resource "aws_api_gateway_authorizer" "cognito" {
  name          = "cognito-authorizer"
  type          = "COGNITO_USER_POOLS"
  rest_api_id   = aws_api_gateway_rest_api.dalscooter_api.id
  provider_arns = [var.cognito_user_pool_arn]
}

# ======================
# PUBLIC GUEST ROUTES
# ======================
resource "aws_api_gateway_resource" "guest" {
  rest_api_id = aws_api_gateway_rest_api.dalscooter_api.id
  parent_id   = aws_api_gateway_rest_api.dalscooter_api.root_resource_id
  path_part   = "guest"
}

resource "aws_api_gateway_resource" "guest_proxy" {
  rest_api_id = aws_api_gateway_rest_api.dalscooter_api.id
  parent_id   = aws_api_gateway_resource.guest.id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "guest_any" {
  rest_api_id   = aws_api_gateway_rest_api.dalscooter_api.id
  resource_id   = aws_api_gateway_resource.guest_proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "guest_integration" {
  rest_api_id             = aws_api_gateway_rest_api.dalscooter_api.id
  resource_id             = aws_api_gateway_resource.guest_proxy.id
  http_method             = aws_api_gateway_method.guest_any.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arn
}

# ======================
# PROTECTED USER ROUTES
# ======================
resource "aws_api_gateway_resource" "user" {
  rest_api_id = aws_api_gateway_rest_api.dalscooter_api.id
  parent_id   = aws_api_gateway_rest_api.dalscooter_api.root_resource_id
  path_part   = "user"
}

resource "aws_api_gateway_resource" "user_proxy" {
  rest_api_id = aws_api_gateway_rest_api.dalscooter_api.id
  parent_id   = aws_api_gateway_resource.user.id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "user_any" {
  rest_api_id   = aws_api_gateway_rest_api.dalscooter_api.id
  resource_id   = aws_api_gateway_resource.user_proxy.id
  http_method   = "ANY"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "user_integration" {
  rest_api_id             = aws_api_gateway_rest_api.dalscooter_api.id
  resource_id             = aws_api_gateway_resource.user_proxy.id
  http_method             = aws_api_gateway_method.user_any.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arn
}

# ======================
# CORS CONFIGURATION
# ======================
resource "aws_api_gateway_method" "options_method" {
  rest_api_id   = aws_api_gateway_rest_api.dalscooter_api.id
  resource_id   = aws_api_gateway_rest_api.dalscooter_api.root_resource_id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_integration" {
  rest_api_id = aws_api_gateway_rest_api.dalscooter_api.id
  resource_id = aws_api_gateway_rest_api.dalscooter_api.root_resource_id
  http_method = aws_api_gateway_method.options_method.http_method
  type        = "MOCK"
  
  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "options_200" {
  rest_api_id = aws_api_gateway_rest_api.dalscooter_api.id
  resource_id = aws_api_gateway_rest_api.dalscooter_api.root_resource_id
  http_method = aws_api_gateway_method.options_method.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.dalscooter_api.id
  resource_id = aws_api_gateway_rest_api.dalscooter_api.root_resource_id
  http_method = aws_api_gateway_method.options_method.http_method
  status_code = aws_api_gateway_method_response.options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,DELETE'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ======================
# DEPLOYMENT
# ======================
resource "aws_api_gateway_deployment" "deployment" {
  depends_on = [
    aws_api_gateway_integration.guest_integration,
    aws_api_gateway_integration.user_integration,
    aws_api_gateway_integration.options_integration
  ]

  rest_api_id = aws_api_gateway_rest_api.dalscooter_api.id
  stage_name  = var.environment

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.guest_proxy.id,
      aws_api_gateway_resource.user_proxy.id,
      aws_api_gateway_method.guest_any.id,
      aws_api_gateway_method.user_any.id
    ]))
  }

  lifecycle { create_before_destroy = true }
}

# Lambda permissions
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.dalscooter_api.execution_arn}/*/*"
}