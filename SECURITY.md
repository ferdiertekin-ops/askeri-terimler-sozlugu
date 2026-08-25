# Security Policy

## Supported version

The current production version and the latest commit on the default branch are supported for security reports.

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities, credentials, administrative routes, authentication weaknesses, or personal data in a public issue.

Report security concerns privately to the maintainer through the contact channel published on the project's website:

- https://askeriterimlersozlugu.com/iletisim

Please include:

- the affected page, function, or file;
- clear reproduction steps;
- the potential impact;
- screenshots or logs with credentials and personal data removed;
- a suggested mitigation, if available.

Do not test vulnerabilities by accessing, modifying, deleting, or publishing data that does not belong to you.

## Public-release gate

The repository must not be made public until the mandatory items in `SECURITY_AUDIT.md` have been completed and verified. In particular, the current password-hash-based editor authorization must be replaced before public release.

## Secrets

Credentials and service tokens must be stored only as deployment environment variables. They must never be committed to the repository, included in examples, exported publication packages, screenshots, issues, or pull-request discussions.
