terraform {
  cloud {
    organization = "sturrock"

    workspaces {
      name = "dev"
    }
  }
}