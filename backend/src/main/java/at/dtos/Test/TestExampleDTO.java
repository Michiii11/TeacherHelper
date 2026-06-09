package at.dtos.Test;

import at.dtos.Example.ExampleDTO;

import java.util.Map;

public record TestExampleDTO(
        ExampleDTO example,
        Double points,
        String title,
        Map<String, String> variableValues
) {
    public TestExampleDTO {
        points = points != null ? points : 0.0;
    }
}
