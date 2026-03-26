package at.dtos.Example;

import at.model.helper.Option;

import java.util.List;

public record GapDTO(Long id, String label, String solution, List<Option> options) {
}
