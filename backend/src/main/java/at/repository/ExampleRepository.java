package at.repository;

import at.dtos.Example.CreateExampleDTO;
import at.dtos.Example.ExampleDTO;
import at.dtos.Example.ExampleOverviewDTO;
import at.dtos.Example.GapDTO;
import at.model.ChangeLog;
import at.model.Example;
import at.model.School;
import at.model.User;
import at.model.helper.Gap;
import at.security.TokenService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.util.LinkedList;
import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class ExampleRepository {
    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

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
                        e.getFocusList()
                )
        ).collect(Collectors.toList());
    }

    public List<ExampleDTO> getFullExamples(Long schoolId) {
        return getAllExamples(schoolId).stream().map(e -> {
            Example example = em.find(Example.class, e.id());
            return new ExampleDTO(
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
                    example.getFocusList(),
                    new SchoolRepository().toSchoolDTO(example.getSchool()),
                    example.getAnswers(),
                    example.getOptions(),
                    example.getGapFillType(),
                    example.getGaps(),
                    example.getAssigns(),
                    example.getAssignRightItems()
            );
        }).collect(Collectors.toList());
    }

    @Transactional
    public Response createExample(CreateExampleDTO dto) {
        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        User admin = em.find(User.class, userId);
        School school = em.find(School.class, dto.schoolId());

        Example example = new Example(admin, dto.type(), dto.instruction(), dto.question(), dto.solution(), school);
        example.getFocusList().clear();
        example.getFocusList().addAll(dto.focusList());

        switch (dto.type()) {
            case HALF_OPEN -> example.setAnswers(dto.answers());
            case MULTIPLE_CHOICE -> example.setOptions(dto.options());
            case GAP_FILL -> {
                List<Gap> gaps = new LinkedList<>();
                for (GapDTO g : dto.gaps()) {
                    gaps.add(new Gap(g.label(), g.solution(), g.options(), example));
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

        em.persist(new ChangeLog("Example", example.getId(), "CREATE", admin, school));

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

        example.setType(dto.type());
        example.setInstruction(dto.instruction());
        example.setQuestion(dto.question());
        example.setSolution(dto.solution());
        example.getFocusList().clear();
        example.getFocusList().addAll(dto.focusList());

        switch (dto.type()) {
            case HALF_OPEN -> example.setAnswers(dto.answers());
            case MULTIPLE_CHOICE -> example.setOptions(dto.options());
            case GAP_FILL -> {
                List<Gap> gaps = new LinkedList<>();
                for (GapDTO g : dto.gaps()) {
                    gaps.add(new Gap(g.label(), g.solution(), g.options(), example));
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

        em.persist(new ChangeLog("Example", example.getId(), "UPDATE", em.find(User.class, userId), example.getSchool()));
        return Response.ok(example.getId()).build();
    }

    @Transactional
    public Response deleteExample(String authToken, Long exampleId) {
        Example example = em.find(Example.class, exampleId);

        Long userId = tokenService.validateTokenAndGetUserId(authToken);

        if (!example.getAdmin().getId().equals(userId) && !example.getSchool().getAdmin().getId().equals(userId)) {
            return Response.status(403)
                    .entity("Not allowed to delete this Example.")
                    .build();
        }
        em.persist(new ChangeLog("Example", example.getId(), "DELETE", em.find(User.class, userId), example.getSchool()));

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
                e.getSolutionImageWidth()
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

        em.persist(new ChangeLog("Example", example.getId(), "UPDATE", null, example.getSchool()));
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
        em.persist(new ChangeLog("Example", example.getId(), "UPDATE", null, example.getSchool()));
        return null;
    }

    public Example findById(Long exampleId) {
        return em.find(Example.class, exampleId);
    }
}