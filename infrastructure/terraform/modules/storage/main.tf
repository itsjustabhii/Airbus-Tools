###############################################################################
# Module: storage
#
# Creates the S3 bucket for user file uploads (AWS_S3_BUCKET env var).
#
#   - SSE-S3 encryption at rest
#   - All public access blocked
#   - Versioning enabled
#   - Bucket policy: TLS-only; task role allowed by IAM (no bucket-level allow needed)
#   - CORS for direct browser uploads (origin = CloudFront distribution)
#   - Lifecycle: abort incomplete multipart uploads after 7 days
###############################################################################

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ── Variables ─────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment (staging | production)."
  type        = string
}

variable "cloudfront_domain" {
  description = "CloudFront domain name used as CORS allowed origin (e.g. https://dxxxx.cloudfront.net)."
  type        = string
  default     = "*"
}

variable "tags" {
  description = "Additional tags."
  type        = map(string)
  default     = {}
}

# ── Locals ────────────────────────────────────────────────────────────────────

locals {
  name_prefix = "airbus-tools-${var.environment}"
  bucket_name = "${local.name_prefix}-uploads"

  common_tags = merge(
    {
      Project     = "airbus-tools"
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# ── S3 bucket ─────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "uploads" {
  bucket = local.bucket_name
  tags   = merge(local.common_tags, { Name = local.bucket_name })
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── Bucket policy — TLS-only ──────────────────────────────────────────────────

resource "aws_s3_bucket_policy" "uploads_tls_only" {
  bucket = aws_s3_bucket.uploads.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyNonTLS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*",
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.uploads]
}

# ── CORS ──────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = [
      "https://${var.cloudfront_domain}",
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# ── Lifecycle rule — abort incomplete multipart uploads ───────────────────────

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "bucket_name" {
  description = "Name of the uploads S3 bucket (inject as AWS_S3_BUCKET)."
  value       = aws_s3_bucket.uploads.id
}

output "bucket_arn" {
  description = "ARN of the uploads S3 bucket."
  value       = aws_s3_bucket.uploads.arn
}
