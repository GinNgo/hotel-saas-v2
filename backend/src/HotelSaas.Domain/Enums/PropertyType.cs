namespace HotelSaas.Domain.Enums;

/// <summary>
/// Defines the type of hospitality property a tenant operates.
/// </summary>
public enum PropertyType
{
    /// <summary>
    /// A traditional hotel property.
    /// </summary>
    Hotel = 1,

    /// <summary>
    /// A resort property, typically with recreational amenities.
    /// </summary>
    Resort = 2,

    /// <summary>
    /// A hostel offering shared or budget accommodation.
    /// </summary>
    Hostel = 3,

    /// <summary>
    /// A bed and breakfast establishment.
    /// </summary>
    BedAndBreakfast = 4,

    /// <summary>
    /// A villa or vacation rental property.
    /// </summary>
    Villa = 5,

    /// <summary>
    /// A serviced apartment property.
    /// </summary>
    Apartment = 6,

    /// <summary>
    /// A motel, typically roadside accommodation.
    /// </summary>
    Motel = 7,

    /// <summary>
    /// A homestay or guest house.
    /// </summary>
    Homestay = 8
}
