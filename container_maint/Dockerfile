FROM node:5

MAINTAINER gyula.weber.in@gmail.com

WORKDIR /srv
RUN apt-get update && \
    apt-get -y install apparmor mysql-client apt-transport-https \
    libzmq3-dev; \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# make it possible for the build system to cache if the modules are not changed
ADD app/package.json /srv/package.json
RUN npm install --production

ADD app/ /srv
ADD init /init

CMD "/init"

