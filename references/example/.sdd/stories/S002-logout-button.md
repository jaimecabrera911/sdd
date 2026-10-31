---
id: S002
title: Botón de logout
status: in-progress
blocked: false
type: feature
priority: P2
size: S
blocked-by: [S001]
touches: [src/session.js, test/session.test.js]
spec-ref: .sdd/specs/spec-01.md#logout
started: 2026-10-30T11:20:00Z
---

Como usuario, quiero cerrar sesión en un clic, para salir desde cualquier pantalla.

## Criterios de aceptación

- **Dado** una sesión activa **Cuando** pulso "Salir" **Entonces** la sesión termina y el token se borra (test: test/session.test.js#logout)

## Fuera de alcance
- Logout global en todos los dispositivos
