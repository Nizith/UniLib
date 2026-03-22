# UniLib Security Hardening

## What was implemented

- Internal-only microservices in `docker-compose.yml`: only `frontend` and `api-gateway` publish host ports; all backend services now stay on an internal Docker network.
- Container hardening: backend containers run as the non-root `node` user, drop Linux capabilities, enable `no-new-privileges`, and use read-only filesystems with temporary writable mounts.
- HTTP hardening: all Node services now use `helmet`, request rate limiting, stricter CORS handling, and JSON body size limits.
- Service-to-service authentication: sensitive internal routes now require `x-internal-service-token`, reducing the chance of direct abuse from outside the microservice boundary.
- Authorization fixes: users can no longer read another user's loans or notifications just by changing URL parameters.
- Frontend reverse proxy headers: nginx now sends security headers such as CSP, `X-Frame-Options`, and `X-Content-Type-Options`.
- DevSecOps: GitHub Actions now runs `npm audit` for every service and optionally runs SonarCloud and Snyk when tokens are configured.

## Free SAST setup

### SonarCloud

1. Create a free SonarCloud account and import this GitHub repository.
2. Update `sonar-project.properties`:
   - Set `sonar.projectKey` to your SonarCloud project key.
   - Set `sonar.organization` to your SonarCloud organization.
3. Add GitHub repository secret `SONAR_TOKEN`.
4. Push to GitHub and the `Security` workflow will run the scan automatically.

### Snyk

1. Create a free Snyk account and connect the repository.
2. Generate an API token in Snyk.
3. Add GitHub repository secret `SNYK_TOKEN`.
4. Push to GitHub and the `Security` workflow will run `snyk test`.

## Least-privilege AWS baseline

- Use the sample Terraform in `infra/aws/least-privilege-baseline.tf`.
- Use ECS task roles instead of embedding AWS access keys in application env files.
- Store secrets such as MongoDB URIs, JWT secrets, email credentials, and the internal service token in AWS Secrets Manager or SSM Parameter Store.
- Keep MongoDB private and allow inbound access only from the ECS service security group.
- Allow internet ingress only to the load balancer on HTTPS; route traffic from ALB to the API gateway only.

## Environment variables to add

- `INTERNAL_SERVICE_TOKEN`: shared secret for internal-only routes between `user-service`, `loan-service`, and `notification-service`.
- `CORS_ORIGIN`: frontend origin, for example `http://localhost:3000`.
- Existing secrets like `JWT_SECRET`, `MONGO_URI`, `EMAIL_USER`, and `EMAIL_PASS` should stay outside source control.
