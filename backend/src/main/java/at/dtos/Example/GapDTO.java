package at.dtos.Example;

import at.model.helper.Option;

import java.util.List;
import java.util.UUID;

public record GapDTO(UUID id, String label, String solution, Integer width, List<Option> options) {
}
