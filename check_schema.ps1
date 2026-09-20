Add-Type -Path 'D:\delhi\Exhibition-Leads-Management\backend\src\ExhibitionLeads.Api\bin\Debug\net9.0\Microsoft.Data.Sqlite.dll'
$conn = New-Object Microsoft.Data.Sqlite.SqliteConnection('Data Source=D:\delhi\Exhibition-Leads-Management\backend\src\ExhibitionLeads.Api\bin\Debug\net9.0\Data\exhibition_leads.db')
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = 'PRAGMA table_info(Stalls);'
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    Write-Output ($reader["name"].ToString() + " (" + $reader["type"].ToString() + ")")
}
$conn.Close()
