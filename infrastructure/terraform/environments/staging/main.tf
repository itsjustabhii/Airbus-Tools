###############################################################################
# Environment: staging
#
# Wires all modules together for the staging environment.
# Region: us-east-1  |  Atlas tier: M10  |  Worker: Fargate Spot only
###############################################################################

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.15"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    bucket         = "airbus-tools-tf-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "airbus-tools-tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "airbus-tools"
      Environment = "staging"
      ManagedBy   = "terraform"
    }
  }
}

# us-east-1 alias required by the dns-acm module for the CloudFront certificate
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ── Variables — see terraform.tfvars (git-ignored) ────────────────────────────

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "domain_name" {
  description = "Base domain (e.g. staging.airbus-tools.example.com). Required — no default."
  type        = string
}

variable "alert_email" {
  description = "Email for CloudWatch alarm SNS notifications."
  type        = string
}

variable "atlas_public_key" {
  description = "Atlas API public key. Supply as TF_VAR_atlas_public_key."
  type        = string
  sensitive   = true
}

variable "atlas_private_key" {
  description = "Atlas API private key. Supply as TF_VAR_atlas_private_key."
  type        = string
  sensitive   = true
}

variable "atlas_org_id" {
  description = "MongoDB Atlas organisation ID."
  type        = string
}

variable "api_image_tag" {
  description = "Docker image tag for the API (e.g. sha-abc1234)."
  type        = string
  default     = "latest"
}

variable "worker_image_tag" {
  description = "Docker image tag for the worker."
  type        = string
  default     = "latest"
}

# ── Locals ────────────────────────────────────────────────────────────────────

locals {
  environment = "staging"

  api_image    = "${module.ecr.api_repository_url}:${var.api_image_tag}"
  worker_image = "${module.ecr.worker_repository_url}:${var.worker_image_tag}"
}

# ── Data: current AWS account ─────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

# ── ST-3: Networking ──────────────────────────────────────────────────────────

module "networking" {
  source = "../../modules/networking"

  environment          = local.environment
  vpc_cidr             = "10.1.0.0/16"
  availability_zones   = ["us-east-1a", "us-east-1b"]
  public_subnet_cidrs  = ["10.1.0.0/24", "10.1.1.0/24"]
  private_subnet_cidrs = ["10.1.10.0/24", "10.1.11.0/24"]
  single_nat_gateway   = true   # cost saving for staging
}

# ── ST-6: ECR (shared — no environment prefix on repo names) ─────────────────

module "ecr" {
  source      = "../../modules/ecr"
  environment = local.environment
}

# ── ST-5: Secrets ─────────────────────────────────────────────────────────────

module "secrets" {
  source      = "../../modules/secrets"
  environment = local.environment
}

# ── ST-11a: MongoDB Atlas ─────────────────────────────────────────────────────

module "atlas" {
  source = "../../modules/atlas"

  environment            = local.environment
  atlas_public_key       = var.atlas_public_key
  atlas_private_key      = var.atlas_private_key
  atlas_org_id           = var.atlas_org_id
  nat_gateway_ips        = module.networking.nat_gateway_eips
  mongodb_uri_secret_arn = module.secrets.mongodb_uri_secret_arn
  enable_vpc_peering     = false
  aws_region             = var.aws_region
  aws_account_id         = data.aws_caller_identity.current.account_id
}

# ── ST-7: ElastiCache ─────────────────────────────────────────────────────────

module "cache" {
  source = "../../modules/cache"

  environment        = local.environment
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_id  = module.networking.sg_redis_id
  auth_token         = module.secrets.redis_auth_token_value
  node_type          = "cache.t3.micro"
  num_cache_clusters = 1   # no replica in staging
}

# ── ST-8: Uploads S3 ──────────────────────────────────────────────────────────

module "storage" {
  source = "../../modules/storage"

  environment       = local.environment
  cloudfront_domain = module.frontend.cloudfront_domain
}

# ── ST-10: DNS + ACM ──────────────────────────────────────────────────────────

module "dns_acm" {
  source = "../../modules/dns-acm"

  environment = local.environment
  domain_name = var.domain_name
}

# ── ST-13a: SES domain identity ───────────────────────────────────────────────

module "ses_identity" {
  source = "../../modules/ses-identity"

  environment     = local.environment
  domain_name     = var.domain_name
  route53_zone_id = module.dns_acm.zone_id
  aws_region      = var.aws_region
}

# ── ST-4: IAM ─────────────────────────────────────────────────────────────────

