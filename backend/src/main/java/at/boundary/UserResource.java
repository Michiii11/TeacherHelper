package at.boundary;

import at.dtos.User.*;
import at.model.User;
import at.repository.UserRepository;
import at.security.TokenService;
import at.service.MediaStorageService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.nio.file.Files;
import java.util.Map;
import java.util.Set;

@Path("user")
public class UserResource {

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_PROFILE_IMAGE_SIZE = 2L * 1024L * 1024L;

    @Inject
    MediaStorageService mediaStorageService;

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

        return Response.ok(Map.of("valid", repo.validateToken(dto.token()))).build();
    }

    @GET
    @Path("verify-email")
    @Produces(MediaType.TEXT_PLAIN)
    public Response verifyEmail(@QueryParam("token") String token) {
        String result = repo.verifyEmail(token);

        if (result == null) {
            return Response.ok("E-Mail erfolgreich bestätigt.").build();
        }

        return switch (result) {
            case "TOKEN_REQUIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("Bestätigungstoken fehlt.").build();
            case "TOKEN_INVALID" -> Response.status(Response.Status.BAD_REQUEST).entity("Bestätigungslink ist ungültig.").build();
            case "TOKEN_EXPIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("Bestätigungslink ist abgelaufen.").build();
            default -> Response.status(Response.Status.BAD_REQUEST).entity("E-Mail konnte nicht bestätigt werden.").build();
        };
    }

    @POST
    @Path("email/resend-verification")
    @Produces(MediaType.TEXT_PLAIN)
    public Response resendVerification(EmailActionDTO dto) {
        String result = repo.resendVerification(dto == null ? null : dto.email());

        if (result == null) {
            return Response.ok("Bestätigungs-Mail wurde erneut gesendet.").build();
        }

        return switch (result) {
            case "EMAIL_REQUIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("E-Mail ist erforderlich.").build();
            case "USER_NOT_FOUND" -> Response.ok("Wenn ein Konto mit dieser E-Mail existiert, wurde eine Mail versendet.").build();
            case "ALREADY_VERIFIED" -> Response.status(Response.Status.BAD_REQUEST).entity("Diese E-Mail ist bereits bestätigt.").build();
            default -> Response.status(Response.Status.BAD_REQUEST).entity("Bestätigungs-Mail konnte nicht gesendet werden.").build();
        };
    }

    @POST
    @Path("password/forgot")
    @Produces(MediaType.TEXT_PLAIN)
    public Response forgotPassword(EmailActionDTO dto) {
        repo.requestPasswordReset(dto == null ? null : dto.email());
        return Response.ok("Wenn ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen versendet.").build();
    }

    @POST
    @Path("password/reset")
    @Produces(MediaType.TEXT_PLAIN)
    public Response resetPassword(ResetPasswordDTO dto) {
        String result = repo.resetPassword(dto == null ? null : dto.token(), dto == null ? null : dto.newPassword());

        if (result == null) {
            return Response.ok("Passwort wurde erfolgreich zurückgesetzt.").build();
        }

        return switch (result) {
            case "TOKEN_REQUIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("Reset-Token fehlt.").build();
            case "PASSWORD_REQUIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("Neues Passwort ist erforderlich.").build();
            case "NEW_PASSWORD_TOO_SHORT" -> Response.status(Response.Status.BAD_REQUEST).entity("Das neue Passwort muss mindestens 8 Zeichen lang sein.").build();
            case "TOKEN_INVALID" -> Response.status(Response.Status.BAD_REQUEST).entity("Reset-Link ist ungültig.").build();
            case "TOKEN_EXPIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("Reset-Link ist abgelaufen.").build();
            default -> Response.status(Response.Status.BAD_REQUEST).entity("Passwort konnte nicht zurückgesetzt werden.").build();
        };
    }

    @POST
    @Path("id")
    public Long getUserId(String authToken) {
        return tokenService.validateTokenAndGetUserId(authToken);
    }

    @POST
    public UserProfileDTO getUser(String authToken) {
        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            throw new WebApplicationException("Invalid token", Response.Status.UNAUTHORIZED);
        }

        User user = repo.findById(userId);
        if (user == null) {
            throw new WebApplicationException("User not found", Response.Status.NOT_FOUND);
        }

        return repo.toProfileDTO(user);
    }

    @PUT
    @Path("username")
    public Response updateUsername(UpdateUsernameDTO dto) {
        Long userId = tokenFromDto(dto == null ? null : dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        String result = repo.updateUsername(userId, dto.username());
        return switch (result) {
            case null -> Response.ok("Benutzername wurde aktualisiert.").build();
            case "USER_NOT_FOUND" -> Response.status(Response.Status.NOT_FOUND).entity("Benutzer nicht gefunden.").build();
            case "USERNAME_REQUIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("Benutzername ist erforderlich.").build();
            case "USERNAME_INVALID_LENGTH" -> Response.status(Response.Status.BAD_REQUEST).entity("Der Benutzername muss zwischen 3 und 40 Zeichen lang sein.").build();
            case "USERNAME_TAKEN" -> Response.status(Response.Status.BAD_REQUEST).entity("Der Benutzername ist bereits vergeben.").build();
            default -> Response.status(Response.Status.BAD_REQUEST).entity("Benutzername konnte nicht geändert werden.").build();
        };
    }

    @PUT
    @Path("email")
    public Response requestEmailChange(UpdateEmailDTO dto) {
        Long userId = tokenFromDto(dto == null ? null : dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        String result = repo.requestEmailChange(userId, dto.email());
        return switch (result) {
            case null -> Response.ok("Bitte bestätige die neue E-Mail über den gesendeten Link.").build();
            case "USER_NOT_FOUND" -> Response.status(Response.Status.NOT_FOUND).entity("Benutzer nicht gefunden.").build();
            case "EMAIL_REQUIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("E-Mail ist erforderlich.").build();
            case "EMAIL_INVALID" -> Response.status(Response.Status.BAD_REQUEST).entity("Bitte eine gültige E-Mail eingeben.").build();
            case "EMAIL_TOO_LONG" -> Response.status(Response.Status.BAD_REQUEST).entity("Die E-Mail ist zu lang.").build();
            case "EMAIL_TAKEN" -> Response.status(Response.Status.BAD_REQUEST).entity("Die E-Mail ist bereits vergeben.").build();
            case "EMAIL_SAME" -> Response.status(Response.Status.BAD_REQUEST).entity("Das ist bereits deine aktuelle E-Mail.").build();
            default -> Response.status(Response.Status.BAD_REQUEST).entity("E-Mail-Änderung konnte nicht angefordert werden.").build();
        };
    }

    @POST
    @Path("email/cancel-pending")
    @Consumes(MediaType.TEXT_PLAIN)
    @Produces(MediaType.TEXT_PLAIN)
    public Response cancelPendingEmailChange(String authToken) {
        Long userId = tokenFromDto(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        String result = repo.cancelPendingEmailChange(userId);
        return switch (result) {
            case null -> Response.ok("Offene E-Mail-Änderung wurde gelöscht.").build();
            case "USER_NOT_FOUND" -> Response.status(Response.Status.NOT_FOUND).entity("Benutzer nicht gefunden.").build();
            case "NO_PENDING_EMAIL" -> Response.status(Response.Status.BAD_REQUEST).entity("Keine offene E-Mail-Änderung vorhanden.").build();
            default -> Response.status(Response.Status.BAD_REQUEST).entity("Offene E-Mail-Änderung konnte nicht gelöscht werden.").build();
        };
    }

    @PUT
    @Path("password")
    public Response changePassword(ChangePasswordDTO dto) {
        Long userId = tokenFromDto(dto == null ? null : dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        String result = repo.changePassword(userId, dto.currentPassword(), dto.newPassword());

        return switch (result) {
            case null -> Response.ok("Passwort wurde aktualisiert.").build();
            case "USER_NOT_FOUND" -> Response.status(Response.Status.NOT_FOUND).entity("Benutzer nicht gefunden.").build();
            case "PASSWORD_REQUIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("Aktuelles und neues Passwort sind erforderlich.").build();
            case "CURRENT_PASSWORD_INVALID" -> Response.status(Response.Status.BAD_REQUEST).entity("Das aktuelle Passwort ist falsch.").build();
            case "NEW_PASSWORD_TOO_SHORT" -> Response.status(Response.Status.BAD_REQUEST).entity("Das neue Passwort muss mindestens 8 Zeichen lang sein.").build();
            case "PASSWORD_EQUAL" -> Response.status(Response.Status.BAD_REQUEST).entity("Das neue Passwort muss sich vom alten unterscheiden.").build();
            default -> Response.status(Response.Status.BAD_REQUEST).entity("Passwort konnte nicht geändert werden.").build();
        };
    }

    @PUT
    @Path("subscription")
    public Response updateSubscription(UpdateSubscriptionDTO dto) {
        Long userId = tokenFromDto(dto == null ? null : dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        String result = repo.updateSubscription(userId, dto.subscriptionModel());

        return switch (result) {
            case null -> Response.ok("Abo-Modell wurde aktualisiert.").build();
            case "USER_NOT_FOUND" -> Response.status(Response.Status.NOT_FOUND).entity("Benutzer nicht gefunden.").build();
            case "SUBSCRIPTION_REQUIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("Abo-Modell ist erforderlich.").build();
            default -> Response.status(Response.Status.BAD_REQUEST).entity("Abo-Modell konnte nicht geändert werden.").build();
        };
    }

    @PUT
    @Path("settings")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public Response updateSettings(UpdateUserSettingsDTO dto) {
        Long userId = tokenFromDto(dto == null ? null : dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        String result = repo.updateUserSettings(userId, dto.settings());

        return switch (result) {
            case null -> Response.ok("Einstellungen wurden gespeichert.").build();
            case "USER_NOT_FOUND" -> Response.status(Response.Status.NOT_FOUND).entity("Benutzer nicht gefunden.").build();
            case "SETTINGS_REQUIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("Einstellungen fehlen.").build();
            case "ALLOW_INVITATIONS_REQUIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("Einladungs-Einstellung fehlt.").build();
            case "LANGUAGE_INVALID" -> Response.status(Response.Status.BAD_REQUEST).entity("Sprache ist ungültig.").build();
            default -> Response.status(Response.Status.BAD_REQUEST).entity("Einstellungen konnten nicht gespeichert werden.").build();
        };
    }

    @POST
    @Path("settings/allow-invitations")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public Response updateAllowInvitations(Map<String, Object> body) {
        String authToken = body == null ? null : (String) body.get("authToken");
        Long userId = tokenFromDto(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        Boolean allowInvitations = body == null ? null : (Boolean) body.get("allowInvitations");
        String result = repo.updateAllowInvitations(userId, allowInvitations);

        return switch (result) {
            case null -> Response.ok("Einstellungen wurden gespeichert.").build();
            case "USER_NOT_FOUND" -> Response.status(Response.Status.NOT_FOUND).entity("Benutzer nicht gefunden.").build();
            case "ALLOW_INVITATIONS_REQUIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("Einladungs-Einstellung fehlt.").build();
            default -> Response.status(Response.Status.BAD_REQUEST).entity("Einladungs-Einstellung konnte nicht gespeichert werden.").build();
        };
    }

    @POST
    @Path("delete-account")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public Response deleteAccount(Map<String, String> body) {
        String authToken = body == null ? null : body.get("authToken");
        Long userId = tokenFromDto(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        String currentPassword = body == null ? null : body.get("currentPassword");
        String result = repo.deleteAccount(userId, currentPassword);

        return switch (result) {
            case null -> Response.ok("Account wurde gelöscht.").build();
            case "USER_NOT_FOUND" -> Response.status(Response.Status.NOT_FOUND).entity("Benutzer nicht gefunden.").build();
            case "PASSWORD_REQUIRED" -> Response.status(Response.Status.BAD_REQUEST).entity("Passwort ist erforderlich.").build();
            case "CURRENT_PASSWORD_INVALID" -> Response.status(Response.Status.BAD_REQUEST).entity("Das aktuelle Passwort ist falsch.").build();
            default -> Response.status(Response.Status.BAD_REQUEST).entity("Account konnte nicht gelöscht werden.").build();
        };
    }

    @POST
    @Path("profile-image")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.TEXT_PLAIN)
    public Response uploadProfileImage(@RestForm("file") FileUpload file,
                                       @RestForm("authToken") String authToken) {
        Long userId = tokenFromDto(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        if (file == null || file.fileName() == null || file.fileName().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Keine Datei hochgeladen.").build();
        }

        String contentType = file.contentType() == null ? "" : file.contentType().toLowerCase();
        if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Bitte nur JPG, PNG oder WEBP hochladen.").build();
        }

        try {
            if (Files.size(file.uploadedFile()) > MAX_PROFILE_IMAGE_SIZE) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Datei ist zu groß. Maximal 2 MB erlaubt.").build();
            }

            String objectKey = mediaStorageService.uploadProfileImage(userId, file.uploadedFile(), contentType);
            String result = repo.updateProfileImageUrl(userId, objectKey);

            if (result != null) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Profilbild konnte nicht gespeichert werden.").build();
            }

            return Response.ok(objectKey).build();
        } catch (IOException e) {
            return Response.serverError().entity("Datei konnte nicht gespeichert werden.").build();
        }
    }

    @GET
    @Path("profile-image/{userId}")
    public Response getProfileImage(@PathParam("userId") Long userId) {
        if (userId == null) {
            return Response.status(Response.Status.BAD_REQUEST).build();
        }

        User user = repo.findById(userId);
        if (user == null || user.getProfileImageUrl() == null || user.getProfileImageUrl().isBlank()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        MediaStorageService.StoredImage image = mediaStorageService.loadImage(user.getProfileImageUrl());
        if (image == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        return Response.ok(image.data(), image.contentType()).build();
    }

    private Long tokenFromDto(String authToken) {
        if (authToken == null || authToken.isBlank()) {
            return null;
        }
        return tokenService.validateTokenAndGetUserId(authToken);
    }

    @DELETE
    @Path("profile-image")
    @Consumes(MediaType.TEXT_PLAIN)
    @Produces(MediaType.TEXT_PLAIN)
    public Response deleteProfileImage(String authToken) {
        Long userId = tokenFromDto(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        User user = repo.findById(userId);
        if (user == null || user.getProfileImageUrl() == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Kein Profilbild vorhanden.").build();
        }

        mediaStorageService.delete(user.getProfileImageUrl());
        repo.updateProfileImageUrl(userId, null);

        return Response.ok("Profilbild gelöscht.").build();
    }
}