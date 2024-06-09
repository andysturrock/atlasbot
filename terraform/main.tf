terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "4.51.0"
    }
  }
}

provider "google" {
  project     = var.gcp_identity_project_id
  credentials = var.gcp_identity_project_credentials
  region      = var.gcp_region
  zone        = var.gcp_zone
  alias       = "identity_project"
}

provider "google" {
  project     = var.gcp_gemini_project_id
  credentials = var.gcp_gemini_project_credentials
  region      = var.gcp_region
  zone        = var.gcp_zone
  alias       = "gemini_project"
}