
output "user_pool_id" {
  description = "The ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.scoot.id
}

output "client_id" {
  description = "The ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.client.id
}

output "user_pool_client_secret" {
  description = "The secret of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.client.client_secret
  sensitive   = true
}

output "user_pool_domain" {
  description = "The domain of the Cognito User Pool"
  value       = aws_cognito_user_pool_domain.domain.domain
}

output "login_url" {
  description = "The login URL for the Cognito User Pool"
  value       = "https://${aws_cognito_user_pool_domain.domain.domain}.auth.us-east-1.amazoncognito.com/login?client_id=${aws_cognito_user_pool_client.client.id}&response_type=code&scope=email+openid+profile&redirect_uri=${var.api_url}/auth/callback"
}

output "cognito_user_pool_arn" {
  description = "The ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.scoot.arn
}

output "cognito_user_pool_name" {
  description = "The name of the Cognito User Pool"
  value       = aws_cognito_user_pool.scoot.name
}

output "user_pool_domain_cloudfront_distribution_arn" {
  description = "The ARN of the CloudFront distribution for the domain"
  value       = aws_cognito_user_pool_domain.domain.cloudfront_distribution_arn
}

output "cognito_groups" {
  description = "List of Cognito groups created"
  value = {
    users  = aws_cognito_user_group.users.name
    owners = aws_cognito_user_group.owners.name
    admins = aws_cognito_user_group.admins.name
  }
}