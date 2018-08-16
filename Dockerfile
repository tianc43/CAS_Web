FROM node:4.9.1



WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

#RUN npm install -g grunt-cli
RUN npm install -g bower
RUN bower install --allow-root
#RUN grunt compileAssets --force

EXPOSE 3500
EXPOSE 5000

CMD [ "npm", "start" ]
