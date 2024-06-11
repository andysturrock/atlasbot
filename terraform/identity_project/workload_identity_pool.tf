resource "random_id" "pool_name_suffix" {
  byte_length = 2
}

resource "google_iam_workload_identity_pool" "aws_atlasbot" {
  # provider = google.identity_project
  # When you delete a pool it soft deletes for 30 days, so we need to create a new name each time.
  workload_identity_pool_id = "aws-atlasbot-${random_id.pool_name_suffix.hex}"
  description               = "Pool for Atlas Bot workloads"
}

resource "google_iam_workload_identity_pool_provider" "aws_atlasbot" {
  # provider                           = google.identity_project
  workload_identity_pool_id          = google_iam_workload_identity_pool.aws_atlasbot.workload_identity_pool_id
  workload_identity_pool_provider_id = "aws-atlasbot"
  display_name                       = "AWS AtlasBot"
  description                        = "AWS identity pool provider"
  aws {
    account_id = var.aws_account_id
  }
  attribute_mapping = {
    "google.subject"     = "assertion.arn"
    "attribute.aws_role" = "assertion.arn.contains('assumed-role') ? assertion.arn.extract('{account_arn}assumed-role/') + 'assumed-role/' + assertion.arn.extract('assumed-role/{role_name}/') : assertion.arn"
  }
}
