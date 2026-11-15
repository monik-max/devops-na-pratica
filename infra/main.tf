terraform {
  required_version = ">= 1.6, < 2.0"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "4.6.0"
    }
  }
}

# Usa o contexto ativo do Docker, como desktop-linux no Windows.
provider "docker" {}

data "docker_image" "gestao" {
  name = "gestao-devops:local"
}

resource "docker_network" "lab" {
  name   = "gestao-devops-terraform"
  driver = "bridge"
}

resource "docker_volume" "dados" {
  name = "gestao-devops-terraform-dados"
}

resource "docker_container" "gestao" {
  name  = "gestao-devops-terraform"
  image = data.docker_image.gestao.id

  env = [
    "PORT=3000",
    "DB_STORAGE=/dados/gestao.sqlite",
  ]

  restart = "unless-stopped"

  ports {
    internal = 3000
    external = 8081
    ip       = "127.0.0.1"
  }

  networks_advanced {
    name = docker_network.lab.name
  }

  mounts {
    type   = "volume"
    source = docker_volume.dados.name
    target = "/dados"
  }
}

output "url_clientes" {
  description = "Endpoint de validação do ambiente local provisionado."
  value       = "http://127.0.0.1:8081/gestao/clientes"
}
