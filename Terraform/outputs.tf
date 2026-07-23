# Outputs
output "scoot_api_url" {
  description = "Scoot API Gateway URL"
  value       = module.api_gateway.api_url
}

output "scoot_api_id" {
  description = "Scoot API Gateway ID"
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
output "user_pool_client_secret" {
  value = module.cognito.user_pool_client_secret
  sensitive   = true
}

# Outputs
output "topic_arn" {
  value = module.sns.topic_arn
}

output "topic_name" {
  value = module.sns.topic_name
}