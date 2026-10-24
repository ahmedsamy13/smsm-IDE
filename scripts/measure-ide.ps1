param([int]$RootProcessId,[string]$EvidenceRoot,[int]$DurationSeconds=150)
$ErrorActionPreference='Stop'
$logical=[Environment]::ProcessorCount
$samples=[Collections.Generic.List[object]]::new()
$previous=@{}
$watch=[Diagnostics.Stopwatch]::StartNew()
$lastTime=$watch.Elapsed.TotalSeconds
while($watch.Elapsed.TotalSeconds -lt $DurationSeconds){
 Start-Sleep -Milliseconds 1000
 $now=$watch.Elapsed.TotalSeconds
 $all=@(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,Name,CommandLine)
 $ids=[Collections.Generic.HashSet[int]]::new();[void]$ids.Add($RootProcessId)
 do{$added=$false;foreach($item in $all){if($ids.Contains([int]$item.ParentProcessId) -and $ids.Add([int]$item.ProcessId)){$added=$true}}}while($added)
 $phase='startup'
 try{$phase=([IO.File]::ReadAllText((Join-Path $EvidenceRoot 'phase.json'))|ConvertFrom-Json).phase}catch{}
 $totals=@{ide=@{working=0L;private=0L;cpu=0.0;count=0};project=@{working=0L;private=0L;cpu=0.0;count=0}}
 $next=@{}
 foreach($item in $all){
  $pidValue=[int]$item.ProcessId
  if(-not $ids.Contains($pidValue)){continue}
  try{
   $process=Get-Process -Id $pidValue -ErrorAction Stop
   $category=if($item.Name -in @('node.exe','esbuild.exe')){'project'}else{'ide'}
   $group=$totals[$category]
   $group.working+=$process.WorkingSet64;$group.private+=$process.PrivateMemorySize64;$group.count++
   $cpu=$process.TotalProcessorTime.TotalSeconds
   $key=[string]$pidValue+':'+$process.StartTime.ToUniversalTime().Ticks
   if($previous.ContainsKey($key)){$group.cpu+=[Math]::Max([double]0,($cpu-$previous[$key])/($now-$lastTime)*100/$logical)}
   $next[$key]=$cpu
  }catch{}
 }
 $previous=$next;$lastTime=$now
 $samples.Add([pscustomobject]@{seconds=[Math]::Round($now,2);phase=$phase;ideWorkingMiB=[Math]::Round($totals.ide.working/1MB,1);idePrivateMiB=[Math]::Round($totals.ide.private/1MB,1);ideCpuPercent=[Math]::Round($totals.ide.cpu,2);ideProcesses=$totals.ide.count;projectWorkingMiB=[Math]::Round($totals.project.working/1MB,1);projectPrivateMiB=[Math]::Round($totals.project.private/1MB,1);projectCpuPercent=[Math]::Round($totals.project.cpu,2);projectProcesses=$totals.project.count})
 if($phase -eq 'complete' -or -not(Get-Process -Id $RootProcessId -ErrorAction SilentlyContinue)){break}
}
$summary=@()
foreach($group in ($samples|Group-Object phase)){
 $rows=$group.Group
 $summary+=[pscustomobject]@{phase=$group.Name;samples=$rows.Count;ideWorkingMiBAvg=[Math]::Round(($rows|Measure-Object ideWorkingMiB -Average).Average,1);ideWorkingMiBPeak=($rows|Measure-Object ideWorkingMiB -Maximum).Maximum;idePrivateMiBAvg=[Math]::Round(($rows|Measure-Object idePrivateMiB -Average).Average,1);ideCpuPercentAvg=[Math]::Round(($rows|Measure-Object ideCpuPercent -Average).Average,2);ideCpuPercentPeak=($rows|Measure-Object ideCpuPercent -Maximum).Maximum;projectWorkingMiBAvg=[Math]::Round(($rows|Measure-Object projectWorkingMiB -Average).Average,1);projectCpuPercentAvg=[Math]::Round(($rows|Measure-Object projectCpuPercent -Average).Average,2)}
}
$result=[pscustomobject]@{logicalProcessors=$logical;requestedDelayMilliseconds=1000;averageIntervalSeconds=[Math]::Round($watch.Elapsed.TotalSeconds/[Math]::Max(1,$samples.Count),3);cpuBasis='Percent of total logical CPU capacity; process CPU deltas. First observations exclude prior CPU time.';memoryBasis='Sum of process working sets (shared pages can be double-counted), and private committed bytes. Project node/esbuild children are reported separately.';summary=$summary;samples=$samples}
[IO.File]::WriteAllText((Join-Path $EvidenceRoot 'performance.json'),($result|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
