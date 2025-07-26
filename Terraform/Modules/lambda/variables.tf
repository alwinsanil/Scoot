variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
}
variable "lambda_role_arn" {
  type = string
}

variable "cognito_user_pool_id" {
  type = string
  
}
variable "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  type        = string
}
variable "cognito_client_secret" {
  description = "Cognito User Pool Client Secret"
  type        = string  
}

variable "cognito_domain" {
  description = "Cognito User Pool Domain"
  type        = string  
  
}

variable "api_url" {
  description = "API URL for the application"
  type        = string
  
}