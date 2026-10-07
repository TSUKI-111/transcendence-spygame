FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy \
    ./node_modules/.bin/prisma generate

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]