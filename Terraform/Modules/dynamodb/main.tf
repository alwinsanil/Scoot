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

resource "aws_dynamodb_table" "franchise_vehicles" {
  name         = "franchise-vehicles"
  billing_mode = var.billing_mode
  hash_key     = "vehicleId"
  range_key    = "ownerId"

  attribute {
    name = "vehicleId"
    type = "S"
  }

  attribute {
    name = "ownerId"
    type = "S"
  }

  # Global Secondary Index for querying by ownerId
  global_secondary_index {
    name            = "ownerId-index"
    hash_key        = "ownerId"
    projection_type = "ALL"
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "vehicle_reservations" {
  name         = "vehicle-reservations"
  billing_mode = var.billing_mode
  hash_key     = "reservationId"
  range_key    = "userId"

  attribute {
    name = "reservationId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "vehicleId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "startDate"
    type = "S"
  }

  # Global Secondary Index for querying reservations by userId
  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  # Global Secondary Index for querying reservations by vehicleId
  global_secondary_index {
    name            = "vehicleId-index"
    hash_key        = "vehicleId"
    projection_type = "ALL"
  }

  # Global Secondary Index for querying reservations by status
  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    range_key       = "startDate"
    projection_type = "ALL"
  }

  # Global Secondary Index for querying reservations by vehicleId and status (for conflict checking)
  global_secondary_index {
    name            = "vehicleId-status-index"
    hash_key        = "vehicleId"
    range_key       = "status"
    projection_type = "ALL"
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "vehicle_feedback" {
  name         = "vehicle-feedback"
  billing_mode = var.billing_mode
  hash_key     = "feedbackId"
  range_key    = "userId"

  attribute {
    name = "feedbackId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "reservationId"
    type = "S"
  }

  attribute {
    name = "vehicleId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "rating"
    type = "N"
  }

  attribute {
    name = "vehicleType"
    type = "S"
  }

  # Global Secondary Index for querying feedback by userId
  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # Global Secondary Index for querying feedback by reservationId (to check if feedback exists)
  global_secondary_index {
    name            = "reservationId-index"
    hash_key        = "reservationId"
    projection_type = "ALL"
  }

  # Global Secondary Index for querying feedback by vehicleId (for vehicle analytics)
  global_secondary_index {
    name            = "vehicleId-index"
    hash_key        = "vehicleId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # Global Secondary Index for querying feedback by rating (for analytics)
  global_secondary_index {
    name            = "rating-index"
    hash_key        = "rating"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # Global Secondary Index for querying feedback by vehicle type (for vehicle type analytics)
  global_secondary_index {
    name            = "vehicleType-index"
    hash_key        = "vehicleType"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  tags = var.tags
}