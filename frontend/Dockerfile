# Use the official Node.js image for building Angular
FROM node:22 as build

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json for dependency installation
COPY package*.json ./

# Install Angular dependencies
RUN npm install

# Copy the application code into the container
COPY . .

# Build the Angular app
ARG CONFIGURATION=production
RUN npm run build -- --configuration=${CONFIGURATION}

RUN ls -la /app/dist && ls -la /app/dist/frontend

# Use Nginx to serve the built Angular app
FROM nginx:alpine
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port for Angular app
EXPOSE 80

# Start the Nginx server
CMD ["nginx", "-g", "daemon off;"]
