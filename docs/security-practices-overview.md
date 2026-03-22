# CodeWave

# Overview Of Security Practices Implemented

## Security practices implemented in UniLib

### 1. Principle of least privilege

- Backend services are no longer exposed directly to the host machine.
- Only the `api-gateway` and `frontend` are publicly reachable in the Docker setup.
- Containers run with reduced privileges using:
  - non-root users
  - dropped Linux capabilities
  - `no-new-privileges`
  - read-only filesystems where possible

This reduces unnecessary access and limits the impact of a compromise.

### 2. Network isolation

- Backend microservices are placed on an internal Docker network.
- Only approved entry points are accessible externally.
- A local MongoDB container is used for Docker-based development, and application services reach it only over the internal network.
- This reflects the same idea used in cloud deployments with private subnets and restrictive security groups.

This helps prevent direct unauthorized access to internal services.

### 3. Secure inter-service communication

- Internal routes used only for microservice-to-microservice communication now require `x-internal-service-token`.
- Services validate the shared internal token before allowing access.

This prevents external clients from calling internal operational endpoints directly.

### 4. Secure HTTP configuration

- `helmet` is used to apply safer HTTP security headers.
- The API Gateway proxy error handling was improved so a failed socket upgrade does not terminate the gateway process.
- nginx adds:
  - Content Security Policy
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`

These protections reduce common web risks such as clickjacking, MIME sniffing, and unsafe resource loading.

### 5. Controlled cross-origin access

- CORS is restricted using `CORS_ORIGIN` instead of leaving it fully open by default.

This ensures browser clients can only access the services from approved origins.

### 6. Rate limiting and request hardening

- `express-rate-limit` is used to reduce abusive repeated requests.
- JSON payload size is limited to reduce oversized request abuse.

These controls strengthen the services against simple denial-of-service and brute-force style attacks.

### 7. Application-level authorization

- Access control checks were improved in the application logic.
- A normal user can only access their own loans and notifications.
- Staff and admin users keep the permissions needed for library management.

This protects user data and enforces role-based access control.

### 8. Secrets and credential handling

- Sensitive values are expected to stay in environment variables or secret stores.
- The AWS baseline recommends using Secrets Manager and IAM roles instead of embedding credentials in code.

This follows secure secret management practices and reduces credential exposure.

### 9. IAM roles and security groups

- An AWS least-privilege Terraform baseline was added.
- It demonstrates:
  - IAM execution roles
  - IAM task roles
  - restrictive security groups
  - private access to MongoDB
  - HTTPS-only load balancer ingress

This supports secure deployment in AWS using standard cloud security controls.

### 10. DevSecOps and SAST integration

- GitHub Actions runs dependency security scanning with `npm audit`.
- SonarCloud can be enabled for static code analysis.
- Snyk can be enabled for dependency and security scanning.

This introduces continuous security checks into the development pipeline so issues can be detected earlier.

## Summary

The implemented security measures cover multiple layers:

- container security
- network isolation
- secure service-to-service communication
- secure HTTP configuration
- access control
- secret handling
- cloud least-privilege design
- automated security scanning

Together, these changes provide a practical basic security baseline for the UniLib microservices project and align with the requirements to use IAM roles, security groups, least privilege, and free managed SAST tooling.
