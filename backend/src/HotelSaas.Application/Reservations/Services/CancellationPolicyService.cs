using System;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Reservations.Services;

/// <summary>
/// Authoritative calculation engine for cancellation fees, refund amounts, and policy enforcement (Task T04).
/// Pure calculation logic without side effects or mutations.
/// </summary>
public sealed class CancellationPolicyService : ICancellationPolicyService
{
    public CancellationEstimateResult CalculateEstimate(
        Reservation reservation,
        Property? property,
        DateTime asOfUtc,
        decimal paidAmount,
        bool hasPendingPayments = false,
        decimal pendingPaymentAmount = 0m)
    {
        ArgumentNullException.ThrowIfNull(reservation);

        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        var rentalType = snapshot?.RentalType ?? (reservation.CheckInDate != reservation.CheckOutDate ? RentalType.Overnight : RentalType.Daily);

        DateTime startAtUtc;
        DateTime endAtUtc;

        if (property != null)
        {
            (startAtUtc, endAtUtc) = ReservationTimeHelper.GetEffectiveStayUtcInterval(reservation, property);
        }
        else if (snapshot != null)
        {
            startAtUtc = snapshot.StartAtUtc;
            endAtUtc = snapshot.EndAtUtc;
        }
        else
        {
            var tz = ReservationTimeHelper.GetVietnamTimeZone();
            var startLocal = reservation.CheckInDate.ToDateTime(new TimeOnly(14, 0));
            var endLocal = reservation.CheckOutDate.ToDateTime(new TimeOnly(12, 0));
            startAtUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, tz);
            endAtUtc = TimeZoneInfo.ConvertTimeToUtc(endLocal, tz);
        }

        int thresholdHours = rentalType == RentalType.Hourly ? 2 : 24;
        var hoursRemaining = (startAtUtc - asOfUtc).TotalHours;
        var hoursUntilCheckIn = (int)Math.Floor(hoursRemaining);

        bool isBeforeCheckIn = asOfUtc < startAtUtc;
        bool isPendingPayment = reservation.Status == ReservationStatus.PendingPayment;
        bool isUnpaid = paidAmount <= 0m;
        bool isHold = isPendingPayment;

        bool isFreeCancellation;
        decimal cancellationFee = 0m;
        decimal refundableAmount = 0m;
        string policyDescription;

        if (isPendingPayment && isUnpaid)
        {
            // PendingPayment with no successful payment: Cancel hold with 0 fee, 0 debt, 0 refund
            isFreeCancellation = true;
            cancellationFee = 0m;
            refundableAmount = 0m;
            policyDescription = hasPendingPayments
                ? "Đơn giữ phòng đang có giao dịch thanh toán đang được xử lý (IPN). Bạn có thể hủy giữ phòng, bộ phận kế toán sẽ đối soát an toàn trước khi xử lý giao dịch."
                : "Đơn của bạn chưa được xác nhận và chưa phát sinh thanh toán. Bạn có thể hủy lượt giữ phòng này.";
        }
        else if (isUnpaid)
        {
            // Confirmed but PaidAmount == 0 (e.g. pay-at-hotel): No penalty debt deducted from 0
            isFreeCancellation = true;
            cancellationFee = 0m;
            refundableAmount = 0m;
            policyDescription = "Đơn đặt phòng chưa phát sinh thanh toán trực tuyến. Bạn có thể hủy đặt phòng mà không phát sinh phí phạt cấn trừ.";
        }
        else
        {
            // PaidAmount > 0: Apply authoritative cancellation policy
            isFreeCancellation = isBeforeCheckIn && hoursRemaining >= thresholdHours;

            if (isFreeCancellation)
            {
                cancellationFee = 0m;
                refundableAmount = paidAmount;
            }
            else if (isBeforeCheckIn)
            {
                // Late cancellation fee: 30% of total booking amount (Decision D15 / P0), capped at paidAmount
                var calculatedFee = Math.Round(reservation.TotalAmount * 0.30m, 0, MidpointRounding.AwayFromZero);
                cancellationFee = Math.Min(calculatedFee, paidAmount);
                refundableAmount = Math.Max(0m, paidAmount - cancellationFee);
            }
            else
            {
                // Past check-in time without checking in (No-show): 100% cancellation fee, capped at paidAmount
                cancellationFee = Math.Min(reservation.TotalAmount, paidAmount);
                refundableAmount = 0m;
            }

            policyDescription = rentalType == RentalType.Hourly
                ? "Miễn phí hủy phòng trước giờ nhận phòng ít nhất 2 giờ. Hủy phòng trong vòng 2 giờ trước giờ nhận phòng áp dụng phí phạt 30% tổng giá trị đơn đặt phòng."
                : "Miễn phí hủy phòng trước ngày nhận phòng ít nhất 24 giờ. Hủy phòng trong vòng 24 giờ trước giờ nhận phòng áp dụng phí phạt 30% tổng giá trị đơn đặt phòng.";

            if (hasPendingPayments)
            {
                policyDescription += " Lưu ý: Đang có giao dịch thanh toán đang được xử lý (IPN). Quá trình đối soát và hoàn tiền sẽ được thực hiện an toàn.";
            }
        }

