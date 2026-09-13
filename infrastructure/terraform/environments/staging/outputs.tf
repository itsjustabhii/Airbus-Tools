###############################################################################
# Outputs — staging
###############################################################################

output "cloudfront_domain" {
  description = "CloudFront distribution domain name for the React SPA."
  value       = module.frontend.cloudfront_domain
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (used in CI for cache invalidation)."
  value       = module.frontend.cloudfront_distribution_id
}

output "web_bucket_name" {
  description = "S3 bucket name for web assets (sync build artifacts here)."
  value       = module.frontend.web_bucket_name
}

output "app_url" {
  description = "Public URL of the React SPA."
  value       = module.frontend.app_url
}

output "api_url" {
  description = "Public API URL."
  value       = module.api_service.api_url
}

output "alb_dns_name" {
  description = "ALB DNS name."
  value       = module.api_service.alb_dns_name
}

output "ecr_api_repository_url" {
  description = "ECR repository URL for the API image."
  value       = module.ecr.api_repository_url
}

output "ecr_worker_repository_url" {
  description = "ECR repository URL for the worker image."
  value       = module.ecr.worker_repository_url
}

output "uploads_bucket_name" {
  description = "Uploads S3 bucket name."
  value       = module.storage.bucket_name
}

output "route53_name_servers" {
  description = "NS records — enter these at your domain registrar before re-applying."
  value       = module.dns_acm.zone_name_servers
}

output "atlas_cluster_srv" {
  description = "MongoDB Atlas cluster SRV address (no credentials)."
  value       = module.atlas.cluster_srv_address
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.ecs_cluster.cluster_name
}

output "sns_alerts_arn" {
  description = "SNS topic ARN for alert notifications."
  value       = module.monitoring.sns_topic_arn
}
