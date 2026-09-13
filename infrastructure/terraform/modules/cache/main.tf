###############################################################################
# Module: cache
#
# Creates an ElastiCache Redis replication group with:
#   - TLS in-transit (rediss://) — matches parseRedisUrl() in jobs/redis.ts
#   - Encryption at rest
#   - Auth token from Secrets Manager
#   - Dedicated subnet group in private subnets
#   - Single shard, 0 replicas (staging) or 1 replica (production)
#
# REDIS_URL injected into ECS tasks:
#   rediss://:{auth_token}@{primary_endpoint}:6380
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

variable "private_subnet_ids" {
  description = "IDs of the private subnets for the ElastiCache subnet group."
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for the Redis replication group."
  type        = string
}

variable "auth_token" {
  description = "Auth token for Redis (pass the random_password value from secrets module)."
  type        = string
  sensitive   = true
}

variable "node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t3.micro"
}

variable "num_cache_clusters" {
  description = "Number of cache clusters (1 = no replica for staging, 2 = primary+replica for production)."
  type        = number
  default     = 1
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

# ── Subnet group ──────────────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = local.common_tags
}

# ── Replication group ─────────────────────────────────────────────────────────

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.name_prefix}-redis"
  description          = "Redis for Airbus-Tools ${var.environment}"

  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_clusters
  port                 = 6380
  parameter_group_name = "default.redis7"
  engine_version       = "7.1"

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [var.security_group_id]

  transit_encryption_enabled = true
  at_rest_encryption_enabled = true
  auth_token                 = var.auth_token

  # Automatic minor version upgrades during maintenance window
  auto_minor_version_upgrade = true

  # Maintenance window — Sunday early morning UTC
  maintenance_window = "sun:03:00-sun:04:00"

  # Snapshot window and retention
  snapshot_window          = "01:00-02:00"
  snapshot_retention_limit = var.environment == "production" ? 7 : 1

  apply_immediately = var.environment == "staging" ? true : false

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-redis" })
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "primary_endpoint" {
  description = "Primary endpoint address of the Redis replication group."
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "port" {
  description = "Port number for TLS Redis connections."
  value       = 6380
}

output "redis_url" {
  description = "Full REDIS_URL (rediss://) for injection into ECS task environment."
  value       = "rediss://:${var.auth_token}@${aws_elasticache_replication_group.main.primary_endpoint_address}:6380"
  sensitive   = true
}
