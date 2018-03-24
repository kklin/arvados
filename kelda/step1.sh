#!/bin/bash
set -e

kelda ssh arvados-api-server bash /trust-workbench-and-make-admin.sh
