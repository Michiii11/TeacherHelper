package at.model;

import at.enums.RequestType;
import jakarta.persistence.*;

@Entity
public class JoinRequest {
    @Id
    @GeneratedValue
    private Long id;

    @ManyToOne
    private School school;

    @ManyToOne
    private User transmitter;

    @ManyToOne
    private User recipient;

    private String message;

    private boolean accepted = false;

    private boolean done = false;

    @Enumerated(EnumType.STRING)
    private RequestType type;

    public JoinRequest() {
    }

    public JoinRequest(School school, User transmitter, User recipient, String message, RequestType type) {
        this.school = school;
        this.transmitter = transmitter;
        this.recipient = recipient;
        this.message = message;
        this.type = type;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public School getSchool() {
        return school;
    }

    public void setSchool(School school) {
        this.school = school;
    }

    public User getTransmitter() {
        return transmitter;
    }

    public void setTransmitter(User transmitter) {
        this.transmitter = transmitter;
    }

    public User getRecipient() {
        return recipient;
    }

    public void setRecipient(User recipient) {
        this.recipient = recipient;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public boolean isAccepted() {
        return accepted;
    }

    public void setAccepted(boolean accepted) {
        this.accepted = accepted;
    }

    public boolean isDone() {
        return done;
    }

    public void setDone(boolean done) {
        this.done = done;
    }

    public RequestType getType() {
        return type;
    }

    public void setType(RequestType type) {
        this.type = type;
    }
}
