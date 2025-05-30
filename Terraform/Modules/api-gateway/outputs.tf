output "api_url" {
  description = "Dalscooter API Gateway base URL"
  value       = "https://${aws_api_gateway_rest_api.dalscooter_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
}

output "api_id" {
  description = "Dalscooter API Gateway ID"
  value       = aws_api_gateway_rest_api.dalscooter_api.id
}

output "stage_name" {
  description = "Deployment stage name"
  value       = var.environment
}

output "cognito_authorizer_id" {
  description = "ID of the Cognito authorizer"
  value       = aws_api_gateway_authorizer.cognito.id
}

output "guest_resource_path" {
  description = "Path to guest endpoints"
  value       = "/guest/{proxy+}"
}

output "user_resource_path" {
  description = "Path to authenticated user endpoints"
  value       = "/user/{proxy+}"
}

output "execution_arn" {
  description = "API Gateway execution ARN"
  value       = aws_api_gateway_rest_api.dalscooter_api.execution_arn
}