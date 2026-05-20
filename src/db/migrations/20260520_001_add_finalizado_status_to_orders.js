exports.up = function (knex) {
  return knex.raw(`
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE orders ADD CONSTRAINT orders_status_check
      CHECK (status IN ('Pending','Confirmed','In Production','Ready','Shipped','Delivered','Cancelled','Finalizado'));
  `)
}

exports.down = function (knex) {
  return knex.raw(`
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE orders ADD CONSTRAINT orders_status_check
      CHECK (status IN ('Pending','Confirmed','In Production','Ready','Shipped','Delivered','Cancelled'));
  `)
}
