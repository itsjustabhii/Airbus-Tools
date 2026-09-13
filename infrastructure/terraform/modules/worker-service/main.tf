###############################################################################
# Module: worker-service
#
# Creates:
#   - ECS task definition for the worker (no port mapping)
#   - ECS service using Fargate Spot (staging: Spot only, production: Spot + Fargate base 1)
#   - CloudWatch log group
#
# Worker connects to MongoDB and Redis via the same secrets/env as the API.
# Health check uses process liveness (kill -0 1) as defined in Dockerfile.worker.
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

variable "cluster_arn" {
  description = "ECS cluster ARN."
  type        = string
}

variable "cluster_name" {
  description = "ECS cluster name."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks."
  type        = list(string)
}

variable "sg_worker_id" {
  description = "Security group ID for worker ECS tasks."
  type        = string
}

variable "execution_role_arn" {
  description = "ECS task execution role ARN."
  type        = string
}

variable "task_role_arn" {
  description = "ECS task role ARN."
  type        = string
}

variable "worker_image" {
  description = "Full ECR image URI for the worker container."
  type        = string
}

variable "jwt_secret_arn" { type = string }
variable "cookie_secret_arn" { type = string }
variable "payment_webhook_secret_arn" { type = string }
variable "mongodb_uri_secret_arn" { type = string }
variable "redis_auth_token_secret_arn" { type = string }

variable "redis_url" {
  type      = string
  sensitive = true
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "uploads_bucket_name" {
  type = string
}

variable "ses_from_address" {
  type = string
}

variable "task_cpu" {
  type    = number
  default = 512
}

variable "task_memory" {
  type    = number
  default = 1024
}

variable "desired_count" {
  description = "Desired number of worker tasks."
  type        = number
  default     = 1
}

variable "tags" {
  type    = map(string)
  default = {}
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

  # Capacity provider strategy:
  #   staging    → Spot only (base 0, weight 1 on FARGATE_SPOT)
  #   production → base 1 on FARGATE, remainder on FARGATE_SPOT
  capacity_provider_strategy = var.environment == "production" ? [
    {
      capacity_provider = "FARGATE"
      base              = 1
      weight            = 1
    },
    {
      capacity_provider = "FARGATE_SPOT"
      base              = 0
      weight            = 3
    }
  ] : [
    {
      capacity_provider = "FARGATE_SPOT"
      base              = 0
      weight            = 1
    }
  ]
}

# ── CloudWatch log group ──────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.environment}/worker"
  retention_in_days = 30
  tags              = local.common_tags
}

# ── ECS task definition ───────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name_prefix}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = var.worker_image
      essential = true

      # No port mappings — worker consumes queues, no inbound HTTP

      environment = [
        { name = "NODE_ENV",         value = "production" },
        { name = "LOG_LEVEL",        value = "info" },
        { name = "AWS_REGION",       value = var.aws_region },
        { name = "AWS_S3_BUCKET",    value = var.uploads_bucket_name },
        { name = "SES_FROM_ADDRESS", value = var.ses_from_address },
        { name = "REDIS_URL",        value = var.redis_url },
        { name = "PAYMENT_PROVIDER", value = "mock" },
        { name = "JWT_EXPIRY",       value = "15m" },
      ]

      secrets = [
        {
          name      = "JWT_SECRET"
          valueFrom = var.jwt_secret_arn
        },
        {
          name      = "COOKIE_SECRET"
          valueFrom = var.cookie_secret_arn
        },
        {
          name      = "PAYMENT_WEBHOOK_SECRET"
          valueFrom = var.payment_webhook_secret_arn
        },
        {
          name      = "MONGODB_URI"
          valueFrom = var.mongodb_uri_secret_arn
        },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "worker"
        }
      }

      # Process liveness check — matches Dockerfile.worker HEALTHCHECK
      healthCheck = {
        command     = ["CMD-SHELL", "kill -0 1 || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])

  tags = local.common_tags
}

# ── ECS service ───────────────────────────────────────────────────────────────

resource "aws_ecs_service" "worker" {
  name            = "${local.name_prefix}-worker"
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.desired_count

  # No launch_type when using capacity_provider_strategy
  dynamic "capacity_provider_strategy" {
    for_each = local.capacity_provider_strategy
    content {
      capacity_provider = capacity_provider_strategy.value.capacity_provider
      base              = capacity_provider_strategy.value.base
      weight            = capacity_provider_strategy.value.weight
    }
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.sg_worker_id]
    assign_public_ip = false
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  force_new_deployment = true

  tags = local.common_tags
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "service_arn" {
  description = "ARN of the worker ECS service."
  value       = aws_ecs_service.worker.id
}

output "service_name" {
  description = "Name of the worker ECS service."
  value       = aws_ecs_service.worker.name
}
