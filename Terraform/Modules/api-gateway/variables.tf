variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "lambda_auth_invoke_arn" {
  description = "ARN to invoke the auth Lambda function"
  type        = string
}

variable "lambda_function_auth_name" {
  description = "Name of the auth Lambda function"
  type        = string
}

variable "lambda_guest_invoke_arn" {
  description = "ARN to invoke the guest API Lambda function"
  type        = string  
}

variable "lambda_guest_function_name" {
  description = "Name of the guest API Lambda function"
  type        = string  
  
}

variable "lambda_user_invoke_arn" {
  description = "ARN to invoke the user API Lambda function"
  type        = string    
  
}

variable "lambda_owner_invoke_arn" {
  description = "ARN to invoke the owner API Lambda function"
  type        = string      
  
}

variable "lambda_function_owner_name" {
  description = "Name of the owner API Lambda function"
  type        = string    
  
}

variable "lambda_user_function_name" {
  description = "Name of the user API Lambda function"
  type        = string    
  
}
variable "cognito_user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  type        = string
}

