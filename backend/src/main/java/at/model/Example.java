package at.model;

import at.enums.ExampleDifficulty;
import at.enums.ExampleTypes;
import jakarta.persistence.*;

@Entity
public class Example {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private User admin;

    private ExampleTypes type;

    private String question;
    private ExampleDifficulty difficulty;

    private String answer;

    public Example(){

    }

    public Example(User admin, ExampleTypes type, String question, ExampleDifficulty difficulty, String answer) {
        this.admin = admin;
        this.type = type;
        this.question = question;
        this.difficulty = difficulty;
        this.answer = answer;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getAdmin() {
        return admin;
    }

    public void setAdmin(User admin) {
        this.admin = admin;
    }

    public ExampleTypes getType() {
        return type;
    }

    public void setType(ExampleTypes type) {
        this.type = type;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public ExampleDifficulty getDifficulty() {
        return difficulty;
    }

    public void setDifficulty(ExampleDifficulty difficulty) {
        this.difficulty = difficulty;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }
}
