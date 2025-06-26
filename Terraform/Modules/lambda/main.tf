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
      COGNITO_CLIENT_ID     = "5bc52eofgvj1latldpn713d0g7"
      COGNITO_CLIENT_SECRET = "1ivrasn4f1sqhq0inifk6q28dof0buu1vq7ls8a2o40eh499uml2"
      COGNITO_DOMAIN        = "dalscooter-auth-16840.auth.us-east-1.amazoncognito.com"
      REDIRECT_URI          = "http://localhost:5173/auth/callback"
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
# Create deployment package
data "archive_file" "guest_lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/guest-api.zip"

  source {
    content  = file("${path.module}../../../../Backend/Routes/guest-api.js")
    filename = "guest-api.js"
  }
}

# Lambda function
resource "aws_lambda_function" "guest_api" {
  filename      = data.archive_file.guest_lambda_zip.output_path
  function_name = "${var.project_name}-${var.environment}-guest-api"
  role          = var.lambda_role_arn
  handler       = "guest-api.lambdaHandler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 128

  source_code_hash = data.archive_file.guest_lambda_zip.output_base64sha256

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
# Create deployment package
data "archive_file" "user_lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/user-api.zip"

  source {
    content  = file("${path.module}../../../../Backend/Routes/user-api.js")
    filename = "user-api.js"
  }
}

# Lambda function
resource "aws_lambda_function" "user_api" {
  filename      = data.archive_file.user_lambda_zip.output_path
  function_name = "${var.project_name}-${var.environment}-user-api"
  role          = var.lambda_role_arn
  handler       = "user-api.lambdaHandler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 128

  source_code_hash = data.archive_file.user_lambda_zip.output_base64sha256

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
resource "aws_cloudwatch_log_group" "user_lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.user_api.function_name}"
  retention_in_days = 7
}

