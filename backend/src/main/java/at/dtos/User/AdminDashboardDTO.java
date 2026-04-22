package at.dtos.User;

import java.util.List;

public record AdminDashboardDTO(int amountUsers, int activeUsersMonth, int activeUsersWeek, int newUsersMonth, int freeAbos, int proAbos, int schoolAbos, double cashflow, List<Integer> collections, List<Integer> examples, List<Integer> tests, List<AdminUserDashboardDTO> users) {
}
