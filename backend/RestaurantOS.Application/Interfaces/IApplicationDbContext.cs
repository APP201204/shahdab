using Microsoft.EntityFrameworkCore;
using RestaurantOS.Domain.Entities;

namespace RestaurantOS.Application.Interfaces;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; set; }
    DbSet<Restaurant> Restaurants { get; set; }
    DbSet<Section> Sections { get; set; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
