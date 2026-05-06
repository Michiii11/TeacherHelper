package at.model.helper;

import jakarta.persistence.Embeddable;

@Embeddable
public class ExampleDisplaySettings {
    private Boolean showInstructionLabel = true;
    private Boolean showQuestionLabel = true;
    private Boolean showTaskImageLabel = true;

    public Boolean getShowInstructionLabel() { return showInstructionLabel; }
    public void setShowInstructionLabel(Boolean showInstructionLabel) { this.showInstructionLabel = showInstructionLabel; }

    public Boolean getShowQuestionLabel() { return showQuestionLabel; }
    public void setShowQuestionLabel(Boolean showQuestionLabel) { this.showQuestionLabel = showQuestionLabel; }

    public Boolean getShowTaskImageLabel() { return showTaskImageLabel; }
    public void setShowTaskImageLabel(Boolean showTaskImageLabel) { this.showTaskImageLabel = showTaskImageLabel; }
}