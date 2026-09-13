###############################################################################
# Module: dns-acm
#
# Creates:
#   - Route 53 public hosted zone for var.domain_name
#   - ACM certificate (regional, us-east-1) for api.<domain>  → ALB
#   - ACM certificate (us-east-1 alias provider) for app.<domain> → CloudFront
#   - DNS validation records for both certs in the hosted zone
#
# ⚠️  TWO-STEP APPLY — no domain registrar delegation yet:
#
#   Step 1:  terraform apply  (creates zone, outputs NS records, starts cert validation)
#   Step 2:  Set the four NS records at your domain registrar
#   Step 3:  terraform apply  (ACM validation completes, certs reach ISSUED state)
#
# The aws_acm_certificate_validation resource will block apply until certs are
# ISSUED. Do NOT skip NS delegation between step 1 and step 3.
###############################################################################

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ── Provider aliases ──────────────────────────────────────────────────────────
# Both default and alias point to us-east-1 (this project's primary region),
# but the alias is kept explicit so that if the primary region ever changes,
# the CloudFront cert continues to be issued in us-east-1 as required.

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ── Variables ─────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment (staging | production)."
  type        = string
}

variable "domain_name" {
  description = "Base domain name (e.g. airbus-tools.example.com). Must be supplied — no default."
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

  common_tags = merge(
    {
      Project     = "airbus-tools"
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# ── Route 53 hosted zone ──────────────────────────────────────────────────────

resource "aws_route53_zone" "main" {
  name    = var.domain_name
  comment = "Airbus-Tools ${var.environment} hosted zone — managed by Terraform"

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-zone" })
}

# ── ACM: regional certificate (for ALB) ──────────────────────────────────────

resource "aws_acm_certificate" "api" {
  domain_name               = "api.${var.domain_name}"
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-cert-api" })
}

resource "aws_route53_record" "api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for record in aws_route53_record.api_cert_validation : record.fqdn]
}

# ── ACM: us-east-1 certificate (for CloudFront) ───────────────────────────────

resource "aws_acm_certificate" "cloudfront" {
  provider = aws.us_east_1

  domain_name               = "app.${var.domain_name}"
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-cert-cf" })
}

resource "aws_route53_record" "cloudfront_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.cloudfront.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

resource "aws_acm_certificate_validation" "cloudfront" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.cloudfront.arn
  validation_record_fqdns = [for record in aws_route53_record.cloudfront_cert_validation : record.fqdn]
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "zone_id" {
  description = "Route 53 hosted zone ID."
  value       = aws_route53_zone.main.zone_id
}

output "zone_name_servers" {
  description = "NS records to enter at your domain registrar (required before ACM validation succeeds)."
  value       = aws_route53_zone.main.name_servers
}

output "api_certificate_arn" {
  description = "ARN of the regional ACM cert for the ALB."
  value       = aws_acm_certificate_validation.api.certificate_arn
}

output "cloudfront_certificate_arn" {
  description = "ARN of the us-east-1 ACM cert for CloudFront."
  value       = aws_acm_certificate_validation.cloudfront.certificate_arn
}
