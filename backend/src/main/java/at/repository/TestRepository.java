package at.repository;

import at.dtos.Example.ExampleDTO;
import at.dtos.Example.ExampleVariableDTO;
import at.dtos.Example.GapDTO;
import at.dtos.School.SchoolDTO;
import at.dtos.Test.CreateTestDTO;
import at.dtos.Test.GradingLevelDTO;
import at.dtos.Test.MoveTestToFolderDTO;
import at.dtos.Test.TestExampleDTO;
import at.dtos.Test.TestOverviewDTO;
import at.model.*;
import at.model.helper.ExampleVariable;
import at.security.TokenService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.io.IOException;
import java.sql.Timestamp;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class TestRepository {
    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

    @Inject
    TestFolderRepository testFolderRepository;

    public List<TestOverviewDTO> getAllTest(Long schoolId) {
        return em.createQuery(
                        "SELECT new at.dtos.Test.TestOverviewDTO(" +
                                "t.id, " +
                                "t.name, " +
                                "SIZE(t.exampleList), " +
                                "t.duration, " +
                                "t.admin.username, " +
                                "t.admin.id, " +
                                "t.createdAt, " +
                                "t.updatedAt, " +
                                "t.folder.id" +
                                ") " +
                                "FROM Test t " +
                                "WHERE t.school.id = :schoolId " +
                                "ORDER BY t.id",
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

        if (school == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Schule nicht gefunden.").build();
        }

        TestFolder folder = null;
        if (dto.folderId() != null && !dto.folderId().isBlank()) {
            folder = testFolderRepository.findById(dto.folderId());
            if (folder == null || !folder.getSchool().getId().equals(school.getId())) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Ungültiger Ordner.").build();
            }
        }

        Test test = new Test(dto.name(), dto.note(), admin, school, dto.duration());
        test.setFolder(folder);
        test.setCreatedAt(Timestamp.from(java.time.Instant.now()));
        test.setUpdatedAt(Timestamp.from(java.time.Instant.now()));
        applySettings(test, dto);
        em.persist(test);

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

        TestFolder folder = null;
        if (dto.folderId() != null && !dto.folderId().isBlank()) {
            folder = testFolderRepository.findById(dto.folderId());
            if (folder == null || !folder.getSchool().getId().equals(test.getSchool().getId())) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Ungültiger Ordner.").build();
            }
        }

        test.setName(dto.name());
        test.setNote(dto.note());
        test.setDuration(dto.duration());
        test.setFolder(folder);
        test.setUpdatedAt(Timestamp.from(java.time.Instant.now()));
        applySettings(test, dto);

        List<TestExample> existingEntries = em.createQuery(
                        "SELECT te FROM TestExample te WHERE te.test.id = :testId", TestExample.class)
                .setParameter("testId", testId)
                .getResultList();

        existingEntries.forEach(em::remove);
        test.getExampleList().clear();

        addExamplesToTest(test, dto.exampleList());

        return Response.ok().build();
    }

    @Transactional
    public Response moveTestToFolder(Long testId, MoveTestToFolderDTO dto) {
        Test test = em.find(Test.class, testId);
        if (test == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Test nicht gefunden.").build();
        }

        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        if (!test.getAdmin().getId().equals(userId) && !test.getSchool().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Not allowed to move this test.")
                    .build();
        }

        TestFolder folder = null;
        if (dto.folderId() != null && !dto.folderId().isBlank()) {
            folder = testFolderRepository.findById(dto.folderId());
            if (folder == null || !folder.getSchool().getId().equals(test.getSchool().getId())) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Ungültiger Zielordner.").build();
            }
        }

        test.setFolder(folder);
        em.merge(test);
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
                exampleList.add(new TestExampleDTO(
                        mapToExampleDTO(example.getExample()),
                        example.getPoints(),
                        example.getTitle(),
                        copyStringMap(example.getVariableValues())
                )));

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
                copyMap(t.getManualGradeMinimums()),
                t.getFolder() != null ? t.getFolder().getId() : null
        );
    }

    private ExampleDTO mapToExampleDTO(Example e) {
        return new ExampleDTO(
                e.getId(),
                e.getAdmin().toUserDTO(),
                e.getType(),
                e.getInstruction(),
                e.getQuestion(),
                e.getSolution(),
                e.getSolutionUrl(),
                e.getImageUrl(),
                e.getImageWidth(),
                e.getSolutionImageWidth(),
                e.getFocusList(),
                mapVariables(e.getVariables()),
                new SchoolDTO(
                        e.getSchool().getId(),
                        e.getSchool().getName(),
                        e.getSchool().getLogoUrl(),
                        e.getSchool().getAdminDTO(),
                        0,
                        null
                ),
                e.getAnswers(),
                e.getOptions(),
                e.getGapFillType(),
                new LinkedList<>(
                        e.getGaps().stream().map(g -> new GapDTO(
                                g.getId(),
                                g.getLabel(),
                                g.getSolution(),
                                g.getWidth(),
                                g.getOptions()
                        )).toList()
                ),
                e.getAssigns(),
                e.getAssignRightItems()
        );
    }

    private void addExamplesToTest(Test test, List<TestExampleDTO> exampleDTOs) {
        if (exampleDTOs == null) {
            return;
        }

        for (TestExampleDTO exampleDTO : exampleDTOs) {
            Example managedExample = em.find(Example.class, exampleDTO.example().id());
            TestExample testExample = new TestExample(test, managedExample, exampleDTO.points(), exampleDTO.title());
            testExample.setVariableValues(copyStringMap(exampleDTO.variableValues()));
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

    private Map<String, String> copyStringMap(Map<String, String> source) {
        return source == null ? new HashMap<>() : new HashMap<>(source);
    }

    private List<ExampleVariableDTO> mapVariables(List<ExampleVariable> variables) {
        List<ExampleVariableDTO> mapped = new LinkedList<>();
        if (variables == null) {
            return mapped;
        }

        for (ExampleVariable variable : variables) {
            mapped.add(new ExampleVariableDTO(
                    variable.getId(),
                    variable.getKey(),
                    variable.getDefaultValue()
            ));
        }

        return mapped;
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
