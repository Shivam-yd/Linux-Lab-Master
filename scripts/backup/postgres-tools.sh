#!/usr/bin/env bash

PG_MAJOR="${PG_MAJOR:-16}"

postgres_tool() {
  local tool="$1"
  local versioned="/usr/lib/postgresql/${PG_MAJOR}/bin/${tool}"

  if [[ -x "$versioned" ]]; then
    printf '%s\n' "$versioned"
    return 0
  fi
  if command -v "${tool}-${PG_MAJOR}" >/dev/null 2>&1; then
    command -v "${tool}-${PG_MAJOR}"
    return 0
  fi
  command -v "$tool"
}

postgres_client_major() {
  "$1" --version | sed -nE 's/.*PostgreSQL[^0-9]*([0-9]+).*/\1/p'
}

check_postgres_server_major() {
  local database_url="$1"
  local psql_bin="$2"
  local pg_dump_bin="$3"
  local client_major server_major server_version

  client_major="$(postgres_client_major "$pg_dump_bin")"
  server_version="$("$psql_bin" --dbname="$database_url" --tuples-only --no-align --quiet \
    --command='SHOW server_version' 2>/dev/null)" || {
    echo "could not determine PostgreSQL server version" >&2
    return 1
  }
  server_major="${server_version%%.*}"

  if [[ -z "$client_major" || -z "$server_major" || "$client_major" != "$server_major" ]]; then
    echo "PostgreSQL client major version ${client_major:-unknown} does not match server major version ${server_major:-unknown}; set PG_MAJOR to the server version" >&2
    return 1
  fi
}