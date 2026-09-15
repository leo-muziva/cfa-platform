select p.item_code, oi.quantity, oi.unit_price, o.status
from order_items oi
join orders o on o.id = oi.order_id
join products p on p.id = oi.product_id;