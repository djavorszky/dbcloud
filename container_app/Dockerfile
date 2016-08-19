FROM node:5

MAINTAINER gyula.weber.in@gmail.com

RUN apt-get update && \
    apt-get -y install \
    apparmor mysql-client apt-transport-https libzmq3-dev \
    libavahi-compat-libdnssd-dev; \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ADD app/package.json /srv/package.json
RUN cd /srv;npm install
RUN npm install -g grunt

ADD app/src /srv/src
ADD app/Gruntfile.js /srv/
RUN cd /srv/;grunt
ADD app/a_dump_test /srv/a_dump_test

ADD init /init
WORKDIR /srv
CMD "/init"

