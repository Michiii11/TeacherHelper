package at.model;

import jakarta.persistence.*;

@Entity
@Table(name = "test_examples")
public class TestExample {

    @EmbeddedId
    private at.model.TestExampleId id = new at.model.TestExampleId();

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("testId")
    private Test test;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("exampleId")
    private Example example;

    @Column(nullable = false)
    private int points;

    private String title;

    public TestExample() {}

    public TestExample(Test test, Example example, int points, String title) {
        this.test = test;
        this.example = example;
        this.points = points;
        this.title = title;
        this.id = new at.model.TestExampleId(test.getId(), example.getId());
    }

    public Test getTest() { return test; }
    public Example getExample() { return example; }
    public int getPoints() { return points; }
    public void setPoints(int points) { this.points = points; }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
}
