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

# Use existing LabRole IAM role
data "aws_iam_role" "lab_role" {
  name = "LabRole"
}

module "cognito" {
  source                 = "./modules/cognito"
  cognito_user_pool_name = var.cognito_user_pool_name
  api_url = module.api_gateway.api_url
}

# Lambda module
module "lambda" {
  source = "./modules/lambda"

  project_name    = var.project_name
  environment     = var.environment
  aws_region      = var.aws_region
  lambda_role_arn = data.aws_iam_role.lab_role.arn
  cognito_user_pool_id = module.cognito.user_pool_id
}

# API Gateway module
module "api_gateway" {
  source = "./modules/api-gateway"
  project_name           = var.project_name
  environment            = var.environment
  lambda_user_invoke_arn = module.lambda.lambda_user_invoke_arn
  lambda_user_function_name = module.lambda.lambda_function_user_name
  lambda_guest_invoke_arn = module.lambda.lambda_guest_invoke_arn
  lambda_guest_function_name = module.lambda.lambda_function_guest_name
  lambda_auth_invoke_arn      = module.lambda.lambda_auth_invoke_arn
  lambda_function_auth_name   = module.lambda.lambda_function_auth_name
  lambda_owner_invoke_arn     = module.lambda.lambda_owner_invoke_arn
  lambda_function_owner_name  = module.lambda.lambda_function_owner_name
  cognito_user_pool_arn  = module.cognito.cognito_user_pool_arn
}

module "auth_database" {
  source = "./modules/dynamodb"

  # Customize table names if needed
  auth_sessions_table_name            = "AuthSessions"
  user_security_questions_table_name  = "UserSecurityQuestions"
  user_cipher_keys_table_name         = "UserCipherKeys"

  billing_mode = "PAY_PER_REQUEST"
  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
