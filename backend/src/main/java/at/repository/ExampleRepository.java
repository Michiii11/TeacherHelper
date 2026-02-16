package at.repository;

import at.dtos.CreateExampleDTO;
import at.dtos.ExampleOverviewDTO;
import at.dtos.GapDTO;
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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Base64;
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
                        e.getDifficulty(),
                        e.getAdmin().getUsername(),
                        e.getAdmin().getId(),
                        e.getFocusList()
                )
        ).collect(Collectors.toList());
    }

    public List<Example> getFullExamples(Long schoolId) {
        return em.createQuery(
                "SELECT e FROM Example e WHERE e.school.id = :schoolId ORDER BY e.id",
                Example.class
        ).setParameter("schoolId", schoolId).getResultList();
    }

    @Transactional
    public Response createExample(CreateExampleDTO dto) throws IOException {
        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        User admin = em.find(User.class, userId);
        School school = em.find(School.class, dto.schoolId());

        Example example = new Example(admin, dto.type(), dto.instruction(), dto.question(), dto.difficulty(), dto.solution(), school);
        example.getFocusList().clear();
        example.getFocusList().addAll(dto.focusList());

        System.out.println(dto);

        switch (dto.type()){
            case HALF_OPEN -> {
                example.setAnswers(dto.answers());
            }
            case MULTIPLE_CHOICE -> {
                example.setOptions(dto.options());
            }
            case GAP_FILL -> {
                List<Gap> gaps = new LinkedList<>();
                for(GapDTO g : dto.gaps()){
                    gaps.add(new Gap(g.label(), g.solution(), g.options(), example));
                }
                example.setGaps(gaps);
                example.setGapFillType(dto.gapFillType());
            }
            case CONSTRUCTION -> {
                example.setImageUrl(dto.image());
                example.setSolutionUrl(dto.solutionUrl());
            }
            case ASSIGN -> {
                example.setAssigns(dto.assigns());
                example.setAssignRightItems(dto.assignRightItems());
            }
        }

        em.persist(example);

        return Response.ok().build();
    }

    @Transactional
    public Response updateExample(Long exampleId, CreateExampleDTO dto) {
        Example example = em.find(Example.class, exampleId);

        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());

        if(tokenService.validateTokenAndGetUserId(dto.authToken()) == null){
            return Response.status(500).build();
        }

        if(example.getAdmin().getId() != userId && example.getSchool().getAdmin().getId() != userId){
            return Response.status(403)
                    .entity("Not allowed to update this Example.")
                    .build();
        }

        example.setType(dto.type());
        example.setInstruction(dto.instruction());
        example.setQuestion(dto.question());
        example.setDifficulty(dto.difficulty());
        example.setSolution(dto.solution());
        example.getFocusList().clear();
        example.getFocusList().addAll(dto.focusList());

        System.out.println(dto);

        switch (dto.type()){
            case HALF_OPEN -> {
                example.setAnswers(dto.answers());
            }
            case MULTIPLE_CHOICE -> {
                example.setOptions(dto.options());
            }
            case GAP_FILL -> {
                List<Gap> gaps = new LinkedList<>();
                for(GapDTO g : dto.gaps()){
                    gaps.add(new Gap(g.label(), g.solution(), g.options(), example));
                }

                example.getGaps().clear();
                example.getGaps().addAll(gaps);
                example.setGapFillType(dto.gapFillType());
            }
            case CONSTRUCTION -> {
                example.setImageUrl(dto.image());
                example.setSolutionUrl(dto.solutionUrl());
            }
            case ASSIGN -> {
                example.setAssigns(dto.assigns());
                example.setAssignRightItems(dto.assignRightItems());
            }
        }

        em.persist(example);

        return Response.ok().build();
    }

    @Transactional
    public Response deleteExample(String authToken, Long exampleId) {
        Example example = em.find(Example.class, exampleId);

        Long userId = tokenService.validateTokenAndGetUserId(authToken);

        if(example.getAdmin().getId() != userId && example.getSchool().getAdmin().getId() != userId){
            return Response.status(403)
                    .entity("Not allowed to delete this Example.")
                    .build();
        }

        em.remove(example);

        return Response.ok().build();
    }

    public CreateExampleDTO getExample(Long exampleId, String authToken) {
        Long userId = tokenService.validateTokenAndGetUserId(authToken);

        Example e = em.find(Example.class, exampleId);

        return new CreateExampleDTO("",
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
                e.getDifficulty(),
                e.getFocusList());
    }
}
