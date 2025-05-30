# Outputs
output "dalscooter_api_url" {
  description = "Dalscooter API Gateway URL"
  value       = module.api_gateway.api_url
}

output "dalscooter_lambda_name" {
  description = "Dalscooter Lambda function name"
  value       = module.lambda.lambda_function_name
}

output "dalscooter_api_id" {
  description = "Dalscooter API Gateway ID"
  value       = module.api_gateway.api_id
}

output "login_url" {
  value = module.cognito.login_url
}

output "user_pool_id" {
  value = module.cognito.user_pool_id
}

output "client_id" {
  value = module.cognito.client_id
}