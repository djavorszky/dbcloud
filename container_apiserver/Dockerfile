FROM node:5

MAINTAINER gyula.weber.in@gmail.com

RUN apt-get update && \
    apt-get -y install \
    apparmor mysql-client apt-transport-https libzmq3-dev; \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ADD init /init
WORKDIR /srv

COPY app/package.json /srv/
RUN npm install

COPY app/src /srv/app

CMD "/init"

