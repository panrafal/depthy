FROM ubuntu:bionic
MAINTAINER Sébastien M-B <essembeh@gmail.com>

RUN apt-get update && apt-get install -y git nodejs npm ruby-compass
RUN npm install -g bower grunt-cli

COPY app/package.json /
RUN npm install

COPY app/bower.json /
RUN bower install --allow-root --config.interactive=false


COPY app/ /

RUN mv bower_components app/

EXPOSE 9000
ENTRYPOINT grunt serve --stack --force
