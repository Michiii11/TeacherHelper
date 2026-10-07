package at.model;

import jakarta.persistence.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
public class TestExample {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(optional = false)
    private Test test;

    @ManyToOne(optional = false)
    private Example example;

    @Column(name = "points", nullable = false, columnDefinition = "double precision")
    private Double points = 0.0;

    private String title;

    @ElementCollection
    @CollectionTable(name = "test_example_variable_values", joinColumns = @JoinColumn(name = "test_example_id"))
    @MapKeyColumn(name = "variable_key")
    @Column(name = "variable_value", columnDefinition = "TEXT")
    private Map<String, String> variableValues = new HashMap<>();

    public TestExample() {
    }

    public TestExample(Test test, Example example, Double points, String title) {
        this.test = test;
        this.example = example;
        this.points = points != null ? points : 0.0;
        this.title = title;
    }

    @Override
    public String toString() {
        return "TestExample{" +
                "id=" + id +
                ", test=" + test +
                ", example=" + example +
                ", points=" + points +
                ", title='" + title + '\'' +
                ", variableValues=" + variableValues +
                '}';
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Test getTest() {
        return test;
    }

    public void setTest(Test test) {
        this.test = test;
    }

    public Example getExample() {
        return example;
    }

    public void setExample(Example example) {
        this.example = example;
    }

    public Double getPoints() {
        return points != null ? points : 0.0;
    }

    public void setPoints(Double points) {
        this.points = points != null ? points : 0.0;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public Map<String, String> getVariableValues() {
        return variableValues;
    }

    public void setVariableValues(Map<String, String> variableValues) {
        this.variableValues = variableValues != null ? new HashMap<>(variableValues) : new HashMap<>();
    }
}
