package at.repository;

import at.dtos.Example.CreateExampleDTO;
import at.dtos.Example.ExampleDTO;
import at.dtos.Example.ExampleOverviewDTO;
import at.dtos.Example.GapDTO;
import at.dtos.Example.MoveExampleToFolderDTO;
import at.model.*;
import at.model.helper.Gap;
import at.security.TokenService;
import at.service.MediaStorageService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.sql.Timestamp;
import java.util.LinkedList;
import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class ExampleRepository {
    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

    @Inject
    ExampleFolderRepository exampleFolderRepository;

    @Inject
    MediaStorageService mediaStorageService;

    @Inject
    SchoolRepository schoolRepository;

    public List<ExampleOverviewDTO> getAllExamples(Long schoolId) {
        List<Example> examples = em.createQuery(
                "SELECT e FROM Example e WHERE e.school.id = :schoolId ORDER BY e.id",
                Example.class
        ).setParameter("schoolId", schoolId).getResultList();

        return examples.stream().map(e ->
                new ExampleOverviewDTO(
                        e.getId(),
                        e.getType(),
                        e.getInstruction(),
                        e.getQuestion(),
                        e.getAdmin().getUsername(),
                        e.getAdmin().getId(),
                        e.getFocusList(),
                        e.getFolder() != null ? e.getFolder().getId() : null,
                        e.getCreatedAt(),
                        e.getUpdatedAt()
                )
        ).collect(Collectors.toList());
    }

    @Transactional
    public List<ExampleDTO> getFullExamples(Long schoolId) {
        List<Example> examples = em.createQuery(
                        "SELECT DISTINCT e FROM Example e " +
                                "LEFT JOIN FETCH e.gaps " +
                                "WHERE e.school.id = :schoolId " +
                                "ORDER BY e.id",
                        Example.class
                ).setParameter("schoolId", schoolId)
                .getResultList();

        return examples.stream().map(example ->
                new ExampleDTO(
                        example.getId(),
                        example.getAdmin().toUserDTO(),
                        example.getType(),
                        example.getInstruction(),
                        example.getQuestion(),
                        example.getSolution(),
                        example.getSolutionUrl(),
                        example.getImageUrl(),
                        example.getImageWidth(),
                        example.getSolutionImageWidth(),
                        new LinkedList<>(example.getFocusList()),
                        schoolRepository.toSchoolDTO(example.getSchool()),
                        new LinkedList<>(example.getAnswers()),
                        new LinkedList<>(example.getOptions()),
                        example.getGapFillType(),
                        new LinkedList<>(example.getGapDTO()),
                        new LinkedList<>(example.getAssigns()),
                        new LinkedList<>(example.getAssignRightItems())
                )
        ).collect(Collectors.toList());
    }

    @Transactional
    public Response createExample(CreateExampleDTO dto) {
        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        User admin = em.find(User.class, userId);
        School school = em.find(School.class, dto.schoolId());

        if (school == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Schule nicht gefunden.").build();
        }

        ExampleFolder folder = null;
        if (dto.folderId() != null && !dto.folderId().isBlank()) {
            folder = exampleFolderRepository.findById(dto.folderId());
            if (folder == null || !folder.getSchool().getId().equals(school.getId())) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Ungültiger Ordner.").build();
            }
        }

        Example example = new Example(admin, dto.type(), dto.instruction(), dto.question(), dto.solution(), school);
        example.setFolder(folder);
        example.getFocusList().clear();
        example.getFocusList().addAll(dto.focusList());
        example.setCreatedAt(Timestamp.from(java.time.Instant.now()));
        example.setUpdatedAt(Timestamp.from(java.time.Instant.now()));

        clearTypeSpecificFields(example);

        switch (dto.type()) {
            case HALF_OPEN -> example.setAnswers(dto.answers());
            case MULTIPLE_CHOICE -> example.setOptions(dto.options());
            case GAP_FILL -> {
                List<Gap> gaps = new LinkedList<>();
                for (GapDTO g : dto.gaps()) {
                    gaps.add(new Gap(g.label(), g.solution(), g.width(), g.options(), example));
                }
                example.setGaps(gaps);
                example.setGapFillType(dto.gapFillType());
            }
            case CONSTRUCTION -> {
                example.setImageUrl(dto.image());
                example.setSolutionUrl(dto.solutionUrl());
                example.setImageWidth(dto.imageWidth());
                example.setSolutionImageWidth(dto.solutionImageWidth());
            }
            case ASSIGN -> {
                example.setAssigns(dto.assigns());
                example.setAssignRightItems(dto.assignRightItems());
            }
            case OPEN -> {
            }
        }

        em.persist(example);
        em.flush();

        return Response.ok(example.getId()).build();
    }

    @Transactional
    public Response updateExample(Long exampleId, CreateExampleDTO dto) {
        Example example = em.find(Example.class, exampleId);
        if (example == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        if (!example.getAdmin().getId().equals(userId) && !example.getSchool().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Not allowed to update this Example.")
                    .build();
        }

        ExampleFolder folder = null;
        if (dto.folderId() != null && !dto.folderId().isBlank()) {
            folder = exampleFolderRepository.findById(dto.folderId());
            if (folder == null || !folder.getSchool().getId().equals(example.getSchool().getId())) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Ungültiger Ordner.").build();
            }
        }

        example.setType(dto.type());
        example.setInstruction(dto.instruction());
        example.setQuestion(dto.question());
        example.setSolution(dto.solution());
        example.setFolder(folder);
        example.getFocusList().clear();
        example.getFocusList().addAll(dto.focusList());
        example.setUpdatedAt(Timestamp.from(java.time.Instant.now()));

        clearTypeSpecificFields(example);

        switch (dto.type()) {
            case HALF_OPEN -> example.setAnswers(dto.answers());
            case MULTIPLE_CHOICE -> example.setOptions(dto.options());
            case GAP_FILL -> {
                List<Gap> gaps = new LinkedList<>();
                for (GapDTO g : dto.gaps()) {
                    gaps.add(new Gap(g.label(), g.solution(), g.width(), g.options(), example));
                }
                example.getGaps().clear();
                example.getGaps().addAll(gaps);
                example.setGapFillType(dto.gapFillType());
            }
            case CONSTRUCTION -> {
                example.setImageUrl(dto.image());
                example.setSolutionUrl(dto.solutionUrl());
                example.setImageWidth(dto.imageWidth());
                example.setSolutionImageWidth(dto.solutionImageWidth());
            }
            case ASSIGN -> {
                example.setAssigns(dto.assigns());
                example.setAssignRightItems(dto.assignRightItems());
            }
            case OPEN -> {
            }
        }

        em.merge(example);
        return Response.ok(example.getId()).build();
    }

    @Transactional
    public Response moveExampleToFolder(Long exampleId, MoveExampleToFolderDTO dto) {
        Example example = em.find(Example.class, exampleId);
        if (example == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Beispiel nicht gefunden.").build();
        }

        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        if (!example.getAdmin().getId().equals(userId) && !example.getSchool().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Not allowed to move this Example.")
                    .build();
        }

        ExampleFolder folder = null;
        if (dto.folderId() != null && !dto.folderId().isBlank()) {
            folder = exampleFolderRepository.findById(dto.folderId());
            if (folder == null || !folder.getSchool().getId().equals(example.getSchool().getId())) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Ungültiger Zielordner.").build();
            }
        }

        example.setFolder(folder);
        em.merge(example);
        return Response.ok().build();
    }

    @Transactional
    public Response deleteExample(String authToken, Long exampleId) {
        Example example = em.find(Example.class, exampleId);
        if (example == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        if (!example.getAdmin().getId().equals(userId) && !example.getSchool().getAdmin().getId().equals(userId)) {
            return Response.status(403)
                    .entity("Not allowed to delete this Example.")
                    .build();
        }

        List<Test> tests = em.createQuery(
                "SELECT t FROM Test t JOIN t.exampleList e WHERE e.example.id = :exampleId",
                Test.class
        ).setParameter("exampleId", exampleId).getResultList();

        if(!tests.isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Example is part of a Test and cannot be deleted.")
                    .build();
        }

        if(example.getImageUrl() != null) {
            mediaStorageService.delete(example.getImageUrl());
        }
        if(example.getSolutionUrl() != null) {
            mediaStorageService.delete(example.getSolutionUrl());
        }
        em.remove(example);
        return Response.ok().build();
    }

    public CreateExampleDTO getExample(Long exampleId, String authToken) {
        tokenService.validateTokenAndGetUserId(authToken);

        Example e = em.find(Example.class, exampleId);

        return new CreateExampleDTO(
                "",
                e.getSchool().getId(),
                e.getType(),
                e.getInstruction(),
                e.getQuestion(),
                e.getAnswers(),
                e.getOptions(),
                e.getGapFillType(),
                e.getGapDTO(),
                e.getAssigns(),
                e.getAssignRightItems(),
                e.getImageUrl(),
                e.getSolution(),
                e.getSolutionUrl(),
                e.getFocusList(),
                e.getImageWidth(),
                e.getSolutionImageWidth(),
                e.getFolder() != null ? e.getFolder().getId() : null
        );
    }

    @Transactional
    public String updateConstructionTaskImage(Long exampleId, String imageKey) {
        Example example = em.find(Example.class, exampleId);
        if (example == null) {
            return "EXAMPLE_NOT_FOUND";
        }

        example.setImageUrl(imageKey);
        em.merge(example);

        return null;
    }

    @Transactional
    public String updateConstructionSolutionImage(Long exampleId, String solutionKey) {
        Example example = em.find(Example.class, exampleId);
        if (example == null) {
            return "EXAMPLE_NOT_FOUND";
        }

        example.setSolutionUrl(solutionKey);
        em.merge(example);
        return null;
    }

    public Example findById(Long exampleId) {
        return em.find(Example.class, exampleId);
    }

    private void clearTypeSpecificFields(Example example) {
        example.setAnswers(new LinkedList<>());
        example.setOptions(new LinkedList<>());
        example.setGapFillType(null);
        example.getGaps().clear();
        example.setAssigns(new LinkedList<>());
        example.setAssignRightItems(new LinkedList<>());
        example.setImageWidth(null);
        example.setSolutionImageWidth(null);

        if (example.getType() != at.enums.ExampleTypes.CONSTRUCTION) {
            example.setImageUrl(null);
            example.setSolutionUrl(null);
        }
    }
}