package at.boundary;

import at.dtos.CreateSchoolDTO;
import at.dtos.JoinRequestDTO;
import at.dtos.SchoolDTO;
import at.dtos.UserDTO;
import at.model.School;
import at.model.helper.Focus;
import at.repository.SchoolRepository;
import at.security.TokenService;
import jakarta.inject.Inject;
import jakarta.json.JsonObject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.Set;

@Path("school")
public class SchoolResource {
    @Inject
    SchoolRepository schoolRepository;

    @Inject
    TokenService tokenService;

    @POST
    @Path("add")
    public Response addSchool(CreateSchoolDTO dto){
        String auth = dto.authToken();
        if (auth == null || auth.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Missing or invalid Authorization token").build();
        }

        String token = auth;

        Long userId = tokenService.validateTokenAndGetUserId(token);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.addSchool(dto.schoolName(), userId);
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
        Long userId = tokenService.validateTokenAndGetUserId(auth);
        return schoolRepository.findById(id, userId);
    }

    @GET
    @Path("{id}/focus")
    public List<Focus> getFocusList(@PathParam("id") Long id){
        return schoolRepository.getFocusList(id);
    }

    @POST
    @Path("{id}/focus")
    public Focus addFocus(@PathParam("id") Long id, Focus focus){
        return schoolRepository.addFocus(id, focus);
    }

    @DELETE
    @Path("{id}/focus/{focusId}")
    public Response deleteFocus(@PathParam("id") Long id, @PathParam("focusId") Long focusId){
        return schoolRepository.deleteFocus(id, focusId);
    }

    @POST
    @Path("{id}/join-request")
    public Response sendJoinRequest(@PathParam("id") Long id, JsonObject request) {
        Long userId = tokenService.validateTokenAndGetUserId(request.getString("userToken"));
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.sendJoinRequest(id, userId, request.getString("message"));
    }

    @POST
    @Path("{id}/get-join-requests")
    public List<JoinRequestDTO> getJoinRequests(@PathParam("id") Long id, String auth) {
        Long userId = tokenService.validateTokenAndGetUserId(auth);
        return schoolRepository.getJoinRequests(id, userId);
    }

    @GET
    @Path("{id}/rest")
    public List<UserDTO> getAllTeachers(@PathParam("id") Long id) {
        return schoolRepository.getAllTeachers(id);
    }

    @POST
    @Path("{id}/invite-teacher")
    public Response inviteTeacher(@PathParam("id") Long id, JsonObject request) {
        Long userId = tokenService.validateTokenAndGetUserId(request.getString("authToken"));
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        return schoolRepository.inviteTeacher(id, userId, request.getInt("teacherId"));
    }
}
