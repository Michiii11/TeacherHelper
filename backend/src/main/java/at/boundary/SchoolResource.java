package at.boundary;

import at.dtos.*;
import at.dtos.Notification.CreateSchoolInviteDTO;
import at.dtos.Notification.RespondSchoolInviteDTO;
import at.dtos.Notification.SchoolInviteDTO;
import at.dtos.School.CreateSchoolDTO;
import at.dtos.School.SchoolDTO;
import at.dtos.User.UserDTO;
import at.model.helper.Focus;
import at.repository.SchoolRepository;
import at.security.TokenService;
import jakarta.inject.Inject;
import jakarta.json.JsonObject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;

import java.util.List;

@Path("school")
public class SchoolResource {
    @Inject
    SchoolRepository schoolRepository;

    @Inject
    TokenService tokenService;

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
        Long userId = tokenService.validateTokenAndGetUserId(auth);
        return schoolRepository.findById(id, userId);
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

        Long userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.addSchool(dto.schoolName(), userId);
    }

    @POST
    @Path("{id}/leave")
    public Response leaveSchool(@PathParam("id") Long id, String auth) {
        Long userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.leaveSchool(id, userId);
    }

    @DELETE
    @Path("{id}/remove-teacher")
    public Response removeTeacher(@PathParam("id") Long id, JsonObject request) {
        Long userId = tokenService.validateTokenAndGetUserId(request.getString("authToken"));
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
    @Path("{id}/invite-teacher")
    public Response inviteTeacher(@PathParam("id") Long id, CreateSchoolInviteDTO dto) {
        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        if (dto.teacherId() == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("teacherId is required").build();
        }

        return schoolRepository.inviteTeacher(id, userId, dto.teacherId(), dto.message());
    }

    @POST
    @Path("{id}/join-request")
    public Response sendJoinRequest(@PathParam("id") Long id, JsonObject request) {
        String authToken = request.getString("authToken", null);
        String message = request.getString("message", "");

        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.sendJoinRequest(id, userId, message);
    }

    @POST
    @Path("invite/{inviteId}/respond")
    public Response respondToInvite(@PathParam("inviteId") Long inviteId, RespondSchoolInviteDTO dto) {
        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.respondToInvite(inviteId, userId, dto.accept());
    }

    @POST
    @Path("join-request/{inviteId}/respond")
    public Response respondToJoinRequest(@PathParam("inviteId") Long inviteId, RespondSchoolInviteDTO dto) {
        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.respondToJoinRequest(inviteId, userId, dto.accept());
    }

    @POST
    @Path("my-pending-invites")
    public List<SchoolInviteDTO> getMyPendingInvites(String auth) {
        Long userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            return List.of();
        }

        return schoolRepository.getMyPendingInvites(userId);
    }

    @POST
    @Path("{id}/pending-join-requests")
    public List<SchoolInviteDTO> getPendingJoinRequests(@PathParam("id") Long id, String auth) {
        Long userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            return List.of();
        }

        return schoolRepository.getPendingRequestsForSchool(id, userId);
    }
}