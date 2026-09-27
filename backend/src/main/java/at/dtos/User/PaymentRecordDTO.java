package at.dtos.User;

import at.enums.PaymentStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record PaymentRecordDTO(
        UUID id,
        Long amountCents,
        String currency,
        PaymentStatus status,
        String invoiceUrl,
        String invoicePdfUrl,
        LocalDateTime paidAt,
        LocalDateTime createdAt
) {
}
