# AWS Production Infrastructure Plan — Airbus-Tools

## Overview

Design and author Terraform-managed AWS infrastructure for the Airbus-Tools
monorepo across two environments: **staging** and **production**. No deployment
occurs as part of this plan — the deliverable is working, reviewed IaC code.

### Services being placed

| App service | Where it runs |
|---|---|
| React web (`apps/web`) | S3 + CloudFront |
| API (`apps/api`, port 3000) | ECS Fargate + ALB |
| Worker (`apps/api`, no port) | ECS Fargate (no load balancer) — Fargate Spot in staging, mixed Spot+Fargate in production |
| File uploads | S3 (dedicated bucket) |
| Email | SES (with provisioned domain identity) |
| Sessions / queues | ElastiCache (Redis) |
| Primary database | MongoDB Atlas (provisioned via `mongodbatlas` Terraform provider) |
| Secrets | AWS Secrets Manager |
| DNS | Route 53 (hosted zone created by Terraform; domain delegated after apply) |
| TLS certificates | ACM (DNS-validated; certs pending until NS delegation is complete) |
| Observability | CloudWatch Logs + Container Insights |

### Source references

- `apps/api/src/config/env.ts` — full list of validated env vars
- `apps/api/src/routes/health.ts` — `/health` and `/ready` endpoints (ALB target)
- `apps/api/src/jobs/redis.ts` — `REDIS_URL` parsing; supports `rediss://` TLS
- `apps/api/Dockerfile` — exposes port 3000
- `apps/api/Dockerfile.worker` — no port; health via `kill -0 1`
- `apps/web/Dockerfile` — Vite build → Nginx; artifact in `apps/web/dist/`
- `.env.example` / `apps/api/.env.example` — all env var keys

---

## Terraform structure

```
infrastructure/
  terraform/
    modules/
      networking/      # VPC, subnets, NAT, security groups
      ecs-cluster/     # ECS cluster, capacity providers
      api-service/     # API task def + service + ALB target group
      worker-service/  # Worker task def + service (no ALB)
      frontend/        # S3 bucket + CloudFront distribution
      storage/         # Uploads S3 bucket + bucket policy
      cache/           # ElastiCache Redis replication group
      secrets/         # Secrets Manager secret resources
      iam/             # Task execution + task roles
      dns-acm/         # Route 53 zones, ACM certs, validation records
      monitoring/      # CloudWatch log groups, alarms, Container Insights
      atlas/           # MongoDB Atlas cluster + database user + network peering
      ses-identity/    # SES domain identity + DKIM + Route 53 verification records
    environments/
      staging/
        main.tf        # module calls for staging
        variables.tf
        outputs.tf
        backend.tf     # S3 remote state (staging prefix)
      production/
        main.tf
        variables.tf
        outputs.tf
        backend.tf     # S3 remote state (production prefix)
    shared/
      versions.tf      # required_providers + version constraints
      locals.tf        # common name prefix helper
```

All secret *values* are supplied via `terraform.tfvars` files (git-ignored) or
via environment variables (`TF_VAR_*`). No secret value appears in source.

---

## Dependency graph

```
ACM cert (dns-acm)
    └─> CloudFront (frontend)
    └─> ALB HTTPS listener (api-service)

Route 53 zone (dns-acm)
    └─> ACM DNS validation records
    └─> CloudFront alias record
    └─> ALB alias record
    └─> SES DKIM + verification records (ses-identity)

VPC + subnets (networking)
    └─> ElastiCache subnet group (cache)
    └─> ALB (api-service)              [public subnets]
    └─> API Fargate tasks (api-service)   [private subnets]
    └─> Worker Fargate tasks (worker-service) [private subnets]
    └─> Atlas VPC peering (atlas)      [private subnets → Atlas peering container]

Secrets Manager secrets (secrets)
    └─> ECS task definitions — injected as valueFrom
    └─> Atlas cluster user password stored here

IAM roles (iam)
    └─> ECS task execution role — ecr pull + secrets read + CW logs
    └─> ECS task role — S3 uploads bucket + SES send

ElastiCache (cache)
    └─> API + Worker task env var REDIS_URL

ECR repositories
    └─> API task definition image reference
    └─> Worker task definition image reference

ECS cluster (ecs-cluster)
    └─> API service (api-service)
    └─> Worker service (worker-service)

Atlas cluster (atlas)
    └─> MONGODB_URI secret in Secrets Manager

SES domain identity (ses-identity)
    └─> Route 53 DKIM and verification records
    └─> SES_FROM_ADDRESS env var in API task definition
```

