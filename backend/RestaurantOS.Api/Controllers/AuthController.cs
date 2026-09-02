using Microsoft.AspNetCore.Mvc;
using RestaurantOS.Application.DTOs;
using RestaurantOS.Application.Interfaces;

namespace RestaurantOS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginRequestDto request)
    {
        var response = await _authService.LoginAsync(request);

        if (response == null)
            return Unauthorized(new { error = "Invalid username or password" });

        return Ok(response);
    }
}
