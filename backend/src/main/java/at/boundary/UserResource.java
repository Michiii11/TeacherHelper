package at.boundary;

import at.dtos.User.*;
import at.model.User;
import at.repository.UserRepository;
import at.security.TokenService;
import at.service.MediaStorageService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.nio.file.Files;
import java.util.Map;
import java.util.UUID;

@Path("user")
public class UserResource {
    @Inject
    MediaStorageService mediaStorageService;

    @Inject
    UserRepository repository;

    @Inject
    TokenService tokenService;

    @POST
    @Path("register")
    public AuthResult register(FullUserDTO dto) {
        return repository.register(dto);
    }

    @POST
    @Path("login")
    public AuthResult login(LoginDTO dto) {
        return repository.login(dto);
    }

    @POST
    @Path("validate")
    public Response validateToken(@HeaderParam("Authorization") String auth) {
        if (auth == null || auth.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("valid", false))
                    .build();
        }

        return Response.ok(Map.of("valid", repository.validateToken(auth))).build();
    }

    @GET
    @Path("verify-email")
    public Response verifyEmail(@QueryParam("token") String token) {
        System.out.println(token);
        return repository.verifyEmail(token);
    }

    @POST
    @Path("email/resend-verification")
    public Response resendVerification(EmailActionDTO dto, @QueryParam("language") String language) {
        return repository.resendVerification(dto == null ? null : dto.email(), language);
    }

    @GET
    @Path("id")
    public UUID getUserId(@HeaderParam("Authorization") String auth) {
        return tokenService.validateTokenAndGetUserId(auth);
    }

    @GET
    public UserProfileDTO getUser(@HeaderParam("Authorization") String auth) {
        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            throw new WebApplicationException("Invalid token", Response.Status.UNAUTHORIZED);
        }

        User user = repository.findById(userId);
        if (user == null) {
            throw new WebApplicationException("User not found", Response.Status.NOT_FOUND);
        }

        return repository.toProfileDTO(user);
    }

    @DELETE
    public Response deleteAccount(@HeaderParam("Authorization") String auth, Map<String, String> body) {
        Response authResponse = repository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.deleteAccount(userId, body.get("password"));
    }

    @PUT
    @Path("password")
    public Response changePassword(@HeaderParam("Authorization") String auth,
                                   ChangePasswordDTO dto) {
        UUID userId = tokenFromDto(dto == null ? null : auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return repository.changePassword(userId, dto.currentPassword(), dto.newPassword());
    }

    @POST
    @Path("password/forgot")
    public Response forgotPassword(EmailActionDTO dto) {
        return repository.requestPasswordReset(dto == null ? null : dto.email());
    }

    @POST
    @Path("password/reset")
    public Response resetPassword(@HeaderParam("ResetToken") String token,
                                  String newPassword) {
        return repository.resetPassword(token, newPassword);
    }

    @PUT
    @Path("username")
    public Response updateUsername(@HeaderParam("Authorization") String auth,
                                   String username) {
        UUID userId = tokenFromDto(auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return repository.updateUsername(userId, username);
    }

    @PUT
    @Path("email")
    public Response requestEmailChange(@HeaderParam("Authorization") String auth,
                                       String email) {
        UUID userId = tokenFromDto(auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return repository.requestEmailChange(userId, email);
    }

    @POST
    @Path("email/cancel-pending")
    public Response cancelPendingEmailChange(@HeaderParam("Authorization") String auth) {
        UUID userId = tokenFromDto(auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return repository.cancelPendingEmailChange(userId);
    }

    @PUT
    @Path("settings")
    public Response updateSettings(@HeaderParam("Authorization") String auth,
                                   UserSettingsDTO settings) {
        UUID userId = tokenFromDto(auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return repository.updateUserSettings(userId, settings);
    }

    @POST
    @Path("profile-image")
    public Response uploadProfileImage(@RestForm("file") FileUpload file,
                                       @HeaderParam("Authorization") String auth) {
        Response authResponse = repository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.uploadProfileImage(userId, file);
    }

    @GET
    @Path("profile-image/{userId}")
    public Response getProfileImage(@PathParam("userId") UUID userId,
                                    @HeaderParam("Authorization") String auth) {
        Response authResponse = repository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID uId = tokenService.validateTokenAndGetUserId(auth);
        return repository.getProfileImage(uId);
    }

    @DELETE
    @Path("profile-image")
    public Response deleteProfileImage(@HeaderParam("Authorization") String auth) {
        Response authResponse = repository.generateResponseOfAuth(auth);
        if (authResponse != null) {
            return authResponse;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return repository.deleteProfileImage(userId);
    }

    @GET
    @Path("admin")
    public Response getAdminDashboard(@HeaderParam("Authorization") String auth) {
        UUID userId = tokenFromDto(auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        User user = repository.findById(userId);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("User not found").build();
        }

        if(!user.isAdmin()){
            return Response.status(Response.Status.FORBIDDEN).entity("Access denied: Admins only").build();
        }

        return repository.getAdminDashboard();
    }

    @GET
    @Path("isAdmin")
    public Response isAdmin(@HeaderParam("Authorization") String auth) {
        UUID userId = tokenFromDto(auth);

        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token").build();
        }

        User user = repository.findById(userId);

        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("User not found").build();
        }

        return Response.ok(Map.of("isAdmin", user.isAdmin())).build();
    }



    private UUID tokenFromDto(String authToken) {
        if (authToken == null || authToken.isBlank()) {
            return null;
        }
        return tokenService.validateTokenAndGetUserId(authToken);
    }
}