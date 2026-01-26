package at.boundary;

import at.dtos.CreateExampleDTO;
import at.dtos.ExampleOverviewDTO;
import at.model.helper.Focus;
import at.repository.ExampleRepository;
import jakarta.inject.Inject;
import jakarta.json.JsonObject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;

import java.io.IOException;
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
    @Path("{exampleId}")
    public CreateExampleDTO getExample(@PathParam("exampleId") Long exampleId, JsonObject json){
        return repo.getExample(exampleId, json.getString("authToken"));
    }

    @POST
    public Response createExample(CreateExampleDTO dto) throws IOException {
        return repo.createExample(dto);
    }

    @PUT
    @Path("{exampleId}")
    public Response updateExample(@PathParam("exampleId") Long exampleId, CreateExampleDTO dto){
        return repo.updateExample(exampleId, dto);
    }

    @DELETE
    @Path("{exampleId}")
    public Response deleteExample(JsonObject json, @PathParam("exampleId") Long exampleId){
        return repo.deleteExample(json.getString("authToken"), exampleId);
    }
}
