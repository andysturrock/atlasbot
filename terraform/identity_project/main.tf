terraform {
  required_providers {
    google = {
      configuration_aliases = [ google ]
    }
  }
}

variable "aws_account_id" {
  type        = string
  description = "AWS Account to allow access from"
}

output "workload_identity_pool_id" {
  value = google_iam_workload_identity_pool.aws_atlasbot.workload_identity_pool_id
}