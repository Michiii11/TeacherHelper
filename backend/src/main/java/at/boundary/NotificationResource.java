package at.boundary;

import at.dtos.Notification.NotificationDTO;
import at.enums.NotificationActionType;
import at.repository.NotificationRepository;
import at.repository.UserRepository;
import at.security.TokenService;
import jakarta.inject.Inject;
import jakarta.json.JsonObject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.UUID;

@Path("notification")
public class NotificationResource {

    @Inject
    NotificationRepository notificationRepository;

    @Inject
    TokenService tokenService;

    @Inject
    UserRepository userRepository;

    @GET
    public Response getMyNotifications(@HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return notificationRepository.getMyNotifications(userId);
    }

    @PUT
    @Path("{id}/read")
    public Response markAsRead(@PathParam("id") UUID notificationId,
                               @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return notificationRepository.markAsRead(notificationId, userId);
    }

    @DELETE
    @Path("{id}")
    public Response delete(@PathParam("id") UUID notificationId,
                           @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return notificationRepository.delete(notificationId, userId);
    }

    @POST
    @Path("{id}/action")
    public Response executeAction(@PathParam("id") UUID notificationId,
                                  @HeaderParam("Authorization") String auth,
                                  NotificationActionType action) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return notificationRepository.executeAction(notificationId, userId, action);
    }

    @POST
    @Path("system-info/school/{schoolId}")
    public Response sendSystemInfoToSchool(@PathParam("schoolId") UUID schoolId,
                                           @HeaderParam("Authorization") String auth,
                                           JsonObject request) {

        String title = request.containsKey("title") ? request.getString("title", null) : null;
        String message = request.containsKey("message") ? request.getString("message", null) : null;
        String link = request.containsKey("link") ? request.getString("link", null) : null;

        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return notificationRepository.sendSystemInfo(userId, schoolId, title, message, link, false);
    }

    @POST
    @Path("system-info/all")
    public Response sendSystemInfoToAll(@HeaderParam("Authorization") String auth,
                                        JsonObject request) {
        String title = request.containsKey("title") ? request.getString("title", null) : null;
        String message = request.containsKey("message") ? request.getString("message", null) : null;
        String link = request.containsKey("link") ? request.getString("link", null) : null;

        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return notificationRepository.sendSystemInfo(userId, null, title, message, link, true);
    }
}