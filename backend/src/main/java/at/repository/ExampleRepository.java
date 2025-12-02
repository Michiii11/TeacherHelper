package at.repository;

import at.dtos.CreateExampleDTO;
import at.dtos.ExampleOverviewDTO;
import at.enums.ExampleDifficulty;
import at.enums.ExampleTypes;
import at.model.Example;
import at.model.School;
import at.model.User;
import at.security.TokenService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.util.List;

@ApplicationScoped
public class ExampleRepository {
    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

    public List<ExampleOverviewDTO> getAllExamples(Long schoolId) {
        return em.createQuery("SELECT new at.dtos.ExampleOverviewDTO(e.type, e.instruction, e.question, e.difficulty, e.admin.username) " +
                        "FROM Example e where e.school.id = :schoolId", ExampleOverviewDTO.class)
                .setParameter("schoolId", schoolId)
                 .getResultList();
    }

    @Transactional
    public Response createExample(CreateExampleDTO dto) {
        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        User admin = em.find(User.class, userId);
        School school = em.find(School.class, dto.schoolId());

        Example example = new Example(admin, dto.type(), dto.instruction(), dto.question(), dto.difficulty(), dto.answer(), school);

        switch (dto.type()){
            case HALF_OPEN -> {
                example.setAnswers(dto.answers());
                example.setHalfOpenCorrectAnswers(dto.halfOpenCorrectAnswers());
            }
            case MULTIPLE_CHOICE -> {
                example.setOptions(dto.options());
            }
            case GAP_FILL -> {
                example.setGaps(dto.gaps());
                example.setGapFillType(dto.gapFillType());
                example.setGapFillCorrectAnswers(dto.gapFillCorrectAnswers());
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
}
