using System;
using HotelSaas.Application.Rooms.Commands.UpdateRoomStatus;
using HotelSaas.Domain.Enums;
using Xunit;

namespace HotelSaas.Application.Tests.Rooms;

public class UpdateRoomStatusCommandValidatorTests
{
    private readonly UpdateRoomStatusCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenExpectedOldStatusIsNull_FailsValidation()
    {
        var command = new UpdateRoomStatusCommand(Guid.NewGuid(), RoomStatus.Cleaning, null);

        var result = _validator.Validate(command);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(UpdateRoomStatusCommand.ExpectedOldStatus) &&
                                            e.ErrorMessage.Contains("bắt buộc"));
    }

    [Fact]
    public void Validate_WhenExpectedOldStatusIsInvalidEnum_FailsValidation()
    {
        var command = new UpdateRoomStatusCommand(Guid.NewGuid(), RoomStatus.Cleaning, (RoomStatus)999);

        var result = _validator.Validate(command);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(UpdateRoomStatusCommand.ExpectedOldStatus) &&
                                            e.ErrorMessage.Contains("không hợp lệ"));
    }

    [Fact]
    public void Validate_WhenStatusIsInvalidEnum_FailsValidation()
    {
        var command = new UpdateRoomStatusCommand(Guid.NewGuid(), (RoomStatus)999, RoomStatus.Dirty);

        var result = _validator.Validate(command);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(UpdateRoomStatusCommand.Status));
    }

    [Fact]
    public void Validate_WhenIdIsEmpty_FailsValidation()
    {
        var command = new UpdateRoomStatusCommand(Guid.Empty, RoomStatus.Cleaning, RoomStatus.Dirty);

        var result = _validator.Validate(command);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(UpdateRoomStatusCommand.Id));
    }

    [Fact]
    public void Validate_WhenAllFieldsValid_PassesValidation()
    {
        var command = new UpdateRoomStatusCommand(Guid.NewGuid(), RoomStatus.Cleaning, RoomStatus.Dirty);

        var result = _validator.Validate(command);

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }
}
