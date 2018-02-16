FROM golang:1.9 as builder
RUN go get github.com/kklin/arvados/services/crunch-dispatch-slurm

FROM ubuntu:16.04
COPY --from=builder /go/bin/crunch-dispatch-slurm /usr/local/bin/crunch-dispatch-slurm

RUN apt-get update && apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common \
    sudo
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
RUN add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
RUN apt-get update
RUN apt-get install -y slurm-llnl munge docker-ce
RUN mkdir /var/run/munge
RUN chown munge /var/run/munge

# Arvados packages.
RUN /usr/bin/apt-key adv --keyserver pool.sks-keyservers.net --recv 1078ECD7
RUN echo "deb http://apt.arvados.org/ xenial main" > /etc/apt/sources.list.d/arvados.list
RUN apt-get update
RUN apt-get install -y python-arvados-python-client crunch-run python-arvados-fuse
