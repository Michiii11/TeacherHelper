package at.model;

import at.dtos.Folder.FolderDTO;
import at.model.helper.AppTime;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "folder")
public class Folder {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, length = 180)
    private String name;

    @ManyToOne(optional = false)
    private Collection collection;

    @ManyToOne
    @JoinColumn(name = "parent_id")
    private Folder parent;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Folder() {
    }

    public Folder(String name, Collection collection, Folder parent) {
        this.name = name;
        this.collection = collection;
        this.parent = parent;
    }

    @PrePersist
    public void prePersist() {
        LocalDateTime now = AppTime.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = AppTime.now();
    }

    public FolderDTO toDto() {
        return new FolderDTO(
                this.getId(),
                this.getName(),
                this.getCollection().getId(),
                this.getParent() != null ? this.getParent().getId() : null,
                this.getCreatedAt(),
                this.getUpdatedAt()
        );
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Collection getCollection() {
        return collection;
    }

    public void setCollection(Collection collection) {
        this.collection = collection;
    }

    public Folder getParent() {
        return parent;
    }

    public void setParent(Folder parent) {
        this.parent = parent;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
