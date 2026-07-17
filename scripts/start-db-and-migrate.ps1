$ErrorActionPreference = 'Stop'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error 'Docker no está instalado o no está disponible en PATH.'
  exit 1
}

Write-Host 'Levantando base de datos con Docker Compose...'
docker compose up -d db

if ($LASTEXITCODE -ne 0) {
  Write-Error 'No se pudo levantar la base de datos.'
  exit $LASTEXITCODE
}

Write-Host 'Esperando a que PostgreSQL quede disponible...'
for ($i = 0; $i -lt 20; $i++) {
  try {
    npx prisma migrate deploy | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Host 'Migraciones aplicadas correctamente.'
      exit 0
    }
  }
  catch {
    Start-Sleep -Seconds 2
  }

  Start-Sleep -Seconds 2
}

Write-Error 'No fue posible aplicar las migraciones. Revisa el estado de Docker y la base de datos.'
exit 1
