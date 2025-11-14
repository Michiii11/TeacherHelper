// src/main/java/at/model/Assign.java
package at.model.helper;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class Assign {
    @Column(name = "left_item")
    private String left;

    @Column(name = "right_item")
    private String right;

    public Assign() {}

    public Assign(String left, String right) {
        this.left = left;
        this.right = right;
    }

    public String getLeft() { return left; }
    public void setLeft(String left) { this.left = left; }

    public String getRight() { return right; }
    public void setRight(String right) { this.right = right; }
}