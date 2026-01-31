$BaseUrl = "http://localhost:8080/api/v1"
$Headers = @{
    "Content-Type" = "application/json"
    "Accept"       = "application/json"
}

Write-Host "--------------------------------------------" -ForegroundColor Cyan
Write-Host "? DÉBUT DES TESTS DE L'API ORCHID (POWERSHELL)" -ForegroundColor Cyan
Write-Host "--------------------------------------------" -ForegroundColor Cyan

# Fonction utilitaire pour tester et afficher les résultats
function Test-Request {
    param($Method, $Path, $Body, $TestName, $ExpectedStatus, $CustomHeaders = $Headers)

    Write-Host "`n- Test: $TestName" -ForegroundColor Yellow
    try {
        $params = @{
            Uri         = "$BaseUrl$Path"
            Method      = $Method
            Headers     = $CustomHeaders
            ErrorAction = "Stop"
        }
        if ($Body) { $params.Body = ($Body | ConvertTo-Json) }

        $response = Invoke-WebRequest @params
        Write-Host "  Code HTTP: $($response.StatusCode) (Succès)" -ForegroundColor Green
        return $response
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.Value__
        $errorBody = $_.ErrorDetails.Message

        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "  Code HTTP: $statusCode (Erreur attendue ?)" -ForegroundColor Green
        } else {
            Write-Host "  Code HTTP: $statusCode (Inattendu ? - Attendu: $ExpectedStatus)" -ForegroundColor Red
            Write-Host "  Réponse: $errorBody" -ForegroundColor Gray
        }
        return $_.Exception.Response
    }
}

# --- 1. CRÉATION COMMANDE (SUCCÈS) ---
$orderData = @{ clientId = 1; date = "2024-01-15T10:30:00Z" }
$res = Test-Request -Method Post -Path "/commandes" -Body $orderData -TestName "Création commande valide" -ExpectedStatus 201

# Récupération de l'ID pour la suite
$cmdId = ($res.Content | ConvertFrom-Json).id
Write-Host "  ID Commande créée : $cmdId" -ForegroundColor Gray

# --- 2. CRÉATION COMMANDE (ERREUR : DATE FUTURE) ---
$futureData = @{ clientId = 1; date = "2029-12-31T23:59:59Z" }
Test-Request -Method Post -Path "/commandes" -Body $futureData -TestName "Erreur: Date future" -ExpectedStatus 400

# --- 3. UPDATE STATUS : RECEIVED -> PAID (SUCCÈS) ---
$statusPaid = @{ status = "PAID" }
Test-Request -Method Patch -Path "/commandes/$cmdId/status" -Body $statusPaid -TestName "Update Status (PAID)" -ExpectedStatus 204

# --- 4. UPDATE STATUS (ERREUR : WORKFLOW INVALIDE) ---
$statusBack = @{ status = "RECEIVED" }
Test-Request -Method Patch -Path "/commandes/$cmdId/status" -Body $statusBack -TestName "Erreur: Workflow (Retour arrière)" -ExpectedStatus 400

# --- 5. UPDATE STATUS (ERREUR : 404) ---
Test-Request -Method Patch -Path "/commandes/9999/status" -Body $statusPaid -TestName "Erreur: ID inexistant" -ExpectedStatus 404

# --- 6. ERREUR : CONTENT-TYPE ---
$wrongHeader = @{ "Content-Type" = "text/plain" }
Test-Request -Method Patch -Path "/commandes/$cmdId/status" -Body $statusPaid -TestName "Erreur: Content-Type non supporté" -ExpectedStatus 415 -CustomHeaders $wrongHeader

Write-Host "`n--------------------------------------------" -ForegroundColor Cyan
Write-Host "? TESTS TERMINÉS" -ForegroundColor Cyan
Write-Host "--------------------------------------------" -ForegroundColor Cyan