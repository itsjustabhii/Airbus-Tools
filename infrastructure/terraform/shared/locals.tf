###############################################################################
# Shared local values — naming convention
#
# Usage in any module:
#
#   locals {
#     name_prefix = "airbus-tools-${var.environment}"
#   }
#
# Modules do NOT import this file directly; they each declare the same
# local so the pattern stays consistent. This file is a reference / template.
###############################################################################

# Common variable expected in every module and environment root.
variable "environment" {
  description = "Deployment environment. One of: staging, production."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "aws_region" {
  description = "Primary AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

locals {
  # Consistent resource name prefix used across all modules.
  # Example: "airbus-tools-staging", "airbus-tools-production"
  name_prefix = "airbus-tools-${var.environment}"

  common_tags = {
    Project     = "airbus-tools"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
