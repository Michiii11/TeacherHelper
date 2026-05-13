package at.boundary;

import at.model.User;
import at.enums.NotificationActionType;
import at.repository.NotificationRepository;
import at.repository.UserRepository;
import jakarta.inject.Inject;
import jakarta.json.JsonObject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.UUID;

@Path("notification")
public class NotificationResource {

    @Inject
    NotificationRepository notificationRepository;
    @Inject
    UserRepository userRepository;


    @Inject
    JsonWebToken jwt;
    @GET
    public Response getMyNotifications(@HeaderParam("Authorization") String auth) {
        UUID userId = currentUserId();
        return notificationRepository.getMyNotifications(userId);
    }

    @PUT
    @Path("{id}/read")
    public Response markAsRead(@PathParam("id") UUID notificationId) {
        UUID userId = currentUserId();
        return notificationRepository.markAsRead(notificationId, userId);
    }

    @DELETE
    @Path("{id}")
    public Response delete(@PathParam("id") UUID notificationId) {
        UUID userId = currentUserId();
        return notificationRepository.delete(notificationId, userId);
    }

    @POST
    @Path("{id}/action")
    public Response executeAction(@PathParam("id") UUID notificationId,
                                  NotificationActionType action) {
        UUID userId = currentUserId();
        return notificationRepository.executeAction(notificationId, userId, action);
    }

    @POST
    @Path("system-info/collection/{collectionId}")
    public Response sendSystemInfoToCollection(@PathParam("collectionId") UUID collectionId,
                                               JsonObject request) {

        String title = request.containsKey("title") ? request.getString("title", null) : null;
        String message = request.containsKey("message") ? request.getString("message", null) : null;
        String link = request.containsKey("link") ? request.getString("link", null) : null;
        UUID userId = currentUserId();
        return notificationRepository.sendSystemInfo(userId, collectionId, title, message, link, false);
    }

    @POST
    @Path("system-info/all")
    public Response sendSystemInfoToAll(JsonObject request) {
        String title = request.containsKey("title") ? request.getString("title", null) : null;
        String message = request.containsKey("message") ? request.getString("message", null) : null;
        String link = request.containsKey("link") ? request.getString("link", null) : null;
        UUID userId = currentUserId();
        return notificationRepository.sendSystemInfo(userId, null, title, message, link, true);
    }


    private UUID currentUserId() {
        User user = userRepository.getOrCreateAuth0User(jwt);
        return user.getId();
    }
}
