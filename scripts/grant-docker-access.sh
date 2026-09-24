#!/usr/bin/env bash
set -euo pipefail

# Run: sudo bash scripts/grant-docker-access.sh
# Or:  sudo bash scripts/grant-docker-access.sh agent01
# Docker daemon access grants administrative control over this machine.

if [[ $EUID -ne 0 ]]; then
  echo 'Run this script with sudo.' >&2
  exit 1
fi

target_user="${1:-${SUDO_USER:-}}"
if [[ -z "$target_user" || "$target_user" == root ]]; then
  echo 'Specify the non-root account to grant access to.' >&2
  exit 1
fi
if ! id "$target_user" >/dev/null 2>&1; then
  echo "User does not exist: $target_user" >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo 'Docker is not installed on this machine.' >&2
  exit 1
fi

socket=/var/run/docker.sock
if [[ ! -S "$socket" ]]; then
  echo "Docker socket not found at $socket. Start Docker, then run this script again." >&2
  exit 1
fi
socket_group="$(stat -c '%G' "$socket")"
if [[ "$socket_group" == nobody || "$socket_group" == nogroup || "$socket_group" == UNKNOWN ]]; then
  echo 'The Docker socket has an unmapped owner/group (often a host socket mounted into an unprivileged container).' >&2
  echo 'Run this script on the Docker host, or ask its administrator to map the Docker socket group into this environment.' >&2
  echo 'No ownership or permission changes have been made.' >&2
  exit 1
fi

if ! getent group docker >/dev/null; then
  groupadd --system docker
fi
usermod -aG docker "$target_user"

# Normal Docker installs already use root:docker with mode 660. If this
# installation uses a different socket group, grant this user an ACL rather
# than changing the daemon-managed socket's owner or other users' access.
if [[ "$socket_group" != docker ]]; then
  if command -v setfacl >/dev/null 2>&1; then
    setfacl -m "u:${target_user}:rw" "$socket"
    echo 'Added a user ACL to the current Docker socket. Re-run after a daemon restart if its permissions reset.'
  else
    echo "Added $target_user to docker, but the socket belongs to $socket_group." >&2
    echo 'Install the acl utility and re-run, or configure the Docker daemon socket to use the docker group.' >&2
    exit 1
  fi
fi

# This starts a fresh process with the user's updated supplementary groups.
runuser -u "$target_user" -- docker version --format '{{.Server.Version}}'
echo "Docker access is ready for $target_user."
echo 'Existing sessions can use: sg docker -c "docker ps"'
echo 'New login sessions will use the docker group automatically.'
