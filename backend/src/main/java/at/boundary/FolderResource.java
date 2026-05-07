package at.boundary;

import at.model.User;
import at.dtos.Folder.CreateFolderDTO;
import at.repository.FolderRepository;
import at.repository.UserRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.UUID;

@Path("/folder")
public class FolderResource {

    @Inject
    FolderRepository repository;

    @Inject
    UserRepository userRepository;

    @Inject
    JsonWebToken jwt;
    @GET
    @Path("/collection/{collectionId}")
    public Response getFolders(@PathParam("collectionId") UUID collectionId) {
        UUID userId = currentUserId();
        return repository.getFolders(collectionId, userId);
    }

    @POST
    @Path("/collection/{collectionId}")
    public Response createFolder(@PathParam("collectionId") UUID collectionId,
                                 CreateFolderDTO dto) {
        UUID userId = currentUserId();
        return repository.createFolder(collectionId, userId, dto);
    }

    @PUT
    @Path("/{folderId}")
    public Response updateFolder(@PathParam("folderId") UUID folderId,
                                 CreateFolderDTO dto) {
        UUID userId = currentUserId();
        return repository.updateFolder(folderId, userId, dto);
    }

    @DELETE
    @Path("/{folderId}")
    public Response deleteFolder(@PathParam("folderId") UUID folderId) {
        UUID userId = currentUserId();
        return repository.deleteFolder(folderId, userId);
    }


    private UUID currentUserId() {
        User user = userRepository.getOrCreateAuth0User(jwt);
        return user.getId();
    }
}
