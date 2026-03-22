# CodeWave

# Security Changes And Testing

## What was changed

### 1. Docker and network hardening

- Added a local `mongo` container in `docker-compose.yml` for stable local Docker development and testing.
- Updated `docker-compose.yml` so only `frontend` and `api-gateway` expose host ports.
- Moved backend services to an internal Docker network.
- Added container hardening settings:
  - `read_only: true`
  - `tmpfs`
  - `cap_drop: ALL`
  - `no-new-privileges:true`
- Updated backend Dockerfiles to run as the non-root `node` user.
- Configured each backend service to use a separate local MongoDB database during Docker runs:
  - `unilib-users`
  - `unilib-books`
  - `unilib-loans`
  - `unilib-notifications`

### 2. HTTP security middleware

- Added `helmet` to:
  - `services/api-gateway`
  - `services/user-service`
  - `services/book-catalog-service`
  - `services/loan-service`
  - `services/notification-service`
- Added `express-rate-limit` to reduce abuse and basic brute-force style traffic.
- Added stricter CORS handling using `CORS_ORIGIN`.
- Added request body size limits with `express.json({ limit: "10kb" })`.
- Improved API Gateway proxy error handling so WebSocket failures do not crash the gateway process.

### 3. Service-to-service protection

- Added `serviceAuth.js` middleware in:
  - `services/user-service/src/middleware`
  - `services/loan-service/src/middleware`
  - `services/notification-service/src/middleware`
- Protected internal-only endpoints with `x-internal-service-token`.
- Added `INTERNAL_SERVICE_TOKEN` environment validation in services that use internal service authentication.
- Updated internal Axios calls to include the internal service token header.

### 4. Authorization improvements

- Restricted `GET /api/users/:id` for internal-service use only.
- Restricted loan routes so a normal user can only view their own loan records.
- Restricted notification routes so a normal user can only read, update, or delete their own notifications.
- Kept admin/staff access where it is needed for library operations.

### 5. Frontend reverse proxy security

