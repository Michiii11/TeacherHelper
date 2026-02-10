package at.model;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class TestExampleId implements Serializable {
    private Long testId;
    private Long exampleId;

    public TestExampleId() {}

    public TestExampleId(Long testId, Long exampleId) {
        this.testId = testId;
        this.exampleId = exampleId;
    }

    public Long getTestId() { return testId; }
    public Long getExampleId() { return exampleId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TestExampleId that)) return false;
        return Objects.equals(testId, that.testId) && Objects.equals(exampleId, that.exampleId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(testId, exampleId);
    }
}
