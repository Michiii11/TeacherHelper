package at.repository;

import at.dtos.*;
import at.model.*;
import at.model.helper.Gap;
import at.security.TokenService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.io.IOException;
import java.util.LinkedList;
import java.util.List;

@ApplicationScoped
public class TestRepository {
    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

    public List<TestOverviewDTO> getAllTest(Long schoolId) {
        return em.createQuery(
                        "SELECT new at.dtos.TestOverviewDTO(" +
                                "t.id, t.name, SIZE(t.exampleList), t.duration, t.state, t.admin.username, t.admin.id) " +
                                "FROM Test t WHERE t.school.id = :schoolId ORDER BY t.id",
                        TestOverviewDTO.class
                )
                .setParameter("schoolId", schoolId)
                .getResultList();
    }

    @Transactional
    public Response createTest(CreateTestDTO dto) throws IOException {
        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        User admin = em.find(User.class, userId);
        School school = em.find(School.class, dto.schoolId());

        Test test = new Test(dto.name(), dto.note(), admin, school, dto.duration(), dto.state());
        em.persist(test);

        dto.exampleList().forEach(example -> {
            TestExample testExample = new TestExample(test, example.example(), example.points(), example.title());
            em.persist(testExample);
            test.getExampleList().add(testExample);
        });

        return Response.ok().build();
    }

    @Transactional
    public Response updateTest(Long testId, CreateTestDTO dto) {
        Test test = em.find(Test.class, testId);

        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if(test.getAdmin().getId() != userId && test.getSchool().getAdmin().getId() != userId){
            return Response.status(403)
                    .entity("Not allowed to update this Example.")
                    .build();
        }

        if(tokenService.validateTokenAndGetUserId(dto.authToken()) == null){
            return Response.status(500).build();
        }

        test.setName(dto.name());
        test.getExampleList().clear();

        test.getExampleList().clear();
        List<TestExample> examplesToRemove = em.createQuery("SELECT te FROM TestExample te WHERE te.test.id = :testId", TestExample.class)
                .setParameter("testId", testId)
                .getResultList();
        examplesToRemove.forEach(em::remove);

        dto.exampleList().forEach(example -> {
            TestExample testExample = new TestExample(test, example.example(), example.points(), example.title());
            em.persist(testExample);
            test.getExampleList().add(testExample);
        });
        test.setDuration(dto.duration());
        test.setState(dto.state());

        em.persist(test);

        return Response.ok().build();
    }

    @Transactional
    public Response deleteTest(String authToken, Long testId) {
        Test test = em.find(Test.class, testId);

        Long userId = tokenService.validateTokenAndGetUserId(authToken);

        if(test.getAdmin().getId() != userId && test.getSchool().getAdmin().getId() != userId){
            return Response.status(403)
                    .entity("Not allowed to delete this Example.")
                    .build();
        }

        em.remove(test);

        return Response.ok().build();
    }

    public CreateTestDTO getTest(Long testId, String authToken) {
        Long userId = tokenService.validateTokenAndGetUserId(authToken);

        Test t = em.find(Test.class, testId);

        List<TestExampleDTO> exampleList = new LinkedList<>();
        t.getExampleList().forEach(example -> exampleList.add(new TestExampleDTO(example.getExample(), example.getPoints(), example.getTitle())));

        return new CreateTestDTO("",
                t.getSchool().getId(),
                t.getName(),
                t.getNote(),
                exampleList,
                t.getDuration(),
                t.getState());
    }
}
