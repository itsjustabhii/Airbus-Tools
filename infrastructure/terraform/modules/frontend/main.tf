###############################################################################
# Module: frontend
#
# Hosts the React SPA (apps/web/dist) via:
#   - Private S3 bucket (all public access blocked)
#   - CloudFront Origin Access Control (OAC) — only CloudFront can read bucket
#   - CloudFront distribution:
#       • Default origin: S3 web bucket (OAC)
#       • Ordered behaviour: /api/* → ALB origin (forwarded, cache disabled)
#       • HTTPS redirect, compression, ACM certificate
#       • Custom error responses: 403/404 → /index.html (SPA routing)
#   - Route 53 A alias record: app.<domain> → CloudFront
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

variable "acm_certificate_arn" {
  description = "ACM certificate ARN (must be in us-east-1) for the CloudFront distribution."
  type        = string
}

variable "alb_dns_name" {
  description = "DNS name of the Application Load Balancer (API origin for /api/* behaviour)."
  type        = string
}

variable "domain_name" {
  description = "Base domain name (e.g. airbus-tools.example.com)."
  type        = string
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID."
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
  bucket_name = "${local.name_prefix}-web"
  app_domain  = "app.${var.domain_name}"

  common_tags = merge(
    {
      Project     = "airbus-tools"
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# ── S3 web bucket ─────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "web" {
  bucket = local.bucket_name
  tags   = merge(local.common_tags, { Name = local.bucket_name })
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "web" {
  bucket = aws_s3_bucket.web.id
  versioning_configuration { status = "Enabled" }
}

# ── CloudFront Origin Access Control ─────────────────────────────────────────

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${local.name_prefix}-oac"
  description                       = "OAC for ${local.name_prefix} web bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ── S3 bucket policy — allow CloudFront OAC only ─────────────────────────────

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.web.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.web.arn
          }
        }
      },
      {
        Sid       = "DenyNonTLS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.web.arn,
          "${aws_s3_bucket.web.arn}/*",
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      }
    ]
  })

  depends_on = [
    aws_s3_bucket_public_access_block.web,
    aws_cloudfront_distribution.web,
  ]
}

# ── CloudFront distribution ───────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = [local.app_domain]
  price_class         = "PriceClass_100"  # US/Canada/Europe only

  comment = "Airbus-Tools ${var.environment} SPA"

  # ── Origin: S3 (SPA assets) ────────────────────────────────────────────────
  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "S3-${local.bucket_name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  # ── Origin: ALB (API) ──────────────────────────────────────────────────────
  origin {
    domain_name = var.alb_dns_name
    origin_id   = "ALB-api"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # ── Default cache behaviour: S3 SPA ───────────────────────────────────────
  default_cache_behavior {
    target_origin_id       = "S3-${local.bucket_name}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 86400   # 1 day
    max_ttl     = 31536000 # 1 year
  }

  # ── Ordered behaviour: /api/* → ALB ───────────────────────────────────────
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "ALB-api"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Accept", "Origin"]
      cookies { forward = "all" }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # ── Custom error responses for SPA routing ────────────────────────────────
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  # ── TLS certificate ────────────────────────────────────────────────────────
  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-cf" })
}

# ── Route 53 alias: app.<domain> → CloudFront ─────────────────────────────────

resource "aws_route53_record" "app" {
  zone_id = var.route53_zone_id
  name    = local.app_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "cloudfront_domain" {
  description = "CloudFront distribution domain name."
  value       = aws_cloudfront_distribution.web.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (used for cache invalidation in CI)."
  value       = aws_cloudfront_distribution.web.id
}

output "web_bucket_name" {
  description = "Name of the S3 web bucket (sync build artifacts here in CI)."
  value       = aws_s3_bucket.web.id
}

output "app_url" {
  description = "Public URL of the React SPA."
  value       = "https://${local.app_domain}"
}
