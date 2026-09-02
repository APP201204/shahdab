namespace RestaurantOS.Domain.Entities;

public enum UserRole
{
    Admin,
    Manager,
    Cashier,
    Waiter,
    Kitchen
}

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
}
