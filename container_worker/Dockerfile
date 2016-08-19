FROM node:5

MAINTAINER gyula.weber.in@gmail.com

WORKDIR /srv
RUN apt-get update && \
    apt-get -y install apparmor mysql-client apt-transport-https; \
    apt-get -y install p7zip unzip libzmq3-dev libavahi-compat-libdnssd-dev; \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# make it possible for the build system to cache if the modules are not changed
ADD app/package.json /srv/package.json
RUN npm install --production

ADD app/src /srv/app
ADD init /init
COPY util/* /usr/local/bin/

CMD "/init"

