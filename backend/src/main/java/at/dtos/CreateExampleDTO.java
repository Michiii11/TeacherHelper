package at.dtos;

import at.enums.ExampleDifficulty;
import at.enums.ExampleTypes;
import at.enums.GapFillType;
import at.model.helper.Assign;
import at.model.helper.Gap;
import at.model.helper.Option;

import java.util.List;

public record CreateExampleDTO(String authToken, Long schoolId, ExampleTypes type, String instruction, String question, List<String[]> answers, List<Option> options, GapFillType gapFillType, List<GapDTO> gaps, List<Assign> assigns, List<String> assignRightItems, String image, String solution, String solutionUrl, ExampleDifficulty difficulty) {
}
