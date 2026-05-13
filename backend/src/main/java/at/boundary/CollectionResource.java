package at.boundary;

import at.model.User;
import at.model.helper.Focus;
import at.repository.CollectionRepository;
import at.repository.UserRepository;
import io.smallrye.common.annotation.Blocking;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.util.UUID;

@Path("collection")
public class CollectionResource {
    @Inject
    CollectionRepository repository;
    @Inject
    UserRepository userRepository;


    @Inject
    JsonWebToken jwt;
    @GET
    @Path("your-collections")
    public Response getYourCollections(@HeaderParam("Authorization") String auth) {
        UUID userId = currentUserId();
        return repository.getYourCollections(userId);
    }

    @GET
    @Path("{id}")
    public Response getCollectionById(@PathParam("id") UUID collectionId) {
        UUID userId = currentUserId();
        return repository.findById(collectionId, userId);
    }

    @POST
    @Path("add")
    public Response addCollection(String collectionName) {
        UUID userId = currentUserId();
        return repository.addCollection(collectionName, userId);
    }

    @DELETE
    @Path("{id}")
    public Response deleteCollection(@PathParam("id") UUID collectionId) {
        UUID userId = currentUserId();
        return repository.deleteCollection(collectionId, userId);
    }

    @GET
    @Path("{id}/logo")
    public Response getCollectionLogo(@PathParam("id") UUID collectionId) {
        UUID userId = currentUserId();
        return repository.getCollectionLogo(collectionId, userId);
    }

    @POST
    @Path("{id}/logo")
    @Blocking
    public Response uploadCollectionLogo(@PathParam("id") UUID collectionId,
                                         @RestForm("file") FileUpload file) {
        UUID userId = currentUserId();
        return repository.uploadCollectionLogo(collectionId, userId, file);
    }

    @DELETE
    @Path("{id}/logo")
    public Response deleteCollectionLogo(@PathParam("id") UUID collectionId) {
        UUID userId = currentUserId();
        return repository.deleteCollectionLogo(collectionId, userId);
    }

    @DELETE
    @Path("{id}/leave")
    public Response leaveCollection(@PathParam("id") UUID collectionId) {
        UUID userId = currentUserId();
        return repository.leaveCollection(collectionId, userId);
    }

    @DELETE
    @Path("{id}/remove-teacher/{teacherId}")
    public Response removeTeacher(@PathParam("id") UUID collectionId,
                                  @PathParam("teacherId") UUID teacherId) {
        UUID userId = currentUserId();
        return repository.removeTeacher(collectionId, userId, teacherId);
    }

    @POST
    @Path("{id}/invite")
    public Response inviteTeacher(@PathParam("id") UUID collectionId,
                                  String username) {
        UUID userId = currentUserId();
        return repository.inviteTeacher(collectionId, userId, username);
    }

    @POST
    @Path("invite/{inviteId}/respond")
    public Response respondToInvite(@PathParam("inviteId") UUID inviteId,
                                    boolean accept) {
        UUID userId = currentUserId();
        return repository.respondToInvite(inviteId, userId, accept);
    }

    @PUT
    @Path("{id}/settings")
    public Response updateCollectionSettings(@PathParam("id") UUID collectionId,
                                             String name) {
        UUID userId = currentUserId();

        return repository.updateCollectionSettings(collectionId, userId, name);
    }

    @GET
    @Path("{id}/focus")
    public Response getFocusList(@PathParam("id") UUID collectionId) {
        UUID userId = currentUserId();
        return repository.getFocusList(collectionId, userId);
    }

    @POST
    @Path("{id}/focus")
    public Response addFocus(@PathParam("id") UUID collectionId,
                             Focus focus) {
        UUID userId = currentUserId();
        return repository.addFocus(collectionId, focus, userId);
    }

    @DELETE
    @Path("{id}/focus/{focusId}")
    public Response deleteFocus(@PathParam("id") UUID collectionId,
                                @PathParam("focusId") UUID focusId) {
        UUID userId = currentUserId();
        return repository.deleteFocus(collectionId, focusId, userId);
    }



    private UUID currentUserId() {
        User user = userRepository.getOrCreateAuth0User(jwt);
        return user.getId();
    }
}
