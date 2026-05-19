package at.repository;

import at.dtos.Example.CreateExampleDTO;
import at.dtos.Example.ExampleDTO;
import at.dtos.Example.ExampleOverviewDTO;
import at.dtos.Example.ExampleVariableDTO;
import at.dtos.Example.GapDTO;
import at.model.*;
import at.model.helper.ExampleVariable;
import at.model.helper.Gap;
import at.service.MediaStorageService;
import at.websocket.CollectionSocket;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.nio.file.Files;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
@Transactional
public class ExampleRepository {
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_PROFILE_IMAGE_SIZE = 2L * 1024L * 1024L;

    @Inject
    EntityManager em;

    @Inject
    FolderRepository folderRepository;

    @Inject
    MediaStorageService mediaStorageService;

    @Inject
    CollectionRepository collectionRepository;

    public Response getAllExamples(UUID collectionId, UUID userId) {
        if (!collectionRepository.isUserPartOfCollection(collectionId, userId)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        List<Example> examples = em.createQuery(
                """
                SELECT DISTINCT e
                FROM Example e
                LEFT JOIN FETCH e.focusList
                LEFT JOIN FETCH e.admin
                LEFT JOIN FETCH e.folder
                WHERE e.collection.id = :collectionId
                ORDER BY e.id
                """,
                Example.class
        ).setParameter("collectionId", collectionId).getResultList();

        return Response.ok(examples.stream().map(e ->
                new ExampleOverviewDTO(
                        e.getId(),
                        e.getType(),
                        e.getInstruction(),
                        e.getQuestion(),
                        e.getAdmin().getUsername(),
                        e.getAdmin().getId(),
                        new LinkedList<>(e.getFocusList()),
                        e.getFolder() != null ? e.getFolder().getId() : null,
                        e.getCreatedAt(),
                        e.getUpdatedAt()
                )
        ).collect(Collectors.toList())).build();
    }

    public Response getFullExamples(UUID collectionId, UUID userId) {
        if (!collectionRepository.isUserPartOfCollection(collectionId, userId)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        List<Example> examples = em.createQuery(
                        "SELECT DISTINCT e FROM Example e LEFT JOIN FETCH e.gaps WHERE e.collection.id = :collectionId ORDER BY e.id",
                        Example.class
                ).setParameter("collectionId", collectionId)
                .getResultList();

        List<ExampleDTO> dtos = examples.stream().map(example ->
                new ExampleDTO(
                        example.getId(),
                        example.getAdmin().toUserDTO(),
                        example.getFolder() != null ? example.getFolder().toDto() : null,
                        example.getType(),
                        example.getInstruction(),
                        example.getQuestion(),
                        example.getSolution(),
                        example.getSolutionUrl(),
                        example.getImageUrl(),
                        example.getImageWidth(),
                        example.getSolutionImageWidth(),
                        new LinkedList<>(example.getFocusList()),
                        mapVariables(example.getVariables()),
                        example.getCollection().toDTO(),
                        new LinkedList<>(example.getAnswers()),
                        new LinkedList<>(example.getOptions()),
                        example.getGapFillType(),
                        new LinkedList<>(example.getGapDTO()),
                        new LinkedList<>(example.getAssigns()),
                        new LinkedList<>(example.getAssignRightItems()),
                        example.getDisplaySettings()
                )
        ).collect(Collectors.toList());

        return Response.ok(dtos).build();
    }

    public Response getExample(UUID exampleId, UUID userId) {
        Example e = em.find(Example.class, exampleId);

        if (e == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        if (!collectionRepository.isUserPartOfCollection(e.getCollection().getId(), userId)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        CreateExampleDTO dto = new CreateExampleDTO(
                e.getCollection().getId(),
                e.getType(),
                e.getInstruction(),
                e.getQuestion(),
                new LinkedList<>(e.getAnswers()),
                new LinkedList<>(e.getOptions()),
                e.getGapFillType(),
                new LinkedList<>(e.getGapDTO()),
                new LinkedList<>(e.getAssigns()),
                new LinkedList<>(e.getAssignRightItems()),
                e.getImageUrl(),
                e.getSolution(),
                e.getSolutionUrl(),
                new LinkedList<>(e.getFocusList()),
                mapVariables(e.getVariables()),
                e.getImageWidth(),
                e.getSolutionImageWidth(),
                e.getFolder() != null ? e.getFolder().getId() : null,
                e.getDisplaySettings()
        );

        return Response.ok(dto).build();
    }

    public Response createExample(CreateExampleDTO dto, UUID userId) {
        if (!collectionRepository.isUserPartOfCollection(dto.collectionId(), userId)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        User admin = em.find(User.class, userId);
        Collection collection = em.find(Collection.class, dto.collectionId());

        if (collection == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Schule nicht gefunden.").build();
        }

        Folder folder = null;
        if (dto.folderId() != null) {
            folder = folderRepository.findById(dto.folderId());
            if (folder == null || !folder.getCollection().getId().equals(collection.getId())) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Ungültiger Ordner.").build();
            }
        }

        Example example = new Example(admin, dto.type(), dto.instruction(), dto.question(), dto.solution(), collection);
        example.setFolder(folder);
        example.getFocusList().clear();
        example.getFocusList().addAll(dto.focusList());
        example.setVariables(mapVariableEntities(dto.variables()));
        example.setDisplaySettings(dto.displaySettings());

        clearTypeSpecificFields(example);

        switch (dto.type()) {
            case HALF_OPEN -> example.setAnswers(dto.answers());
            case MULTIPLE_CHOICE -> example.setOptions(dto.options());
            case GAP_FILL -> {
                List<Gap> gaps = new LinkedList<>();
                for (GapDTO g : dto.gaps()) {
                    gaps.add(new Gap(g.label(), g.solution(), g.width(), g.options(), example));
                }
                example.setGaps(gaps);
                example.setGapFillType(dto.gapFillType());
            }
            case CONSTRUCTION -> {
                example.setImageUrl(dto.image());
                example.setSolutionUrl(dto.solutionUrl());
                example.setImageWidth(dto.imageWidth());
                example.setSolutionImageWidth(dto.solutionImageWidth());
            }
            case ASSIGN -> {
                example.setAssigns(dto.assigns());
                example.setAssignRightItems(dto.assignRightItems());
            }
            case OPEN -> {
            }
        }

        em.persist(example);
        em.flush();

        CollectionSocket.broadcast(dto.collectionId());

        return Response.ok(example.getId()).build();
    }

    public Response deleteExample(UUID userId, UUID exampleId) {
        Example example = em.find(Example.class, exampleId);
        if (example == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        if (!example.getAdmin().getId().equals(userId) && !example.getCollection().getAdmin().getId().equals(userId)) {
            return Response.status(403)
                    .entity("Not allowed to delete this Example.")
                    .build();
        }

        List<TestExample> testExamples = em.createQuery(
                "SELECT te FROM TestExample te WHERE te.example.id = :exampleId",
                TestExample.class
        ).setParameter("exampleId", exampleId).getResultList();

        testExamples.forEach(te -> {
            em.remove(te);
        });

        List<Test> tests = em.createQuery(
                "SELECT t FROM Test t JOIN t.exampleList e WHERE e.example.id = :exampleId",
                Test.class
        ).setParameter("exampleId", exampleId).getResultList();

        tests.forEach(t -> {
            t.getExampleList().removeIf(e -> e.getExample().getId().equals(exampleId));
            em.merge(t);
        });

        if (example.getImageUrl() != null) {
            mediaStorageService.delete(example.getImageUrl());
        }
        if (example.getSolutionUrl() != null) {
            mediaStorageService.delete(example.getSolutionUrl());
        }
        em.remove(example);

        CollectionSocket.broadcast(example.getCollection().getId());

        return Response.ok().build();
    }

    public Response updateExample(UUID exampleId, UUID userId, CreateExampleDTO dto) {
        Example example = em.find(Example.class, exampleId);
        if (example == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        if (!example.getAdmin().getId().equals(userId) && !example.getCollection().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Not allowed to update this Example.")
                    .build();
        }

        Folder folder = null;
        if (dto.folderId() != null) {
            folder = folderRepository.findById(dto.folderId());
            if (folder == null || !folder.getCollection().getId().equals(example.getCollection().getId())) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Folder is invalid.").build();
            }
        }

        example.setType(dto.type());
        example.setInstruction(dto.instruction());
        example.setQuestion(dto.question());
        example.setSolution(dto.solution());
        example.setFolder(folder);
        example.getFocusList().clear();
        example.getFocusList().addAll(dto.focusList());
        example.setVariables(mapVariableEntities(dto.variables()));
        example.setDisplaySettings(dto.displaySettings());

        clearTypeSpecificFields(example);

        switch (dto.type()) {
            case HALF_OPEN -> example.setAnswers(dto.answers());
            case MULTIPLE_CHOICE -> example.setOptions(dto.options());
            case GAP_FILL -> {
                List<Gap> gaps = new LinkedList<>();
                for (GapDTO g : dto.gaps()) {
                    gaps.add(new Gap(g.label(), g.solution(), g.width(), g.options(), example));
                }
                example.getGaps().clear();
                example.getGaps().addAll(gaps);
                example.setGapFillType(dto.gapFillType());
            }
            case CONSTRUCTION -> {
                example.setImageUrl(dto.image());
                example.setSolutionUrl(dto.solutionUrl());
                example.setImageWidth(dto.imageWidth());
                example.setSolutionImageWidth(dto.solutionImageWidth());
            }
            case ASSIGN -> {
                example.setAssigns(dto.assigns());
                example.setAssignRightItems(dto.assignRightItems());
            }
            case OPEN -> {
            }
        }

        em.merge(example);
        CollectionSocket.broadcast(example.getCollection().getId());
        return Response.ok(example.getId()).build();
    }

    public Response moveExampleToFolder(UUID exampleId, UUID userId, UUID folderId) {
        Example example = em.find(Example.class, exampleId);
        if (example == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Example not found.").build();
        }

        if (!example.getAdmin().getId().equals(userId) && !example.getCollection().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Not allowed to move this Example.")
                    .build();
        }

        Folder folder = null;
        if (folderId != null) {
            folder = folderRepository.findById(folderId);
            if (folder == null || !folder.getCollection().getId().equals(example.getCollection().getId())) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Folder is invalid.").build();
            }
        }

        example.setFolder(folder);
        em.merge(example);
        CollectionSocket.broadcast(example.getCollection().getId());
        return Response.ok().build();
    }

    public Response getExampleImage(UUID exampleId, UUID userId, boolean isSolution) {
        Example example = findById(exampleId);
        if (example == null || example.getImageUrl() == null || example.getImageUrl().isBlank()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        if (!collectionRepository.isUserPartOfCollection(example.getCollection().getId(), userId)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        MediaStorageService.StoredImage image = null;
        if(isSolution) {
            image = mediaStorageService.loadImage(example.getSolutionUrl());
        } else {
            image = mediaStorageService.loadImage(example.getImageUrl());
        }

        if (image == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        return Response.ok(image.data(), image.contentType()).build();
    }

    public Response uploadExampleImage(UUID exampleId, UUID userId, FileUpload file, boolean isSolution) {
        Example example = findById(exampleId);
        if (example == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Example not found.").build();
        }

        if (!example.getAdmin().getId().equals(userId) && !example.getCollection().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Not allowed to upload image for this Example.")
                    .build();
        }

        if (file == null || file.fileName() == null || file.fileName().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("No file uploaded.").build();
        }

        String contentType = file.contentType() == null ? "" : file.contentType().toLowerCase();
        if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Use JPG, PNG or WEBP.").build();
        }

        try {
            String objectKey = "";

            if (Files.size(file.uploadedFile()) > MAX_PROFILE_IMAGE_SIZE) {
                return Response.status(Response.Status.BAD_REQUEST).entity("File is too big. Max. 2 MB.").build();
            }

            if(isSolution) {
                if (example.getSolutionUrl() != null) {
                    mediaStorageService.delete(example.getSolutionUrl());
                }

                objectKey = mediaStorageService.uploadConstructionSolutionImage(exampleId, file.uploadedFile());
                example.setSolutionUrl(objectKey);
            } else{
                if (example.getImageUrl() != null) {
                    mediaStorageService.delete(example.getImageUrl());
                }

                objectKey = mediaStorageService.uploadConstructionTaskImage(exampleId, file.uploadedFile());
                example.setImageUrl(objectKey);
            }

            em.merge(example);
            CollectionSocket.broadcast(example.getCollection().getId());
            return Response.ok(objectKey).build();
        } catch (IOException e) {
            return Response.serverError().entity("Failed to upload image.").build();
        }
    }

    public Response deleteExampleImage(UUID exampleId, UUID userId, boolean isSolution) {
        Example example = findById(exampleId);
        if (example == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Example not found.").build();
        }

        if (!example.getAdmin().getId().equals(userId) && !example.getCollection().getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Not allowed to delete this Example.").build();
        }

        if(isSolution) {
            if (example.getSolutionUrl() != null) {
                mediaStorageService.delete(example.getSolutionUrl());
            }
            example.setSolutionUrl("");
        } else{
            if (example.getImageUrl() != null) {
                mediaStorageService.delete(example.getImageUrl());
            }
            example.setImageUrl("");
        }

        em.merge(example);
        CollectionSocket.broadcast(example.getCollection().getId());
        return Response.ok().build();
    }


    public Example findById(UUID exampleId) {
        return em.find(Example.class, exampleId);
    }

    private List<ExampleVariableDTO> mapVariables(List<ExampleVariable> variables) {
        List<ExampleVariableDTO> mapped = new LinkedList<>();
        if (variables == null) {
            return mapped;
        }

        for (ExampleVariable variable : variables) {
            mapped.add(new ExampleVariableDTO(
                    variable.getId(),
                    variable.getKey(),
                    variable.getDefaultValue()
            ));
        }

        return mapped;
    }

    private List<ExampleVariable> mapVariableEntities(List<ExampleVariableDTO> variables) {
        List<ExampleVariable> mapped = new LinkedList<>();
        if (variables == null) {
            return mapped;
        }

        for (ExampleVariableDTO variable : variables) {
            mapped.add(new ExampleVariable(
                    variable.id(),
                    variable.key(),
                    variable.defaultValue()
            ));
        }

        return mapped;
    }

    private void clearTypeSpecificFields(Example example) {
        example.setAnswers(new LinkedList<>());
        example.setOptions(new LinkedList<>());
        example.setGapFillType(null);
        example.getGaps().clear();
        example.setAssigns(new LinkedList<>());
        example.setAssignRightItems(new LinkedList<>());
        example.setImageWidth(null);
        example.setSolutionImageWidth(null);

        if (example.getType() != at.enums.ExampleTypes.CONSTRUCTION) {
            example.setImageUrl(null);
            example.setSolutionUrl(null);
        }
    }
}
