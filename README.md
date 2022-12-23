# slvctrlplus-server

## Run

```bash
$ docker compose up -d
$ docker compose node bash
$ npm install
$ npm run dev
```

The service should be reachable under http://localhost:1337.

## Build image
```bash
$ VERSION=0.1.0
$ docker build -f ./docker/prod/Dockerfile -t slvctrlplus/server:$VERSION .
$ docker push slvctrlplus/server:$VERSION
```
