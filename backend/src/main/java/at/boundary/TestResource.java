package at.boundary;

import at.dtos.CreateExampleDTO;
import at.dtos.CreateTestDTO;
import at.dtos.ExampleOverviewDTO;
import at.dtos.TestOverviewDTO;
import at.repository.ExampleRepository;
import at.repository.TestRepository;
import jakarta.inject.Inject;
import jakarta.json.JsonObject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;

import java.io.IOException;
import java.util.List;

@Path("/test")
public class TestResource {
    @Inject
    TestRepository repo;

    @GET
    @Path("/school/{schoolId}")
    public List<TestOverviewDTO> getTests(@PathParam("schoolId") Long schoolId) {
        return repo.getAllTest(schoolId);
    }

    @POST
    @Path("{testId}")
    public CreateTestDTO getTest(@PathParam("testId") Long testId, JsonObject json){
        return repo.getTest(testId, json.getString("authToken"));
    }

    @POST
    public Response createTest(CreateTestDTO dto) throws IOException {
        return repo.createTest(dto);
    }

    @PUT
    @Path("{testId}")
    public Response updateTest(@PathParam("testId") Long testId, CreateTestDTO dto){
        return repo.updateTest(testId, dto);
    }

    @DELETE
    @Path("{testId}")
    public Response deleteTest(JsonObject json, @PathParam("testId") Long testId){
        return repo.deleteTest(json.getString("authToken"), testId);
    }
}
