using System.Linq.Expressions;
using HotelSaas.Domain.Entities;

namespace HotelSaas.Application.Guests;

/// <summary>One SQL-translatable identity rule shared by directory, history and updates.</summary>
public static class GuestIdentity
{
    public static readonly Expression<Func<Reservation, string>> Key = r =>
        r.GuestPhone != null && r.GuestPhone.Trim() != "" ? "phone:" + r.GuestPhone.Trim() :
        r.GuestEmail != null && r.GuestEmail.Trim() != "" ? "email:" + r.GuestEmail.Trim().ToLower() :
        r.GuestUserId.HasValue ? "user:" + r.GuestUserId.Value.ToString() + ":" + r.GuestName.Trim().ToLower() :
        "reservation:" + r.Id.ToString();

    public static IQueryable<Reservation> ForGuest(IQueryable<Reservation> query, string? guestKey, string? phoneNumber)
    {
        var key = !string.IsNullOrWhiteSpace(guestKey)
            ? guestKey.Trim()
            : !string.IsNullOrWhiteSpace(phoneNumber) ? "phone:" + phoneNumber.Trim() : null;
        if (key is null) return query.Where(_ => false);
        return query.Where(Expression.Lambda<Func<Reservation, bool>>(
            Expression.Equal(Key.Body, Expression.Constant(key)), Key.Parameters));
    }
}
