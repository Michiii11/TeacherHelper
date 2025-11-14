package at.repository;

import at.dtos.ExampleOverviewDTO;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;

import java.util.List;

@ApplicationScoped
public class ExampleRepository {
    @Inject
    EntityManager em;

    public List<ExampleOverviewDTO> getAllExamples(Long schoolId) {
        return em.createQuery("SELECT new at.dtos.ExampleOverviewDTO(e.type, e.instruction, e.question, e.difficulty, e.admin.username) " +
                        "FROM Example e where e.school.id = :schoolId", ExampleOverviewDTO.class)
                .setParameter("schoolId", schoolId)
                 .getResultList();
    }
}
