package at.repository;

import at.dtos.Example.ExampleDTO;
import at.dtos.Example.ExampleVariableDTO;
import at.dtos.Example.GapDTO;
import at.dtos.Collection.CollectionDTO;
import at.dtos.Test.CreateTestDTO;
import at.dtos.Test.GradingLevelDTO;
import at.dtos.Test.TestExampleDTO;
import at.dtos.Test.TestOverviewDTO;
import at.model.*;
import at.model.Collection;
import at.model.helper.ExampleVariable;
import at.model.helper.GradingLevel;
import at.websocket.CollectionSocket;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.util.*;

@ApplicationScoped
@Transactional
public class TestRepository {
    @Inject
    EntityManager em;

    @Inject
    FolderRepository folderRepository;

    @Inject
    CollectionRepository collectionRepository;

    public Response getAllTest(UUID collectionId, UUID userId) {
        if (!collectionRepository.isUserPartOfCollection(collectionId, userId)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        List<TestOverviewDTO> dtos = em.createQuery(
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
                                "WHERE t.collection.id = :collectionId " +
                                "ORDER BY t.id",
                        TestOverviewDTO.class
                )
                .setParameter("collectionId", collectionId)
                .getResultList();

        return Response.ok(dtos).build();
    }

    public Response getTest(UUID testId, UUID userId) {
        Test t = em.find(Test.class, testId);
        if (t == null) {
            return null;
        }

        if (!collectionRepository.isUserPartOfCollection(t.getCollection().getId(), userId)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        List<TestExampleDTO> exampleList = new LinkedList<>();
        t.getExampleList().forEach(example ->
                exampleList.add(new TestExampleDTO(
                        mapToExampleDTO(example.getExample()),
                        example.getPoints(),
                        example.getTitle(),
                        copyStringMap(example.getVariableValues())
                )));

        CreateTestDTO dto = new CreateTestDTO(
                t.getCollection().getId(),
                t.getName(),
                t.getNote(),
                exampleList,
                t.getDuration(),
                t.getDefaultTaskSpacing(),
                copyMap(t.getTaskSpacingMap()),
                t.getGradingMode(),
                t.getGradingSystemName(),
                mapDtoSchemaToEntitySchema(t.getGradingSchema()),
                copyMapInt(t.getGradePercentages()),
                copyMapInt(t.getManualGradeMinimums()),
                t.getFolder() != null ? t.getFolder().getId() : null
        );

        return Response.ok(dto).build();
    }

    public Response createTest(CreateTestDTO dto, UUID userId) {
        User admin = em.find(User.class, userId);
        Collection collection = em.find(Collection.class, dto.collectionId());

        if (collection == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Collection not found.").build();
        }

        if (!collectionRepository.isUserPartOfCollection(collection.getId(), userId)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        Folder folder = null;
        if (dto.folderId() != null) {
            folder = folderRepository.findById(dto.folderId());
            if (folder == null || !folder.getCollection().getId().equals(collection.getId())) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Unvalid Folder.").build();
            }
        }

        Test test = new Test(dto.name(), dto.note(), admin, collection, dto.duration());
        test.setFolder(folder);
        applySettings(test, dto);
        em.persist(test);

        addExamplesToTest(test, dto.exampleList());
        CollectionSocket.broadcast(test.getCollection().getId());
        return Response.ok().build();
    }

    public Response updateTest(UUID testId, UUID userId, CreateTestDTO dto) {
        Test test = em.find(Test.class, testId);
        if (test == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        if (!test.getAdmin().getId().equals(userId) && !test.getCollection().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Not allowed to update this test.")
                    .build();
        }

        Folder folder = null;
        if (dto.folderId() != null) {
            folder = folderRepository.findById(dto.folderId());
            if (folder == null || !folder.getCollection().getId().equals(test.getCollection().getId())) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Unvalid Folder.").build();
            }
        }

        test.setName(dto.name());
        test.setNote(dto.note());
        test.setDuration(dto.duration());
        test.setFolder(folder);
        applySettings(test, dto);

        List<UUID> existingEntryIds = em.createQuery(
                        "SELECT te.id FROM TestExample te WHERE te.test.id = :testId", UUID.class)
                .setParameter("testId", testId)
                .getResultList();

        deleteTestExamples(existingEntryIds);

        em.flush();
        em.clear();
        test = em.find(Test.class, testId);
        applySettings(test, dto);
        test.getExampleList().clear();

        addExamplesToTest(test, dto.exampleList());
        CollectionSocket.broadcast(test.getCollection().getId());
        return Response.ok().build();
    }

    public Response deleteTest(UUID testId, UUID userId) {
        Test test = em.find(Test.class, testId);
        if (test == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        if (!test.getAdmin().getId().equals(userId) && !test.getCollection().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Not allowed to delete this test.")
                    .build();
        }

        em.remove(test);
        CollectionSocket.broadcast(test.getCollection().getId());
        return Response.ok().build();
    }

    public Response moveTestToFolder(UUID testId, UUID folderId, UUID userId) {
        Test test = em.find(Test.class, testId);
        if (test == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Test not found.").build();
        }

        if (!test.getAdmin().getId().equals(userId) && !test.getCollection().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Not allowed to move this test.")
                    .build();
        }

        Folder folder = null;
        if (folderId != null) {
            folder = folderRepository.findById(folderId);
            if (folder == null || !folder.getCollection().getId().equals(test.getCollection().getId())) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Unvalid folder.").build();
            }
        }

        test.setFolder(folder);
        em.merge(test);
        CollectionSocket.broadcast(test.getCollection().getId());
        return Response.ok().build();
    }






    private void deleteTestExamples(List<UUID> testExampleIds) {
        if (testExampleIds == null || testExampleIds.isEmpty()) {
            return;
        }

        em.createNativeQuery("""
            DELETE FROM test_example_variable_values
            WHERE test_example_id IN (:ids)
            """)
                .setParameter("ids", testExampleIds)
                .executeUpdate();

        em.createQuery("""
            DELETE FROM TestExample te
            WHERE te.id IN :ids
            """)
                .setParameter("ids", testExampleIds)
                .executeUpdate();
    }

    private void deleteTestElementCollections(List<UUID> testIds) {
        if (testIds == null || testIds.isEmpty()) {
            return;
        }

        em.createNativeQuery("DELETE FROM test_task_spacing WHERE test_id IN (:testIds)")
                .setParameter("testIds", testIds)
                .executeUpdate();

        em.createNativeQuery("DELETE FROM test_grading_levels WHERE test_id IN (:testIds)")
                .setParameter("testIds", testIds)
                .executeUpdate();

        em.createNativeQuery("DELETE FROM test_grade_percentages WHERE test_id IN (:testIds)")
                .setParameter("testIds", testIds)
                .executeUpdate();

        em.createNativeQuery("DELETE FROM test_manual_grade_minimums WHERE test_id IN (:testIds)")
                .setParameter("testIds", testIds)
                .executeUpdate();
    }

    private ExampleDTO mapToExampleDTO(Example e) {
        return new ExampleDTO(
                e.getId(),
                e.getAdmin().toUserDTO(),
                e.getFolder() != null ? e.getFolder().toDto() : null,
                e.getType(),
                e.getInstruction(),
                e.getQuestion(),
                e.getSolution(),
                e.getSolutionUrl(),
                e.getImageUrl(),
                e.getImageWidth(),
                e.getSolutionImageWidth(),
                e.getFocusList() == null ? new LinkedList<>() : new LinkedList<>(e.getFocusList()),
                mapVariables(e.getVariables()),
                new CollectionDTO(
                        e.getCollection().getId(),
                        e.getCollection().getName(),
                        e.getCollection().getLogoUrl(),
                        e.getCollection().getAdminDTO(),
                        List.of(),
                        List.of(),
                        e.getCollection().getUsers() == null
                                ? List.of()
                                : e.getCollection().getUsers().stream()
                                .map(User::toUserDTO)
                                .toList()
                ),
                e.getAnswers() == null ? new LinkedList<>() : new LinkedList<>(e.getAnswers()),
                e.getOptions() == null ? new LinkedList<>() : new LinkedList<>(e.getOptions()),
                e.getGapFillType(),
                e.getGaps() == null ? new LinkedList<>() : new LinkedList<>(
                        e.getGaps().stream().map(g -> new GapDTO(
                                g.getId(),
                                g.getLabel(),
                                g.getSolution(),
                                g.getWidth(),
                                g.getOptions() == null ? new LinkedList<>() : new LinkedList<>(g.getOptions())
                        )).toList()
                ),
                e.getAssigns() == null ? new LinkedList<>() : new LinkedList<>(e.getAssigns()),
                e.getAssignRightItems() == null ? new LinkedList<>() : new LinkedList<>(e.getAssignRightItems()),
                e.getDisplaySettings()
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
        test.setGradePercentages(copyMapInt(dto.gradePercentages()));
        test.setManualGradeMinimums(copyMapInt(dto.manualGradeMinimums()));
    }

    private Map<UUID, Integer> copyMap(Map<UUID, Integer> source) {
        return source == null ? Map.of() : Map.copyOf(source);
    }

    private Map<Integer, Integer> copyMapInt(Map<Integer, Integer> source) {
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
