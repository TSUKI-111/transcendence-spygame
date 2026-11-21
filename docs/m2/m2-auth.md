# M2 — Authentication and Profile API

## Local access

Open the application at https://localhost:8443.
Frontend requests must use relative URLs starting with /api.

Authentication uses the HttpOnly cookie __Host-spygame_session.
Do not store a session token in localStorage or try to read this cookie
from JavaScript.

## Endpoints

| Method | URL | Request body | Success |
|---|---|---|---|
| POST | /api/auth/register | username, displayName, email, password | 201 — PublicUser |
| POST | /api/auth/login | email, password | 200 — message + session cookie |
| GET | /api/auth/me | None | 200 — PublicUser |
| PUT | /api/auth/me | displayName | 200 — updated PublicUser |
| POST | /api/auth/logout | None | 200 — message + cookie removal |

Registration creates an account but does not automatically log the user in.
GET and PUT /api/auth/me require a valid session.
Logout revokes the current session, not all sessions on other devices.

## Public user

```ts
type PublicUser = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};
```

When avatarUrl is null, the frontend must display a default avatar.

## Validation

Registration:
- username: 3–30 characters; letters, digits and underscore only.
- displayName: 1–50 characters; cannot contain only whitespace.
- email: valid email address, maximum 254 characters.
- password: 15–128 characters.

Login:
- email: valid email address, maximum 254 characters.
- password: 1–128 characters.

Profile update:
- Only displayName is accepted.
- Leading and trailing whitespace is removed before validation.
- The resulting name must contain 1–50 characters.
- The account ID comes from the verified session, never from the body.

## Errors

- 400: invalid input or unexpected body fields.
- 401: incorrect credentials, missing session, invalid or expired session.
- 403: missing or unauthorized Origin on a state-changing request.
- 409: username or email already used.

The response message may be a string or an array of validation messages.

## Frontend integration — M3

- Call /api/auth/me when initializing the authenticated interface.
- Treat 401 as unauthenticated; distinguish network/server failures.
- Redirect after login only when the API confirms success.
- Send JSON with Content-Type: application/json.
- Use credentials: "same-origin" for requests through the same origin.
- The browser supplies the Origin header; do not set it manually.
- After logout succeeds, clear the user from React state.
- Frontend route protection does not replace backend authorization.

## Backend integration — M4

Import AuthModule into the module containing protected controllers.
Apply SessionAuthGuard to routes requiring authentication.

SessionAuthGuard validates the session and populates req.user.
Use req.user.id as the authenticated user ID.

RequireUserGuard alone does not establish an authenticated identity.

The global CsrfOriginGuard checks the origin of state-changing HTTP
requests against APP_ORIGIN.

## Verification status

Completed:
- Manual checks of registration, login, logout and protected access.
- Manual checks of invalid, expired and revoked sessions.
- Manual checks of profile validation and origin validation.
- Automated authentication lifecycle test on spygame_m2_test.

Pending:
- Browser integration with M3, including the default avatar.
- Real-session integration confirmation with M4.
- Confirmation of the User/profile model review with M5.