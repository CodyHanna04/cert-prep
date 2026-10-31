#!/bin/sh
# Runs once, on first start of an empty data directory.
# Creates the four runtime roles and the databases. Passwords come from the container env.
# Use simple alphanumeric/dash passwords (they are interpolated into SQL).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
CREATE ROLE certprep_owner LOGIN PASSWORD '${OWNER_PASSWORD}' NOSUPERUSER NOBYPASSRLS;
CREATE ROLE app_user       LOGIN PASSWORD '${APP_PASSWORD}'   NOSUPERUSER NOBYPASSRLS;
CREATE ROLE auth_app       LOGIN PASSWORD '${AUTH_PASSWORD}'  NOSUPERUSER NOBYPASSRLS;
CREATE ROLE admin_app      LOGIN PASSWORD '${ADMIN_PASSWORD}' NOSUPERUSER NOBYPASSRLS;
ALTER ROLE auth_app  SET search_path = auth;
ALTER ROLE admin_app SET search_path = auth;
ALTER ROLE app_user  SET search_path = app;
CREATE DATABASE certprep OWNER certprep_owner;
CREATE DATABASE certprep_test OWNER certprep_owner;
SQL

for db in certprep certprep_test; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<SQL
REVOKE ALL ON DATABASE $db FROM PUBLIC;
GRANT CONNECT ON DATABASE $db TO certprep_owner, app_user, auth_app, admin_app;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL
done
