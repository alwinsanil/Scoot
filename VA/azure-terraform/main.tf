provider "azurerm" {
  features {}
  subscription_id = "d33a39a2-8dcc-47fc-a1a7-3958b74c91a7"
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-scoot-bot"
  location = "Canada Central"
}

resource "azurerm_storage_account" "sa" {
  name                     = "scootfuncsa01"
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_service_plan" "plan" {
  name                = "scoot-plan"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  os_type             = "Linux"
  sku_name            = "Y1"
}

resource "azurerm_linux_function_app" "function" {
  name                       = "scoot-botfunc"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  service_plan_id            = azurerm_service_plan.plan.id
  storage_account_name       = azurerm_storage_account.sa.name
  storage_account_access_key = azurerm_storage_account.sa.primary_access_key

  site_config {
    application_stack {
      python_version = "3.10"
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME = "python"
    WEBSITE_RUN_FROM_PACKAGE = "0"
  }
}

resource "azurerm_cosmosdb_account" "cosmos" {
  name                = "scootcosmos${random_integer.rand.result}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.rg.location
    failover_priority = 0
  }
}

resource "azurerm_cosmosdb_sql_database" "db" {
  name                = "scootdb"
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = azurerm_cosmosdb_account.cosmos.name
}

resource "azurerm_cosmosdb_sql_container" "bookings" {
  name                = "bookings"
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = azurerm_cosmosdb_account.cosmos.name
  database_name       = azurerm_cosmosdb_sql_database.db.name

  partition_key_paths = ["/booking_id"]

  indexing_policy {
    indexing_mode = "consistent"
  }
}

resource "azurerm_cosmosdb_sql_container" "issues" {
  name                = "customer_issues"
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = azurerm_cosmosdb_account.cosmos.name
  database_name       = azurerm_cosmosdb_sql_database.db.name

  partition_key_paths = ["/user_id"]

  indexing_policy {
    indexing_mode = "consistent"
  }
}

resource "random_integer" "rand" {
  min = 1000
  max = 9999
}
