package at.boundary;

import at.dtos.Folder.CreateFolderDTO;
import at.repository.FolderRepository;
import at.repository.UserRepository;
import at.security.TokenService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;

import java.util.UUID;

@Path("/folder")
public class FolderResource {

    @Inject
    FolderRepository repository;

    @Inject
    UserRepository userRepository;

    @Inject
    TokenService tokenService;

    @GET
    @Path("/school/{collectionId}")
    public Response getFolders(@PathParam("collectionId") UUID collectionId,
                               @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.getFolders(collectionId, userId);
    }

    @POST
    @Path("/school/{collectionId}")
    public Response createFolder(@PathParam("collectionId") UUID collectionId,
                                 @HeaderParam("Authorization") String auth,
                                 CreateFolderDTO dto) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.createFolder(collectionId, userId, dto);
    }

    @PUT
    @Path("/{folderId}")
    public Response updateFolder(@PathParam("folderId") UUID folderId,
                                 @HeaderParam("Authorization") String auth,
                                 CreateFolderDTO dto) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.updateFolder(folderId, userId, dto);
    }

    @DELETE
    @Path("/{folderId}")
    public Response deleteFolder(@PathParam("folderId") UUID folderId,
                                 @HeaderParam("Authorization") String auth) {
        Response authResponse = userRepository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.deleteFolder(folderId, userId);
    }
}
