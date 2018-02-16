FROM golang:1.9 as builder

RUN go get github.com/kklin/arvados/services/ws

FROM ubuntu:16.04
COPY --from=builder /go/bin/ws /usr/local/bin/ws

ENTRYPOINT []
