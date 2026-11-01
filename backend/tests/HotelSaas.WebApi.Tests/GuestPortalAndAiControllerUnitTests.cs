using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Models;
using HotelSaas.WebApi.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace HotelSaas.WebApi.Tests;

public sealed class GuestPortalAndAiControllerUnitTests
{
    private sealed class DummyServiceProvider : IServiceProvider
    {
        public object? GetService(Type serviceType) => null;
    }

    [Fact]
    public async Task GuestPortal_UpdateMe_NullRequest_ReturnsBadRequestWithoutNullReferenceException()
    {
        var controller = new GuestPortalController();
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                RequestServices = new DummyServiceProvider()
            }
        };

        var result = await controller.UpdateMe(null!, CancellationToken.None);

        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result.Result);
        var apiResponse = Assert.IsType<ApiResponse<object>>(badRequestResult.Value);
        Assert.False(apiResponse.Success);
        Assert.Equal("ERR_INVALID_BODY", apiResponse.ErrorCode);
    }

    [Fact]
    public async Task GuestPortal_UpdateMe_EmptyFullName_ReturnsBadRequest()
    {
        var controller = new GuestPortalController();
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                RequestServices = new DummyServiceProvider()
            }
        };

        var request = new GuestPortalController.UpdateGuestProfileRequest(string.Empty);
        var result = await controller.UpdateMe(request, CancellationToken.None);

        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result.Result);
        var apiResponse = Assert.IsType<ApiResponse<object>>(badRequestResult.Value);
        Assert.False(apiResponse.Success);
        Assert.Equal("ERR_FULLNAME_REQUIRED", apiResponse.ErrorCode);
    }
}
