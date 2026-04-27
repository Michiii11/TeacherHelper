package at.boundary;

import at.dtos.Test.CreateTestDTO;
import at.repository.TestRepository;
import at.repository.UserRepository;
import at.security.TokenService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;

import java.util.UUID;

@Path("/test")
public class TestResource {
    @Inject
    TestRepository repository;

    @Inject
    TokenService tokenService;

    @Inject
    UserRepository userRepository;

    @GET
    @Path("/school/{collectionId}")
    public Response getTests(@PathParam("collectionId") UUID collectionId,
                             @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.getAllTest(collectionId, userId);
    }

    @GET
    @Path("{testId}")
    public Response getTest(@PathParam("testId") UUID testId,
                            @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.getTest(testId, userId);
    }

    @POST
    public Response createTest(@HeaderParam("Authorization") String auth,
                               CreateTestDTO dto) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.createTest(dto, userId);
    }

    @PUT
    @Path("{testId}")
    public Response updateTest(@PathParam("testId") UUID testId,
                               @HeaderParam("Authorization") String auth,
                               CreateTestDTO dto){
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.updateTest(testId, userId, dto);
    }

    @DELETE
    @Path("{testId}")
    public Response deleteTest(@PathParam("testId") UUID testId,
                               @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.deleteTest(testId, userId);
    }

    @PUT
    @Path("{testId}/folder/{folderId}")
    public Response moveTestToFolder(@PathParam("testId") UUID testId,
                                     @HeaderParam("Authorization") String auth,
                                     @PathParam("folderId") UUID folderId) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.moveTestToFolder(testId, folderId, userId);
    }
}
