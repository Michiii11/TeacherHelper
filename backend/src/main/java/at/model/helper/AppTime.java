package at.model.helper;

import java.time.LocalDateTime;
import java.time.ZoneId;

public final class AppTime {
    public static final ZoneId APP_ZONE = ZoneId.of("Europe/Vienna");

    private AppTime() {
    }

    public static LocalDateTime now() {
        return LocalDateTime.now(APP_ZONE);
    }
}
