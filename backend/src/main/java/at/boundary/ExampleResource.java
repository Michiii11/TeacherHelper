package at.boundary;

import at.dtos.Example.CreateExampleDTO;
import at.dtos.Example.ExampleDTO;
import at.dtos.Example.ExampleOverviewDTO;
import at.model.Example;
import at.repository.ExampleRepository;
import at.security.TokenService;
import at.service.MediaStorageService;
import jakarta.inject.Inject;
import jakarta.json.JsonObject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.nio.file.Files;
import java.util.List;
import java.util.Set;

@Path("/example")
public class ExampleResource {
    @Inject
    ExampleRepository repo;

    @Inject
    MediaStorageService mediaStorageService;

    @Inject
    TokenService tokenService;

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_EXAMPLE_IMAGE_SIZE = 5L * 1024L * 1024L;

    @GET
    @Path("/school/{schoolId}")
    public List<ExampleOverviewDTO> getExamples(@PathParam("schoolId") Long schoolId) {
        return repo.getAllExamples(schoolId);
    }

    @GET
    @Path("/school/{schoolId}/full")
    public List<ExampleDTO> getFullExamples(@PathParam("schoolId") Long schoolId) {
        return repo.getFullExamples(schoolId);
    }

    @POST
    @Path("{exampleId}")
    public CreateExampleDTO getExample(@PathParam("exampleId") Long exampleId, JsonObject json) {
        return repo.getExample(exampleId, json.getString("authToken"));
    }

    @POST
    @Produces(MediaType.TEXT_PLAIN)
    public Response createExample(CreateExampleDTO dto) {
        return repo.createExample(dto);
    }

    @PUT
    @Path("{exampleId}")
    @Produces(MediaType.TEXT_PLAIN)
    public Response updateExample(@PathParam("exampleId") Long exampleId, CreateExampleDTO dto) {
        return repo.updateExample(exampleId, dto);
    }

    @DELETE
    @Path("{exampleId}")
    public Response deleteExample(JsonObject json, @PathParam("exampleId") Long exampleId) {
        return repo.deleteExample(json.getString("authToken"), exampleId);
    }

    @POST
    @Path("{exampleId}/construction-image")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.TEXT_PLAIN)
    public Response uploadConstructionImage(@PathParam("exampleId") Long exampleId,
                                            @RestForm("file") FileUpload file,
                                            @RestForm("authToken") String authToken) {
        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        Example example = repo.findById(exampleId);
        if (example == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Beispiel nicht gefunden.").build();
        }

        if (!example.getAdmin().getId().equals(userId) && !example.getSchool().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Nicht berechtigt.").build();
        }

        if (file == null || file.fileName() == null || file.fileName().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Keine Datei hochgeladen.").build();
        }

        String contentType = file.contentType() == null ? "" : file.contentType().toLowerCase();
        if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Bitte nur JPG, PNG oder WEBP hochladen.").build();
        }

        try {
            if (Files.size(file.uploadedFile()) > MAX_EXAMPLE_IMAGE_SIZE) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Datei ist zu groß. Maximal 5 MB erlaubt.").build();
            }

            if (example.getImageUrl() != null && !example.getImageUrl().isBlank()) {
                mediaStorageService.delete(example.getImageUrl());
            }

            String objectKey = mediaStorageService.uploadConstructionTaskImage(exampleId, file.uploadedFile());
            String result = repo.updateConstructionTaskImage(exampleId, objectKey);

            if (result != null) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Bild konnte nicht gespeichert werden.").build();
            }

            return Response.ok(objectKey).build();
        } catch (IOException e) {
            return Response.serverError().entity("Datei konnte nicht gespeichert werden.").build();
        }
    }

    @DELETE
    @Path("{exampleId}/construction-image")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public Response deleteConstructionImage(@PathParam("exampleId") Long exampleId, JsonObject json) {
        String authToken = json.getString("authToken", "");
        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        Example example = repo.findById(exampleId);
        if (example == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Beispiel nicht gefunden.").build();
        }

        if (!example.getAdmin().getId().equals(userId) && !example.getSchool().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Nicht berechtigt.").build();
        }

        if (example.getImageUrl() != null && !example.getImageUrl().isBlank()) {
            mediaStorageService.delete(example.getImageUrl());
        }

        repo.updateConstructionTaskImage(exampleId, "");
        return Response.ok("DELETED").build();
    }

    @POST
    @Path("{exampleId}/construction-solution-image")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.TEXT_PLAIN)
    public Response uploadConstructionSolutionImage(@PathParam("exampleId") Long exampleId,
                                                    @RestForm("file") FileUpload file,
                                                    @RestForm("authToken") String authToken) {
        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        Example example = repo.findById(exampleId);
        if (example == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Beispiel nicht gefunden.").build();
        }

        if (!example.getAdmin().getId().equals(userId) && !example.getSchool().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Nicht berechtigt.").build();
        }

        if (file == null || file.fileName() == null || file.fileName().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Keine Datei hochgeladen.").build();
        }

        String contentType = file.contentType() == null ? "" : file.contentType().toLowerCase();
        if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Bitte nur JPG, PNG oder WEBP hochladen.").build();
        }

        try {
            if (Files.size(file.uploadedFile()) > MAX_EXAMPLE_IMAGE_SIZE) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Datei ist zu groß. Maximal 5 MB erlaubt.").build();
            }

            if (example.getSolutionUrl() != null && !example.getSolutionUrl().isBlank()) {
                mediaStorageService.delete(example.getSolutionUrl());
            }

            String objectKey = mediaStorageService.uploadConstructionSolutionImage(exampleId, file.uploadedFile());
            String result = repo.updateConstructionSolutionImage(exampleId, objectKey);

            if (result != null) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Lösungsbild konnte nicht gespeichert werden.").build();
            }

            return Response.ok(objectKey).build();
        } catch (IOException e) {
            return Response.serverError().entity("Datei konnte nicht gespeichert werden.").build();
        }
    }

    @DELETE
    @Path("{exampleId}/construction-solution-image")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public Response deleteConstructionSolutionImage(@PathParam("exampleId") Long exampleId, JsonObject json) {
        String authToken = json.getString("authToken", "");
        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Ungültiger Token").build();
        }

        Example example = repo.findById(exampleId);
        if (example == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Beispiel nicht gefunden.").build();
        }

        if (!example.getAdmin().getId().equals(userId) && !example.getSchool().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Nicht berechtigt.").build();
        }

        if (example.getSolutionUrl() != null && !example.getSolutionUrl().isBlank()) {
            mediaStorageService.delete(example.getSolutionUrl());
        }

        repo.updateConstructionSolutionImage(exampleId, "");
        return Response.ok("DELETED").build();
    }

    @GET
    @Path("{exampleId}/construction-image")
    public Response getConstructionImage(@PathParam("exampleId") Long exampleId) {
        Example example = repo.findById(exampleId);
        if (example == null || example.getImageUrl() == null || example.getImageUrl().isBlank()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        MediaStorageService.StoredImage image = mediaStorageService.loadImage(example.getImageUrl());
        if (image == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        return Response.ok(image.data(), image.contentType()).build();
    }

    @GET
    @Path("{exampleId}/construction-solution-image")
    public Response getConstructionSolutionImage(@PathParam("exampleId") Long exampleId) {
        Example example = repo.findById(exampleId);
        if (example == null || example.getSolutionUrl() == null || example.getSolutionUrl().isBlank()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        MediaStorageService.StoredImage image = mediaStorageService.loadImage(example.getSolutionUrl());
        if (image == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        return Response.ok(image.data(), image.contentType()).build();
    }
}