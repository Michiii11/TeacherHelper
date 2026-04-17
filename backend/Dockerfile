FROM eclipse-temurin:21-jre

WORKDIR /opt/application

COPY ./target/backend-1.0-SNAPSHOT-runner.jar /opt/application/backend.jar

ENV DB_URL="unknown"
ENV DB_USER="unknown"
ENV DB_PASSWORD="unknown"
ENV FRONTEND_URL="unknown"
ENV MAIL_HOST="unknown"
ENV MAIL_USER="unknown"
ENV MAIL_PASSWORD="unknown"
ENV BUCKET_NAME="unknown"

EXPOSE 8080

ENTRYPOINT ["/bin/sh", "-c", "java \
-Dquarkus.http.host=0.0.0.0 \
-Dquarkus.datasource.jdbc.url=${DB_URL} \
-Dquarkus.datasource.username=${DB_USER} \
-Dquarkus.datasource.password=${DB_PASSWORD} \
-Dfrontend.url=${FRONTEND_URL} \
-Dmail.host=${MAIL_HOST} \
-Dmail.user=${MAIL_USER} \
-Dmail.password=${MAIL_PASSWORD} \
-Dbucket.name=${BUCKET_NAME} \
-jar /opt/application/backend.jar"]