package at.dtos.Example;

import java.util.UUID;

public record ExampleVariableDTO(
        UUID id,
        String key,
        String defaultValue
) {
}
