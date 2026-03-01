# Script de reparation des dependances Expo SDK 54

Write-Host "Nettoyage des dependances..." -ForegroundColor Yellow

# Supprimer node_modules et package-lock.json
if (Test-Path node_modules) {
    Remove-Item -Recurse -Force node_modules
    Write-Host "node_modules supprime" -ForegroundColor Green
}

if (Test-Path package-lock.json) {
    Remove-Item -Force package-lock.json
    Write-Host "package-lock.json supprime" -ForegroundColor Green
}

Write-Host ""
Write-Host "Installation des dependances de base..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "Dependances de base installees" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Correction des versions Expo SDK 54..." -ForegroundColor Yellow
    npx expo install --fix
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "TOUT EST PRET!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Pour lancer l'app:" -ForegroundColor Cyan
        Write-Host "   npm start" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "Erreur lors de la correction Expo" -ForegroundColor Red
    }
} else {
    Write-Host "Erreur lors de l'installation" -ForegroundColor Red
}
