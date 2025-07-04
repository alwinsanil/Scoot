output "auth_sessions_table_arn" {
  description = "ARN of the AuthSessions table"
  value       = aws_dynamodb_table.auth_sessions.arn
}

output "user_security_questions_table_arn" {
  description = "ARN of the UserSecurityQuestions table"
  value       = aws_dynamodb_table.user_security_questions.arn
}

output "user_cipher_keys_table_arn" {
  description = "ARN of the UserCipherKeys table"
  value       = aws_dynamodb_table.user_cipher_keys.arn
}

output "auth_sessions_table_name" {
  description = "Name of the AuthSessions table"
  value       = aws_dynamodb_table.auth_sessions.name
}

output "user_security_questions_table_name" {
  description = "Name of the UserSecurityQuestions table"
  value       = aws_dynamodb_table.user_security_questions.name
}

output "user_cipher_keys_table_name" {
  description = "Name of the UserCipherKeys table"
  value       = aws_dynamodb_table.user_cipher_keys.name
}