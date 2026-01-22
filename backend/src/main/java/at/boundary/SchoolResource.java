package at.boundary;

import at.dtos.CreateSchoolDTO;
import at.dtos.SchoolDTO;
import at.model.School;
import at.model.helper.Focus;
import at.repository.SchoolRepository;
import at.security.TokenService;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
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

    @GET
    @Path("{id}")
    public SchoolDTO getYourSchools(@PathParam("id") Long id) {
        return schoolRepository.findById(id);
    }

    @GET
    @Path("{id}/focus")
    public List<Focus> getFocusList(@PathParam("id") Long id){
        return schoolRepository.getFocusList(id);
    }
}
