#!/bin/sh
set -e

mkdir -p /mnt/pgdata
if ! mountpoint -q /mnt/pgdata; then
    mount -o loop /mnt/host/c/Dev/pgdata.img /mnt/pgdata
fi
chown -R postgres:postgres /mnt/pgdata

mkdir -p /run/postgresql
chown -R postgres:postgres /run/postgresql

exec su - postgres -c "postgres -D /mnt/pgdata/data"
