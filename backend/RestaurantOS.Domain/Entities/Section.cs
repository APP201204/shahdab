namespace RestaurantOS.Domain.Entities;

public enum SectionType
{
    DineIn,
    Takeaway
}

public enum BrandingMode
{
    RestaurantDefault,
    OwnColours
}

public class Section
{
    public Guid Id { get; set; }
    public Guid RestaurantId { get; set; }
    public Restaurant Restaurant { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public SectionType Type { get; set; }
    public decimal ServiceChargePercent { get; set; }
    public BrandingMode BrandingMode { get; set; }
    public string? PrimaryColor { get; set; }
    public string? LogoOverrideUrl { get; set; }
    public int DisplayOrder { get; set; }
}
