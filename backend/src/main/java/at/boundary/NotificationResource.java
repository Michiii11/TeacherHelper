package at.boundary;

import at.dtos.Notification.NotificationDTO;
import at.enums.NotificationActionType;
import at.repository.NotificationRepository;
import at.security.TokenService;
import jakarta.inject.Inject;
import jakarta.json.JsonObject;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.UUID;

@Path("notification")
public class NotificationResource {

    @Inject
    NotificationRepository notificationRepository;

    @Inject
    TokenService tokenService;

    @POST
    @Path("my")
    public List<NotificationDTO> getMyNotifications(String auth) {
        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            return List.of();
        }

        return notificationRepository.getMyNotifications(userId);
    }

    @POST
    @Path("{id}/read")
    public Response markAsRead(@PathParam("id") UUID id, String auth) {
        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return notificationRepository.markAsRead(id, userId);
    }

    @DELETE
    @Path("{id}")
    public Response delete(@PathParam("id") UUID id, String auth) {
        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return notificationRepository.delete(id, userId);
    }

    @POST
    @Path("{id}/action")
    public Response executeAction(@PathParam("id") UUID id, JsonObject request) {
        String authToken = request.containsKey("authToken") ? request.getString("authToken", null) : null;
        String actionRaw = request.containsKey("action") ? request.getString("action", null) : null;

        if (authToken == null || authToken.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Missing auth token").build();
        }

        UUID userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        if (actionRaw == null || actionRaw.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Missing action").build();
        }

        NotificationActionType action;
        try {
            action = NotificationActionType.valueOf(actionRaw);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Invalid action: " + actionRaw).build();
        }

        return notificationRepository.executeAction(id, userId, action);
    }

    @POST
    @Path("system-info/school/{schoolId}")
    public Response sendSystemInfoToSchool(@PathParam("schoolId") UUID schoolId, JsonObject request) {
        String authToken = request.containsKey("authToken") ? request.getString("authToken", null) : null;
        String title = request.containsKey("title") ? request.getString("title", null) : null;
        String message = request.containsKey("message") ? request.getString("message", null) : null;
        String link = request.containsKey("link") ? request.getString("link", null) : null;

        if (authToken == null || authToken.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Missing auth token").build();
        }

        UUID userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return notificationRepository.sendSystemInfoToSchool(userId, schoolId, title, message, link);
    }

    @POST
    @Path("system-info/all")
    public Response sendSystemInfoToAll(JsonObject request) {
        String authToken = request.containsKey("authToken") ? request.getString("authToken", null) : null;
        String title = request.containsKey("title") ? request.getString("title", null) : null;
        String message = request.containsKey("message") ? request.getString("message", null) : null;
        String link = request.containsKey("link") ? request.getString("link", null) : null;

        if (authToken == null || authToken.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Missing auth token").build();
        }

        UUID userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return notificationRepository.sendSystemInfoToAll(userId, title, message, link);
    }
}