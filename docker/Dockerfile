FROM ubuntu:trusty
MAINTAINER Sébastien M-B <essembeh@gmail.com>

RUN locale-gen en_US.UTF-8  
ENV LANG en_US.UTF-8  
ENV LANGUAGE en_US:en  
ENV LC_ALL en_US.UTF-8

ADD sources.list /etc/apt/

RUN apt-get update
RUN apt-get install -y git
RUN apt-get install -y nodejs npm ruby-compass

RUN ln -s /usr/bin/nodejs /usr/bin/node
RUN npm install -g grunt-cli bower

RUN git clone https://github.com/panrafal/depthy.git
WORKDIR /depthy
RUN npm install
RUN bower install --allow-root --config.interactive=false

EXPOSE 9000 
ENTRYPOINT grunt serve

