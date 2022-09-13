FROM node:latest

RUN apt-get update && \
    apt-get install -y openjdk-17-jdk-headless
COPY . .
RUN npm install
CMD ["node", "app.js"]
EXPOSE 8080