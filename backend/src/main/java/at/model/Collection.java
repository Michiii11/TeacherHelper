package at.model;

import at.dtos.Collection.CollectionDTO;
import at.dtos.Example.ExampleOverviewDTO;
import at.dtos.Folder.FolderDTO;
import at.dtos.Test.TestOverviewDTO;
import at.dtos.User.UserDTO;
import at.model.helper.AppTime;
import at.model.helper.Focus;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
public class Collection {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(length = 1000)
    private String logoUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id")
    private User admin;

    @ManyToMany
    @JoinTable(
            name = "collection_members",
            joinColumns = @JoinColumn(name = "collection_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private List<User> users = new ArrayList<>();

    @OneToMany
    private List<Focus> focusList;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Collection() {
        createdAt = AppTime.now();
        updatedAt = AppTime.now();
    }

    public Collection(String name, User admin) {
        this.name = name;
        this.admin = admin;
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

    public void addUser(User user) {
        if (user != null && !users.contains(user)) {
            users.add(user);
        }
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void removeUser(User user) {
        users.remove(user);
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

    public String getLogoUrl() {
        return logoUrl;
    }

    public void setLogoUrl(String logoUrl) {
        this.logoUrl = logoUrl;
    }

    public User getAdmin() {
        return admin;
    }

    public UserDTO getAdminDTO() {
        if (admin == null) {
            return null;
        }
        return admin.toUserDTO();
    }

    public void setAdmin(User admin) {
        this.admin = admin;
    }

    public List<User> getUsers() {
        return users;
    }

    public void setUsers(List<User> users) {
        this.users = users;
    }

    public List<Focus> getFocusList() {
        return focusList;
    }

    public void setFocusList(List<Focus> focusList) {
        this.focusList = focusList;
    }

    public CollectionDTO toDTO() {
        return new CollectionDTO(
                this.getId(),
                this.getName(),
                this.getLogoUrl(),
                this.getAdminDTO(),
                null, null, null, null,
                this.getUsers().stream().map(User::toUserDTO).toList()
        );
    }

    public CollectionDTO toDTOFull(
            List<ExampleOverviewDTO> examples,
            List<TestOverviewDTO> tests,
            List<FolderDTO> folders
    ) {
        return new CollectionDTO(
                this.getId(),
                this.getName(),
                this.getLogoUrl(),
                this.getAdminDTO(),
                examples,
                tests,
                folders,
                this.getFocusList() != null
                        ? new java.util.LinkedList<>(this.getFocusList())
                        : List.of(),
                this.getUsers().stream()
                        .map(User::toUserDTO)
                        .toList()
        );
    }
}