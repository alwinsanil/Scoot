

output "dynamodb_table" {
  value = aws_dynamodb_table.concern_logs.name
}

output "lambda_name" {
  value = aws_lambda_function.message_handler.function_name
}
