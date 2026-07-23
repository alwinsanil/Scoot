

# AWS Cognito User Pool
// cognito/main.tf
resource "aws_cognito_user_pool" "scoot" {
  name = var.cognito_user_pool_name

  # Password policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # User attributes
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "phone_number"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 0
      max_length = 256
    }
  }

  schema {
    name                = "gender"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 0
      max_length = 256
    }
  }

  # Email configuration
  auto_verified_attributes = ["email"]
  
  username_attributes = ["email"]
  
  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email verification message
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your verification code"
    email_message        = "Your verification code is {####}"
  }

  tags = {
    Name        = "ScootUserPool"
    Environment = "development"
  }
}

# AWS Cognito User Pool Client
resource "aws_cognito_user_pool_client" "client" {
  name         = "ScootAppClient"
  user_pool_id = aws_cognito_user_pool.scoot.id

  # App client settings
  generate_secret = true
  
  # OAuth settings
  callback_urls = [
    "${var.api_url}/auth/callback",
    "https://main.d1c997xz3yo4ro.amplifyapp.com",
    "https://main.d1c997xz3yo4ro.amplifyapp.com/auth/callback"
  ]
  logout_urls   = [
    "http://localhost:5173",
    "https://main.d1c997xz3yo4ro.amplifyapp.com"
  ]
  default_redirect_uri = "${var.api_url}/auth/callback"
  
  allowed_oauth_flows = ["code"]
  allowed_oauth_scopes = ["email", "openid", "profile"]
  allowed_oauth_flows_user_pool_client = true
  
  supported_identity_providers = ["COGNITO"]

  # Explicit auth flows
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # Read and write attributes
  read_attributes = [
    "email",
    "email_verified",
    "name",
    "phone_number",
    "gender"
  ]

  write_attributes = [
    "email",
    "name",
    "phone_number",
    "gender"
  ]

  # Token validity
  access_token_validity  = 60    # 1 hour
  id_token_validity     = 60    # 1 hour
  refresh_token_validity = 30   # 30 days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Prevent user existence errors
  prevent_user_existence_errors = "ENABLED"
}

# Random suffix for domain uniqueness
resource "random_integer" "domain_suffix" {
  min = 10000
  max = 99999
}

# User Pool Domain
resource "aws_cognito_user_pool_domain" "domain" {
  domain       = "scoot-auth-${random_integer.domain_suffix.result}"
  user_pool_id = aws_cognito_user_pool.scoot.id
}

# ========================================
# COGNITO GROUPS FOR ROLE-BASED ACCESS
# NOTE: Correct resource type is aws_cognito_user_group (NOT aws_cognito_user_pool_group)
# ========================================

# Users Group - Standard app users
resource "aws_cognito_user_group" "users" {
  name         = "users"
  user_pool_id = aws_cognito_user_pool.scoot.id
  description  = "Standard users who can rent scooters"
  precedence   = 10  # Lower precedence (higher number)
}

# Owners Group - Scooter owners who can list their scooters
resource "aws_cognito_user_group" "owners" {
  name         = "owners"
  user_pool_id = aws_cognito_user_pool.scoot.id
  description  = "Scooter owners who can list and manage their scooters"
  precedence   = 5   # Higher precedence (lower number)
}

# Admins Group - System administrators (optional)
resource "aws_cognito_user_group" "admins" {
  name         = "admins"
  user_pool_id = aws_cognito_user_pool.scoot.id
  description  = "System administrators with full access"
  precedence   = 1   # Highest precedence (lowest number)
}