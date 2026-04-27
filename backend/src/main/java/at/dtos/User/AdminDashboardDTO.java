package at.dtos.User;

import at.dtos.User.AdminCountPeriodDTO;
import at.dtos.User.AdminUserDashboardDTO;
import java.util.List;

public record AdminDashboardDTO(
        long amountUsers,
        long activeUsersMonth,
        long activeUsersWeek,
        long newUsersMonth,
        long freeAbos,
        long proAbos,
        long schoolAbos,
        long cashflow,
        AdminCountPeriodDTO collections,
        AdminCountPeriodDTO examples,
        AdminCountPeriodDTO tests,
        List<AdminUserDashboardDTO> users
) {
}