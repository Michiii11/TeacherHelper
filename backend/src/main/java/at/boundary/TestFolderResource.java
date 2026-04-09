package at.boundary;

import at.dtos.Test.CreateTestFolderDTO;
import at.dtos.Test.TestFolderDTO;
import at.dtos.Test.UpdateTestFolderDTO;
import at.repository.TestFolderRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;

@Path("/test-folder")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class TestFolderResource {

    @Inject
    TestFolderRepository repo;

    @GET
    @Path("/school/{schoolId}")
    public List<TestFolderDTO> getFolders(@PathParam("schoolId") Long schoolId,
                                          @HeaderParam("Authorization") String authHeader,
                                          @QueryParam("authToken") String authToken) {
        String token = authToken;

        if ((token == null || token.isBlank()) && authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring("Bearer ".length());
        }

        return repo.getFolders(schoolId, token);
    }

    @POST
    @Path("/school/{schoolId}")
    public Response createFolder(@PathParam("schoolId") Long schoolId, CreateTestFolderDTO dto) {
        return repo.createFolder(schoolId, dto);
    }

    @PUT
    @Path("/{folderId}")
    public Response updateFolder(@PathParam("folderId") String folderId, UpdateTestFolderDTO dto) {
        return repo.updateFolder(folderId, dto);
    }

    @DELETE
    @Path("/{folderId}")
    public Response deleteFolder(@PathParam("folderId") String folderId,
                                 @QueryParam("authToken") String authToken) {
        return repo.deleteFolder(folderId, authToken);
    }
}