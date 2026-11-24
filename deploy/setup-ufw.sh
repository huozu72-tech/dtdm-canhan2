#!/usr/bin/env bash
set -euo pipefail

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.100.0/24 to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw --force enable
sudo ufw status verbose
