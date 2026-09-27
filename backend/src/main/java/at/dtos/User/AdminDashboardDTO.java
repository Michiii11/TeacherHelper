package at.dtos.User;

import java.util.List;

public record AdminDashboardDTO(
        long amountUsers,
        long activeUsersMonth,
        long activeUsersWeek,
        long newUsersMonth,

        long freeAbos,
        long proAbos,
        long schoolAbos,

        long revenueTotalCents,
        long revenueMonthCents,
        long successfulPayments,
        long failedPayments,
        long schoolSeatsTotal,

        AdminCountPeriodDTO collections,
        AdminCountPeriodDTO examples,
        AdminCountPeriodDTO tests,
        List<AdminUserDashboardDTO> users
) {
}
