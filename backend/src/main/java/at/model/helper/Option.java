// src/main/java/at/model/Option.java
package at.model.helper;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class Option {
    @Column(name = "text", length = 1000)
    private String text;

    @Column(name = "is_correct")
    private boolean isCorrect;

    public Option() {}

    public Option(String text, boolean isCorrect) {
        this.text = text;
        this.isCorrect = isCorrect;
    }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public boolean isCorrect() { return isCorrect; }
    public void setCorrect(boolean correct) { isCorrect = correct; }
}