---

## Sub-Tasks

---

### ST-1 — Remote state backend

**Status:** `[ ] pending`

**Intent**  
Create the S3 bucket and DynamoDB table that Terraform will use for remote
state locking across all environments. This is a one-time bootstrap that must
exist before any environment-level `terraform init` can succeed.

**Expected outcomes**
- S3 bucket `airbus-tools-tf-state` with versioning, SSE, and blocked public access
- DynamoDB table `airbus-tools-tf-locks` with `LockID` hash key
- Both in the same AWS region as all other resources

**Todo list**
1. Create `infrastructure/terraform/bootstrap/main.tf`
2. S3 bucket resource with versioning, AES-256 SSE, all public access blocks enabled, `prevent_destroy` lifecycle
3. S3 bucket policy denying non-TLS access
4. DynamoDB table with `PAY_PER_REQUEST` billing and `LockID` hash key
5. Document the one-time `terraform apply` instruction in the bootstrap `README.md`

**Relevant context**
- Both `environments/staging/backend.tf` and `environments/production/backend.tf`
  will reference the same bucket with different `key` prefixes

---

### ST-2 — Shared Terraform configuration

**Status:** `[ ] pending`

**Intent**  
Establish provider version constraints, a `locals` helper for consistent
resource naming (`airbus-tools-{env}-{resource}`), and the `shared/versions.tf`
used by every module and environment root.

**Expected outcomes**
- `shared/versions.tf` — `hashicorp/aws`, `hashicorp/random`, minimum versions pinned
- `shared/locals.tf` — `name_prefix = "airbus-tools-${var.environment}"` helper
- Both environment roots include a `module "shared"` source or inherit via local values

**Todo list**
1. Create `infrastructure/terraform/shared/versions.tf` with `required_providers`
2. Create `infrastructure/terraform/shared/locals.tf` with naming helper
3. Establish `variable "environment"` (values: `staging`, `production`) and `variable "aws_region"` in a shared variable definition file
4. Pin AWS provider version to `~> 5.0`

**Relevant context**
- `apps/api/src/config/env.ts` uses `AWS_REGION=us-east-1` as default; use that region

---

### ST-3 — Networking module

**Status:** `[ ] pending`

**Intent**  
Provision a dedicated VPC per environment with public and private subnets across
two Availability Zones, NAT Gateways for private egress, and all base security
groups.

**Expected outcomes**
- VPC CIDR: staging `10.1.0.0/16`, production `10.0.0.0/16`
- 2× public subnets (ALB, NAT), 2× private subnets (ECS tasks, ElastiCache)
- Internet Gateway attached to VPC
- 1 NAT Gateway per AZ in production; 1 shared NAT in staging (cost saving)
- Security groups:
  - `sg-alb` — inbound 80 + 443 from `0.0.0.0/0`; egress to `sg-api`
  - `sg-api` — inbound 3000 from `sg-alb` only; egress to `sg-redis`, MongoDB Atlas CIDR, S3/SES VPC endpoints
  - `sg-redis` — inbound 6379 from `sg-api` + `sg-worker` only
  - `sg-worker` — egress to `sg-redis`, MongoDB Atlas CIDR
- VPC Flow Logs to CloudWatch

**Todo list**
1. Create `modules/networking/main.tf` — VPC, IGW, public and private subnets, route tables
2. Add NAT Gateway resources (conditional single vs per-AZ via `var.single_nat_gateway`)
3. Define all four security groups with minimal ingress rules
4. Enable VPC Flow Logs with a dedicated CW log group
5. Output subnet IDs, VPC ID, and all security group IDs for use by other modules

**Relevant context**
- ECS tasks run in private subnets; ALB in public subnets
- ElastiCache also uses private subnets (dedicated subnet group created in `cache` module)
- `sg-api` must reach MongoDB Atlas — Atlas whitelists the NAT Gateway EIP(s); output the EIPs

