# Auth Controller

## Responsibility

Handles credential login and session lifecycle.

## Public methods

- `logIn`: normalizes the email input, resolves the user-owned email, compares the password hash, stores `req.session.userId`, and returns the authenticated user.
- `logout`: destroys the session and clears `connect.sid`.
- `status`: returns whether a session or authenticated user is present.

## Dependencies

The factory receives `models` in this order: `UserModel`, then `EmailModel`.

## Responses

Invalid credentials return `401`. Missing credentials return `400`. Session failures and unexpected errors return `500`.

## Security

Password comparison uses the user model hash helper. The controller never returns the stored password hash.
