using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantOS.Domain.Entities;

namespace RestaurantOS.Infrastructure.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);
        builder.HasIndex(u => u.Username).IsUnique();
        builder.Property(u => u.Username).HasMaxLength(50);
        builder.Property(u => u.DisplayName).HasMaxLength(100);
        builder.Property(u => u.Role).HasConversion<string>();
    }
}
