variable "auth_sessions_table_name" {
  description = "Name of the AuthSessions table"
  type        = string
  default     = "AuthSessions"
}

variable "user_security_questions_table_name" {
  description = "Name of the UserSecurityQuestions table"
  type        = string
  default     = "UserSecurityQuestions"
}

variable "user_cipher_keys_table_name" {
  description = "Name of the UserCipherKeys table"
  type        = string
  default     = "UserCipherKeys"
}

variable "billing_mode" {
  description = "DynamoDB billing mode (PAY_PER_REQUEST or PROVISIONED)"
  type        = string
  default     = "PAY_PER_REQUEST"
}

variable "tags" {
  description = "Tags to apply to DynamoDB tables"
  type        = map(string)
  default     = {}
}