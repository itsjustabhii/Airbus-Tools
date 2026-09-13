# Deployment Guide — Airbus-Tools AWS Infrastructure

## Prerequisites

| Tool | Minimum version |
|---|---|
| [Terraform](https://developer.hashicorp.com/terraform/downloads) | 1.7.0 |
| [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) | 2.x |
| Docker | 24.x |
| Node.js | 20.x |

AWS credentials must be configured (`aws configure` or environment variables
`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_DEFAULT_REGION=us-east-1`).

Atlas API keys must be available as environment variables:

```bash
export TF_VAR_atlas_public_key="your-atlas-public-key"
export TF_VAR_atlas_private_key="your-atlas-private-key"
```

---

## Step 0 — One-time: Bootstrap remote state

This must be run exactly once per AWS account before any environment `init`.

```bash
cd infrastructure/terraform/bootstrap
terraform init
terraform apply
```

Expected output:
```
state_bucket_name = "airbus-tools-tf-state"
lock_table_name   = "airbus-tools-tf-locks"
```

Commit the local `terraform.tfstate` in `bootstrap/` (it contains no secrets)
or keep it safe — losing it means you can no longer manage the bootstrap resources.

---

## Step 1 — Prepare environment variables

```bash
# Staging
cp infrastructure/terraform/environments/staging/terraform.tfvars.example \
   infrastructure/terraform/environments/staging/terraform.tfvars
# Edit terraform.tfvars — fill in domain_name, alert_email, atlas_org_id

# Production
cp infrastructure/terraform/environments/production/terraform.tfvars.example \
   infrastructure/terraform/environments/production/terraform.tfvars
# Edit terraform.tfvars
```

> ⚠️ **Never commit `terraform.tfvars`** — it is git-ignored. It may contain the
> `atlas_org_id` (non-secret but org-specific). Atlas key pairs must go in
> `TF_VAR_*` env vars only.

---

## Step 2 — First apply (creates zone, waits for NS delegation)

```bash
cd infrastructure/terraform/environments/staging   # or production

terraform init
terraform apply -target=module.dns_acm
```

After this partial apply, note the NS records in the output:

```
route53_name_servers = [
  "ns-123.awsdns-15.com",
  "ns-456.awsdns-26.net",
  "ns-789.awsdns-30.org",
  "ns-012.awsdns-45.co.uk",
]
```

Go to your domain registrar and set these four NS records for your domain.
DNS propagation typically takes 5–30 minutes but can take up to 48 hours.

---

## Step 3 — Full apply (completes ACM validation)

Once NS records have propagated:

```bash
terraform apply
```

ACM certificate validation will proceed automatically (CNAME records were
already created in Step 2). The `aws_acm_certificate_validation` resources
will block until both certs reach ISSUED status.

Full apply typically completes in 15–25 minutes due to:
- Atlas cluster provisioning (~7–10 min)
- ACM DNS validation (~5–10 min after NS delegation)
- CloudFront distribution deployment (~5–10 min)

---

## Step 4 — Post-apply: populate manual secrets

After `terraform apply` completes, three secrets have empty values and must
be set manually before the API can start:

```bash
# Staging
aws secretsmanager put-secret-value \
  --secret-id "airbus-tools/staging/jwt-secret" \
  --secret-string "$(openssl rand -base64 48)"

aws secretsmanager put-secret-value \
  --secret-id "airbus-tools/staging/cookie-secret" \
  --secret-string "$(openssl rand -base64 48)"

aws secretsmanager put-secret-value \
  --secret-id "airbus-tools/staging/payment-webhook-secret" \
  --secret-string "$(openssl rand -base64 32)"
```

> `MONGODB_URI` and `REDIS_URL` are populated automatically by Terraform —
> no manual action required.

---

## Step 5 — Build and push Docker images to ECR

```bash
# Get ECR login token
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1

aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push API image (from monorepo root)
IMAGE_TAG="sha-$(git rev-parse --short HEAD)"

docker build \
  --file apps/api/Dockerfile \
  --tag $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/airbus-tools-api:$IMAGE_TAG \
  --tag $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/airbus-tools-api:latest \
  .

docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/airbus-tools-api:$IMAGE_TAG
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/airbus-tools-api:latest

# Build and push Worker image
docker build \
  --file apps/api/Dockerfile.worker \
  --tag $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/airbus-tools-worker:$IMAGE_TAG \
  --tag $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/airbus-tools-worker:latest \
  .

docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/airbus-tools-worker:$IMAGE_TAG
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/airbus-tools-worker:latest
```

To deploy new images, re-run Terraform with updated tags:

```bash
terraform apply \
  -var="api_image_tag=$IMAGE_TAG" \
  -var="worker_image_tag=$IMAGE_TAG"
```

The ECS services use `force_new_deployment = true` and will roll new tasks
automatically when the task definition changes.

---

## Step 6 — Build and deploy the React SPA

```bash
# Build (VITE_API_BASE_URL must match the CloudFront /api path)
VITE_API_BASE_URL=https://app.$DOMAIN_NAME/api/v1 \
  npm run build --workspace=apps/web

# Get bucket name from Terraform output
WEB_BUCKET=$(terraform -chdir=infrastructure/terraform/environments/staging \
  output -raw web_bucket_name)

CF_DIST_ID=$(terraform -chdir=infrastructure/terraform/environments/staging \
  output -raw cloudfront_distribution_id)

# Sync to S3
aws s3 sync apps/web/dist/ s3://$WEB_BUCKET/ \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

# Upload index.html with no-cache (ensures SPA bootstrap is always fresh)
aws s3 cp apps/web/dist/index.html s3://$WEB_BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $CF_DIST_ID \
  --paths "/*"
```

---

## Step 7 — SES sandbox removal (production only)

By default, SES accounts are in **sandbox mode** — you can only send to
verified email addresses. To send to any recipient in production:

1. AWS Console → **Simple Email Service** → **Account dashboard**
2. Click **Request production access**
3. Fill in the use case (transactional email, opt-in list, etc.)
4. Approval typically takes 24 hours

Alternatively via CLI:

```bash
aws support create-case \
  --subject "Request to move out of Amazon SES sandbox" \
  --service-code "ses" \
  --severity-code "normal" \
  --communication-body "We are requesting production SES access for the domain \
    airbus-tools.example.com. Use case: transactional email (account notifications, \
    password resets). Estimated volume: < 1000/day."
```

---

## CI/CD integration (GitHub Actions)

### Secrets to add in GitHub → Settings → Secrets and variables → Actions

| Secret name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user key with ECR push + ECS deploy permissions |
| `AWS_SECRET_ACCESS_KEY` | Corresponding secret |
| `TF_VAR_ATLAS_PUBLIC_KEY` | Atlas API public key |
| `TF_VAR_ATLAS_PRIVATE_KEY` | Atlas API private key |
| `STAGING_DOMAIN` | Your staging domain name |
| `PROD_DOMAIN` | Your production domain name |
| `ALERT_EMAIL` | Alert notification email |
| `ATLAS_ORG_ID` | Atlas org ID |

### Recommended workflow strategy

| Branch | Terraform | Docker push | SPA deploy |
|---|---|---|---|
| `develop` | `terraform plan` (staging) | Push to ECR → `terraform apply` staging | Sync to staging bucket |
| `main` | `terraform plan` (production) | Push to ECR → `terraform apply` production | Sync to production bucket |

### Important

- Terraform workspace is **NOT** used — staging and production are separate
  root modules with separate state files. Never run `terraform workspace`.
- The bootstrap step (`infrastructure/terraform/bootstrap/`) is a one-time
  manual action — it is not part of any CI pipeline.
- `terraform apply` in CI should use `-auto-approve` only after a plan has
  been reviewed (use the PR comment pattern to post plans).

---

## Atlas API key setup

1. Log into [cloud.mongodb.com](https://cloud.mongodb.com)
2. Navigate to your **Organisation** → **Access Manager** → **API Keys**
3. Create a key with roles: **Organisation Project Creator** (to create
   clusters) or **Project Owner** if the project already exists
4. Copy the **Public Key** and **Private Key** (private key is shown once only)
5. Set them as `TF_VAR_atlas_public_key` / `TF_VAR_atlas_private_key`
6. In **Network Access** → allow the IP(s) of your CI runner or use `0.0.0.0/0`
   for the API key whitelist (Atlas API, not DB access — separate from NAT IPs)

The Atlas module will automatically whitelist the application NAT Gateway EIPs
in the database network access list.

---

## Quick reference — Terraform commands

```bash
# Staging
cd infrastructure/terraform/environments/staging
terraform init
terraform plan
terraform apply
terraform output route53_name_servers   # get NS records
terraform output app_url                # get app URL

# Production
cd infrastructure/terraform/environments/production
terraform init
terraform plan
terraform apply
```
