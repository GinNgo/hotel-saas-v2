using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.Commands.Register;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.WebApi.Controllers;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace HotelSaas.WebApi.Tests.Controllers;

public sealed class AuthControllerTests
{
    private sealed class FakeMediator : IMediator
    {
        private readonly Func<object, CancellationToken, Task<object?>> _responder;

        public FakeMediator(Func<object, CancellationToken, Task<object?>> responder)
        {
            _responder = responder;
        }

        public async Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            var result = await _responder(request, cancellationToken);
            return (TResponse)result!;
        }

        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest =>
            Task.CompletedTask;

        public Task<object?> Send(object request, CancellationToken cancellationToken = default) =>
            _responder(request, cancellationToken);

        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Task Publish(object notification, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task Publish<TNotification>(TNotification notification, CancellationToken cancellationToken = default) where TNotification : INotification =>
            Task.CompletedTask;
    }

    [Fact]
    public async Task Register_ReturnsHttp201WithApiResponseAndLegacyRootFields()
    {
        // Arrange
        var expectedUserId = Guid.NewGuid();
        const string expectedMessage = "Đăng ký tài khoản thành công. Vui lòng kiểm tra email để xác thực.";
        var registerResponse = new RegisterResponse(expectedUserId, expectedMessage);
        var mediator = new FakeMediator((_, _) => Task.FromResult<object?>(registerResponse));
        var controller = new AuthController(mediator);
        var command = new RegisterCommand("guest@example.com", "StrongPass123!", "Nguyen Van A");

        // Act
        var actionResult = await controller.Register(command, CancellationToken.None);

        // Assert
        var objectResult = Assert.IsType<ObjectResult>(actionResult);
        Assert.Equal(StatusCodes.Status201Created, objectResult.StatusCode);

        var json = JsonSerializer.SerializeToElement(
            objectResult.Value,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.True(json.GetProperty("success").GetBoolean());
        Assert.Equal(expectedUserId, json.GetProperty("userId").GetGuid());
        Assert.Equal(expectedMessage, json.GetProperty("message").GetString());

        var data = json.GetProperty("data");
        Assert.Equal(expectedUserId, data.GetProperty("userId").GetGuid());
        Assert.Equal(expectedMessage, data.GetProperty("message").GetString());
    }
}
