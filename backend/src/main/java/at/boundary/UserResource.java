package at.boundary;

import at.dtos.User.AuthResult;
import at.dtos.User.LoginDTO;
import at.dtos.User.UserDTO;
import at.dtos.User.ValidateTokenDTO;
import at.model.User;
import at.repository.UserRepository;
import at.security.TokenService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;

import java.util.Map;

@Path("user")
public class UserResource {
    @Inject
    UserRepository repo;

    @Inject
    TokenService tokenService;

    @POST
    @Path("register")
    public AuthResult register(UserDTO dto) {
        return repo.register(dto);
    }

    @POST
    @Path("login")
    public AuthResult login(LoginDTO dto) {
        return repo.login(dto);
    }

    @POST
    @Path("validate")
    public Response validateToken(ValidateTokenDTO dto) {
        if (dto == null || dto.token() == null || dto.token().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("valid", false))
                    .build();
        }
        boolean valid = repo.validateToken(dto.token());
        return Response.ok(Map.of("valid", valid)).build();
    }

    @POST
    @Path("id")
    public Long getUserId(String authToken) {
        return tokenService.validateTokenAndGetUserId(authToken);
    }

    @POST
    public User getUser(String authToken) {
        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            throw new WebApplicationException("Invalid token", Response.Status.UNAUTHORIZED);
        }
        return repo.findById(userId);
    }
}