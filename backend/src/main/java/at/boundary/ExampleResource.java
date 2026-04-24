package at.boundary;

import at.dtos.Example.CreateExampleDTO;
import at.repository.ExampleRepository;
import at.repository.UserRepository;
import at.security.TokenService;
import at.service.MediaStorageService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.util.UUID;

@Path("/example")
public class ExampleResource {
    @Inject
    ExampleRepository repository;

    @Inject
    UserRepository userRepository;

    @Inject
    MediaStorageService mediaStorageService;

    @Inject
    TokenService tokenService;

    @GET
    @Path("/school/{collectionId}")
    public Response getExamples(@PathParam("collectionId") UUID collectionId,
                                @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.getAllExamples(collectionId, userId);
    }

    @GET
    @Path("/school/{collectionId}/full")
    public Response getFullExamples(@PathParam("collectionId") UUID collectionId,
                                    @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.getFullExamples(collectionId, userId);
    }

    @GET
    @Path("{exampleId}")
    public Response getExample(@PathParam("exampleId") UUID exampleId,
                               @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.getExample(exampleId, userId);
    }

    @POST
    @Produces(MediaType.TEXT_PLAIN)
    public Response createExample(@HeaderParam("Authorization") String auth,
                                  CreateExampleDTO dto) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.createExample(dto, userId);
    }

    @DELETE
    @Path("{exampleId}")
    public Response deleteExample(@PathParam("exampleId") UUID exampleId,
                                  @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.deleteExample(userId, exampleId);
    }

    @PUT
    @Path("{exampleId}")
    @Produces(MediaType.TEXT_PLAIN)
    public Response updateExample(@PathParam("exampleId") UUID exampleId,
                                  @HeaderParam("Authorization") String auth,
                                  CreateExampleDTO dto) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.updateExample(exampleId, userId, dto);
    }

    @PUT
    @Path("{exampleId}/folder")
    @Produces(MediaType.TEXT_PLAIN)
    public Response moveExampleToFolder(@PathParam("exampleId") UUID exampleId,
                                        @HeaderParam("Authorization") String auth,
                                        UUID folderId) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.moveExampleToFolder(exampleId, userId, folderId);
    }

    @GET
    @Path("{exampleId}/image/{isSolution}")
    public Response getExampleImage(@PathParam("exampleId") UUID exampleId,
                                    @HeaderParam("Authorization") String auth,
                                    @PathParam("isSolution") boolean isSolution) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.getExampleImage(exampleId, userId, isSolution);
    }

    @POST
    @Path("{exampleId}/image/{isSolution}")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.TEXT_PLAIN)
    public Response uploadExampleImage(@PathParam("exampleId") UUID exampleId,
                                       @RestForm("file") FileUpload file,
                                       @PathParam("isSolution") boolean isSolution,
                                       @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.uploadExampleImage(exampleId, userId, file, isSolution);
    }

    @DELETE
    @Path("{exampleId}/image/{isSolution}")
    public Response deleteExampleImage(@PathParam("exampleId") UUID exampleId,
                                       @HeaderParam("Authorization" ) String auth,
                                       @PathParam("isSolution") boolean isSolution) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.deleteExampleImage(exampleId, userId, isSolution);
    }
}