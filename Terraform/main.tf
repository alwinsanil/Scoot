# main.tf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Lambda execution role (replaces AWS Academy's LabRole for use on a real AWS account)
resource "aws_iam_role" "lambda_exec_role" {
  name = "${var.project_name}-lambda-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_role_policy_attachment" "lambda_sns" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSNSFullAccess"
}

resource "aws_iam_role_policy_attachment" "lambda_cognito" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonCognitoPowerUser"
}

module "cognito" {
  source                 = "./modules/cognito"
  cognito_user_pool_name = var.cognito_user_pool_name
  api_url                = module.api_gateway.api_url
}



# SNS Topic
module "sns" {
  source     = "./modules/sns"
  topic_name = "scoot-notifications"
}

# Lambda module
module "lambda" {
  source = "./modules/lambda"

  project_name          = var.project_name
  environment           = var.environment
  aws_region            = var.aws_region
  lambda_role_arn       = aws_iam_role.lambda_exec_role.arn
  cognito_user_pool_id  = module.cognito.user_pool_id
  cognito_client_id     = module.cognito.client_id
  cognito_client_secret = module.cognito.user_pool_client_secret
  cognito_domain        = module.cognito.user_pool_domain
  api_url               = module.api_gateway.api_url
  sns_arn               = module.sns.topic_arn
}

# API Gateway module
module "api_gateway" {
  source                     = "./modules/api-gateway"
  project_name               = var.project_name
  environment                = var.environment
  lambda_user_invoke_arn     = module.lambda.lambda_user_invoke_arn
  lambda_user_function_name  = module.lambda.lambda_function_user_name
  lambda_guest_invoke_arn    = module.lambda.lambda_guest_invoke_arn
  lambda_guest_function_name = module.lambda.lambda_function_guest_name
  lambda_auth_invoke_arn     = module.lambda.lambda_auth_invoke_arn
  lambda_function_auth_name  = module.lambda.lambda_function_auth_name
  lambda_owner_invoke_arn    = module.lambda.lambda_owner_invoke_arn
  lambda_function_owner_name = module.lambda.lambda_function_owner_name
  cognito_user_pool_arn      = module.cognito.cognito_user_pool_arn
}

module "auth_database" {
  source = "./modules/dynamodb"

  # Customize table names if needed
  auth_sessions_table_name           = "AuthSessions"
  user_security_questions_table_name = "UserSecurityQuestions"
  user_cipher_keys_table_name        = "UserCipherKeys"

  billing_mode = "PAY_PER_REQUEST"
  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

