resource "aws_dynamodb_table" "auth_sessions" {
  name         = var.auth_sessions_table_name
  billing_mode = var.billing_mode
  hash_key     = "tempToken"

  attribute {
    name = "tempToken"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "user_security_questions" {
  name         = var.user_security_questions_table_name
  billing_mode = var.billing_mode
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "user_cipher_keys" {
  name         = var.user_cipher_keys_table_name
  billing_mode = var.billing_mode
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  tags = var.tags
}