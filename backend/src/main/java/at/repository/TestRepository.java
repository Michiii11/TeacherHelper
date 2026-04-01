package at.repository;

import at.dtos.Test.CreateTestDTO;
import at.dtos.Test.GradingLevelDTO;
import at.dtos.Test.TestExampleDTO;
import at.dtos.Test.TestOverviewDTO;
import at.model.*;
import at.security.TokenService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.io.IOException;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class TestRepository {
    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

    public List<TestOverviewDTO> getAllTest(Long schoolId) {
        return em.createQuery(
                        "SELECT new at.dtos.Test.TestOverviewDTO(" +
                                "t.id, t.name, SIZE(t.exampleList), t.duration, t.admin.username, t.admin.id) " +
                                "FROM Test t WHERE t.school.id = :schoolId ORDER BY t.id",
                        TestOverviewDTO.class
                )
                .setParameter("schoolId", schoolId)
                .getResultList();
    }

    @Transactional
    public Response createTest(CreateTestDTO dto) throws IOException {
        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        User admin = em.find(User.class, userId);
        School school = em.find(School.class, dto.schoolId());

        Test test = new Test(dto.name(), dto.note(), admin, school, dto.duration());
        applySettings(test, dto);
        em.persist(test);

        em.persist(new ChangeLog("Test", test.getId(), "CREATE", admin, test.getSchool()));

        addExamplesToTest(test, dto.exampleList());

        return Response.ok().build();
    }

    @Transactional
    public Response updateTest(Long testId, CreateTestDTO dto) {
        Test test = em.find(Test.class, testId);
        if (test == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        if (!test.getAdmin().getId().equals(userId) && !test.getSchool().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Not allowed to update this test.")
                    .build();
        }

        test.setName(dto.name());
        test.setNote(dto.note());
        test.setDuration(dto.duration());
        applySettings(test, dto);

        List<TestExample> existingEntries = em.createQuery(
                        "SELECT te FROM TestExample te WHERE te.test.id = :testId", TestExample.class)
                .setParameter("testId", testId)
                .getResultList();

        existingEntries.forEach(em::remove);
        test.getExampleList().clear();

        addExamplesToTest(test, dto.exampleList());

        em.persist(new ChangeLog("Test", test.getId(), "UPDATE", test.getAdmin(), test.getSchool()));

        return Response.ok().build();
    }

    @Transactional
    public Response deleteTest(String authToken, Long testId) {
        Test test = em.find(Test.class, testId);
        if (test == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        if (!test.getAdmin().getId().equals(userId) && !test.getSchool().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Not allowed to delete this test.")
                    .build();
        }

        em.persist(new ChangeLog("Test", test.getId(), "DELETE", test.getAdmin(), test.getSchool()));
        em.remove(test);

        return Response.ok().build();
    }

    public CreateTestDTO getTest(Long testId, String authToken) {
        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return null;
        }

        Test t = em.find(Test.class, testId);
        if (t == null) {
            return null;
        }

        List<TestExampleDTO> exampleList = new LinkedList<>();
        t.getExampleList().forEach(example ->
                exampleList.add(new TestExampleDTO(example.getExample(), example.getPoints(), example.getTitle())));

        return new CreateTestDTO(
                "",
                t.getSchool().getId(),
                t.getName(),
                t.getNote(),
                exampleList,
                t.getDuration(),
                t.getDefaultTaskSpacing(),
                copyMap(t.getTaskSpacingMap()),
                t.getGradingMode(),
                t.getGradingSystemName(),
                mapDtoSchemaToEntitySchema(t.getGradingSchema()),
                copyMap(t.getGradePercentages()),
                copyMap(t.getManualGradeMinimums())
        );
    }

    private void addExamplesToTest(Test test, List<TestExampleDTO> exampleDTOs) {
        if (exampleDTOs == null) {
            return;
        }

        for (TestExampleDTO exampleDTO : exampleDTOs) {
            Example managedExample = em.find(Example.class, exampleDTO.example().getId());
            TestExample testExample = new TestExample(test, managedExample, exampleDTO.points(), exampleDTO.title());
            em.persist(testExample);
            test.getExampleList().add(testExample);
        }
    }

    private void applySettings(Test test, CreateTestDTO dto) {
        test.setDefaultTaskSpacing(dto.defaultTaskSpacing());
        test.setGradingMode(dto.gradingMode());
        test.setGradingSystemName(dto.gradingSystemName());
        test.setTaskSpacingMap(copyMap(dto.taskSpacingMap()));
        test.setGradingSchema(mapGradingSchema(dto.gradingSchema()));
        test.setGradePercentages(copyMap(dto.gradePercentages()));
        test.setManualGradeMinimums(copyMap(dto.manualGradeMinimums()));
    }

    private Map<Integer, Integer> copyMap(Map<Integer, Integer> source) {
        return source == null ? Map.of() : Map.copyOf(source);
    }

    private List<GradingLevelDTO> mapDtoSchemaToEntitySchema(List<GradingLevel> source) {
        List<GradingLevelDTO> mapped = new LinkedList<>();
        if (source == null) {
            return mapped;
        }

        for (GradingLevel level : source) {
            mapped.add(new GradingLevelDTO(
                    level.getKey(),
                    level.getLabel(),
                    level.getShortLabel(),
                    level.getOrder(),
                    level.getPercentageFrom(),
                    level.getMinimumPoints()
            ));
        }

        return mapped;
    }

    private List<GradingLevel> mapGradingSchema(List<GradingLevelDTO> source) {
        List<GradingLevel> mapped = new LinkedList<>();
        if (source == null) {
            return mapped;
        }

        for (GradingLevelDTO level : source) {
            mapped.add(new GradingLevel(
                    level.key(),
                    level.label(),
                    level.shortLabel(),
                    level.order(),
                    level.percentageFrom(),
                    level.minimumPoints()
            ));
        }

        return mapped;
    }
}
