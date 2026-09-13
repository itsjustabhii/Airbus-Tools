###############################################################################
# Module: secrets
#
# Creates AWS Secrets Manager secret *resources* for all runtime secrets.
# Values are populated:
#   - Automatically: redis_auth_token (random_password), mongodb_uri (Atlas module)
#   - Manually:      jwt_secret, cookie_secret, payment_webhook_secret
#
# Terraform manages the ARN lifecycle only; secret values are never stored
# in Terraform source or state (lifecycle ignore_changes on secret_string).
###############################################################################

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

# ── Variables ─────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment (staging | production)."
  type        = string
}

variable "tags" {
  description = "Additional tags."
  type        = map(string)
  default     = {}
}

# ── Locals ────────────────────────────────────────────────────────────────────

locals {
  name_prefix = "airbus-tools-${var.environment}"
  secret_path = "airbus-tools/${var.environment}"

  common_tags = merge(
    {
      Project     = "airbus-tools"
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# ── Helper: generated Redis auth token ───────────────────────────────────────

resource "random_password" "redis_auth_token" {
  length           = 32
  special          = true
  override_special = "!&#$^<>-"   # characters safe for Redis auth tokens
}

# ── Secret resources ──────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${local.secret_path}/jwt-secret"
  description             = "JWT signing secret for ${var.environment} API."
  recovery_window_in_days = 7

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-jwt-secret" })
}

resource "aws_secretsmanager_secret" "cookie_secret" {
  name                    = "${local.secret_path}/cookie-secret"
  description             = "Cookie signing secret for ${var.environment} API."
  recovery_window_in_days = 7

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-cookie-secret" })
}

resource "aws_secretsmanager_secret" "payment_webhook_secret" {
  name                    = "${local.secret_path}/payment-webhook-secret"
  description             = "Payment webhook signing secret for ${var.environment}."
  recovery_window_in_days = 7

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-payment-webhook-secret" })
}

# MongoDB URI — value written by the Atlas module via aws_secretsmanager_secret_version.
# The secret resource is created here so the ARN is available to IAM before Atlas runs.
resource "aws_secretsmanager_secret" "mongodb_uri" {
  name                    = "${local.secret_path}/mongodb-uri"
  description             = "MongoDB Atlas connection string for ${var.environment}."
  recovery_window_in_days = 7

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-mongodb-uri" })
}

# Redis auth token — value written here directly (generated above).
resource "aws_secretsmanager_secret" "redis_auth_token" {
  name                    = "${local.secret_path}/redis-auth-token"
  description             = "ElastiCache Redis auth token for ${var.environment}."
  recovery_window_in_days = 7

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-redis-auth-token" })
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id     = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = random_password.redis_auth_token.result

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "jwt_secret_arn" {
  description = "ARN of the JWT secret."
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "cookie_secret_arn" {
  description = "ARN of the cookie secret."
  value       = aws_secretsmanager_secret.cookie_secret.arn
}

output "payment_webhook_secret_arn" {
  description = "ARN of the payment webhook secret."
  value       = aws_secretsmanager_secret.payment_webhook_secret.arn
}

output "mongodb_uri_secret_arn" {
  description = "ARN of the MongoDB URI secret (value written by the Atlas module)."
  value       = aws_secretsmanager_secret.mongodb_uri.arn
}

output "redis_auth_token_secret_arn" {
  description = "ARN of the Redis auth token secret."
  value       = aws_secretsmanager_secret.redis_auth_token.arn
}

output "redis_auth_token_value" {
  description = "Plaintext Redis auth token (used by ElastiCache module to configure the replication group)."
  value       = random_password.redis_auth_token.result
  sensitive   = true
}

output "all_secret_arns" {
  description = "All secret ARNs — pass to IAM execution role."
  value = [
    aws_secretsmanager_secret.jwt_secret.arn,
    aws_secretsmanager_secret.cookie_secret.arn,
    aws_secretsmanager_secret.payment_webhook_secret.arn,
    aws_secretsmanager_secret.mongodb_uri.arn,
    aws_secretsmanager_secret.redis_auth_token.arn,
  ]
}
