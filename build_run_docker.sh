#!/usr/bin/env bash

docker build -t cas_web .
docker run -it --rm --name cas_web-app -p 3500:3500 -p 5000:5000 cas_web