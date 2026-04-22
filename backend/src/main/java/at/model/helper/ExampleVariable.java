package at.model.helper;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.util.UUID;

@Embeddable
public class ExampleVariable {
    @Column
    private UUID id;

    @Column(name = "variable_key", nullable = false, length = 120)
    private String key;

    @Column(name = "default_value", columnDefinition = "TEXT")
    private String defaultValue;

    public ExampleVariable() {
    }

    public ExampleVariable(UUID id, String key, String defaultValue) {
        this.id = id;
        this.key = key;
        this.defaultValue = defaultValue;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getDefaultValue() {
        return defaultValue;
    }

    public void setDefaultValue(String defaultValue) {
        this.defaultValue = defaultValue;
    }
}
