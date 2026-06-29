# Fable Server — Express.js Backend

Backend REST API for the Fable ebook sharing platform.

## Live URL

[https://fable-server-pearl.vercel.app](https://fable-server-pearl.vercel.app)

## Tech Stack

- Node.js + Express.js
- MongoDB Atlas
- JWT Authentication (Better Auth session verification)
- Vercel Deployment

## API Endpoints

### Ebooks

| Method | Endpoint             | Description                                 | Auth   |
| ------ | -------------------- | ------------------------------------------- | ------ |
| GET    | /api/ebooks          | Get all ebooks (search, filter, pagination) | Public |
| GET    | /api/ebooks/featured | Get latest 6 ebooks                         | Public |
| GET    | /api/ebooks/:id      | Get single ebook                            | Public |
| GET    | /api/my/ebooks       | Get writer's own ebooks                     | Public |
| POST   | /api/ebooks          | Create new ebook                            | Writer |
| PATCH  | /api/ebooks/:id      | Update ebook                                | Token  |
| DELETE | /api/ebooks/:id      | Delete ebook                                | Token  |

### Purchases

| Method | Endpoint       | Description                               | Auth   |
| ------ | -------------- | ----------------------------------------- | ------ |
| GET    | /api/purchases | Get purchases (filter by userId/writerId) | Token  |
| POST   | /api/purchases | Save purchase after payment               | Public |

### Bookmarks

| Method | Endpoint           | Description        | Auth  |
| ------ | ------------------ | ------------------ | ----- |
| GET    | /api/bookmarks     | Get user bookmarks | Token |
| POST   | /api/bookmarks     | Add bookmark       | Token |
| DELETE | /api/bookmarks/:id | Remove bookmark    | Token |

### Transactions

| Method | Endpoint          | Description          | Auth   |
| ------ | ----------------- | -------------------- | ------ |
| GET    | /api/transactions | Get all transactions | Admin  |
| POST   | /api/transactions | Save transaction     | Public |

### Users

| Method | Endpoint       | Description      | Auth  |
| ------ | -------------- | ---------------- | ----- |
| GET    | /api/users     | Get all users    | Admin |
| PATCH  | /api/users/:id | Update user role | Admin |
| DELETE | /api/users/:id | Delete user      | Admin |

### Stats & Writers

| Method | Endpoint         | Description            | Auth   |
| ------ | ---------------- | ---------------------- | ------ |
| GET    | /api/stats       | Platform statistics    | Public |
| GET    | /api/writers/top | Top 3 writers by sales | Public |

## Environment Variables

```env
MONGODB_URI=
DB_NAME=fable-db
AUTH_DB_NAME=fable-auth
PORT=5000
```

## npm Packages Used

| Package | Purpose               |
| ------- | --------------------- |
| express | Web framework         |
| cors    | Cross-origin requests |
| dotenv  | Environment variables |
| mongodb | Database driver       |
