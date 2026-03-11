package at.repository;

import at.dtos.CreateSchoolDTO;
import at.dtos.JoinRequestDTO;
import at.dtos.SchoolDTO;
import at.dtos.UserDTO;
import at.enums.RequestType;
import at.model.Example;
import at.model.JoinRequest;
import at.model.School;
import at.model.User;
import at.model.helper.Focus;
import at.security.TokenService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.util.LinkedList;
import java.util.List;
import java.util.Set;

@ApplicationScoped
@Transactional
public class SchoolRepository {
    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

    public Response addSchool(String schoolName, Long userId) {
        try {
            User user = em.find(User.class, userId);
            if (user == null) {
                return Response.status(Response.Status.BAD_REQUEST).entity("User not found").build();
            }

            School school = new School(schoolName, user);
            em.persist(school);

            return Response.ok(school).build();
        } catch (Exception e) {
            return Response.status(Response.Status.BAD_REQUEST).entity("User not found or error occurred").build();
        }
    }

    public List<SchoolDTO> getAllSchools() {
        List<School> schools = em.createQuery("SELECT s FROM School s", School.class).getResultList();
        return schools.stream()
                .map(school -> new SchoolDTO(school.getId(), school.getName(), school.getAdminDTO(), 0, school.getFocusList().stream().map(Focus::getLabel).toList()))
                .toList();
    }

    public SchoolDTO findById(Long id, Long userId) {
        School school = em.find(School.class, id);
        if (school == null) {
            return null;
        }

        if(userId == null || (!school.getAdmin().getId().equals(userId) && school.getUsers().stream().noneMatch(u -> u.getId().equals(userId)))){
            return null;
        }

        return new SchoolDTO(school.getId(), school.getName(), school.getAdminDTO(), 0, school.getFocusList().stream().map(Focus::getLabel).toList());
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
                .map(school -> new SchoolDTO(school.getId(), school.getName(), school.getAdminDTO(), 0, school.getFocusList().stream().map(Focus::getLabel).toList()))
                .toList();
    }

    public List<Focus> getFocusList(Long id) {
        return em.createQuery("SELECT s.focusList FROM School s WHERE s.id = :id", Focus.class).setParameter("id", id).getResultList();
    }

    public Focus addFocus(Long id, Focus focus) {
        School s = em.find(School.class, id);

        Focus f = new Focus(focus.getLabel());

        em.persist(f);

        s.getFocusList().add(f);

        em.merge(s);

        return f;
    }

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

    public SchoolDTO toSchoolDTO(School school) {
        return new SchoolDTO(school.getId(), school.getName(), school.getAdminDTO(), school.getUsers().size(), school.getFocusList().stream().map(Focus::getLabel).toList());
    }

    public Response sendJoinRequest(Long id, Long userId, String message) {
        School school = em.find(School.class, id);
        User user = em.find(User.class, userId);

        if (school == null || user == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("School or User not found").build();
        }

        if (school.getAdmin().getId().equals(userId) || school.getUsers().stream().anyMatch(u -> u.getId().equals(userId))) {
            return Response.status(Response.Status.BAD_REQUEST).entity("You are already a member of this school").build();
        }

        if (em.createQuery("SELECT COUNT(j) FROM JoinRequest j WHERE j.school.id = :schoolId AND j.transmitter.id = :userId", Long.class)
                .setParameter("schoolId", id)
                .setParameter("userId", userId)
                .getSingleResult() > 0) {
            return Response.status(Response.Status.BAD_REQUEST).entity("You have already sent a join request to this school").build();
        }

        JoinRequest joinRequest = new JoinRequest(school, user, school.getAdmin(), message, RequestType.JOIN);
        em.persist(joinRequest);

        return Response.ok().build();
    }

    public List<JoinRequestDTO> getJoinRequests(Long id, Long userId) {
        School school = em.find(School.class, id);

        List<JoinRequest> joinRequests;

        if (school == null) {
            joinRequests = em.createQuery("SELECT j FROM JoinRequest j WHERE j.recipient.id = :userId", JoinRequest.class)
                    .setParameter("userId", userId)
                    .getResultList();
        } else {
            joinRequests = em.createQuery("SELECT j FROM JoinRequest j WHERE j.recipient.id = :userId AND j.school.id = :schoolId", JoinRequest.class)
                    .setParameter("schoolId", id)
                    .setParameter("userId", userId)
                    .getResultList();
        }

        return joinRequests.stream()
                .map(j -> new JoinRequestDTO(toSchoolDTO(j.getSchool()), j.getTransmitter().toUserDTO(), j.getRecipient().toUserDTO(), j.getMessage(), j.isAccepted(), j.isDone(), RequestType.JOIN))
                .toList();
    }

    public List<UserDTO> getAllTeachers(Long id) {
        School school = em.find(School.class, id);

        if (school == null) {
            return List.of();
        }

        List<Long> userIds = school.getUsers()
                .stream()
                .map(User::getId)
                .toList();

        Long adminId = school.getAdmin().getId();

        String jpql = userIds.isEmpty()
                ? "SELECT u FROM User u WHERE u.id != :adminId"
                : "SELECT u FROM User u WHERE u.id NOT IN :users AND u.id != :adminId";

        var query = em.createQuery(jpql, User.class)
                .setParameter("adminId", adminId);

        if (!userIds.isEmpty()) {
            query.setParameter("users", userIds);
        }

        return query.getResultList()
                .stream()
                .map(User::toUserDTO)
                .toList();
    }

    public Response inviteTeacher(Long id, Long userId, int teacherId) {
        School school = em.find(School.class, id);
        User user = em.find(User.class, userId);
        User teacher = em.find(User.class, (long) teacherId);

        if (school == null || user == null || teacher == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("School, User or Teacher not found").build();
        }

        if (!school.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the school admin can invite teachers").build();
        }

        if (school.getUsers().stream().anyMatch(u -> u.getId().equals(teacherId))) {
            return Response.status(Response.Status.BAD_REQUEST).entity("This teacher is already a member of the school").build();
        }

        System.out.println(teacher);

        JoinRequest request = new JoinRequest(school, user, teacher, "", RequestType.INVITE);
        em.persist(request);

        return Response.ok().build();
    }
}
