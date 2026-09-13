###############################################################################
# Module: atlas
#
# Provisions MongoDB Atlas:
#   - Uses existing Atlas project (data source, not created here)
#   - Atlas cluster: M10 (staging) / M30 (production), AWS/US_EAST_1, MongoDB 7.x
#   - Dedicated database user with random password
#   - IP access list: NAT Gateway EIPs from networking module
#   - Optional VPC peering (var.enable_vpc_peering, requires M10+ tier)
#   - Assembles MONGODB_URI and writes it to Secrets Manager
#
# Atlas API keys must be supplied via environment variables:
#   TF_VAR_atlas_public_key
#   TF_VAR_atlas_private_key
###############################################################################

terraform {
  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.15"
    }
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

variable "atlas_public_key" {
  description = "MongoDB Atlas API public key. Supply via TF_VAR_atlas_public_key."
  type        = string
  sensitive   = true
}

variable "atlas_private_key" {
  description = "MongoDB Atlas API private key. Supply via TF_VAR_atlas_private_key."
  type        = string
  sensitive   = true
}

variable "atlas_org_id" {
  description = "MongoDB Atlas organisation ID (visible in Atlas UI)."
  type        = string
}

variable "atlas_project_name" {
  description = "Name of the existing Atlas project to use."
  type        = string
  default     = "airbus-tools"
}

variable "nat_gateway_ips" {
  description = "List of NAT Gateway public IPs to whitelist in Atlas (from networking module)."
  type        = list(string)
}

variable "mongodb_uri_secret_arn" {
  description = "ARN of the Secrets Manager secret that will hold the MONGODB_URI."
  type        = string
}

variable "enable_vpc_peering" {
  description = "Enable VPC peering between Atlas and the application VPC."
  type        = bool
  default     = false
}

variable "vpc_id" {
  description = "Application VPC ID (required when enable_vpc_peering = true)."
  type        = string
  default     = ""
}

variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID (required for VPC peering)."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags for AWS resources."
  type        = map(string)
  default     = {}
}

# ── Locals ────────────────────────────────────────────────────────────────────

locals {
  name_prefix = "airbus-tools-${var.environment}"
  db_name     = "airbus-tools"

  # Atlas cluster tier per environment
  cluster_tier = var.environment == "production" ? "M30" : "M10"

  common_tags = merge(
    {
      Project     = "airbus-tools"
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# ── Atlas provider ────────────────────────────────────────────────────────────

provider "mongodbatlas" {
  public_key  = var.atlas_public_key
  private_key = var.atlas_private_key
}

# ── Atlas project (existing — data source) ────────────────────────────────────

data "mongodbatlas_project" "main" {
  name = var.atlas_project_name
}

# ── Atlas cluster ─────────────────────────────────────────────────────────────

resource "mongodbatlas_cluster" "main" {
  project_id = data.mongodbatlas_project.main.id
  name       = "${local.name_prefix}-cluster"

  provider_name               = "AWS"
  provider_region_name        = "US_EAST_1"
  provider_instance_size_name = local.cluster_tier

  mongo_db_major_version       = "7.0"
  auto_scaling_disk_gb_enabled = var.environment == "production" ? true : false

  # Backup
  cloud_backup = var.environment == "production" ? true : false

  # Replication factor
  replication_factor = 3

  tags {
    key   = "Environment"
    value = var.environment
  }

  tags {
    key   = "ManagedBy"
    value = "terraform"
  }
}

# ── Database user ─────────────────────────────────────────────────────────────

resource "random_password" "atlas_db_password" {
  length           = 32
  special          = true
  override_special = "!&#$^<>-"
}

resource "mongodbatlas_database_user" "app" {
  project_id         = data.mongodbatlas_project.main.id
  auth_database_name = "admin"
  username           = "${local.name_prefix}-app"
  password           = random_password.atlas_db_password.result

  roles {
    role_name     = "readWrite"
    database_name = local.db_name
  }

  scopes {
    name = mongodbatlas_cluster.main.name
    type = "CLUSTER"
  }
}

# ── IP access list — NAT Gateway EIPs ────────────────────────────────────────

resource "mongodbatlas_project_ip_access_list" "nat_gateways" {
  count      = length(var.nat_gateway_ips)
  project_id = data.mongodbatlas_project.main.id
  ip_address = "${var.nat_gateway_ips[count.index]}/32"
  comment    = "NAT Gateway ${count.index} — ${var.environment}"
}

# ── Optional VPC peering ──────────────────────────────────────────────────────

resource "mongodbatlas_network_peering" "main" {
  count = var.enable_vpc_peering ? 1 : 0

  project_id             = data.mongodbatlas_project.main.id
  container_id           = mongodbatlas_cluster.main.container_id
  accepter_region_name   = var.aws_region
  provider_name          = "AWS"
  aws_account_id         = var.aws_account_id
  vpc_id                 = var.vpc_id
  route_table_cidr_block = "0.0.0.0/0"
}

resource "aws_vpc_peering_connection_accepter" "atlas" {
  count = var.enable_vpc_peering ? 1 : 0

  vpc_peering_connection_id = mongodbatlas_network_peering.main[0].connection_id
  auto_accept               = true

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-atlas-peering" })
}

# ── Assemble MONGODB_URI and write to Secrets Manager ─────────────────────────

locals {
  mongodb_uri = "mongodb+srv://${mongodbatlas_database_user.app.username}:${random_password.atlas_db_password.result}@${mongodbatlas_cluster.main.srv_address}/${local.db_name}?retryWrites=true&w=majority"
}

resource "aws_secretsmanager_secret_version" "mongodb_uri" {
  secret_id     = var.mongodb_uri_secret_arn
  secret_string = local.mongodb_uri

  # Allow rotation/manual updates without Terraform overwriting the value
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "cluster_srv_address" {
  description = "Atlas cluster SRV address (no credentials)."
  value       = mongodbatlas_cluster.main.srv_address
}

output "db_username" {
  description = "Atlas database username for the application user."
  value       = mongodbatlas_database_user.app.username
}
