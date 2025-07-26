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