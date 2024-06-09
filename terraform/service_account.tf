# resource "google_service_account" "gemini" {
#   provider     = google.identity_project
#   account_id   = "gemini"
#   display_name = "Gemini Service Account"
#   description  = "Service Account for calling Gemini APIs"
# }

# resource "google_service_account_iam_binding" "service_account_token_creator" {
#   provider           = google.identity_project
#   service_account_id = google_service_account.gemini.name
#   role               = "roles/iam.serviceAccountTokenCreator"
#   members            = ["serviceAccount:${google_service_account.gemini.email}"]
# }

# resource "google_service_account_iam_binding" "workload_identity_user" {
#   provider           = google.identity_project
#   service_account_id = google_service_account.gemini.name
#   role               = "roles/iam.workloadIdentityUser"
#   members            = ["serviceAccount:${google_service_account.gemini.email}"]
# }