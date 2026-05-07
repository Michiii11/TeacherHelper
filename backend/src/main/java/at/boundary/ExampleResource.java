package at.boundary;

import at.model.User;
import at.dtos.Example.CreateExampleDTO;
import at.repository.ExampleRepository;
import at.repository.UserRepository;
import at.service.MediaStorageService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.util.Set;
import java.util.UUID;

@Path("/example")
public class ExampleResource {
    @Inject
    ExampleRepository repository;

    @Inject
    UserRepository userRepository;

    @Inject
    JsonWebToken jwt;
    @GET
    @Path("/collection/{collectionId}")
    public Response getExamples(@PathParam("collectionId") UUID collectionId) {
        UUID userId = currentUserId();
        return repository.getAllExamples(collectionId, userId);
    }

    @GET
    @Path("/collection/{collectionId}/full")
    public Response getFullExamples(@PathParam("collectionId") UUID collectionId) {
        UUID userId = currentUserId();
        return repository.getFullExamples(collectionId, userId);
    }

    @GET
    @Path("{exampleId}")
    public Response getExample(@PathParam("exampleId") UUID exampleId) {
        UUID userId = currentUserId();
        return repository.getExample(exampleId, userId);
    }

    @POST
    @Produces(MediaType.TEXT_PLAIN)
    public Response createExample(CreateExampleDTO dto) {
        UUID userId = currentUserId();
        return repository.createExample(dto, userId);
    }

    @DELETE
    @Path("{exampleId}")
    public Response deleteExample(@PathParam("exampleId") UUID exampleId) {
        UUID userId = currentUserId();
        return repository.deleteExample(userId, exampleId);
    }

    @PUT
    @Path("{exampleId}")
    @Produces(MediaType.TEXT_PLAIN)
    public Response updateExample(@PathParam("exampleId") UUID exampleId,
                                  CreateExampleDTO dto) {
        UUID userId = currentUserId();
        return repository.updateExample(exampleId, userId, dto);
    }

    @PUT
    @Path("{exampleId}/folder/{folderId}")
    public Response moveExampleToFolder(@PathParam("exampleId") UUID exampleId,
                                        @PathParam("folderId") UUID folderId) {
        UUID userId = currentUserId();
        return repository.moveExampleToFolder(exampleId, userId, folderId);
    }

    @GET
    @Path("{exampleId}/image/{isSolution}")
    public Response getExampleImage(@PathParam("exampleId") UUID exampleId,
                                    @PathParam("isSolution") boolean isSolution) {
        UUID userId = currentUserId();
        return repository.getExampleImage(exampleId, userId, isSolution);
    }

    @POST
    @Path("{exampleId}/image/{isSolution}")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.TEXT_PLAIN)
    public Response uploadExampleImage(@PathParam("exampleId") UUID exampleId,
                                       @RestForm("file") FileUpload file,
                                       @PathParam("isSolution") boolean isSolution) {
        UUID userId = currentUserId();
        return repository.uploadExampleImage(exampleId, userId, file, isSolution);
    }

    @DELETE
    @Path("{exampleId}/image/{isSolution}")
    public Response deleteExampleImage(@PathParam("exampleId") UUID exampleId,
                                       @HeaderParam("Authorization" ) String auth,
                                       @PathParam("isSolution") boolean isSolution) {
        UUID userId = currentUserId();
        return repository.deleteExampleImage(exampleId, userId, isSolution);
    }


    private UUID currentUserId() {
        User user = userRepository.getOrCreateAuth0User(jwt);
        return user.getId();
    }
}
