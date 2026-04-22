package at.boundary;

import at.dtos.Notification.CreateSchoolInviteDTO;
import at.dtos.Notification.RespondSchoolInviteDTO;
import at.dtos.Notification.SchoolInviteDTO;
import at.dtos.School.CreateSchoolDTO;
import at.dtos.School.SchoolDTO;
import at.dtos.School.UpdateSchoolDTO;
import at.dtos.User.UserDTO;
import at.model.helper.Focus;
import at.repository.SchoolRepository;
import at.security.TokenService;
import at.service.MediaStorageService;
import io.smallrye.common.annotation.Blocking;
import jakarta.inject.Inject;
import jakarta.json.JsonObject;
import jakarta.ws.rs.BeanParam;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Path("school")
public class SchoolResource {
    @Inject
    SchoolRepository schoolRepository;

    @Inject
    TokenService tokenService;

    @Inject
    MediaStorageService mediaStorageService;

    public static class SchoolLogoUploadForm {
        @RestForm
        public String authToken;

        @RestForm
        public FileUpload file;
    }

    @GET
    public List<SchoolDTO> getSchools() {
        return schoolRepository.getAllSchools();
    }

    @POST
    @Path("your-schools")
    public List<SchoolDTO> getYourSchools(String auth) {
        return schoolRepository.getYourSchools(auth);
    }

    @POST
    @Path("{id}")
    public SchoolDTO getSchoolById(@PathParam("id") Long id, String auth) {
        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        return schoolRepository.findById(id, userId);
    }

    @PUT
    @Path("{id}/settings")
    public Response updateSchoolSettings(@PathParam("id") Long id, UpdateSchoolDTO dto) {
        if (dto == null || dto.authToken() == null || dto.authToken().isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Missing or invalid Authorization token").build();
        }

        UUID userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.updateSchoolSettings(id, userId, dto.name());
    }

    @POST
    @Path("{id}/logo")
    @Blocking
    public Response uploadSchoolLogo(@PathParam("id") Long id, @BeanParam SchoolLogoUploadForm form) {
        if (form == null || form.authToken == null || form.authToken.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Missing or invalid Authorization token").build();
        }

        UUID userId = tokenService.validateTokenAndGetUserId(form.authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        if (form.file == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("No file uploaded").build();
        }

        String contentType = form.file.contentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Uploaded file must be an image").build();
        }

        try {
            String objectName = mediaStorageService.uploadSchoolLogo(id, form.file.uploadedFile());
            return schoolRepository.updateSchoolLogoObject(id, userId, objectName);
        } catch (IOException e) {
            return Response.serverError().entity("Logo upload failed").build();
        }
    }

    @DELETE
    @Path("{id}/logo")
    public Response deleteSchoolLogo(@PathParam("id") Long id, JsonObject request) {
        if (request == null || !request.containsKey("authToken")) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Missing or invalid Authorization token").build();
        }

        UUID userId = tokenService.validateTokenAndGetUserId(request.getString("authToken"));
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.deleteSchoolLogo(id, userId);
    }

    @GET
    @Path("{id}/logo")
    public Response getSchoolLogo(@PathParam("id") Long id) {
        String objectName = schoolRepository.getSchoolUrl(id);
        if (objectName == null || objectName.isBlank()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        MediaStorageService.StoredImage image = mediaStorageService.loadImage(objectName);
        if (image == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        return Response.ok(image.data()).type(image.contentType()).build();
    }

    @DELETE
    @Path("{id}")
    public Response deleteSchool(@PathParam("id") Long id, JsonObject request) {
        if (request == null || !request.containsKey("authToken")) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Missing or invalid Authorization token").build();
        }

        UUID userId = tokenService.validateTokenAndGetUserId(request.getString("authToken"));
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.deleteSchool(id, userId);
    }

    @GET
    @Path("{id}/focus")
    public List<Focus> getFocusList(@PathParam("id") Long id) {
        return schoolRepository.getFocusList(id);
    }

    @GET
    @Path("{id}/rest")
    public List<UserDTO> getAllTeachers(@PathParam("id") Long id) {
        return schoolRepository.getAllTeachers(id);
    }

    @POST
    @Path("add")
    public Response addSchool(CreateSchoolDTO dto) {
        String auth = dto.authToken();
        if (auth == null || auth.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Missing or invalid Authorization token").build();
        }

        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.addSchool(dto.schoolName(), userId);
    }

    @POST
    @Path("{id}/leave")
    public Response leaveSchool(@PathParam("id") Long id, String auth) {
        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.leaveSchool(id, userId);
    }

    @DELETE
    @Path("{id}/remove-teacher")
    public Response removeTeacher(@PathParam("id") Long id, JsonObject request) {
        UUID userId = tokenService.validateTokenAndGetUserId(request.getString("authToken"));
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.removeTeacher(id, userId, request.getInt("teacherId"));
    }

    @POST
    @Path("{id}/focus")
    public Focus addFocus(@PathParam("id") Long id, Focus focus) {
        return schoolRepository.addFocus(id, focus);
    }

    @DELETE
    @Path("{id}/focus/{focusId}")
    public Response deleteFocus(@PathParam("id") Long id, @PathParam("focusId") Long focusId) {
        return schoolRepository.deleteFocus(id, focusId);
    }

    @POST
    @Path("{id}/invite")
    public Response inviteTeacher(@PathParam("id") Long id, CreateSchoolInviteDTO dto) {
        UUID userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.inviteTeacher(id, userId, dto.email());
    }

    @POST
    @Path("invite/{inviteId}/respond")
    public Response respondToInvite(@PathParam("inviteId") Long inviteId, RespondSchoolInviteDTO dto) {
        UUID userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.respondToInvite(inviteId, userId, dto.accept());
    }

    @POST
    @Path("my-pending-invites")
    public List<SchoolInviteDTO> getMyPendingInvites(String auth) {
        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            return List.of();
        }

        return schoolRepository.getMyPendingInvites(userId);
    }

    @POST
    @Path("{id}/pending-join-requests")
    public List<SchoolInviteDTO> getPendingJoinRequests(@PathParam("id") Long id, String auth) {
        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            return List.of();
        }

        return schoolRepository.getPendingRequestsForSchool(id, userId);
    }
}