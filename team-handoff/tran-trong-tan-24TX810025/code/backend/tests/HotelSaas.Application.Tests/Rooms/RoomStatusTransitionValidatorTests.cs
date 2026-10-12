using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Rooms.Services;
using HotelSaas.Domain.Enums;
using Xunit;

namespace HotelSaas.Application.Tests.Rooms;

public class RoomStatusTransitionValidatorTests
{
    [Theory]
    // Clean can transition to Dirty, Cleaning, OutOfService
    [InlineData(RoomStatus.Clean, RoomStatus.Dirty)]
    [InlineData(RoomStatus.Clean, RoomStatus.Cleaning)]
    [InlineData(RoomStatus.Clean, RoomStatus.OutOfService)]
    [InlineData(RoomStatus.Clean, RoomStatus.Clean)] // Same status is idempotent
    // Dirty can transition to Cleaning, OutOfService
    [InlineData(RoomStatus.Dirty, RoomStatus.Cleaning)]
    [InlineData(RoomStatus.Dirty, RoomStatus.OutOfService)]
    [InlineData(RoomStatus.Dirty, RoomStatus.Dirty)]
    // Cleaning can transition to Clean, Dirty, OutOfService
    [InlineData(RoomStatus.Cleaning, RoomStatus.Clean)]
    [InlineData(RoomStatus.Cleaning, RoomStatus.Dirty)]
    [InlineData(RoomStatus.Cleaning, RoomStatus.OutOfService)]
    [InlineData(RoomStatus.Cleaning, RoomStatus.Cleaning)]
    // OutOfService can only transition to Dirty
    [InlineData(RoomStatus.OutOfService, RoomStatus.Dirty)]
    [InlineData(RoomStatus.OutOfService, RoomStatus.OutOfService)]
    public void IsValidTransition_AllowedTransitions_ReturnsTrue(RoomStatus from, RoomStatus to)
    {
        var isValid = RoomStatusTransitionValidator.IsValidTransition(from, to);
        Assert.True(isValid);

        // Validate should not throw
        var exception = Record.Exception(() => RoomStatusTransitionValidator.Validate(from, to));
        Assert.Null(exception);
    }

    [Theory]
    // Direct operational transitions to/from Occupied are forbidden (P3 reservation lifecycle only)
    [InlineData(RoomStatus.Clean, RoomStatus.Occupied)]
    [InlineData(RoomStatus.Dirty, RoomStatus.Occupied)]
    [InlineData(RoomStatus.Cleaning, RoomStatus.Occupied)]
    [InlineData(RoomStatus.OutOfService, RoomStatus.Occupied)]
    [InlineData(RoomStatus.Occupied, RoomStatus.Clean)]
    [InlineData(RoomStatus.Occupied, RoomStatus.Dirty)]
    [InlineData(RoomStatus.Occupied, RoomStatus.Cleaning)]
    [InlineData(RoomStatus.Occupied, RoomStatus.OutOfService)]
    // Dirty cannot jump directly to Clean without Cleaning
    [InlineData(RoomStatus.Dirty, RoomStatus.Clean)]
    // OutOfService cannot jump directly to Clean or Cleaning without first going to Dirty
    [InlineData(RoomStatus.OutOfService, RoomStatus.Clean)]
    [InlineData(RoomStatus.OutOfService, RoomStatus.Cleaning)]
    public void IsValidTransition_ForbiddenTransitions_ReturnsFalseAndThrowsBadRequest(RoomStatus from, RoomStatus to)
    {
        var isValid = RoomStatusTransitionValidator.IsValidTransition(from, to);
        Assert.False(isValid);

        var ex = Assert.Throws<BadRequestException>(() => RoomStatusTransitionValidator.Validate(from, to));
        Assert.Equal("ERR_INVALID_STATUS_TRANSITION", ex.ErrorCode);
    }
}
