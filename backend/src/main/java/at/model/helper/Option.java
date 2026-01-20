// src/main/java/at/model/Option.java
package at.model.helper;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class Option {
    @Column(name = "text", length = 1000)
    private String text;

    private boolean correct;

    public Option() {}

    public Option(String text, boolean correct) {
        this.text = text;
        this.correct = correct;
    }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public boolean isCorrect() { return correct; }
    public void setCorrect(boolean correct) { this.correct = correct; }
}