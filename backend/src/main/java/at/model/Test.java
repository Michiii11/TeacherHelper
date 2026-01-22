package at.model;

import at.enums.TestCreationStates;
import jakarta.persistence.*;

import java.util.List;
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

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "test_examples",
            joinColumns = @JoinColumn(name = "test_id"),
            inverseJoinColumns = @JoinColumn(name = "example_id")
    )
    private Set<Example> exampleList;

    @ManyToOne
    private School school;

    public Test(String name, Set<Example> exampleList, User admin, School school, int duration, TestCreationStates state) {
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

    public Set<Example> getExampleList() {
        return exampleList;
    }

    public void setExampleList(Set<Example> exampleList) {
        this.exampleList = exampleList;
    }
}
