# Blessed-Box-BackEnd

Proyecto Personal de OCC (Bakcend)

The DynamoDB session and OTP table names can be configured with
`DYNAMODB_SESSIONS_TABLE` and `DYNAMODB_OTP_TABLE`. They default to the
development table names for local and development deployments; production
requires both variables to be explicitly configured.

## Postman

Importa `postman/Blessed-Box.postman_collection.json` y los entornos
`postman/Blessed-Box-Dev.postman_environment.json` y
`postman/Blessed-Box-Prod.postman_environment.json`. Selecciona el entorno
correspondiente antes de enviar peticiones. La colección incluye todos los
endpoints registrados en Express, además de `GET /health`; el host base se
configura por entorno.

Completa `email`, `password`, `name`, `lastName` y los demás datos requeridos
en las variables del entorno. Ejecuta `Login` para guardar automáticamente
`accessToken` y `refreshToken` en el entorno seleccionado. `Refresh tokens`
rota y guarda ambos tokens; los endpoints protegidos usan el `accessToken`
automáticamente. Para registro o recuperación de contraseña, usa `otp` con el
código recibido por correo. `Generate QR code and access code` envía únicamente
`RC_Code`; el backend genera el `accessCode` y la colección lo guarda para las
peticiones relacionadas. Los endpoints protegidos requieren además los roles
o permisos correspondientes. `GET /api/qrCodes/manualAccessCode` solo permite
acceso a usuarios con rol `MANAGER`.

## Despliegue a producción

El workflow `.github/workflows/deploy-main.yml` se ejecuta al actualizar `main`.
Publica el SHA exacto del commit en el parámetro SSM
`/blessedbox/prod/app/RELEASE_SHA`, inicia un instance refresh del Auto Scaling
Group `prod-api` y espera a que termine correctamente. Si ya hay un refresh en
curso, espera a que termine antes de iniciar el de este release.

Para habilitarlo, primero aplica Terraform en los entornos `prod` y
`github-actions` del repositorio de infraestructura, incluyendo el valor
`initial_release_sha` de 40 caracteres en el `terraform.tfvars` ignorado por
Git. Después configura en las variables del repositorio backend
`AWS_PROD_ROLE_ARN` con la salida
`terraform output -raw github_actions_prod_role_arn`. El rol debe tener permiso
para actualizar el parámetro y controlar/consultar el instance refresh. Las
instancias nuevas dependen del bootstrap y del acceso de la AMI al repositorio
privado para obtener el SHA publicado. Hasta aplicar esa infraestructura y
configurar la variable de GitHub, el workflow no puede desplegar.
