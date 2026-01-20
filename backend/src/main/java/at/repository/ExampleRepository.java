package at.repository;

import at.dtos.CreateExampleDTO;
import at.dtos.ExampleOverviewDTO;
import at.model.Example;
import at.model.School;
import at.model.User;
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
import java.util.List;

@ApplicationScoped
public class ExampleRepository {
    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

    public List<ExampleOverviewDTO> getAllExamples(Long schoolId) {
        return em.createQuery("SELECT new at.dtos.ExampleOverviewDTO(e.id, e.type, e.instruction, e.question, e.difficulty, e.admin.username) " +
                        "FROM Example e where e.school.id = :schoolId order by e.id", ExampleOverviewDTO.class)
                .setParameter("schoolId", schoolId)
                 .getResultList();
    }

    @Transactional
    public Response createExample(CreateExampleDTO dto) throws IOException {
        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        User admin = em.find(User.class, userId);
        School school = em.find(School.class, dto.schoolId());

        Example example = new Example(admin, dto.type(), dto.instruction(), dto.question(), dto.difficulty(), dto.solution(), school);

        System.out.println(dto);

        switch (dto.type()){
            case HALF_OPEN -> {
                example.setAnswers(dto.answers());
            }
            case MULTIPLE_CHOICE -> {
                example.setOptions(dto.options());
            }
            case GAP_FILL -> {
                System.out.println(dto.gaps());
                System.out.println(dto.gaps().size());
                example.setGaps(dto.gaps());
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

        if(tokenService.validateTokenAndGetUserId(dto.authToken()) == null){
            return Response.status(500).build();
        }

        example.setInstruction(dto.instruction());
        example.setQuestion(dto.question());
        example.setDifficulty(dto.difficulty());
        example.setSolution(dto.solution());

        System.out.println(dto);

        switch (dto.type()){
            case HALF_OPEN -> {
                example.setAnswers(dto.answers());
            }
            case MULTIPLE_CHOICE -> {
                example.setOptions(dto.options());
            }
            case GAP_FILL -> {
                example.setGaps(dto.gaps());
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

        if(e.getAdmin().getId() != userId && e.getSchool().getAdmin().getId() != userId){
            return null;
        }

        System.out.println("found");
        System.out.println(e);

        return new CreateExampleDTO("",
                e.getSchool().getId(),
                e.getType(),
                e.getInstruction(),
                e.getQuestion(),
                e.getAnswers(),
                e.getOptions(),
                e.getGapFillType(),
                e.getGaps(),
                e.getAssigns(),
                e.getAssignRightItems(),
                e.getImageUrl(),
                e.getSolution(),
                e.getSolutionUrl(),
                e.getDifficulty());
    }
}
