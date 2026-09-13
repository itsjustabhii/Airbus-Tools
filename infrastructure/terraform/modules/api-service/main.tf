###############################################################################
# Module: api-service
#
# Creates:
#   - Application Load Balancer (public subnets, sg-alb)
#   - ALB target group with health check on GET /health
#   - HTTP 80 → HTTPS 443 redirect listener
#   - HTTPS 443 listener with ACM certificate → target group
#   - ECS task definition (port 3000, secrets injected from Secrets Manager)
#   - ECS service (private subnets, sg-api, rolling update)
#   - Application Autoscaling on CPU and memory
#   - Route 53 A alias: api.<domain> → ALB
#   - CloudWatch log group
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

variable "vpc_id" {
  description = "VPC ID."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB."
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks."
  type        = list(string)
}

variable "sg_alb_id" {
  description = "Security group ID for the ALB."
  type        = string
}

variable "sg_api_id" {
  description = "Security group ID for the API ECS tasks."
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

variable "api_image" {
  description = "Full ECR image URI for the API container (e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/airbus-tools-api:latest)."
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for the HTTPS listener."
  type        = string
}

variable "domain_name" {
  description = "Base domain name."
  type        = string
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID."
  type        = string
}

# ── Secret ARNs injected as task definition secrets[] ────────────────────────

variable "jwt_secret_arn" { type = string }
variable "cookie_secret_arn" { type = string }
variable "payment_webhook_secret_arn" { type = string }
variable "mongodb_uri_secret_arn" { type = string }
variable "redis_auth_token_secret_arn" { type = string }

# ── Non-secret environment variables ─────────────────────────────────────────

variable "redis_url" {
  description = "Full REDIS_URL (rediss://) — sensitive but not a Secrets Manager secret."
  type        = string
  sensitive   = true
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "uploads_bucket_name" {
  description = "Name of the S3 uploads bucket (AWS_S3_BUCKET)."
  type        = string
}

variable "ses_from_address" {
  description = "SES verified from address."
  type        = string
}

variable "cors_origin" {
  description = "CORS_ORIGIN value — typically the CloudFront app URL."
  type        = string
}

# ── Sizing per environment ────────────────────────────────────────────────────

variable "task_cpu" {
  description = "Task CPU units (512 = staging, 1024 = production)."
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Task memory in MB (1024 = staging, 2048 = production)."
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired number of running tasks (1 = staging, 2 = production)."
  type        = number
  default     = 1
}

variable "autoscaling_min" {
  description = "Minimum number of tasks for autoscaling."
  type        = number
  default     = 1
}

variable "autoscaling_max" {
  description = "Maximum number of tasks for autoscaling."
  type        = number
  default     = 4
}

variable "tags" {
  type    = map(string)
  default = {}
}

# ── Locals ────────────────────────────────────────────────────────────────────

locals {
  name_prefix = "airbus-tools-${var.environment}"
  api_domain  = "api.${var.domain_name}"

  common_tags = merge(
    {
      Project     = "airbus-tools"
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# ── CloudWatch log group ──────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.environment}/api"
  retention_in_days = 30
  tags              = local.common_tags
}

# ── Application Load Balancer ─────────────────────────────────────────────────

resource "aws_lb" "api" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.sg_alb_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.environment == "production" ? true : false

  access_logs {
    bucket  = ""   # set in environment root if S3 ALB logging is desired
    enabled = false
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-alb" })
}

# ── Target group ──────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "api" {
  name        = "${local.name_prefix}-api-tg"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    port                = "traffic-port"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-api-tg" })
}

# ── HTTP → HTTPS redirect listener ────────────────────────────────────────────

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ── HTTPS listener ────────────────────────────────────────────────────────────

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ── Route 53 alias: api.<domain> → ALB ───────────────────────────────────────

resource "aws_route53_record" "api" {
  zone_id = var.route53_zone_id
  name    = local.api_domain
  type    = "A"

  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}

# ── ECS task definition ───────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.api_image
      essential = true

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV",          value = "production" },
        { name = "PORT",              value = "3000" },
        { name = "HOST",              value = "0.0.0.0" },
        { name = "API_PREFIX",        value = "/api/v1" },
        { name = "LOG_LEVEL",         value = "info" },
        { name = "AWS_REGION",        value = var.aws_region },
        { name = "AWS_S3_BUCKET",     value = var.uploads_bucket_name },
        { name = "SES_FROM_ADDRESS",  value = var.ses_from_address },
        { name = "CORS_ORIGIN",       value = var.cors_origin },
        { name = "REDIS_URL",         value = var.redis_url },
        { name = "PAYMENT_PROVIDER",  value = "mock" },
        { name = "JWT_EXPIRY",        value = "15m" },
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
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = local.common_tags
}

# ── ECS service ───────────────────────────────────────────────────────────────

resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api"
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count

  launch_type = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.sg_api_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  health_check_grace_period_seconds = 60

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  # Force new deployment when task definition changes
  force_new_deployment = true

  tags = local.common_tags

  depends_on = [aws_lb_listener.https]
}

# ── Application Autoscaling ───────────────────────────────────────────────────

resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.autoscaling_max
  min_capacity       = var.autoscaling_min
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${local.name_prefix}-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_policy" "api_memory" {
  name               = "${local.name_prefix}-api-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "alb_dns_name" {
  description = "ALB DNS name (used by CloudFront API origin and Route 53)."
  value       = aws_lb.api.dns_name
}

output "alb_arn" {
  description = "ALB ARN."
  value       = aws_lb.api.arn
}

output "alb_arn_suffix" {
  description = "ALB ARN suffix for CloudWatch metrics."
  value       = aws_lb.api.arn_suffix
}

output "target_group_arn_suffix" {
  description = "Target group ARN suffix for CloudWatch metrics."
  value       = aws_lb_target_group.api.arn_suffix
}

output "api_url" {
  description = "Public API URL."
  value       = "https://${local.api_domain}"
}

output "service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.api.name
}
