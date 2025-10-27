package at.boundary;

import at.dtos.AuthResult;
import at.dtos.LoginDTO;
import at.dtos.UserDTO;
import at.dtos.ValidateTokenDTO;
import at.repository.UserRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;

@Path("user")
public class UserResource {
    @Inject
    UserRepository repo;

    @POST
    @Path("register")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public AuthResult register(UserDTO dto) {
        return repo.register(dto);
    }

    @POST
    @Path("login")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public AuthResult login(LoginDTO dto) {
        return repo.login(dto);
    }

    @POST
    @Path("validate")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response validateToken(ValidateTokenDTO dto) {
        if (dto == null || dto.token() == null || dto.token().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("valid", false))
                    .build();
        }
        boolean valid = repo.validateToken(dto.token());
        return Response.ok(Map.of("valid", valid)).build();
    }
}