#!/bin/bash
set -e
export HOME="/root"
arv keep_service create --keep-service "$(cat <<EOF
{
 "service_host":"arvados-keep-store-0.arvados-keep-store",
 "service_port":25107,
 "service_ssl_flag":false,
 "service_type":"disk"
}
EOF
)"

arv keep_service create --keep-service "$(cat <<EOF
{
 "service_host":"arvados-keep-store-1.arvados-keep-store",
 "service_port":25107,
 "service_ssl_flag":false,
 "service_type":"disk"
}
EOF
)"

arv keep_service create --keep-service "$(cat <<EOF
{
 "service_host":"8.8.8.8",
 "service_port":25107,
 "service_ssl_flag":true,
 "service_type":"proxy"
}
EOF
)"
