using System;
using HotelSaas.Application.Properties.DTOs;
using MediatR;

namespace HotelSaas.Application.Properties.Queries.GetPropertyPolicies;

/// <summary>
/// Query to retrieve operational policies for a specified property branch.
/// </summary>
public sealed record GetPropertyPoliciesQuery(Guid PropertyId) : IRequest<PropertyPoliciesDto>;
