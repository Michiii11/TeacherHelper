FROM node:22 as build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ARG CONFIGURATION=production
RUN npm run build -- --configuration=${CONFIGURATION}

RUN ls -la /app/dist && ls -la /app/dist/frontend

FROM nginx:alpine
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
