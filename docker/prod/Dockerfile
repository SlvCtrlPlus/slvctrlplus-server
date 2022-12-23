FROM node:18-alpine
WORKDIR /usr/app
COPY package.json yarn.lock tsconfig.json ./
COPY src ./src
RUN ls -a
RUN yarn install
RUN yarn run build

FROM node:18-alpine

# Create app directory
WORKDIR /usr/app

ENV PORT 1337

RUN apk add --no-cache eudev

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --prod
COPY --from=0 /usr/app/dist .
RUN yarn global add pm2 --prod
EXPOSE 1337
CMD ["pm2-runtime","index.js"]