        int pointsRedeemed = reservation.PointsRedeemed;
        int pointsRefundable = Math.Max(0, reservation.PointsRedeemed - reservation.PointsRefunded);

        bool canCancel = true;
        string? ineligibilityReason = null;

        if (reservation.Status == ReservationStatus.Cancelled)
        {
            canCancel = false;
            ineligibilityReason = "Đơn đặt phòng này đã bị hủy trước đó.";
        }
        else if (reservation.Status == ReservationStatus.CheckedIn)
        {
            canCancel = false;
            ineligibilityReason = "Khách đang lưu trú tại khách sạn (CheckedIn). Vui lòng liên hệ trực tiếp quầy lễ tân để làm thủ tục trả phòng.";
        }
        else if (reservation.Status == ReservationStatus.CheckedOut)
        {
            canCancel = false;
            ineligibilityReason = "Đơn đặt phòng đã hoàn tất thời gian lưu trú và trả phòng (CheckedOut).";
        }
        else if (reservation.Status == ReservationStatus.NoShow)
        {
            canCancel = false;
            ineligibilityReason = "Đơn đặt phòng đã được ghi nhận Vắng mặt (NoShow).";
        }
        else if (reservation.Status == ReservationStatus.PendingPayment &&
                 snapshot?.IsOnlineHold == true &&
                 snapshot.HoldExpiresAtUtc.HasValue &&
                 snapshot.HoldExpiresAtUtc.Value <= asOfUtc)
        {
            canCancel = false;
            ineligibilityReason = "Thời gian giữ phòng đã hết hạn. Lượt giữ phòng đã tự động được giải phóng.";
        }

        var depositRequired = snapshot?.DepositRequired ?? Math.Round(reservation.TotalAmount * 0.30m, 0, MidpointRounding.AwayFromZero);

        return new CancellationEstimateResult
        {
            ReservationId = reservation.Id,
            ConfirmationCode = reservation.ConfirmationCode,
            Status = reservation.Status.ToString(),
            RentalType = rentalType,
            StartAtUtc = startAtUtc,
            EndAtUtc = endAtUtc,
            CheckInDate = reservation.CheckInDate,
            CheckOutDate = reservation.CheckOutDate,
            HoursUntilCheckIn = hoursUntilCheckIn,
            FreeCancellationThresholdHours = thresholdHours,
            IsBeforeCheckIn = isBeforeCheckIn,
            IsFreeCancellation = isFreeCancellation,
            TotalAmount = reservation.TotalAmount,
            PaidAmount = paidAmount,
            DepositRequired = depositRequired,
            CancellationFee = cancellationFee,
            RefundableAmount = refundableAmount,
            PointsRedeemed = pointsRedeemed,
            PointsRefundable = pointsRefundable,
            PolicyDescription = policyDescription,
            CanCancel = canCancel,
            IneligibilityReason = ineligibilityReason,
            IsHold = isHold,
            HasPendingPayment = hasPendingPayments,
            PendingPaymentAmount = pendingPaymentAmount
        };
    }
}
