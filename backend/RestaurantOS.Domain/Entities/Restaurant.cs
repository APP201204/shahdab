namespace RestaurantOS.Domain.Entities;

public class Restaurant
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Tagline { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
}
