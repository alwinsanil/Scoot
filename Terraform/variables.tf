# Variables
variable "aws_region" {
  description = "AWS region for scoot deployment"
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
  default     = "scoot"
}

variable "cognito_user_pool_name" {
  description = "Name of the Cognito User Pool for API authentication"
  type        = string
  default     = "ScootUserPool"  
}