package at.model;

import at.enums.TestCreationStates;
import jakarta.persistence.*;

import java.util.Set;

@Entity
public class Test {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private User admin;

    @Column(nullable = false)
    private String name;

    private int duration;

    private TestCreationStates state;

    @OneToMany(mappedBy = "test", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<TestExample> exampleList;

    @ManyToOne
    private School school;

    public Test(String name, Set<TestExample> exampleList, User admin, School school, int duration, TestCreationStates state) {
        this.name = name;
        this.exampleList = exampleList;
        this.school = school;
        this.admin = admin;
        this.duration = duration;
        this.state = state;
    }

    public TestCreationStates getState() {
        return state;
    }

    public void setState(TestCreationStates state) {
        this.state = state;
    }

    public int getDuration() {
        return duration;
    }

    public void setDuration(int duration) {
        this.duration = duration;
    }

    public User getAdmin() {
        return admin;
    }

    public void setAdmin(User admin) {
        this.admin = admin;
    }

    public School getSchool() {
        return school;
    }

    public void setSchool(School school) {
        this.school = school;
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

    public Set<TestExample> getExampleList() {
        return exampleList;
    }

    public void setExampleList(Set<TestExample> exampleList) {
        this.exampleList = exampleList;
    }
}
