# Spec 01 — Autenticación

Fuente de verdad para las historias con `spec-ref: .sdd/specs/spec-01.md#…`.

## login

El login delega en Google OAuth. Éxito = sesión con token en memoria y refresh persistido.

## logout

El logout borra el token y el refresh en un solo paso observable desde la UI.
