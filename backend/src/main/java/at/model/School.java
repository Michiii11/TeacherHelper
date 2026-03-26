package at.model;

import at.dtos.User.UserDTO;
import at.model.helper.Focus;
import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

@Entity
public class School {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id")
    private User admin;

    @ManyToMany
    @JoinTable(
            name = "school_members",
            joinColumns = @JoinColumn(name = "school_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private List<User> users = new ArrayList<>();

    @OneToMany
    private List<Focus> focusList;

    public School(){

    }

    public School(String name, User admin) {
        this.name = name;
        this.admin = admin;
    }

    public void addUser(User user) {
        if (user != null && !users.contains(user)) {
            users.add(user);
        }
    }

    public void removeUser(User user) {
        users.remove(user);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public User getAdmin() {
        return admin;
    }

    public UserDTO getAdminDTO() {
        if (admin == null) {
            return null;
        }
        return new UserDTO(admin.getId(), admin.getUsername(), admin.getEmail(), admin.getPassword());
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
}
