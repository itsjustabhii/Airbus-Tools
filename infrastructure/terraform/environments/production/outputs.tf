###############################################################################
# Outputs — production
###############################################################################

output "cloudfront_domain" {
  value = module.frontend.cloudfront_domain
}

output "cloudfront_distribution_id" {
  value = module.frontend.cloudfront_distribution_id
}

output "web_bucket_name" {
  value = module.frontend.web_bucket_name
}

output "app_url" {
  value = module.frontend.app_url
}

output "api_url" {
  value = module.api_service.api_url
}

output "alb_dns_name" {
  value = module.api_service.alb_dns_name
}

output "ecr_api_repository_url" {
  value = module.ecr.api_repository_url
}

output "ecr_worker_repository_url" {
  value = module.ecr.worker_repository_url
}

output "uploads_bucket_name" {
  value = module.storage.bucket_name
}

output "route53_name_servers" {
  description = "NS records — enter these at your domain registrar."
  value       = module.dns_acm.zone_name_servers
}

output "atlas_cluster_srv" {
  value = module.atlas.cluster_srv_address
}

output "ecs_cluster_name" {
  value = module.ecs_cluster.cluster_name
}

output "sns_alerts_arn" {
  value = module.monitoring.sns_topic_arn
}
