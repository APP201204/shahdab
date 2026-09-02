using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantOS.Domain.Entities;

namespace RestaurantOS.Infrastructure.Data.Configurations;

public class SectionConfiguration : IEntityTypeConfiguration<Section>
{
    public void Configure(EntityTypeBuilder<Section> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Name).HasMaxLength(100);
        builder.Property(s => s.Type).HasConversion<string>();
        builder.Property(s => s.BrandingMode).HasConversion<string>();
        builder.HasOne(s => s.Restaurant)
            .WithMany()
            .HasForeignKey(s => s.RestaurantId);
    }
}
