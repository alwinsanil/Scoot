output "user_pool_id" {
  value = aws_cognito_user_pool.dalscooter.id
}

output "client_id" {
  value = aws_cognito_user_pool_client.client.id
}

output "login_url" {
  value = "https://${aws_cognito_user_pool_domain.domain.domain}.auth.us-east-1.amazoncognito.com/login?client_id=${aws_cognito_user_pool_client.client.id}&response_type=code&scope=email+openid+profile&redirect_uri=http://localhost:3000/callback"
}

output "cognito_user_pool_arn" {
  value = aws_cognito_user_pool.dalscooter.arn
}

output "cognito_user_pool_name" {
  value = aws_cognito_user_pool.dalscooter.name
}