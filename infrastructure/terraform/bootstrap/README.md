# Bootstrap README

## What this is

A one-time Terraform root that creates the S3 bucket and DynamoDB table used
as the remote state backend for all environment roots (staging and production).

## Prerequisites

- AWS CLI configured with credentials that have permission to create S3 buckets
  and DynamoDB tables
- Terraform >= 1.7.0

## Steps

```bash
cd infrastructure/terraform/bootstrap
terraform init
terraform apply
```

After apply, note the outputs:

```
state_bucket_name = "airbus-tools-tf-state"
lock_table_name   = "airbus-tools-tf-locks"
```

These values are already hard-coded into the environment `backend.tf` files.
You do not need to change anything unless you customise the bucket/table names.

## Important

- `prevent_destroy = true` is set on both resources. To delete them you must
  first remove that lifecycle rule.
- Do **not** store this bootstrap state in itself — it uses local state only
  (`terraform.tfstate` in this directory). Keep that file safe or commit it
  (it contains no secrets).
- Run this bootstrap **only once**. Re-running `terraform apply` on an already
  bootstrapped account is safe (no changes will be made), but there is no need
  to run it again.
