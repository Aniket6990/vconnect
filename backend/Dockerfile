FROM node

COPY dist/index.js home/app/index.js
COPY dist/db/Users.js home/app/db/Users.js
COPY package.json home/app/package.json
COPY package-lock.json home/app/package-lock.json
COPY .env home/app/.env

WORKDIR home/app

RUN npm install

CMD [ "node", "index.js" ]