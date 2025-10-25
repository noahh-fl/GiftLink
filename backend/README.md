# GiftLink Backend

## Wishlist & Gift Lifecycle API

### Create a wishlist item
`POST /wishlist`

Creates a wishlist item for a space. When a `url` is provided the backend attempts to ingest Open Graph metadata but manual fields always win. Returns the created item with its associated gift record.

### List wishlist items
`GET /wishlist?spaceId=<id>`

Supports optional filters: `category`, `priority`, `archived` (default `false`), `priceMin`, and `priceMax` (all in cents).

### Update a wishlist item
`PATCH /wishlist/:id`

Allows updating `notes`, `priority`, and `archived` status.

### Gift lifecycle

* `POST /gift/:id/reserve` – reserve a gift for a giver.
* `POST /gift/:id/purchase` – lock the price-indexed point value.
* `POST /gift/:id/deliver` – mark the gift as delivered.
* `POST /gift/:id/receive` – complete the lifecycle and receive the calculated points in the response.

### Gift listings
`GET /space/:id/gifts`

Returns gifts for a space with lightweight wishlist item context.
