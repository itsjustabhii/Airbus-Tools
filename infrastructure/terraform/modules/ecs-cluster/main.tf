###############################################################################
# Module: ecs-cluster
#
# Creates:
#   - ECS cluster with Container Insights enabled
#   - FARGATE and FARGATE_SPOT capacity providers
#   - Default capacity provider strategy: base 1 on FARGATE, remainder on FARGATE_SPOT
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

# ── ECS cluster ───────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = local.name_prefix

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(local.common_tags, { Name = local.name_prefix })
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    base              = 1
    weight            = 1
  }

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    base              = 0
    weight            = 3
  }
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "cluster_arn" {
  description = "ARN of the ECS cluster."
  value       = aws_ecs_cluster.main.arn
}

output "cluster_name" {
  description = "Name of the ECS cluster."
  value       = aws_ecs_cluster.main.name
}
