-- The six-month membership is confirmed as 10% off six month-to-month dues.
-- The seeded R3050 did not match it. Derive the price from the stored
-- month-to-month row instead of hardcoding a second figure, so the two stay
-- consistent: at R550 a month this is 6 x 550 x 0.9 = R2970 (R495 a month).
--
-- Approved applications already awaiting payment keep the amount they were
-- quoted, because their charges were snapshotted at approval.
update public.membership_types six set
  price=round(monthly.price*6*0.9,2),
  monthly_fee=round(monthly.price*0.9,2)
from public.membership_types monthly
where six.code='six_month' and monthly.code='month_to_month';
