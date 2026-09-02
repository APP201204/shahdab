using Microsoft.EntityFrameworkCore;
using RestaurantOS.Domain.Entities;

namespace RestaurantOS.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        await context.Database.MigrateAsync();

        if (!context.Restaurants.Any())
        {
            var restaurant = new Restaurant
            {
                Id = Guid.NewGuid(),
                Name = "SHADAB",
                Tagline = "The Taste of Hyderabad"
            };
            context.Restaurants.Add(restaurant);

            context.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                Username = "shadab",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Shadab123"),
                DisplayName = "Shadab",
                Role = UserRole.Admin
            });

            context.Sections.AddRange(
                new Section { Id = Guid.NewGuid(), RestaurantId = restaurant.Id, Name = "Dine In", Type = SectionType.DineIn, ServiceChargePercent = 0, DisplayOrder = 1 },
                new Section { Id = Guid.NewGuid(), RestaurantId = restaurant.Id, Name = "Mezzanine", Type = SectionType.DineIn, ServiceChargePercent = 0, DisplayOrder = 2 },
                new Section { Id = Guid.NewGuid(), RestaurantId = restaurant.Id, Name = "Aiwan-e-Khas", Type = SectionType.DineIn, ServiceChargePercent = 10, BrandingMode = BrandingMode.OwnColours, DisplayOrder = 3 },
                new Section { Id = Guid.NewGuid(), RestaurantId = restaurant.Id, Name = "AC Takeaway", Type = SectionType.Takeaway, ServiceChargePercent = 0, DisplayOrder = 4 },
                new Section { Id = Guid.NewGuid(), RestaurantId = restaurant.Id, Name = "AK Takeaway", Type = SectionType.Takeaway, ServiceChargePercent = 0, DisplayOrder = 5 },
                new Section { Id = Guid.NewGuid(), RestaurantId = restaurant.Id, Name = "Cafe", Type = SectionType.Takeaway, ServiceChargePercent = 0, BrandingMode = BrandingMode.OwnColours, DisplayOrder = 6 }
            );

            await context.SaveChangesAsync();
        }
    }
}
