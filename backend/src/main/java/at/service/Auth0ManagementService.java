package at.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;
import org.eclipse.microprofile.rest.client.inject.RestClient;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.jboss.resteasy.reactive.RestPath;

@ApplicationScoped
public class Auth0ManagementService {

    @Inject
    @RestClient
    Auth0TokenClient tokenClient;

    @Inject
    @RestClient
    Auth0ManagementClient managementClient;

    @ConfigProperty(name = "auth0.management.client-id")
    String clientId;

    @ConfigProperty(name = "auth0.management.client-secret")
    String clientSecret;

    @ConfigProperty(name = "auth0.management.audience")
    String audience;

    public void deleteUser(String auth0Id) {
        if (auth0Id == null || auth0Id.isBlank()) {
            return;
        }

        Auth0TokenResponse token = tokenClient.getToken(new Auth0TokenRequest(
                clientId,
                clientSecret,
                audience,
                "client_credentials"
        ));

        managementClient.deleteUser(
                auth0Id,
                "Bearer " + token.accessToken()
        );
    }

    public record Auth0TokenRequest(
            @JsonProperty("client_id") String clientId,
            @JsonProperty("client_secret") String clientSecret,
            String audience,
            @JsonProperty("grant_type") String grantType
    ) {}

    public record Auth0TokenResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("token_type") String tokenType
    ) {}

    @RegisterRestClient(configKey = "auth0-token")
    @Path("/oauth/token")
    public interface Auth0TokenClient {
        @POST
        @Consumes(MediaType.APPLICATION_JSON)
        @Produces(MediaType.APPLICATION_JSON)
        Auth0TokenResponse getToken(Auth0TokenRequest request);
    }

    @RegisterRestClient(configKey = "auth0-management")
    @Path("/api/v2")
    public interface Auth0ManagementClient {
        @DELETE
        @Path("/users/{id}")
        void deleteUser(@RestPath String id, @HeaderParam("Authorization") String authorization);
    }
}