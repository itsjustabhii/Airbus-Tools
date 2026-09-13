###############################################################################
# Module: ses-identity
#
# Provisions SES domain identity with full deliverability setup:
#   - aws_ses_domain_identity for var.domain_name
#   - aws_ses_domain_dkim (3 DKIM CNAME records in Route 53)
#   - Verification TXT record in Route 53
#   - aws_ses_domain_mail_from (mail.<domain> subdomain)
#   - MX record for MAIL FROM subdomain
#   - SPF TXT record on MAIL FROM subdomain
#
# ⚠️  SES accounts start in sandbox mode.
#     Request production access via:
#     AWS Console → SES → Account Dashboard → Request production access
#     or via aws support create-case CLI.
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

variable "domain_name" {
  description = "Domain to verify for SES sending."
  type        = string
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID."
  type        = string
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "tags" {
  type    = map(string)
  default = {}
}

# ── Locals ────────────────────────────────────────────────────────────────────

locals {
  name_prefix      = "airbus-tools-${var.environment}"
  mail_from_domain = "mail.${var.domain_name}"

  common_tags = merge(
    {
      Project     = "airbus-tools"
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# ── SES domain identity ───────────────────────────────────────────────────────

resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

# ── SES domain verification TXT record ───────────────────────────────────────

resource "aws_route53_record" "ses_verification" {
  zone_id = var.route53_zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.main.verification_token]
}

resource "aws_ses_domain_identity_verification" "main" {
  domain = aws_ses_domain_identity.main.id

  depends_on = [aws_route53_record.ses_verification]
}

# ── SES DKIM ─────────────────────────────────────────────────────────────────

resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

resource "aws_route53_record" "ses_dkim" {
  count = 3

  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# ── MAIL FROM subdomain ───────────────────────────────────────────────────────

resource "aws_ses_domain_mail_from" "main" {
  domain           = aws_ses_domain_identity.main.domain
  mail_from_domain = local.mail_from_domain
}

# MX record for MAIL FROM subdomain
resource "aws_route53_record" "ses_mail_from_mx" {
  zone_id = var.route53_zone_id
  name    = local.mail_from_domain
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

# SPF TXT record on MAIL FROM subdomain
resource "aws_route53_record" "ses_mail_from_spf" {
  zone_id = var.route53_zone_id
  name    = local.mail_from_domain
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "ses_identity_arn" {
  description = "ARN of the SES domain identity (scope IAM ses:SendEmail to this)."
  value       = aws_ses_domain_identity.main.arn
}

output "domain_identity_arn" {
  description = "Alias for ses_identity_arn."
  value       = aws_ses_domain_identity.main.arn
}
