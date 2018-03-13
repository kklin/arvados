REPO = cure

docker-push-arvados-runtime:
	docker push ${REPO}/arvados-runtime

docker-arvados-runtime:
	docker build -t ${REPO}/arvados-runtime -f Dockerfile.runtime .

docker-build-sso:
	docker build -t ${REPO}/arvados-sso-server -f Dockerfile.sso .

docker-push-sso: docker-build-sso
	docker push ${REPO}/arvados-sso-server

docker-build-workbench:
	docker build -t ${REPO}/arvados-workbench -f Dockerfile.workbench .

docker-push-workbench: docker-build-workbench
	docker push ${REPO}/arvados-workbench

docker-build-keep:
	docker build -t ${REPO}/arvados-keep -f Dockerfile.keep .

docker-push-keep: docker-build-keep
	docker push ${REPO}/arvados-keep

docker-build-ws:
	docker build -t ${REPO}/arvados-ws -f Dockerfile.ws .

docker-push-ws: docker-build-ws
	docker push ${REPO}/arvados-ws

docker-build-api-server:
	docker build -t ${REPO}/arvados-api-server -f Dockerfile.api_server .

docker-push-api-server: docker-build-api-server
	docker push ${REPO}/arvados-api-server

docker-build-shell-server:
	docker build -t ${REPO}/arvados-shell-server -f Dockerfile.shell_server .

docker-push-shell-server: docker-build-shell-server
	docker push ${REPO}/arvados-shell-server

docker-build-slurm:
	docker build -t ${REPO}/slurm -f Dockerfile.slurm .

docker-push-slurm: docker-build-slurm
	docker push ${REPO}/slurm
