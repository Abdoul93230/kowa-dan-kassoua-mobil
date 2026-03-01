# Redémarrage propre de l'app Expo

Write-Host "Nettoyage du cache Expo..." -ForegroundColor Yellow

# Supprimer le cache .expo
if (Test-Path .expo) {
    Remove-Item -Recurse -Force .expo
    Write-Host "Cache .expo supprime" -ForegroundColor Green
}

Write-Host ""
Write-Host "Demarrage de l'app avec cache vide..." -ForegroundColor Cyan
npm start -- --clear