- Added nginx response headers:
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Content-Security-Policy`
- Disabled nginx version exposure using `server_tokens off`.

### 6. DevSecOps and SAST

- Added GitHub Actions workflow: `.github/workflows/security.yml`
- Added `npm audit` checks for all services and frontend.
- Added optional SonarCloud scan support.
- Added optional Snyk scan support.
- Added `sonar-project.properties` for SonarCloud project configuration.
- Upgraded `nodemailer` in `notification-service` to remove the reported high-severity vulnerability.

### 7. AWS least-privilege guidance

- Added `infra/aws/least-privilege-baseline.tf` with:
  - IAM task role example
  - IAM execution role example
  - security groups for ALB, ECS services, and MongoDB
- This provides a deployable example for using IAM roles and security groups instead of broad access.

## Why these changes were added

### Internal-only networking

This reduces the attack surface. Backend microservices should not be directly reachable from outside when the API Gateway already acts as the controlled entry point.

The local MongoDB container was added so the secured Docker stack can run reliably without depending on external MongoDB Atlas SRV DNS resolution during demos and testing.

### Non-root containers and dropped privileges

This follows least privilege. If a container is compromised, the attacker gets fewer permissions and less ability to affect the host or other services.

### Security middleware

- `helmet` adds safe HTTP headers.
- rate limiting reduces simple abuse and high-frequency attack attempts.
- CORS restrictions reduce unsafe browser-based cross-origin access.
- body size limits reduce the risk of oversized request abuse.

### Internal service token

Some routes are meant only for communication between services. Adding the internal token prevents external users from calling those routes directly.

### Authorization fixes

Security is not only infrastructure. The application also must ensure users can only access their own data unless they have staff/admin permission.

### SAST and dependency scanning

SonarCloud and Snyk support secure development by finding code issues and dependency vulnerabilities early. `npm audit` gives a free baseline dependency security check in CI.

### IAM roles and security groups

This is required for secure cloud deployment. IAM roles avoid storing AWS credentials in code or environment files, and security groups restrict which systems can talk to each other.

## How to test the changes

## 1. Verify compose and startup configuration

Run:

```powershell
docker compose config --quiet
```

Expected result:

- No validation errors.

## 2. Verify JavaScript syntax

Run:

```powershell
node --check services/api-gateway/src/index.js
node --check services/user-service/src/index.js
node --check services/user-service/src/routes/userRoutes.js
node --check services/book-catalog-service/src/index.js
node --check services/loan-service/src/index.js
node --check services/loan-service/src/routes/loanRoutes.js
node --check services/notification-service/src/index.js
node --check services/notification-service/src/routes/notificationRoutes.js
```

Expected result:

- All commands complete without syntax errors.

## 3. Verify dependency vulnerability baseline

Run inside each package:

```powershell
npm audit --audit-level=high
```

Expected result:

- No high or critical vulnerabilities.

## 4. Verify internal-only service protection

Start the application:

```powershell
docker compose up --build
```

Then try calling an internal route without the header:

```powershell
curl http://localhost:8080/api/notifications/check-overdue -Method POST
```

Expected result:

- Access should be denied because the internal token header is missing.

Then call the same route from inside the service boundary or with the expected header:

```powershell
curl -X POST http://localhost:3004/api/notifications/check-overdue -H "x-internal-service-token: YOUR_TOKEN"
```

Expected result:

- Request is accepted if the token is correct.

## 5. Verify authorization rules

### Loan access test

1. Log in as User A.
2. Call `GET /api/loans/user/<UserBId>`.

Expected result:

- User A should receive `403 Forbidden`.

### Notification access test

1. Log in as User A.
2. Call `GET /api/notifications/user/<UserBId>`.

Expected result:

- User A should receive `403 Forbidden`.

### Staff/admin access test

1. Log in as staff or admin.
2. Call the same routes.

Expected result:

- Staff/admin should be allowed where operational access is intended.

## 6. Verify local Docker startup with MongoDB

Run:

```powershell
docker compose down
docker compose up --build
```

Expected result:

- `mongo`, `api-gateway`, `frontend`, `user-service`, `book-catalog-service`, `loan-service`, and `notification-service` start successfully.
- The backend services connect to the local Docker MongoDB container instead of external Atlas SRV records.

## 7. Verify API and WebSocket stability

After startup, open:

```text
http://localhost:3000
```

Expected result:

- The application loads without `502 Bad Gateway`.
- `/api/books` responds through the gateway.
- A temporary WebSocket proxy failure does not crash the API Gateway process.

## 8. Verify CI security scanning

Push the branch to GitHub.

Expected result:

- GitHub Actions runs the `Security` workflow.
- `dependency-audit` runs automatically.
- `sonarcloud` runs if `SONAR_TOKEN` is configured.
- `snyk` runs if `SNYK_TOKEN` is configured.

## 9. Verify SonarCloud

Steps:

1. Set `sonar.projectKey` and `sonar.organization` in `sonar-project.properties`.
2. Add `SONAR_TOKEN` in GitHub repository secrets.
3. Push to GitHub.

Expected result:

- SonarCloud shows a scan result for the repository.

## 10. Verify Snyk

Steps:

1. Add `SNYK_TOKEN` in GitHub repository secrets.
2. Push to GitHub.

Expected result:

- Snyk dependency scanning runs in GitHub Actions.

## Notes

- Before deployment, set a strong real value for `INTERNAL_SERVICE_TOKEN`.
- Do not commit sensitive values such as `JWT_SECRET`, `MONGO_URI`, email credentials, or cloud credentials.
- Replace placeholder SonarCloud values with your real organization and project key.
- The local Docker MongoDB setup is for development and testing convenience. For production, use a managed/private database with restricted network access and secret-managed credentials.
