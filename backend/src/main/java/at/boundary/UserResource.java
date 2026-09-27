package at.boundary;

import at.dtos.User.AdminLockUpdateDTO;
import at.dtos.User.AdminSubscriptionUpdateDTO;
import at.dtos.User.UserProfileDTO;
import at.dtos.User.UserSettingsDTO;
import at.model.User;
import at.repository.UserRepository;
import at.service.StripeBillingSyncService;
import jakarta.inject.Inject;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.util.Map;
import java.util.UUID;

@Path("user")
public class UserResource {

    @Inject
    UserRepository repository;

    @Inject
    StripeBillingSyncService stripeBillingSyncService;

    @Inject
    JsonWebToken jwt;

    @GET
    @Path("server")
    public Response getServer() {
        return Response.ok().build();
    }

    @GET
    @Path("list")
    public Response getUsernames() {
        return repository.getUsernames();
    }

    @GET
    @Path("id")
    public UUID getUserId() {
        return currentUserId();
    }

    @GET
    @Path("me")
    public UserProfileDTO getMe() {
        return repository.toProfileDTO(currentUser());
    }

    @GET
    @Path("me/id")
    public UUID getMyUserId() {
        return currentUserId();
    }

    @GET
    public UserProfileDTO getUser() {
        return repository.toProfileDTO(currentUser());
    }

    @DELETE
    public Response deleteAccount() {
        return repository.deleteAccount(currentUserId());
    }

    @PUT
    @Path("username")
    public Response updateUsername(String username) {
        return repository.updateUsername(currentUserId(), username);
    }

    @PUT
    @Path("settings")
    public Response updateSettings(UserSettingsDTO settings) {
        return repository.updateUserSettings(currentUserId(), settings);
    }

    @POST
    @Path("profile-image")
    public Response uploadProfileImage(@RestForm("file") FileUpload file) {
        return repository.uploadProfileImage(currentUserId(), file);
    }

    @GET
    @Path("profile-image/{userId}")
    public Response getProfileImage(@PathParam("userId") UUID userId) {
        return repository.getProfileImage(userId);
    }

    @DELETE
    @Path("profile-image")
    public Response deleteProfileImage() {
        return repository.deleteProfileImage(currentUserId());
    }

    @GET
    @Path("admin")
    public Response getAdminDashboard() {
        User user = currentUser();
        if (!user.isAdmin()) {
            return Response.status(Response.Status.FORBIDDEN).entity("Access denied: Admins only").build();
        }
        return repository.getAdminDashboard();
    }

    @GET
    @Path("admin/{id}")
    public Response getUserAdminDashboard(@PathParam("id") UUID id) {
        User user = currentUser();
        if (!user.isAdmin()) {
            return Response.status(Response.Status.FORBIDDEN).entity("Access denied: Admins only").build();
        }

        // Backfill current Stripe period + historical paid invoices before
        // returning the admin detail. This makes old subscriptions visible too.
        stripeBillingSyncService.syncUser(id);

        return repository.getUserAdminDashboard(id);
    }

    @PUT
    @Path("admin/{id}/subscription")
    public Response updateAdminSubscription(
            @PathParam("id") UUID id,
            AdminSubscriptionUpdateDTO request
    ) {
        User admin = currentUser();
        if (!admin.isAdmin()) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Access denied: Admins only")
                    .build();
        }

        return repository.updateAdminSubscription(id, request);
    }

    @PUT
    @Path("admin/{id}/lock")
    public Response updateAdminLock(
            @PathParam("id") UUID id,
            AdminLockUpdateDTO request
    ) {
        User admin = currentUser();
        if (!admin.isAdmin()) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Access denied: Admins only")
                    .build();
        }

        if (request == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Request body required")
                    .build();
        }

        return repository.updateAdminLock(id, request.locked(), admin.getId());
    }

    @GET
    @Path("isAdmin")
    public Response isAdmin() {
        return Response.ok(Map.of("isAdmin", currentUser().isAdmin())).build();
    }

    private User currentUser() {
        return repository.getOrCreateAuth0User(jwt);
    }

    private UUID currentUserId() {
        return currentUser().getId();
    }
}
