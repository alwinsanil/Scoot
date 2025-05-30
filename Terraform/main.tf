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
}

# Lambda module
module "lambda" {
  source = "./modules/lambda"

  project_name    = var.project_name
  environment     = var.environment
  lambda_role_arn = data.aws_iam_role.lab_role.arn
}

# API Gateway module
module "api_gateway" {
  source = "./modules/api-gateway"
  project_name           = var.project_name
  environment            = var.environment
  lambda_invoke_arn      = module.lambda.lambda_invoke_arn
  lambda_function_name   = module.lambda.lambda_function_name
  cognito_user_pool_arn  = module.cognito.cognito_user_pool_arn
}

