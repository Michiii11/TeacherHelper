package at.boundary;

import at.dtos.ExampleOverviewDTO;
import at.repository.ExampleRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;

import java.util.List;

@Path("/example")
public class ExampleResource {
    @Inject
    ExampleRepository repo;

    @GET
    @Path("/school/{schoolId}")
    public List<ExampleOverviewDTO> getExamples(@PathParam("schoolId") Long schoolId) {
        return repo.getAllExamples(schoolId);
    }
}
