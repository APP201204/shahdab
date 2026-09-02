using RestaurantOS.Application.DTOs;

namespace RestaurantOS.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponseDto?> LoginAsync(LoginRequestDto request);
}
