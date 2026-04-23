package at.boundary;

import at.model.User;
import at.model.helper.Focus;
import at.repository.SchoolRepository;
import at.repository.UserRepository;
import at.security.TokenService;
import at.service.MediaStorageService;
import io.smallrye.common.annotation.Blocking;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.headers.Header;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.util.UUID;

@Path("school")
public class SchoolResource {
    @Inject
    SchoolRepository repository;

    @Inject
    TokenService tokenService;

    @Inject
    UserRepository userRepository;

    @Inject
    MediaStorageService mediaStorageService;

    private Response generateResponseOfAuth(String auth) {
        if (auth == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Missing token").build();
        }
        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        if (userRepository.findById(userId) != null) {
            userRepository.findById(userId).newActivity();
        }
        return null;
    }

    @GET
    @Path("your-collections")
    public Response getYourCollections(@HeaderParam("Authorization") String auth) {
        Response authResponse = generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.getYourSchools(userId);
    }

    @GET
    @Path("{id}")
    public Response getCollectionById(@PathParam("id") UUID collectionId,
                                      @HeaderParam("Authorization") String auth) {
        Response authResponse = generateResponseOfAuth(auth);
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
        Response authResponse = generateResponseOfAuth(auth);
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
        Response authResponse = generateResponseOfAuth(auth);
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
        Response authResponse = generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        String objectName = repository.getSchoolUrl(collectionId);
        if (objectName == null || objectName.isBlank()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        MediaStorageService.StoredImage image = mediaStorageService.loadImage(objectName);
        if (image == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        return Response.ok(image.data()).type(image.contentType()).build();
    }

    @POST
    @Path("{id}/logo")
    @Blocking
    public Response uploadCollectionLogo(@PathParam("id") UUID collectionId,
                                         @RestForm("file") FileUpload file,
                                         @HeaderParam("Authorization") String auth) {
        Response authResponse = generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        if (file == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("No file uploaded").build();
        }

        String contentType = file.contentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Uploaded file must be an image").build();
        }

        try {
            UUID userId = tokenService.validateTokenAndGetUserId(auth);
            String objectName = mediaStorageService.uploadSchoolLogo(collectionId, file.uploadedFile());
            return repository.updateCollectionLogo(collectionId, userId, objectName);
        } catch (IOException e) {
            return Response.serverError().entity("Logo upload failed").build();
        }
    }

    @DELETE
    @Path("{id}/logo")
    public Response deleteCollectionLogo(@PathParam("id") UUID collectionId,
                                         @HeaderParam("Authorization") String auth) {
        Response authResponse = generateResponseOfAuth(auth);
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
        Response authResponse = generateResponseOfAuth(auth);
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
        Response authResponse = generateResponseOfAuth(auth);
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
                                  String email) {
        Response authResponse = generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.inviteTeacher(collectionId, userId, email);
    }

    @POST
    @Path("invite/{inviteId}/respond")
    public Response respondToInvite(@PathParam("inviteId") UUID inviteId,
                                    @HeaderParam("Authorization") String auth,
                                    boolean accept) {
        Response authResponse = generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.respondToInvite(inviteId, userId, accept);
    }

    @PUT
    @Path("{id}/settings")
    public Response updateSchoolSettings(@PathParam("id") UUID collectionId,
                                         @HeaderParam("Authorization") String auth,
                                         String name) {
        Response authResponse = generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);

        return repository.updateSchoolSettings(collectionId, userId, name);
    }

    @GET
    @Path("{id}/focus")
    public Response getFocusList(@PathParam("id") UUID collectionId,
                                    @HeaderParam("Authorization") String auth) {
        Response authResponse = generateResponseOfAuth(auth);
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
        Response authResponse = generateResponseOfAuth(auth);
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
        Response authResponse = generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.deleteFocus(collectionId, focusId, userId);
    }

}