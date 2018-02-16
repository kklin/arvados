#!/bin/bash
set -e

kelda ssh arvados-api-server bundle exec rails runner /trust-workbench.rb
kelda ssh arvados-api-server bundle exec rails runner /make-admin.rb
