package at.boundary;

import at.dtos.CreateExampleDTO;
import at.dtos.ExampleOverviewDTO;
import at.repository.ExampleRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.core.Response;

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

    @POST
    public Response createExample(CreateExampleDTO dto){
        return repo.createExample(dto);
    }
}
