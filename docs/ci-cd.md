# CI/CD — GitHub Actions

This document describes every workflow in `.github/workflows/` and explains what
you need to configure before they can run.

---

## Pipelines at a glance

| Workflow file | Trigger | Purpose |
|---|---|---|
| `ci.yml` | Push / PR → `main`, `develop` | PR gate: lint, typecheck, tests, build, security |
| `deploy-staging.yml` | Push → `develop` | Deploy to the **staging** environment |
| `deploy-production.yml` | Push → `main` | Deploy to the **production** environment |

---

## PR pipeline (`ci.yml`)

Sequential gate — each job must pass before the next starts.

```
checkout → install → lint → typecheck → unit tests → integration tests → build → security
```

| Job | What it does |
|---|---|
| `lint` | ESLint (`--max-warnings 0`) + Prettier format check |
| `typecheck` | `tsc --noEmit` across all packages, api, and web |
| `unit-tests` | Vitest for `apps/api` and `apps/web`; uploads coverage artifacts |
| `integration-tests` | Same test suite with a live Redis service container |
| `build` | TypeScript compile + Vite build; uploads `web-dist-<sha>` artifact |
| `security` | `npm audit --audit-level=high`; Trivy CRITICAL/HIGH scan of both Docker images (not pushed); SARIF results uploaded to GitHub Security tab |

No AWS credentials are used in this pipeline.

---

## Production pipeline (`deploy-production.yml`)

```
main → tests → build → docker-build (scan → push) → deploy-api → health-check
     → deploy-frontend (S3 upload → CloudFront invalidation)
     → deploy-worker (parallel with frontend)
```

| Job | What it does |
|---|---|
| `tests` | Full test suite (Redis service container included) |
| `build` | Application build; injects `VITE_API_URL` at build time; uploads `web-dist-<sha>` |
| `docker-build` | Builds API and Worker images with GHA cache; Trivy CRITICAL/HIGH scan; pushes to ECR only after a clean scan |
| `deploy-api` | Downloads live task definition; renders new revision with updated image tag; deploys to ECS; waits for stability; runs HTTP health check; verifies `services-stable` |
| `deploy-frontend` | Downloads `web-dist-<sha>` artifact; syncs to S3 (hashed assets get long-lived cache, `index.html` gets no-cache); creates and waits for CloudFront invalidation |
| `deploy-worker` | Same ECS rolling deploy pattern as `deploy-api`, runs in parallel with `deploy-frontend` after images are pushed |

`concurrency: cancel-in-progress: false` — a running production deploy is **never** interrupted.

---

## Staging pipeline (`deploy-staging.yml`)

Identical shape to production, triggered by `develop` pushes, targeting the
`staging` GitHub Environment.

`concurrency: cancel-in-progress: true` — a newer commit to `develop` will
cancel an in-flight staging deploy.

---

## Authentication — OIDC (no static keys)

AWS credentials are obtained via the GitHub OIDC provider so **no `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` are ever stored as GitHub secrets**.

### 1. Create an IAM OIDC Identity Provider

In the AWS Console (or via Terraform):

```
Provider URL : https://token.actions.githubusercontent.com
Audience     : sts.amazonaws.com
```

### 2. Create an IAM Role per environment

Create two roles — one for staging, one for production — with the following
trust policy (replace the placeholders):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<ORG>/<REPO>:environment:<ENVIRONMENT>"
        }
      }
    }
  ]
}
```

Attach a policy that grants the role the minimum permissions needed:

- `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:PutImage`, … (ECR push)
- `ecs:DescribeTaskDefinition`, `ecs:RegisterTaskDefinition`, `ecs:UpdateService`, `ecs:DescribeServices` (ECS deploy)
- `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` (S3 web bucket only)
- `cloudfront:CreateInvalidation`, `cloudfront:GetInvalidation` (CloudFront)

### 3. Configure GitHub Environments

Go to **Settings → Environments** in your GitHub repository and create:

| Environment | Protection rules |
|---|---|
| `staging` | None (auto-deploy on `develop` push) |
| `production` | Require reviewers + restrict to `main` branch (recommended) |

For each environment, add the following **variables** (`vars.*`) and **secrets** (`secrets.*`):

#### Variables (non-sensitive, visible in logs)

| Name | Example value |
|---|---|
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCOUNT_ID` | `123456789012` |
| `ECR_API_REPOSITORY` | `airbus-tools-production-api` |
| `ECR_WORKER_REPOSITORY` | `airbus-tools-production-worker` |
| `ECS_CLUSTER` | `airbus-tools-production` |
| `ECS_API_SERVICE` | `airbus-tools-production-api` |
| `ECS_WORKER_SERVICE` | `airbus-tools-production-worker` |
| `API_TASK_DEFINITION` | `airbus-tools-production-api` |
| `WORKER_TASK_DEFINITION` | `airbus-tools-production-worker` |
| `API_CONTAINER_NAME` | `api` |
| `WORKER_CONTAINER_NAME` | `worker` |
| `S3_WEB_BUCKET` | `airbus-tools-production-web` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E1ABCDEF1234567` |
| `API_HEALTH_URL` | `https://api.airbus-tools.example.com/health` |
| `VITE_API_URL` | `https://api.airbus-tools.example.com` |

#### Secrets (sensitive, redacted in logs)

| Name | Value |
|---|---|
| `GH_OIDC_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/github-actions-<ENVIRONMENT>` |

---

## Composite actions

| Action | Path | Purpose |
|---|---|---|
| `setup-node` | `.github/actions/setup-node/action.yml` | Checkout + Node 20 setup + `npm ci` |
| `health-check` | `.github/actions/health-check/action.yml` | Poll an HTTPS URL until HTTP 200 or timeout |

---

## Environment separation

| Branch | GitHub Environment | AWS account / resources |
|---|---|---|
| any PR | *(none — no AWS)* | No cloud resources touched |
| `develop` | `staging` | Staging ECR, ECS cluster, S3, CloudFront |
| `main` | `production` | Production ECR, ECS cluster, S3, CloudFront |

---

## Docker image tags

Every pushed image is tagged with both the **full Git SHA** (immutable, used for
ECS task definition rendering) and **`latest`** (convenience, for manual pulls).

---

## Security scan behaviour

- **PR pipeline**: Trivy scans images built locally (never pushed). The
  workflow fails immediately on any CRITICAL or HIGH CVE. SARIF results are
  uploaded to the GitHub Security tab.
- **Deploy pipelines**: Trivy scan runs after `docker build` but **before**
  `docker push`. An image with a CRITICAL/HIGH CVE will never reach ECR.
