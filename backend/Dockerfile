FROM eclipse-temurin:21-jre

ENV DB_URL="unknown"
ENV DB_USER="unknown"
ENV DB_PASSWORD="unknown"

ENV FRONTEND_URL="unknown"

RUN mkdir -p /opt/application
WORKDIR /opt/application

COPY ./target/reservationssystem-runner.jar /opt/application/backend.jar

EXPOSE 8080

ENTRYPOINT ["/bin/sh", "-c", "java -Dquarkus.datasource.jdbc.url=${DB_URL} -Dquarkus.datasource.password=${DB_PASSWORD} -Dquarkus.datasource.username=${DB_USER} -Dfrontend.url=${FRONTEND_URL} -jar backend.jar"]
