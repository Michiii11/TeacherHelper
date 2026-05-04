package at.boundary;

import at.model.helper.Focus;
import at.repository.CollectionRepository;
import at.repository.UserRepository;
import at.security.TokenService;
import io.smallrye.common.annotation.Blocking;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.util.UUID;

@Path("collection")
public class CollectionResource {
    @Inject
    CollectionRepository repository;

    @Inject
    TokenService tokenService;

    @Inject
    UserRepository userRepository;

    @GET
    @Path("your-collections")
    public Response getYourCollections(@HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.getYourCollections(userId);
    }

    @GET
    @Path("{id}")
    public Response getCollectionById(@PathParam("id") UUID collectionId,
                                      @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.findById(collectionId, userId);
    }

    @POST
    @Path("add")
    public Response addCollection(String collectionName,
                                  @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.addCollection(collectionName, userId);
    }

    @DELETE
    @Path("{id}")
    public Response deleteCollection(@PathParam("id") UUID collectionId,
                                     @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.deleteCollection(collectionId, userId);
    }

    @GET
    @Path("{id}/logo")
    public Response getCollectionLogo(@PathParam("id") UUID collectionId,
                                      @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.getCollectionLogo(collectionId, userId);
    }

    @POST
    @Path("{id}/logo")
    @Blocking
    public Response uploadCollectionLogo(@PathParam("id") UUID collectionId,
                                         @RestForm("file") FileUpload file,
                                         @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.uploadCollectionLogo(collectionId, userId, file);
    }

    @DELETE
    @Path("{id}/logo")
    public Response deleteCollectionLogo(@PathParam("id") UUID collectionId,
                                         @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.deleteCollectionLogo(collectionId, userId);
    }

    @DELETE
    @Path("{id}/leave")
    public Response leaveCollection(@PathParam("id") UUID collectionId,
                                    @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.leaveCollection(collectionId, userId);
    }

    @DELETE
    @Path("{id}/remove-teacher/{teacherId}")
    public Response removeTeacher(@PathParam("id") UUID collectionId,
                                  @PathParam("teacherId") UUID teacherId,
                                  @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.removeTeacher(collectionId, userId, teacherId);
    }

    @POST
    @Path("{id}/invite")
    public Response inviteTeacher(@PathParam("id") UUID collectionId,
                                  @HeaderParam("Authorization")  String auth,
                                  String username) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.inviteTeacher(collectionId, userId, username);
    }

    @POST
    @Path("invite/{inviteId}/respond")
    public Response respondToInvite(@PathParam("inviteId") UUID inviteId,
                                    @HeaderParam("Authorization") String auth,
                                    boolean accept) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.respondToInvite(inviteId, userId, accept);
    }

    @PUT
    @Path("{id}/settings")
    public Response updateCollectionSettings(@PathParam("id") UUID collectionId,
                                         @HeaderParam("Authorization") String auth,
                                         String name) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);

        return repository.updateCollectionSettings(collectionId, userId, name);
    }

    @GET
    @Path("{id}/focus")
    public Response getFocusList(@PathParam("id") UUID collectionId,
                                    @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.getFocusList(collectionId, userId);
    }

    @POST
    @Path("{id}/focus")
    public Response addFocus(@PathParam("id") UUID collectionId,
                             @HeaderParam("Authorization") String auth,
                             Focus focus) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.addFocus(collectionId, focus, userId);
    }

    @DELETE
    @Path("{id}/focus/{focusId}")
    public Response deleteFocus(@PathParam("id") UUID collectionId,
                                @PathParam("focusId") UUID focusId,
                                @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.deleteFocus(collectionId, focusId, userId);
    }

}