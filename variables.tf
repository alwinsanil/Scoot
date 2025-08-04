# Variables
variable "aws_region" {
  description = "AWS region for dalscooter deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "dalscooter"
}

variable "cognito_user_pool_name" {
  description = "Name of the Cognito User Pool for API authentication"
  type        = string
  default     = "DalscooterUserPool"  
}