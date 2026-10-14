#!/bin/sh
set -e

mkdir -p /mnt/pgdata
if ! mountpoint -q /mnt/pgdata; then
    mount -o loop /mnt/host/c/Dev/pgdata.img /mnt/pgdata
fi
chown -R postgres:postgres /mnt/pgdata


mkdir -p /run/postgresql
chown -R postgres:postgres /run/postgresql

if [ ! -f /mnt/pgdata/data/PG_VERSION ]; then
    mkdir -p /mnt/pgdata/data
    chown -R postgres:postgres /mnt/pgdata/data
    su - postgres -c "initdb -D /mnt/pgdata/data"
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" /mnt/pgdata/data/postgresql.conf
    echo "host all all 0.0.0.0/0 trust" >> /mnt/pgdata/data/pg_hba.conf
    echo "host all all ::0/0 trust" >> /mnt/pgdata/data/pg_hba.conf
fi

if ! su - postgres -c "pg_isready -h localhost -p 5432"; then
    su - postgres -c "/usr/bin/pg_ctl -D /mnt/pgdata/data -l /mnt/pgdata/logfile.txt start"
fi

su - postgres -c "createuser -s postgres 2>/dev/null || true"
su - postgres -c "createdb -O postgres hotel_saas_p1b01a_test 2>/dev/null || true"

echo "POSTGRES_READY"

