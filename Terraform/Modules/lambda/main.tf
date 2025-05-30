# modules/lambda/main.tf

# Create deployment package
data "archive_file" "dalscooter_lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/dalscooter-api.zip"
  
  source {
    content = file("${path.module}../../../../Backend/Routes/dalscooter-api.js")
    filename = "dalscooter-api.js"
  }
}

# Lambda function
resource "aws_lambda_function" "dalscooter_api" {
  filename         = data.archive_file.dalscooter_lambda_zip.output_path
  function_name    = "${var.project_name}-${var.environment}-api"
  role             = var.lambda_role_arn
  handler          = "dalscooter-api.lambdaHandler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 128

  source_code_hash = data.archive_file.dalscooter_lambda_zip.output_base64sha256

  environment {
    variables = {
      PROJECT_NAME        = var.project_name
      ENVIRONMENT         = var.environment
      LOG_LEVEL           = "INFO"
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    Component   = "api"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "dalscooter_lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.dalscooter_api.function_name}"
  retention_in_days = 7 
}

