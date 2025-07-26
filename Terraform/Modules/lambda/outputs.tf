output "lambda_function_guest_name" {
  value = aws_lambda_function.guest_api.function_name
}
output "lambda_function_user_name" {
  value = aws_lambda_function.user_api.function_name
}

output "lambda_guest_invoke_arn" {
  value = aws_lambda_function.guest_api.invoke_arn
}

output "lambda_user_invoke_arn" {
  value = aws_lambda_function.user_api.invoke_arn
}

output "lambda_function_auth_name" {
  value = aws_lambda_function.auth_api.function_name
  
}

output "lambda_auth_invoke_arn" {
  value = aws_lambda_function.auth_api.invoke_arn 
  
}
output "lambda_owner_invoke_arn" {
  value = aws_lambda_function.owner_api.invoke_arn
}

output "lambda_function_owner_name" {
  value = aws_lambda_function.owner_api.function_name
}