REPO = cure

docker-build-arvados-runtime:
	docker build -t ${REPO}/arvados-runtime -f Dockerfile.runtime .

docker-push-arvados-slurm-runtime: docker-build-arvados-slurm-runtime
	docker push ${REPO}/arvados-slurm-runtime

docker-push-arvados-rails-runtime: docker-build-arvados-rails-runtime
	docker push ${REPO}/arvados-rails-runtime

docker-build-arvados-rails-runtime:
	docker build -t ${REPO}/arvados-rails-runtime -f Dockerfile.rails-runtime .

docker-push-arvados-runtime: docker-build-arvados-runtime
	docker push ${REPO}/arvados-runtime

docker-build-arvados-slurm-runtime:
	docker build -t ${REPO}/arvados-slurm-runtime -f Dockerfile.slurm-runtime .

docker-build-shell-server:
	docker build -t ${REPO}/arvados-shell-server -f Dockerfile.shell_server .

docker-push-shell-server: docker-build-shell-server
	docker push ${REPO}/arvados-shell-server


