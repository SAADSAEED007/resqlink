# API contracts

Status: ResQLink feature contracts have not been defined. No disaster-response endpoints are implemented by this initialization.

Before feature work, agree on each operation's owner, HTTP method/path, authentication/roles, request schema, response schema, status codes, validation errors, pagination (if needed), and examples. Record decisions here and review them together before parallel implementation.

The imported backend already mounts general and user/authentication routers under /v1. These are inherited boilerplate, not approved ResQLink contracts. Inspect backend/src/APIs and validate actual behavior before reusing any route. This document intentionally makes no promise about implemented ResQLink endpoints.
