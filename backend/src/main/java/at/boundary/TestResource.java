package at.boundary;

import at.dtos.Folder.MoveTestToFolderDTO;
import at.dtos.Test.CreateTestDTO;
import at.dtos.Test.TestOverviewDTO;
import at.repository.TestRepository;
import jakarta.inject.Inject;
import jakarta.json.JsonObject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

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
    public CreateTestDTO getTest(@PathParam("testId") UUID testId, JsonObject json){
        return repo.getTest(testId, json.getString("authToken"));
    }

    @POST
    public Response createTest(CreateTestDTO dto) throws IOException {
        return repo.createTest(dto);
    }

    @PUT
    @Path("{testId}")
    public Response updateTest(@PathParam("testId") UUID testId, CreateTestDTO dto){
        return repo.updateTest(testId, dto);
    }

    @DELETE
    @Path("{testId}")
    public Response deleteTest(JsonObject json, @PathParam("testId") UUID testId){
        return repo.deleteTest(json.getString("authToken"), testId);
    }

    @PUT
    @Path("{testId}/folder")
    public Response moveTestToFolder(@PathParam("testId") UUID testId, MoveTestToFolderDTO dto) {
        return repo.moveTestToFolder(testId, dto);
    }
}
