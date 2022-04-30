FROM node:17 as builder

RUN mkdir /builder
WORKDIR /builder
COPY . . 
RUN npm install && \
    npm run build


FROM node:17-slim
RUN useradd -ms /bin/bash poe
USER poe
RUN mkdir -p /home/poe/app
COPY --from=builder /builder/ /home/poe/app
WORKDIR /home/poe/app
EXPOSE 3000
ENTRYPOINT ["node", "build/src/main.js"]