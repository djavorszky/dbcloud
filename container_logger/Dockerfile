FROM node:5

MAINTAINER gyula.weber.in@gmail.com

RUN apt-get update && \
    apt-get -y install \
    apparmor mysql-client apt-transport-https libzmq3-dev \
    python make g++; \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /srv
ADD init /init
RUN mkdir /srv/src
COPY app/package.json /srv/src
RUN cd /srv/src;npm install
COPY app/* /srv/src/
CMD "/init"

