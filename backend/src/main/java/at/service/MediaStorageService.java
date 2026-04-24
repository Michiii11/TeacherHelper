package at.service;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import jakarta.enterprise.context.ApplicationScoped;
import net.coobird.thumbnailator.Thumbnails;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Path;
import java.util.UUID;

@ApplicationScoped
public class MediaStorageService {

    private static final String IMAGE_CONTENT_TYPE = "image/jpeg";
    private static final String DEFAULT_CONTENT_TYPE = "application/octet-stream";
    private static final String PRIVATE_CACHE_CONTROL = "private, max-age=3600";

    private static final int DEFAULT_IMAGE_SIZE = 512;
    private static final double DEFAULT_IMAGE_QUALITY = 0.8;
    private static final double EXAMPLE_IMAGE_QUALITY = 0.72;

    @ConfigProperty(name = "media.bucket")
    String bucketName;

    private final Storage storage = StorageOptions.getDefaultInstance().getService();

    public String uploadProfileImage(UUID userId, Path file, String contentType) throws IOException {
        String objectName = "users/%s/avatar/current.jpg".formatted(userId);
        return uploadResizedJpeg(file, objectName, DEFAULT_IMAGE_QUALITY);
    }

    public String uploadSchoolLogo(UUID schoolId, Path file) throws IOException {
        String objectName = "schools/%s/logo/current.jpg".formatted(schoolId);
        return uploadResizedJpeg(file, objectName, DEFAULT_IMAGE_QUALITY);
    }

    public String uploadConstructionTaskImage(UUID exampleId, Path file) throws IOException {
        return uploadExampleImage(exampleId, file, ExampleImageVariant.TASK);
    }

    public String uploadConstructionSolutionImage(UUID exampleId, Path file) throws IOException {
        return uploadExampleImage(exampleId, file, ExampleImageVariant.SOLUTION);
    }

    private String uploadExampleImage(UUID exampleId, Path file, ExampleImageVariant variant) throws IOException {
        String objectName = "examples/%s/construction/%s/current.jpg"
                .formatted(exampleId, variant.path);

        return uploadResizedJpeg(file, objectName, EXAMPLE_IMAGE_QUALITY);
    }

    private String uploadResizedJpeg(Path file, String objectName, double quality) throws IOException {
        byte[] imageData = resizeToJpeg(file, quality);

        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, objectName)
                .setContentType(IMAGE_CONTENT_TYPE)
                .setCacheControl(PRIVATE_CACHE_CONTROL)
                .build();

        storage.create(blobInfo, imageData);

        return objectName;
    }

    private byte[] resizeToJpeg(Path file, double quality) throws IOException {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Thumbnails.of(file.toFile())
                    .size(DEFAULT_IMAGE_SIZE, DEFAULT_IMAGE_SIZE)
                    .outputFormat("jpg")
                    .outputQuality(quality)
                    .toOutputStream(out);

            return out.toByteArray();
        }
    }

    public StoredImage loadImage(String objectName) {
        if (objectName == null || objectName.isBlank()) {
            return null;
        }

        Blob blob = storage.get(bucketName, objectName);

        if (blob == null || !blob.exists()) {
            return null;
        }

        String contentType = blob.getContentType();
        byte[] data = blob.getContent();

        return new StoredImage(
                data,
                contentType != null ? contentType : DEFAULT_CONTENT_TYPE
        );
    }

    public void delete(String objectName) {
        if (objectName == null || objectName.isBlank()) {
            return;
        }

        storage.delete(bucketName, objectName);
    }

    private enum ExampleImageVariant {
        TASK("task"),
        SOLUTION("solution");

        private final String path;

        ExampleImageVariant(String path) {
            this.path = path;
        }
    }

    public record StoredImage(byte[] data, String contentType) {
    }
}