module "iam" {
  source = "../../modules/iam"

  environment        = local.environment
  uploads_bucket_arn = module.storage.bucket_arn
  ses_identity_arn   = module.ses_identity.ses_identity_arn
  secrets_arns       = module.secrets.all_secret_arns
  ecr_repo_arns      = module.ecr.repository_arns
}

# ── ST-11: ECS cluster ────────────────────────────────────────────────────────

module "ecs_cluster" {
  source      = "../../modules/ecs-cluster"
  environment = local.environment
}

# ── ST-12: API service + ALB ──────────────────────────────────────────────────

module "api_service" {
  source = "../../modules/api-service"

  environment        = local.environment
  cluster_arn        = module.ecs_cluster.cluster_arn
  cluster_name       = module.ecs_cluster.cluster_name
  vpc_id             = module.networking.vpc_id
  public_subnet_ids  = module.networking.public_subnet_ids
  private_subnet_ids = module.networking.private_subnet_ids
  sg_alb_id          = module.networking.sg_alb_id
  sg_api_id          = module.networking.sg_api_id
  execution_role_arn = module.iam.execution_role_arn
  task_role_arn      = module.iam.task_role_arn
  api_image          = local.api_image
  acm_certificate_arn           = module.dns_acm.api_certificate_arn
  domain_name                   = var.domain_name
  route53_zone_id               = module.dns_acm.zone_id
  jwt_secret_arn                = module.secrets.jwt_secret_arn
  cookie_secret_arn             = module.secrets.cookie_secret_arn
  payment_webhook_secret_arn    = module.secrets.payment_webhook_secret_arn
  mongodb_uri_secret_arn        = module.secrets.mongodb_uri_secret_arn
  redis_auth_token_secret_arn   = module.secrets.redis_auth_token_secret_arn
  redis_url                     = module.cache.redis_url
  aws_region                    = var.aws_region
  uploads_bucket_name           = module.storage.bucket_name
  ses_from_address              = "noreply@${var.domain_name}"
  cors_origin                   = "https://app.${var.domain_name}"
  task_cpu                      = 512
  task_memory                   = 1024
  desired_count                 = 1
  autoscaling_min               = 1
  autoscaling_max               = 4
}

# ── ST-13: Worker service ─────────────────────────────────────────────────────

module "worker_service" {
  source = "../../modules/worker-service"

  environment        = local.environment
  cluster_arn        = module.ecs_cluster.cluster_arn
  cluster_name       = module.ecs_cluster.cluster_name
  private_subnet_ids = module.networking.private_subnet_ids
  sg_worker_id       = module.networking.sg_worker_id
  execution_role_arn = module.iam.execution_role_arn
  task_role_arn      = module.iam.task_role_arn
  worker_image       = local.worker_image
  jwt_secret_arn                = module.secrets.jwt_secret_arn
  cookie_secret_arn             = module.secrets.cookie_secret_arn
  payment_webhook_secret_arn    = module.secrets.payment_webhook_secret_arn
  mongodb_uri_secret_arn        = module.secrets.mongodb_uri_secret_arn
  redis_auth_token_secret_arn   = module.secrets.redis_auth_token_secret_arn
  redis_url                     = module.cache.redis_url
  aws_region                    = var.aws_region
  uploads_bucket_name           = module.storage.bucket_name
  ses_from_address              = "noreply@${var.domain_name}"
  task_cpu                      = 512
  task_memory                   = 1024
  desired_count                 = 1
}

# ── ST-9: Frontend S3 + CloudFront ───────────────────────────────────────────

module "frontend" {
  source = "../../modules/frontend"

  environment         = local.environment
  acm_certificate_arn = module.dns_acm.cloudfront_certificate_arn
  alb_dns_name        = module.api_service.alb_dns_name
  domain_name         = var.domain_name
  route53_zone_id     = module.dns_acm.zone_id
}

# ── ST-14: Monitoring ─────────────────────────────────────────────────────────

module "monitoring" {
  source = "../../modules/monitoring"

  environment                      = local.environment
  alert_email                      = var.alert_email
  alb_arn_suffix                   = module.api_service.alb_arn_suffix
  target_group_arn_suffix          = module.api_service.target_group_arn_suffix
  ecs_cluster_name                 = module.ecs_cluster.cluster_name
  api_service_name                 = module.api_service.service_name
  elasticache_replication_group_id = "airbus-tools-${local.environment}-redis"
  aws_region                       = var.aws_region
}
