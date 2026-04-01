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

@ApplicationScoped
public class MediaStorageService {

    @ConfigProperty(name = "media.bucket")
    String bucketName;

    public String uploadProfileImage(Long userId, Path file, String contentType) throws IOException {
        Storage storage = StorageOptions.getDefaultInstance().getService();

        ByteArrayOutputStream out = new ByteArrayOutputStream();

        Thumbnails.of(file.toFile())
                .size(512, 512)
                .outputFormat("jpg")
                .outputQuality(0.8)
                .toOutputStream(out);

        String objectName = "users/" + userId + "/avatar/current.jpg";

        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, objectName)
                .setContentType("image/jpeg")
                .setCacheControl("private, max-age=3600")
                .build();

        storage.create(blobInfo, out.toByteArray());

        return objectName;
    }

    public String uploadSchoolLogo(Long schoolId, Path file) throws IOException {
        Storage storage = StorageOptions.getDefaultInstance().getService();

        ByteArrayOutputStream out = new ByteArrayOutputStream();

        Thumbnails.of(file.toFile())
                .size(1200, 1200)
                .outputFormat("jpg")
                .outputQuality(0.82)
                .toOutputStream(out);

        String objectName = "schools/" + schoolId + "/logo/current.jpg";

        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, objectName)
                .setContentType("image/jpeg")
                .setCacheControl("private, max-age=3600")
                .build();

        storage.create(blobInfo, out.toByteArray());

        return objectName;
    }

    public StoredImage loadImage(String objectName) {
        Storage storage = StorageOptions.getDefaultInstance().getService();
        Blob blob = storage.get(bucketName, objectName);

        if (blob == null || !blob.exists()) {
            return null;
        }

        String contentType = blob.getContentType();
        byte[] data = blob.getContent();

        return new StoredImage(data, contentType != null ? contentType : "application/octet-stream");
    }

    public void delete(String objectName) {
        if (objectName == null || objectName.isBlank()) {
            return;
        }

        Storage storage = StorageOptions.getDefaultInstance().getService();
        storage.delete(bucketName, objectName);
    }

    public String uploadConstructionTaskImage(Long exampleId, Path file) throws IOException {
        return uploadExampleImage(exampleId, file, "task");
    }

    public String uploadConstructionSolutionImage(Long exampleId, Path file) throws IOException {
        return uploadExampleImage(exampleId, file, "solution");
    }

    private String uploadExampleImage(Long exampleId, Path file, String variant) throws IOException {
        Storage storage = StorageOptions.getDefaultInstance().getService();

        ByteArrayOutputStream out = new ByteArrayOutputStream();

        Thumbnails.of(file.toFile())
                .size(1600, 1600)
                .outputFormat("jpg")
                .outputQuality(0.82)
                .toOutputStream(out);

        String objectName = "examples/" + exampleId + "/construction/" + variant + "/current.jpg";

        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, objectName)
                .setContentType("image/jpeg")
                .setCacheControl("private, max-age=3600")
                .build();

        storage.create(blobInfo, out.toByteArray());

        return objectName;
    }

    public record StoredImage(byte[] data, String contentType) {}
}