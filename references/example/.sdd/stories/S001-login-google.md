---
id: S001
title: Login con Google
status: done
blocked: false
type: feature
priority: P1
size: M
blocked-by: []
touches: [src/auth.js, test/auth.test.js]
spec-ref: .sdd/specs/spec-01.md#login
started: 2026-10-27T09:00:00Z
---

Como usuario, quiero iniciar sesión con Google, para no crear una contraseña más.

## Criterios de aceptación

- **Dado** en la pantalla de login **Cuando** pulso "Google" **Entonces** redirige al consentimiento (test: test/auth.test.js#login-google)
- **Dado** el consentimiento otorgado **Cuando** vuelvo a la app **Entonces** hay una sesión activa (test: test/auth.test.js#session)

## Fuera de alcance
- Login con Apple (siguiente epic)
