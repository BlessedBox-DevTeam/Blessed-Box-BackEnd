# Blessed-Box-BackEnd

Proyecto Personal de OCC (Bakcend)

## Postman

Importa `postman/Blessed-Box.postman_collection.json` y define `email`, `password` y `rcCode` en las variables de la colección. Ejecuta `Login` primero; el script guarda automáticamente `accessToken` y `refreshToken`. Usa `Refresh tokens` cuando expire el access token: la respuesta rota y vuelve a guardar ambos tokens. `Generate QR code` envía únicamente `RC_Code`; el controller genera el `accessCode` en formato `A-Z0-9` y lo devuelve en la respuesta.
