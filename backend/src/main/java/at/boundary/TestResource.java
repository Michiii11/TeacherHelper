package at.boundary;

import at.model.User;
import at.dtos.Test.CreateTestDTO;
import at.repository.TestRepository;
import at.repository.UserRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.UUID;

@Path("/test")
public class TestResource {
    @Inject
    TestRepository repository;
    @Inject
    UserRepository userRepository;


    @Inject
    JsonWebToken jwt;
    @GET
    @Path("/collection/{collectionId}")
    public Response getTests(@PathParam("collectionId") UUID collectionId) {
        UUID userId = currentUserId();
        return repository.getAllTest(collectionId, userId);
    }

    @GET
    @Path("{testId}")
    public Response getTest(@PathParam("testId") UUID testId) {
        UUID userId = currentUserId();
        return repository.getTest(testId, userId);
    }

    @POST
    public Response createTest(CreateTestDTO dto) {
        UUID userId = currentUserId();
        return repository.createTest(dto, userId);
    }

    @PUT
    @Path("{testId}")
    public Response updateTest(@PathParam("testId") UUID testId,
                               CreateTestDTO dto){
        UUID userId = currentUserId();
        return repository.updateTest(testId, userId, dto);
    }

    @DELETE
    @Path("{testId}")
    public Response deleteTest(@PathParam("testId") UUID testId) {
        UUID userId = currentUserId();
        return repository.deleteTest(testId, userId);
    }

    @PUT
    @Path("{testId}/folder/{folderId}")
    public Response moveTestToFolder(@PathParam("testId") UUID testId,
                                     @PathParam("folderId") UUID folderId) {
        UUID userId = currentUserId();
        return repository.moveTestToFolder(testId, folderId, userId);
    }

    @PUT
    @Path("/{testId}/folder")
    public Response moveTestToRoot(@PathParam("testId") UUID testId) {
        UUID userId = currentUserId();
        return repository.moveTestToFolder(testId, null, userId);
    }

    private UUID currentUserId() {
        User user = userRepository.getOrCreateAuth0User(jwt);
        return user.getId();
    }
}
