#!/bin/bash

PACKAGE=$1
PACKAGE_VERSION=$2

if [[ "$PACKAGE" == "" ]] || [[ "$PACKAGE_VERSION" == "" ]]; then
  echo "Syntax: $0 <package> <version>"
  exit 1
fi

if [[ "$PACKAGE" == "arvados-workbench" ]]; then
  RESET_NGINX_DAEMON_FLAG=true
else
  RESET_NGINX_DAEMON_FLAG=false
fi

if [[ $RESET_NGINX_DAEMON_FLAG ]]; then
  # our packages restart nginx; with the 'daemon off' flag in place, 
  # that makes package install hang. Arguably we shouldn't be restarting nginx on install.
  (cd /etc/service; sv down nginx || true)
  sed -i 's/daemon off;/#daemon off;/' /etc/nginx/nginx.conf
fi

apt-get -qqy install $PACKAGE="$PACKAGE_VERSION"

if [[ $RESET_NGINX_DAEMON_FLAG ]]; then
  /etc/init.d/nginx stop
  sed -i 's/#daemon off;/daemon off;/' /etc/nginx/nginx.conf
  (cd /etc/service; sv up nginx || true)
fi


