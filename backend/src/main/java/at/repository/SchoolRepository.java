package at.repository;

import at.dtos.CreateSchoolDTO;
import at.dtos.SchoolDTO;
import at.dtos.UserDTO;
import at.model.School;
import at.model.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.util.List;

@ApplicationScoped
public class SchoolRepository {
    @Inject
    EntityManager em;

    @Transactional
    public Response addSchool(String schoolName, Long userId) {
        try {
            User user = em.find(User.class, userId);
            if (user == null) {
                return Response.status(Response.Status.BAD_REQUEST).entity("User not found").build();
            }

            School school = new School(schoolName, user);
            em.persist(school);

            user.setSchool(school);
            em.merge(user);

            return Response.ok(school).build();
        } catch (Exception e) {
            return Response.status(Response.Status.BAD_REQUEST).entity("User not found or error occurred").build();
        }
    }

    public List<SchoolDTO> getAllSchools() {
        List<School> schools = em.createQuery("SELECT s FROM School s", School.class).getResultList();
        return schools.stream()
                .map(school -> new SchoolDTO(school.getId(), school.getName(), new UserDTO(
                        school.getAdmin().getUsername(),
                        school.getAdmin().getEmail(),
                        school.getAdmin().getPassword()
                )))
                .toList();
    }
}
