#!/bin/bash

PACKAGE=$1
PACKAGE_VERSION=$2

if [[ "$1" == "" ]] || [[ "$2" == "" ]]; then
  echo "Syntax: $0 <package> <version>"
  exit 1
fi

apt-get -qqy install $1="$2"
