package at.boundary;

import at.dtos.Folder.CreateFolderDTO;
import at.dtos.Folder.FolderDTO;
import at.dtos.Folder.UpdateFolderDTO;
import at.repository.FolderRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.UUID;

@Path("/folder")
public class FolderResource {

    @Inject
    FolderRepository repo;

    @GET
    @Path("/school/{schoolId}")
    public List<FolderDTO> getFolders(@PathParam("schoolId") UUID schoolId,
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
    public Response createFolder(@PathParam("schoolId") UUID schoolId, CreateFolderDTO dto) {
        return repo.createFolder(schoolId, dto);
    }

    @PUT
    @Path("/{folderId}")
    public Response updateFolder(@PathParam("folderId") UUID folderId, UpdateFolderDTO dto) {
        return repo.updateFolder(folderId, dto);
    }

    @DELETE
    @Path("/{folderId}")
    public Response deleteFolder(@PathParam("folderId") UUID folderId,
                                 @QueryParam("authToken") String authToken) {
        return repo.deleteFolder(folderId, authToken);
    }
}
