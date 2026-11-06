# ═══════════════════════════════════════════════════════════════════════════
# Hotel SaaS Platform v2 — Infrastructure as Code (Terraform VPS + Firewall)
# ═══════════════════════════════════════════════════════════════════════════
# Provisions a production Linux VPS with strict UFW/Cloud Firewall rules,
# SSH key-only authentication, and kernel sysctl tuning for SignalR WebSockets.
# ═══════════════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.38"
    }
  }
}

variable "do_token" {
  description = "Cloud Provider API Token (injected via TF_VAR_do_token)"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  default     = "production"
}

variable "region" {
  description = "Southeast Asia datacenter region (Singapore)"
  type        = string
  default     = "sgp1"
}

variable "vps_size" {
  description = "Droplet instance size (4 vCPU / 8GB RAM for Postgres 17 + .NET 10 + PLG Observability)"
  type        = string
  default     = "s-4vcpu-8gb"
}

variable "ssh_key_fingerprints" {
  description = "Authorized SSH key fingerprints for CI/CD and SRE access"
  type        = list(string)
}

variable "grafana_allowed_cidrs" {
  description = "Restricted office/VPN CIDR blocks allowed to access Grafana port 3001"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

provider "digitalocean" {
  token = var.do_token
}

resource "digitalocean_droplet" "hotelsaas_vps" {
  name       = "hotelsaas-v2-${var.environment}"
  image      = "ubuntu-24-04-x64"
  region     = var.region
  size       = var.vps_size
  monitoring = true
  ipv6       = true
  ssh_keys   = var.ssh_key_fingerprints

  user_data = <<-EOF
    #!/bin/bash
    set -euxo pipefail

    # 1. Kernel tuning for high-concurrency SignalR WebSockets & PostgreSQL
    cat << 'SYSCTL' > /etc/sysctl.d/99-hotelsaas-tuning.conf
    fs.file-max = 2097152
    net.core.somaxconn = 65535
    net.ipv4.tcp_max_syn_backlog = 65535
    net.ipv4.ip_local_port_range = 1024 65535
    net.ipv4.tcp_tw_reuse = 1
    vm.swappiness = 10
    SYSCTL
    sysctl --system

    # 2. Install Docker Engine & Docker Compose Plugin
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg ufw fail2ban
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # 3. Create application directory
    mkdir -p /opt/hotel-saas/docker/observability
  EOF

  tags = ["hotel-saas", var.environment, "managed-by-terraform"]
}

resource "digitalocean_firewall" "hotelsaas_fw" {
  name        = "hotelsaas-${var.environment}-firewall"
  droplet_ids = [digitalocean_droplet.hotelsaas_vps.id]

  # SSH (Port 22)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTP / HTTPS (Ports 80, 443)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Grafana Centralized Monitoring Dashboard (Port 3001)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "3001"
    source_addresses = var.grafana_allowed_cidrs
  }

  # Note: PostgreSQL (5435), Redis (6381), Prometheus (9090), and Loki (3100)
  # are strictly internal to the Docker bridge network and blocked from public internet.

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

output "vps_public_ipv4" {
  description = "Public IPv4 address of the Hotel SaaS VPS"
  value       = digitalocean_droplet.hotelsaas_vps.ipv4_address
}