---

### ST-4 — IAM module

**Status:** `[ ] pending`

**Intent**  
Create least-privilege IAM roles: one task *execution* role (ECS control plane
needs it to pull images and read secrets) and one task *task* role (the running
container's permissions for S3 uploads and SES).

**Expected outcomes**
- `airbus-tools-{env}-ecs-execution-role`
  - Trust policy: `ecs-tasks.amazonaws.com`
  - Managed policy: `AmazonECSTaskExecutionRolePolicy`
  - Inline policy: `secretsmanager:GetSecretValue` scoped to `airbus-tools/{env}/*`
  - Inline policy: `ecr:GetAuthorizationToken` + `ecr:BatchGetImage` + `ecr:GetDownloadUrlForLayer` scoped to account ECR ARNs
- `airbus-tools-{env}-ecs-task-role`
  - Trust policy: `ecs-tasks.amazonaws.com`
  - Inline policy: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` scoped to the uploads bucket ARN + `/*`
  - Inline policy: `ses:SendEmail`, `ses:SendRawEmail` scoped to the verified SES identity ARN

**Todo list**
1. Create `modules/iam/main.tf` — execution role + trust + policies
2. Add task role + S3 and SES inline policies
3. Take `uploads_bucket_arn`, `ses_identity_arn`, `secrets_prefix`, and `ecr_repo_arns` as input variables
4. Output both role ARNs for use in task definitions

**Relevant context**
- API task needs both roles (execution + task); worker task needs same
- No `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` in container env — SDK uses task role via IMDS

---

### ST-5 — Secrets module

**Status:** `[ ] pending`

**Intent**  
Create AWS Secrets Manager secret *resources* (not values) for all runtime
secrets. Values are supplied out-of-band (console, CI, or `aws secretsmanager
put-secret-value`). Terraform manages the secret ARN lifecycle; it never stores
the value in state.

**Expected outcomes**
- One secret per logical secret group, e.g. `airbus-tools/{env}/api`
- Secret ARNs exported as outputs for use in task definition `secrets[]`
- `lifecycle { ignore_changes = [secret_string] }` prevents Terraform drift when values are rotated

**Secret keys to provision** (from `apps/api/src/config/env.ts`):
- `JWT_SECRET`
- `COOKIE_SECRET`
- `PAYMENT_WEBHOOK_SECRET`
- `MONGODB_URI` (Atlas connection string with credentials)

Non-secret config (port, region, bucket name, log level) goes in ECS task
definition `environment[]` directly.

**Todo list**
1. Create `modules/secrets/main.tf` — one `aws_secretsmanager_secret` resource per secret
2. Set `name = "airbus-tools/${var.environment}/${local.secret_name}"`
3. Add `lifecycle { ignore_changes = [secret_string] }` to each
4. Output a map of `secret_name → secret_arn` for the ECS module

**Relevant context**
- `apps/api/src/config/env.ts` is the authoritative list of env vars
- `REDIS_URL` comes from the ElastiCache module output — injected in `environment[]` not secrets

---

### ST-6 — ECR repositories

**Status:** `[ ] pending`

**Intent**  
Create two ECR repositories — one for the API image and one for the worker
image — with image scanning, lifecycle policies (retain last 10 images), and
encrypted at rest.

**Expected outcomes**
- `airbus-tools-api` ECR repository
- `airbus-tools-worker` ECR repository
- Image scanning on push enabled
- Lifecycle policy: expire untagged images after 1 day; keep last 10 tagged
- KMS or AES-256 encryption at rest

**Todo list**
1. Create `modules/ecr/main.tf` — two repository resources
2. Attach `aws_ecr_lifecycle_policy` to each
3. Set `image_scanning_configuration { scan_on_push = true }`
4. Output repository URLs for use in CI/CD and task definitions

**Relevant context**
- API image built from `apps/api/Dockerfile`, worker from `apps/api/Dockerfile.worker`
- Both use the monorepo root as build context

---

### ST-7 — ElastiCache (Redis) module

**Status:** `[ ] pending`

**Intent**  
Provision an ElastiCache Redis replication group in the private subnets with
TLS enabled. The resulting `rediss://` URL is injected as `REDIS_URL` in both
the API and worker ECS task definitions.

**Expected outcomes**
- ElastiCache subnet group in private subnets
- Replication group: `redis7.x`, 1 shard, 1 replica in production; 1 shard 0 replicas in staging
- TLS (`transit_encryption_enabled = true`) and auth token
- Auth token stored in Secrets Manager (created in `secrets` module) and injected via task env
- `REDIS_URL` format: `rediss://:{auth_token}@{primary_endpoint}:6380` — matches `parseRedisUrl` in `apps/api/src/jobs/redis.ts`

**Todo list**
1. Create `modules/cache/main.tf` — subnet group + replication group
2. Set `transit_encryption_enabled = true`, `at_rest_encryption_enabled = true`
3. Generate auth token via `random_password` resource; store in Secrets Manager
4. Security group association: allow `sg-api` and `sg-worker` inbound 6380
5. Output the primary endpoint and port for URL assembly

**Relevant context**
- `apps/api/src/jobs/redis.ts` parseRedisUrl handles `rediss://` scheme on port 6380
- Worker and API both need `REDIS_URL` injected

---

### ST-8 — Storage module (uploads S3 bucket)

**Status:** `[ ] pending`

**Intent**  
Create the S3 bucket for user file uploads referenced in `AWS_S3_BUCKET` env
var, with server-side encryption, versioning, blocked public access, and a
lifecycle rule for incomplete multipart uploads.

**Expected outcomes**
- Bucket name: `airbus-tools-{env}-uploads` (the default in `.env.example` is `airbus-tools-uploads`)
- SSE-S3 or SSE-KMS encryption
- All public access blocked
- Versioning enabled
- Bucket policy: deny non-TLS access, allow task role only
- CORS rule for direct browser uploads if needed
- Lifecycle: abort incomplete multipart uploads after 7 days

**Todo list**
1. Create `modules/storage/main.tf` — S3 bucket resource with versioning, SSE, public access block
2. Add bucket policy with TLS-only + task role allow condition
3. Add CORS configuration (origin: CloudFront distribution domain)
4. Add lifecycle rule for incomplete multipart uploads
5. Output bucket name and ARN

**Relevant context**
- `AWS_S3_BUCKET` env var is consumed in API; inject the Terraform-created bucket name
- IAM task role (ST-4) scoped to this bucket ARN

---

### ST-9 — Frontend module (S3 + CloudFront)

**Status:** `[ ] pending`

**Intent**  
Create the S3 bucket hosting the React SPA and the CloudFront distribution that
serves it, including an Origin Access Control (OAC), HTTPS enforcement, custom
error responses for client-side routing, and a Route 53 alias record.

**Expected outcomes**
- Private S3 bucket (`airbus-tools-{env}-web`) with all public access blocked
- Bucket policy allowing CloudFront OAC only
- CloudFront distribution:
  - Default origin: web S3 bucket via OAC
  - API behaviour: `/api/*` forwarded to ALB origin
  - HTTPS only (`redirect-to-https`)
  - ACM certificate attached
  - Default root object: `index.html`
  - Custom error response: 404 → `/index.html` (SPA routing)
  - Gzip + Brotli compression enabled
  - Cache policy: managed `CachingOptimized` for static assets; `CachingDisabled` for `/api/*`
- Route 53 A alias: `app.airbustools.example.com` → CloudFront

**Todo list**
1. Create `modules/frontend/main.tf` — S3 bucket (web), OAC, CloudFront distribution
2. Add `/api/*` ordered cache behaviour pointing to ALB origin
3. Set custom error responses for 403/404 → index.html with 200 status
4. Add ACM certificate ARN input variable (must be `us-east-1` for CloudFront)
5. Add Route 53 alias record
6. Output CloudFront domain and distribution ID

**Relevant context**
- ACM cert for CloudFront MUST be issued in `us-east-1` even if infra is in another region
- `VITE_API_BASE_URL` baked into the web build must match the CloudFront `/api/v1` path

---

### ST-10 — DNS and ACM module

**Status:** `[ ] pending`

**Intent**
Create the Route 53 public hosted zone (Terraform-managed), issue and
DNS-validate two ACM certificates — one regional for the ALB and one in
`us-east-1` for CloudFront — and output the NS records that must be delegated
at the registrar before certificates become ISSUED.

**Expected outcomes**
- `aws_route53_zone` resource creating the hosted zone (not a `data` source — zone does not pre-exist)
- `outputs.tf` exposes the four NS records so the user can enter them at their domain registrar
- Two ACM certificates:
  - Regional cert (us-east-1) for ALB: `api.<domain>`
  - `us-east-1` provider alias cert for CloudFront: `app.<domain>`
- DNS validation CNAME records created in the Route 53 zone automatically
- `aws_acm_certificate_validation` resources block apply until certs reach ISSUED state
- **Important:** ACM validation will time out if NS records are not delegated first. A `README` note will explain the two-step apply: (1) apply to get NS records, (2) delegate at registrar, (3) re-apply to complete cert validation

**Todo list**
1. Create `modules/dns-acm/main.tf` — `aws_route53_zone` resource with `var.domain_name`
2. Regional ACM cert + `aws_route53_record` validation records + `aws_acm_certificate_validation`
3. Add a provider alias `aws.us_east_1` for the CloudFront cert; same validation pattern
4. Output NS records list, hosted zone ID, both certificate ARNs
5. Add a `README` comment explaining the two-step apply required when no domain is pre-delegated

**Relevant context**
- `var.domain_name` will be the only variable without a default — must be supplied in `terraform.tfvars`
- SES domain identity module (ST-17) also adds records to this hosted zone
- Two provider aliases required: default `us-east-1` and `aws.us_east_1` (same region here, but kept explicit for portability)
- ALB module (ST-12) consumes the regional cert ARN; Frontend module (ST-9) consumes the us-east-1 cert ARN

---

### ST-11 — ECS cluster module

**Status:** `[ ] pending`

**Intent**  
Create the ECS cluster with Fargate and Fargate Spot capacity providers and
enable Container Insights for CloudWatch metrics.

**Expected outcomes**
- ECS cluster `airbus-tools-{env}`
- Container Insights enabled
- Capacity providers: `FARGATE` and `FARGATE_SPOT`; default strategy: Spot with base 1 on Fargate

**Todo list**
1. Create `modules/ecs-cluster/main.tf` — `aws_ecs_cluster` + capacity provider strategy
2. Enable Container Insights via `setting { name="containerInsights" value="enabled" }`
3. Output cluster ARN and name

---

### ST-11a — MongoDB Atlas module

**Status:** `[ ] pending`

**Intent**
Provision a MongoDB Atlas cluster, a dedicated database user, IP access list
entries (NAT Gateway EIPs from the networking module), and output the
connection string URI assembled from Terraform outputs. The URI is then written
to Secrets Manager so no Atlas credentials appear in Terraform source.

**Expected outcomes**
- Atlas project data source (`mongodbatlas_project`) — the project already exists in the browser session
- Atlas cluster: `M10` (staging) / `M30` (production), provider `AWS`, region `US_EAST_1`, MongoDB 7.x
- Dedicated Atlas database user with `readWriteAnyDatabase` scoped to `airbus-tools` database only
- User password generated by `random_password`; stored in Secrets Manager
- IP access list: NAT Gateway EIP(s) from networking module outputs + optionally a CIDR for dev access
- VPC peering connection between Atlas and the application VPC (optional but recommended for production; `var.enable_vpc_peering`)
- `MONGODB_URI` assembled as `mongodb+srv://{user}:{password}@{cluster_srv_address}/airbus-tools?retryWrites=true&w=majority`
- URI written to the Secrets Manager secret created in ST-5

**Todo list**
1. Create `modules/atlas/main.tf` — configure `mongodbatlas` provider with `var.atlas_public_key` and `var.atlas_private_key` (supplied via `TF_VAR_*`, never in source)
2. `mongodbatlas_cluster` resource: tier, region, MongoDB version, auto-scaling disabled in staging
3. `mongodbatlas_database_user` with `random_password` for the app user
4. `mongodbatlas_project_ip_access_list` entries from networking NAT EIP outputs
5. Optional `mongodbatlas_network_peering` + `aws_vpc_peering_connection_accepter` (guarded by `var.enable_vpc_peering`)
6. Assemble `MONGODB_URI` in a `local` and write it to the Secrets Manager secret ARN via `aws_secretsmanager_secret_version`
7. Output cluster SRV address (no credentials)

**Relevant context**
- `mongodbatlas` Terraform provider: `mongodb/mongodbatlas ~> 1.15`
- Atlas public/private API keys are generated in the Atlas UI under Organisation > API Keys
- `apps/api/src/database/connection.ts` uses `mongoose.connect(config.MONGODB_URI)` — srv format is expected
- VPC peering requires Atlas project to be on an `M10+` tier dedicated cluster

---

### ST-12 — API service module (ECS + ALB)

**Status:** `[ ] pending`

**Intent**  
Define the ECS task definition for the API, an ALB with HTTPS listener, target
group with health checks against `/health`, and the ECS service with
autoscaling.

**Expected outcomes**
- ALB in public subnets with `sg-alb`
- Target group: port 3000, protocol HTTP, health check path `/health`, healthy threshold 2, interval 30s
- HTTPS listener (443) with ACM cert; HTTP listener (80) redirects to HTTPS
- ECS task definition:
  - Image: ECR API repo URL
  - Port mapping: 3000
  - CPU/memory: 512/1024 staging, 1024/2048 production
  - `secrets[]` for JWT_SECRET, COOKIE_SECRET, PAYMENT_WEBHOOK_SECRET, MONGODB_URI
  - `environment[]` for PORT, HOST, API_PREFIX, REDIS_URL, AWS_REGION, AWS_S3_BUCKET, SES_FROM_ADDRESS, CORS_ORIGIN, LOG_LEVEL, NODE_ENV
  - Execution role ARN, task role ARN from IAM module
  - CloudWatch log group `/ecs/airbus-tools-{env}/api`
- ECS service: desired count 1 staging / 2 production, rolling update deployment
- Application Autoscaling: scale on CPU > 70%, min 1 staging / 2 production, max 4 staging / 8 production

**Todo list**
1. Create `modules/api-service/main.tf` — ALB, listener rules, target group, ECS task def, ECS service
2. Add `aws_appautoscaling_target` and two `aws_appautoscaling_policy` resources (CPU + memory)
3. Attach `sg-api` to ECS service network config; `sg-alb` to ALB
4. Set `health_check_grace_period_seconds = 60`
5. Add CloudWatch log group resource
6. Output ALB DNS name and ARN

**Relevant context**
- API health endpoint: `GET /health` returns 200 (from `apps/api/src/routes/health.ts`)
- CORS_ORIGIN must match the CloudFront domain — create a circular dependency via outputs or use a known domain variable

---

### ST-13 — Worker service module

**Status:** `[ ] pending`

**Intent**  
Define the ECS task definition and service for the worker. No ALB or port
mapping is needed; the worker is long-lived and health-checked via process
liveness (`kill -0 1`).

**Expected outcomes**
- ECS task definition:
  - Image: ECR worker repo URL
  - No port mappings
  - Same CPU/memory as API or smaller (512/1024)
  - Same `secrets[]` and `environment[]` as API (worker also needs MongoDB and Redis)
  - CloudWatch log group `/ecs/airbus-tools-{env}/worker`
- ECS service: desired count 1, no load balancer
- No autoscaling (workers are queue-driven; scale by queue depth metric in a later phase)

**Todo list**
1. Create `modules/worker-service/main.tf` — task definition + service
2. `sg-worker` security group attached; no public IP
3. CloudWatch log group resource
4. Output service ARN

**Relevant context**
- `apps/api/Dockerfile.worker` — no EXPOSE, healthcheck via `kill -0 1`
- Worker needs `MONGODB_URI` and `REDIS_URL` — same injection pattern as API

---

### ST-13a — SES domain identity module

**Status:** `[ ] pending`

**Intent**
Provision an SES domain identity for the sending domain, generate DKIM tokens,
create the required DNS records in Route 53 to verify ownership and enable
DKIM signing, and request SES production access notes.

**Expected outcomes**
- `aws_ses_domain_identity` resource for `var.domain_name`
- `aws_ses_domain_dkim` resource — generates three DKIM CNAME records
- Three `aws_route53_record` resources for DKIM CNAMEs in the hosted zone
- `aws_route53_record` for the SES verification TXT record
- `aws_ses_domain_mail_from` resource setting `mail.{domain_name}` as the MAIL FROM subdomain (improves deliverability)
- MX record for the MAIL FROM subdomain pointing to the SES regional feedback endpoint
- SPF TXT record on the MAIL FROM subdomain: `"v=spf1 include:amazonses.com ~all"`
- Output: domain identity ARN (consumed by IAM task role policy in ST-4)
- **Note in README:** SES accounts start in sandbox mode; production access must be requested via AWS Support Console

**Todo list**
1. Create `modules/ses-identity/main.tf` — `aws_ses_domain_identity`, `aws_ses_domain_dkim`
2. Create three DKIM CNAME records + verification TXT record in Route 53 (depends on dns-acm module zone ID)
3. Create `aws_ses_domain_mail_from` + MX + SPF TXT records
4. Output the SES domain identity ARN for IAM scoping in ST-4
5. Add README note about SES sandbox → production access request

**Relevant context**
- `SES_FROM_ADDRESS` env var in the API task definition uses `noreply@{domain_name}`
- IAM task role (ST-4) `ses:SendEmail` policy must be scoped to this identity ARN
- SES DKIM records must be in the same Route 53 zone created in ST-10

---

### ST-14 — Monitoring module

**Status:** `[ ] pending`

**Intent**  
Create CloudWatch log groups (with retention), a CloudWatch dashboard, and
alarms for critical signals: API 5xx errors, ECS task CPU, ALB unhealthy targets,
and ElastiCache memory.

**Expected outcomes**
- Log groups with 30-day retention: `/ecs/{env}/api`, `/ecs/{env}/worker`, `/vpc/{env}/flow-logs`
- CloudWatch dashboard: ALB 5xx rate, ECS CPU/memory, ElastiCache `CurrConnections`
- Alarms:
  - ALB `HTTPCode_Target_5XX_Count > 10` over 5 minutes → SNS topic
  - ECS API CPU > 80% over 10 minutes → SNS topic
  - ElastiCache `FreeableMemory < 50MB` → SNS topic
- SNS topic `airbus-tools-{env}-alerts` with email subscription variable

**Todo list**
1. Create `modules/monitoring/main.tf` — log groups, dashboard JSON, alarms, SNS topic
2. Parameterise `var.alert_email` for the SNS email subscription
3. Set `retention_in_days = 30` on all log groups
4. Output SNS topic ARN

---

### ST-15 — Environment root modules

**Status:** `[ ] pending`

**Intent**
Wire all modules together in `environments/staging/main.tf` and
`environments/production/main.tf` with environment-appropriate variable values,
remote state backends, and outputs.

**Expected outcomes**
- Each environment directory is a self-contained Terraform root
- `backend.tf` configures S3 backend with DynamoDB locking
- `variables.tf` declares all environment-specific variables (domain name, alert email, image tags, Atlas API keys)
- `main.tf` calls all modules in dependency order passing outputs between modules
- `outputs.tf` exports CloudFront domain, ALB DNS, ECR URLs, Route 53 NS records for use in CI/CD and registrar delegation
- `terraform.tfvars.example` documents all required variable values (no secrets)

**Todo list**
1. Create `environments/staging/` and `environments/production/` root modules
2. Write `backend.tf` for each with correct state key
3. Write `variables.tf` + `terraform.tfvars.example` (never `terraform.tfvars` in git)
4. Write `main.tf` calling modules in order: networking → iam → secrets → ecr → cache → storage → atlas → ses-identity → ecs-cluster → dns-acm → api-service → worker-service → frontend → monitoring
5. Write `outputs.tf` with CloudFront URL, ALB URL, ECR repository URLs, and Route 53 NS records
6. Add `terraform.tfvars` to `.gitignore`

**Relevant context**
- Staging uses `single_nat_gateway = true`, smaller ECS sizes, Atlas M10, worker on Fargate Spot
- Production uses `single_nat_gateway = false`, larger ECS sizes, Atlas M30, worker mixed Fargate+Spot
- `domain_name` has no default — must be supplied before any apply

---

### ST-16 — CI/CD integration notes

**Status:** `[ ] pending`

**Intent**
Document (not implement) how the GitHub Actions CI pipeline at
`.github/workflows/ci.yml` should be extended to push images and update ECS
services. No code is changed; a `docs/deploy.md` is written.

**Expected outcomes**
- `docs/deploy.md` explaining:
  - How to bootstrap the remote state (ST-1 one-time step)
  - The two-step domain delegation sequence (apply → get NS → delegate at registrar → apply again)
  - How to build and push API + worker images to ECR
  - How to build the React app and sync to the web S3 bucket
  - How to invalidate the CloudFront cache after a web deploy
  - How to run `terraform plan` in CI (staging on `develop`, production on `main`)
  - Environment variable and secret injection via GitHub Actions secrets
  - How Atlas API keys (`atlas_public_key`, `atlas_private_key`) are supplied via `TF_VAR_*` in CI
  - SES sandbox → production access request procedure

**Todo list**
1. Create `docs/deploy.md` with bootstrap, domain delegation, ECR push, S3 sync, and CloudFront invalidation procedures
2. Document `terraform workspace` is NOT used — separate root modules per environment
3. Document that `MONGODB_URI` is assembled and written by the Atlas module automatically via `aws_secretsmanager_secret_version`
4. Document SES sandbox removal request steps

---

## Key design decisions

| Decision | Choice | Rationale |
|---|---|---|
| State isolation | Separate root module per env | Prevents accidental cross-env apply |
| Secrets in Terraform | Secret resource ARN only; value via console/CLI | No plaintext in state file |
| Redis TLS | `rediss://` on port 6380 | `parseRedisUrl` in `jobs/redis.ts` already handles it |
| CloudFront ACM | Separate us-east-1 cert | CloudFront requires certs in us-east-1 |
| NAT cost in staging | Single NAT Gateway | Cost saving; not HA but acceptable for staging |
| Worker autoscaling | Not included in v1 | Queue-depth scaling requires CloudWatch custom metrics; deferred |
| MongoDB | Atlas provisioned by Terraform via `mongodbatlas` provider | URI assembled and written to Secrets Manager automatically |
| Atlas credentials in Terraform | Supplied via `TF_VAR_atlas_public_key` / `TF_VAR_atlas_private_key` | Never in source |
| IAM credentials in containers | None — task role via IMDS | Eliminates `AWS_ACCESS_KEY_ID` from env |
| Worker capacity | Fargate Spot only in staging; Spot+Fargate base-1 in production | Worker has no SLA; cost saving acceptable |
| SES identity | Full domain identity with DKIM + MAIL FROM subdomain | Improves deliverability vs single-address verification |
| Domain in Route 53 | `aws_route53_zone` resource; NS delegation done manually post-first-apply | No pre-existing zone; two-step apply documented |

---

## Variables requiring values before apply (never commit these)

| Variable | Where supplied | Note |
|---|---|---|
| `domain_name` | `terraform.tfvars` | Required; no default. e.g. `airbus-tools.example.com` |
| `alert_email` | `terraform.tfvars` | Email address for CloudWatch alarm SNS subscription |
| `atlas_public_key` | `TF_VAR_atlas_public_key` env var | Atlas Organisation API key (public part) |
| `atlas_private_key` | `TF_VAR_atlas_private_key` env var | Atlas Organisation API key (private part) — sensitive |
| `atlas_org_id` | `terraform.tfvars` | Atlas Organisation ID (visible in Atlas UI) |
| `jwt_secret` | Secrets Manager (manual post-apply) | Min 32 chars |
| `cookie_secret` | Secrets Manager (manual post-apply) | Min 32 chars |
| `payment_webhook_secret` | Secrets Manager (manual post-apply) | Min 16 chars |
| `redis_auth_token` | Generated by Terraform `random_password` | Written to Secrets Manager automatically |
| `mongodb_uri` | Assembled by Atlas module + written to Secrets Manager | No manual entry needed |
| `ses_from_address` | ECS env var derived from `var.domain_name` | e.g. `noreply@{domain_name}` |
