param([string]$OutputDirectory = (Join-Path $PSScriptRoot '../../public/assets/world-in-a-box/chancellor/audio'))
$ErrorActionPreference='Stop'
$audioOut=[IO.Path]::GetFullPath($OutputDirectory)
[IO.Directory]::CreateDirectory($audioOut) | Out-Null
$content=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../../public/assets/world-in-a-box/chancellor/content.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$lines=[ordered]@{
 'definition'=$content.definition
 'opening'=$content.opening
 'granary'='管粮的人说：一共有十二袋粮。开始时车里六袋，粮仓六袋。我们会核对数量，再装粮。'
 'bridge'='工程队说：桥坏了。修桥材料已经放在桥边。我们修桥的时候，运输队可以走水路。'
 'pier'='船工说：船最多装三袋，能到河村。开车和开船，是同一支运输队。'
 'river'='河村需要六袋粮。船能到，车也能到。船每次三袋，车每次六袋。'
 'mountain'='山村需要六袋粮。这里不通船。车必须经过修好的桥。'
 'council'='宰相先听大家的消息。哪些事情能一起做？哪些要等一等？安排以后，还要看实际结果。'
 'repair'='工程队收到安排，准备修桥。运输队可以同时运粮。'
 'bridge-done'='工程队回报：桥修好了。现在车可以过桥。'
 'arrived'='村里收到了粮食。运输队还要回到起点，才能接下一项任务。'
 'success'='两个村子都收到了六袋粮。管粮的人核对数量，工程队修桥，运输队开车、开船并回报。宰相把这些事情联系起来。大家一起做成了。'
}
for($i=0;$i -lt 4;$i++){$lines['story-'+($i+1)]=($content.scenes[$i].lines -join ' ')}
$speaker=New-Object -ComObject SAPI.SpVoice
$voices=$speaker.GetVoices();$chosen=$null
foreach($item in $voices){if($item.GetDescription() -match 'Huihui'){$chosen=$item;break}}
if($null -eq $chosen){throw 'Microsoft Huihui is required; do not silently substitute a different voice.'}
$speaker.Voice=$chosen;$speaker.Rate=0;$speaker.Volume=100
$manifest=@()
foreach($name in $lines.Keys){
 $path=Join-Path $audioOut ($name+'.wav')
 $stream=New-Object -ComObject SAPI.SpFileStream
 $stream.Format.Type=22
 $stream.Open($path,3,$false)
 $speaker.AudioOutputStream=$stream
 [void]$speaker.Speak($lines[$name],0)
 $stream.Close()
 $manifest+=@{id=$name;file=$name+'.wav';text=$lines[$name];sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
}
@{version=$content.version;voice=$chosen.GetDescription();rate=0;production='Installed Windows SAPI voice; local generated speech, no voice cloning';files=$manifest}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $audioOut 'manifest.json') -Encoding utf8
Write-Output ('Created '+$manifest.Count+' local narration files.')
