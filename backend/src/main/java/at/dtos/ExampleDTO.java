package at.dtos;

import at.enums.ExampleDifficulty;
import at.enums.ExampleTypes;
import at.enums.GapFillType;
import at.model.helper.Assign;
import at.model.helper.Focus;
import at.model.helper.Gap;
import at.model.helper.Option;

import java.util.List;

public record ExampleDTO(Long id, UserDTO admin, ExampleTypes type, String instruction, String question, ExampleDifficulty difficulty, String solution, String solutionUrl, String imageUrl, List<Focus> focusList, SchoolDTO school, List<String[]> answers, List<Option> options, GapFillType gapFillType, List<Gap> gaps, List<Assign> assigns, List<String> assignRightItems) {
}
