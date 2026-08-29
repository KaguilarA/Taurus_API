# Auth Routes

Base path: `/auth`.

These routes do not add route middleware.

| Method | Path | Responsibility |
| --- | --- | --- |
| POST | `/login` | Validate credentials and create a session. |
| POST | `/logout` | Destroy the current session. |
| GET | `/status` | Return the current authentication status. |

The login response sets `req.session.userId` on success. Session persistence is configured by `OwlSession` in `index.js`.
