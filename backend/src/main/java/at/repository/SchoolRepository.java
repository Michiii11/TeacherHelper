package at.repository;

import at.dtos.CreateSchoolDTO;
import at.dtos.SchoolDTO;
import at.dtos.UserDTO;
import at.model.Example;
import at.model.School;
import at.model.User;
import at.model.helper.Focus;
import at.security.TokenService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.Set;

@ApplicationScoped
public class SchoolRepository {
    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

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
                        school.getAdmin().getPassword()), 0))
                .toList();
    }

    public SchoolDTO findById(Long id) {
        School school = em.find(School.class, id);
        if (school == null) {
            return null;
        }
        return new SchoolDTO(school.getId(), school.getName(), new UserDTO(
                school.getAdmin().getUsername(),
                school.getAdmin().getEmail(),
                school.getAdmin().getPassword()), 0);
    }

    public List<SchoolDTO> getYourSchools(String auth) {
        Long userId = tokenService.validateTokenAndGetUserId(auth);

        if (userId == null) {
            return List.of();
        }

        User user = em.find(User.class, userId);

        List<School> schools = em.createQuery(
                        "SELECT s FROM School s WHERE s.admin.id = :userId OR :user MEMBER OF s.users", School.class)
                .setParameter("userId", userId)
                .setParameter("user", user)
                .getResultList();

        return schools.stream()
                .map(school -> new SchoolDTO(school.getId(), school.getName(), new UserDTO(
                        school.getAdmin().getUsername(),
                        school.getAdmin().getEmail(),
                        school.getAdmin().getPassword()), 0))
                .toList();
    }

    public List<Focus> getFocusList(Long id) {
        return em.createQuery("SELECT s.focusList FROM School s WHERE s.id = :id", Focus.class).setParameter("id", id).getResultList();
    }

    @Transactional
    public Focus addFocus(Long id, Focus focus) {
        School s = em.find(School.class, id);

        Focus f = new Focus(focus.getLabel());

        em.persist(f);

        s.getFocusList().add(f);

        em.merge(s);

        return f;
    }

    @Transactional
    public Response deleteFocus(Long id, Long focusId) {
        School s = em.find(School.class, id);
        Focus f = em.find(Focus.class, focusId);

        s.getFocusList().remove(f);

        List<Example> exampleList = em.createQuery(
                        "select e from Example e where :f MEMBER OF e.focusList", Example.class)
                .setParameter("f", f)
                .getResultList();

        for(Example e : exampleList){
            e.getFocusList().remove(f);
        }

        em.remove(f);

        return Response.ok().build();
    }
}
