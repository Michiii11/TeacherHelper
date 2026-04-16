package at.dtos.Test;

import at.dtos.Example.ExampleDTO;

import java.util.Map;

public record TestExampleDTO(
        ExampleDTO example,
        int points,
        String title,
        Map<String, String> variableValues
) {
}
