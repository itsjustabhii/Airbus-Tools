###############################################################################
# Module: ecr
#
# Creates two ECR repositories:
#   - airbus-tools-api    (API image — apps/api/Dockerfile)
#   - airbus-tools-worker (Worker image — apps/api/Dockerfile.worker)
#
# Both have:
#   - Image scanning on push
#   - Lifecycle policy: keep last 10 tagged images; expire untagged after 1 day
#   - AES-256 encryption at rest
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

variable "tags" {
  description = "Additional tags."
  type        = map(string)
  default     = {}
}

# ── Locals ────────────────────────────────────────────────────────────────────

locals {
  common_tags = merge(
    {
      Project     = "airbus-tools"
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )

  repositories = {
    api    = "airbus-tools-api"
    worker = "airbus-tools-worker"
  }
}

# ── ECR repositories ──────────────────────────────────────────────────────────

resource "aws_ecr_repository" "repos" {
  for_each = local.repositories

  name                 = each.value
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(local.common_tags, { Name = each.value })
}

# ── Lifecycle policies ────────────────────────────────────────────────────────

resource "aws_ecr_lifecycle_policy" "repos" {
  for_each   = aws_ecr_repository.repos
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep last 10 tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "sha-", "latest"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      }
    ]
  })
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "api_repository_url" {
  description = "ECR URL for the API image."
  value       = aws_ecr_repository.repos["api"].repository_url
}

output "worker_repository_url" {
  description = "ECR URL for the worker image."
  value       = aws_ecr_repository.repos["worker"].repository_url
}

output "api_repository_arn" {
  description = "ARN of the API ECR repository."
  value       = aws_ecr_repository.repos["api"].arn
}

output "worker_repository_arn" {
  description = "ARN of the worker ECR repository."
  value       = aws_ecr_repository.repos["worker"].arn
}

output "repository_arns" {
  description = "List of all ECR repository ARNs (pass to IAM execution role)."
  value = [
    aws_ecr_repository.repos["api"].arn,
    aws_ecr_repository.repos["worker"].arn,
  ]
}
