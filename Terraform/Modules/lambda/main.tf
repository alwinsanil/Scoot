# modules/lambda/main.tf


# Lambda function
resource "aws_lambda_function" "auth_api" {
  filename      = "${path.module}/auth-api.zip"
  function_name = "${var.project_name}-${var.environment}-auth-api"
  role          = var.lambda_role_arn
  handler       = "auth-api.handler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 128

  source_code_hash = filebase64sha256("${path.module}/auth-api.zip")

  environment {
    variables = {
      PROJECT_NAME          = var.project_name
      ENVIRONMENT           = var.environment
      LOG_LEVEL             = "INFO"
      COGNITO_CLIENT_ID     = var.cognito_client_id
      COGNITO_CLIENT_SECRET = var.cognito_client_secret
      COGNITO_DOMAIN        = "${var.cognito_domain}.auth.${var.aws_region}.amazoncognito.com"
      REDIRECT_URI          = "${var.api_url}/auth/callback"
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    Component   = "api"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "auth_lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.auth_api.function_name}"
  retention_in_days = 7
}

# guest-api

# Lambda function
resource "aws_lambda_function" "guest_api" {
  filename      = "${path.module}/guest-api.zip"
  
  function_name = "${var.project_name}-${var.environment}-guest-api"
  role          = var.lambda_role_arn
  handler       = "guest-api.lambdaHandler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 128

  source_code_hash = filebase64sha256("${path.module}/guest-api.zip")

  environment {
    variables = {
      PROJECT_NAME = var.project_name
      ENVIRONMENT  = var.environment
      LOG_LEVEL    = "INFO"
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    Component   = "api"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "guest_lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.guest_api.function_name}"
  retention_in_days = 7
}

# user-api

# Lambda function
resource "aws_lambda_function" "user_api" {
  filename      = "${path.module}/user-api.zip"
  function_name = "${var.project_name}-${var.environment}-user-api"
  role          = var.lambda_role_arn
  handler       = "user-api.lambdaHandler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 1024

  source_code_hash = filebase64sha256("${path.module}/user-api.zip")

  environment {
    variables = {
      PROJECT_NAME         = var.project_name
      ENVIRONMENT          = var.environment
      LOG_LEVEL            = "INFO"
      COGNITO_USER_POOL_ID = var.cognito_user_pool_id
      REGION               = var.aws_region
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    Component   = "api"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "user_lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.user_api.function_name}"
  retention_in_days = 7
}

# owner-api

# Lambda function
resource "aws_lambda_function" "owner_api" {
  filename      = "${path.module}/owner-api.zip"
  function_name = "${var.project_name}-${var.environment}-owner-api"
  role          = var.lambda_role_arn
  handler       = "owner-api.lambdaHandler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 128

  source_code_hash = filebase64sha256("${path.module}/owner-api.zip")

  environment {
    variables = {
      PROJECT_NAME         = var.project_name
      ENVIRONMENT          = var.environment
      LOG_LEVEL            = "INFO"
      COGNITO_USER_POOL_ID = var.cognito_user_pool_id
      REGION               = var.aws_region
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    Component   = "api"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "owner_lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.owner_api.function_name}"
  retention_in_days = 7
}
