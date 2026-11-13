<?php
// Disposable DB and web root. Never writes to actual catalog files or records.
require_once dirname(__DIR__) . '/phpfiles/config.php';
require_once dirname(__DIR__) . '/phpfiles/part_pdf_queue.php';
if (!in_array(DB_HOST, ['localhost','127.0.0.1','::1'], true)) die('Local database required.');
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$checks = 0;
function qcheck($ok, $message) { global $checks; if (!$ok) throw new RuntimeException($message); $checks++; }
function qremove($path) { foreach (scandir($path) as $name) if ($name!=='.' && $name!=='..') { $file=$path.'/'.$name; if (is_dir($file)&&!is_link($file)) qremove($file); else unlink($file); } rmdir($path); }
function qfixturePdf(string $path, float $tilt = 0): void {
    $content = "0.5 w\n";
    foreach ([120,280,440,600] as $top) {
        for($line=0;$line<5;$line++){ $y=$top+$line*8; $content.="50 $y m 550 $y l S\n"; }
        foreach([50,200,380,550] as $x)$content.="$x $top m $x ".($top+32)." l S\n";
    }
    if ($tilt) {
        $cos=cos(deg2rad($tilt));$sin=sin(deg2rad($tilt));$e=300-300*$cos+400*$sin;$f=400-300*$sin-400*$cos;
        $content=sprintf("q\n%.8f %.8f %.8f %.8f %.8f %.8f cm\n",$cos,$sin,-$sin,$cos,$e,$f).$content."Q\n";
    }
    $objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Contents 5 0 R /Resources << >> >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Contents 5 0 R /Resources << >> >>',
        '<< /Length '.strlen($content)." >>\nstream\n".$content."endstream"];
    $pdf="%PDF-1.4\n"; $offsets=[0];
    foreach($objects as $i=>$object){$offsets[]=strlen($pdf);$pdf.=($i+1)." 0 obj\n$object\nendobj\n";}
    $start=strlen($pdf);$pdf.="xref\n0 6\n0000000000 65535 f \n";
    foreach(array_slice($offsets,1) as $offset)$pdf.=sprintf("%010d 00000 n \n",$offset);
    file_put_contents($path,$pdf."trailer << /Size 6 /Root 1 0 R >>\nstartxref\n$start\n%%EOF\n");
}
function qhttp($port, $action, $session, $id='', $data=null, $csrf=true) {
    $ch=curl_init('http://127.0.0.1:'.$port.'/editmode/part-pdf-queue.php?action='.$action.($id?'&id='.$id:''));
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20,CURLOPT_COOKIE=>'PHPSESSID='.$session]);
    if ($data!==null) { curl_setopt($ch,CURLOPT_POST,true); curl_setopt($ch,CURLOPT_POSTFIELDS,$data); if($csrf)curl_setopt($ch,CURLOPT_HTTPHEADER,['X-CSRF-Token: '.str_repeat('a',64)]); }
    $raw=curl_exec($ch);if($raw===false)throw new RuntimeException(curl_error($ch));$code=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
    $result=json_decode($raw,true);if(!is_array($result))throw new RuntimeException('Invalid queue response: '.substr($raw,0,1000));return [$code,$result];
}
function qterminal($port, $session, $id, $replaced=false, $attempts=100) {
    for($i=0;$i<$attempts;$i++) {
        usleep(150000); $item=qhttp($port,'get',$session,$id)[1]['item'];
        if($item['status']==='error'||($item['status']==='ready'&&(!$replaced||!empty($item['replaces_applied']))))return $item;
    }
    throw new RuntimeException('Queue conversion did not finish.');
}
$root=dirname(__DIR__);$database='mw_queue_test_'.bin2hex(random_bytes(5));$fixture=sys_get_temp_dir().'/'.$database;$server=null;
$connection=new mysqli(DB_HOST,DB_USER,DB_PASSWORD,DB_NAME);
try {
    $connection->query("CREATE DATABASE `$database` CHARACTER SET utf8mb4");$db=new mysqli(DB_HOST,DB_USER,DB_PASSWORD,$database);$db->set_charset('utf8mb4');
    $db->query('CREATE TABLE users (id INT PRIMARY KEY, role VARCHAR(20))');$db->query("INSERT INTO users VALUES (1,'admin'),(2,'admin'),(3,'user')");
    $db->query('CREATE TABLE composers (composer_id INT PRIMARY KEY, composer_first VARCHAR(100), composer_last VARCHAR(100))');$db->query("INSERT INTO composers VALUES (1,'Gustav','Mahler')");
    $db->query('CREATE TABLE pieces (piece_id INT PRIMARY KEY, piece_name VARCHAR(100),composer_id INT)');$db->query("INSERT INTO pieces VALUES (71,'Test Symphony',1),(72,'Another test piece',1)");
    $db->query('CREATE TABLE instruments (instrument_id INT PRIMARY KEY,instrument_name VARCHAR(100),part_number VARCHAR(20),instrument_key VARCHAR(20))');$db->query("INSERT INTO instruments VALUES (39,'Full Score','',''),(3,'Viola','',''),(4,'Cello','',''),(5,'Double Bass','',''),(6,'Solo Cello','','')");
    $db->query('CREATE TABLE piece_categories(category_id INT PRIMARY KEY,category_name VARCHAR(100))');
    $db->query('CREATE TABLE metric_arr(metric_arr_id INT AUTO_INCREMENT PRIMARY KEY,piece_id INT,instrument_id INT,measures_version INT,metric_arr_data LONGTEXT,edition_label VARCHAR(100)) ENGINE=InnoDB');
    $db->query('CREATE TABLE recordings(recording_id INT PRIMARY KEY,piece_id INT)');
    mkdir($fixture,0700);mkdir($fixture.'/public/editmode',0700,true);mkdir($fixture.'/public/sessions',0700);mkdir($fixture.'/phpfiles',0700);mkdir($fixture.'/queue',0700);
    mkdir($fixture.'/tools',0700);
    foreach(['process-pdf-queue.py','compress-pdf-low-memory.py','deskew-pdf.py','scan-pdf-barlines.py','barline-worker-runner.js'] as $tool) symlink($root.'/scripts/'.$tool,$fixture.'/tools/'.$tool);
    $python=getenv('MW_BARLINE_TEST_PYTHON') ?: trim(shell_exec('command -v python3'));
    $config=['DB_HOST'=>DB_HOST,'DB_USER'=>DB_USER,'DB_PASSWORD'=>DB_PASSWORD,'DB_NAME'=>$database,'MW_PDF_QUEUE_DIRECTORY'=>$fixture.'/queue','MW_PDF_QUEUE_PYTHON'=>$python,'MW_PDF_QUEUE_WORKER'=>$fixture.'/tools/process-pdf-queue.py'];
    $text='<?php ';foreach($config as $key=>$value)$text.='define('.var_export($key,true).','.var_export($value,true).');';
    file_put_contents($fixture.'/phpfiles/config.php',$text);chmod($fixture.'/phpfiles/config.php',0600);file_put_contents($fixture.'/phpfiles/read_only_user_config.php',$text);
    foreach(['part_pdf_queue.php','metric-arr-functions.php','get_pieces_and_composers.php'] as $file)copy($root.'/phpfiles/'.$file,$fixture.'/phpfiles/'.$file);
    file_put_contents($fixture.'/phpfiles/library_cache.php', '<?php function mwLibraryRefresh($db, $piece, $root) { file_put_contents('.var_export($fixture.'/snapshots.jsonl',true).',json_encode([$piece,$root])."\n",FILE_APPEND); return []; }');
    file_put_contents($fixture.'/phpfiles/cloudflare_purge.php','<?php function purgeMetricArrCache($metric,$piece,$instrument,$recordings=[]) { file_put_contents('.var_export($fixture.'/purges.jsonl',true).',json_encode([$metric,$piece,$instrument])."\n",FILE_APPEND); return ["success"=>true]; }');
    copy($root.'/session_config.php',$fixture.'/public/session_config.php');
    foreach(['part-pdf-queue.php','synpdf-edit-mode.php','get_parts.php','get_metric_arr.php'] as $file)copy($root.'/synpdf_182/editmode/'.$file,$fixture.'/public/editmode/'.$file);
    foreach(glob($root.'/synpdf_182/editmode/*') as $path)if(is_file($path)&&preg_match('/\.(js|css)$/',$path))symlink($path,$fixture.'/public/editmode/'.basename($path));
    symlink($root.'/synpdf_182/editmode/vendor',$fixture.'/public/editmode/vendor');symlink($root.'/synpdf_182/models',$fixture.'/public/models');symlink($root.'/assets',$fixture.'/public/assets');symlink($root.'/js',$fixture.'/public/js');
    $sessions=[];foreach(['owner'=>1,'admin'=>2,'user'=>3,'guest'=>0] as $role=>$id){$s=bin2hex(random_bytes(16));$sessions[$role]=$s;file_put_contents($fixture.'/public/sessions/sess_'.$s,'pdf_queue_csrf|s:64:"'.str_repeat('a',64).'";user_id|i:'.$id.';user_role|s:5:"admin";');}
    $socket=stream_socket_server('tcp://127.0.0.1:0');$port=(int)substr(strrchr(stream_socket_get_name($socket,false),':'),1);fclose($socket);
    $server=proc_open([PHP_BINARY,'-S','127.0.0.1:'.$port,'-t',$fixture.'/public'],[0=>['file','/dev/null','r'],1=>['file',$fixture.'/web.log','a'],2=>['file',$fixture.'/web.log','a']],$pipes);
    for($i=0;$i<50;$i++){if($s=@fsockopen('127.0.0.1',$port)){fclose($s);break;}usleep(20000);}
    [$code,$owner]=qhttp($port,'list',$sessions['owner']);qcheck($code===200&&$owner['can_upload'],'Primary admin can upload.');
    [$code,$admin]=qhttp($port,'list',$sessions['admin']);qcheck($code===200&&!$admin['can_upload'],'Other admins can review but cannot upload.');
    qcheck(qhttp($port,'list',$sessions['user'])[0]===403,'Stale forged admin role cannot access the queue.');qcheck(qhttp($port,'list',$sessions['guest'])[0]===403,'Guest cannot access the queue.');
    $source=$fixture.'/source.pdf'; qfixturePdf($source);
    $input=['name'=>'71-39.pdf','size'=>filesize($source),'piece_id'=>71,'instrument_id'=>39];
    qcheck(qhttp($port,'create',$sessions['admin'],'',$input)[0]===403,'Non-owner admin cannot upload via direct API.');
    qcheck(qhttp($port,'create',$sessions['owner'],'',$input,false)[0]===403,'Upload requires CSRF.');
    qcheck(qhttp($port,'create',$sessions['owner'],'',array_replace($input,['piece_id'=>99999]))[0]===400,'Unknown piece ID is rejected.');
    qcheck(qhttp($port,'create',$sessions['owner'],'',array_replace($input,['name'=>'../bad.pdf']))[0]===400,'Filenames cannot escape the queue folder.');
    qcheck(qhttp($port,'create',$sessions['owner'],'',array_replace($input,['fix_skew'=>'invalid']))[0]===400,'Invalid skew options are rejected.');
    qcheck(qhttp($port,'create',$sessions['owner'],'',array_replace($input,['combined_cello_bass'=>'invalid']))[0]===400,'Invalid combined part options are rejected.');
    foreach ([3,6,39] as $otherPart) qcheck(qhttp($port,'create',$sessions['owner'],'',array_replace($input,['instrument_id'=>$otherPart,'combined_cello_bass'=>'1']))[0]===400,'Combined cello/bass is rejected for instrument '.$otherPart.', including Solo Cello.');
    $input['upload_token']=bin2hex(random_bytes(16));
    qcheck(qhttp($port,'create',$sessions['owner'],'',array_replace($input,['upload_token'=>'../bad']))[0]===400,'Invalid upload tokens cannot escape the queue.');
    [$code,$created]=qhttp($port,'create',$sessions['owner'],'',$input);qcheck($code===200,'Create queued PDF.');$id=$created['item']['id'];
    qcheck(qhttp($port,'create',$sessions['owner'],'',$input)[1]['item']['id']===$id,'Retrying a lost create response reuses the original upload.');
    qcheck($created['item']['fix_skew']===false,'Skew correction is opt-in.');
    qcheck(qhttp($port,'create',$sessions['owner'],'',array_replace($input,['fix_skew'=>'1']))[0]===400,'Upload retries cannot change the chosen skew option.');
    qcheck(qhttp($port,'create',$sessions['owner'],'',array_replace($input,['name'=>'72-3.pdf']))[0]===400,'An upload token cannot be reused for another file.');
    qcheck(qhttp($port,'finish',$sessions['owner'],$id,[])[0]===400,'Incomplete uploads cannot start compression.');
    $part=substr(file_get_contents($source),0,1024);file_put_contents($fixture.'/chunk.bin',$part);
    $chunk=['offset'=>0,'chunk'=>new CURLFile($fixture.'/chunk.bin')];
    [$code,$uploaded]=qhttp($port,'chunk',$sessions['owner'],$id,$chunk);qcheck($code===200&&$uploaded['item']['received']===1024,'Chunks stream to disk.');
    qcheck(qhttp($port,'create',$sessions['owner'],'',$input)[1]['item']['received']===1024,'Retrying creation never resets bytes already saved.');
    qcheck(qhttp($port,'chunk',$sessions['owner'],$id,$chunk)[1]['item']['received']===1024,'Repeated chunk retry does not duplicate bytes.');
    file_put_contents($fixture.'/chunk.bin',str_repeat('x',1024));qcheck(qhttp($port,'chunk',$sessions['owner'],$id,$chunk)[0]===400,'Mismatched retry is rejected.');
    file_put_contents($fixture.'/chunk.bin',substr(file_get_contents($source),1024));
    qcheck(qhttp($port,'chunk',$sessions['owner'],$id,['offset'=>1024,'chunk'=>new CURLFile($fixture.'/chunk.bin')])[0]===200,'Interrupted upload can resume.');
    qcheck(hash_file('sha256',$source)===hash_file('sha256',$fixture.'/queue/'.$id.'/hd.pdf'),'HD source preserved byte for byte.');
    qcheck(qhttp($port,'finish',$sessions['owner'],$id,[])[0]===200,'Finished upload starts server compression.');
    $ready=null;for($i=0;$i<100;$i++){usleep(150000);$ready=qhttp($port,'get',$sessions['owner'],$id)[1]['item'];if(in_array($ready['status'],['ready','error']))break;}
    qcheck($ready['status']==='ready'&&$ready['pages']===2,'Actual background worker produces a two-page PDF: '.json_encode($ready));
    $metrics=[1000,['cxs'=>[['cs'=>[100,160],'xs'=>['x1'=>50,'x2'=>950]]],'bxs'=>[[50,350,650,950]]],['cxs'=>[],'bxs'=>[]]];
    $save=['piece_id'=>71,'instrument_id'=>39,'metrics'=>json_encode($metrics),'edition_label'=>'','measures_version'=>1,'barline_preparation'=>'complete'];
    qcheck(qhttp($port,'draft',$sessions['admin'],$id,array_replace($save,['barline_preparation'=>'pending']))[0]===400,'An unfinished scan cannot be saved as a prepared draft.');
    qcheck(qhttp($port,'draft',$sessions['admin'],$id,$save)[0]===200,'Reviewing admin can autosave geometry.');
    qcheck(qhttp($port,'get',$sessions['admin'],$id)[1]['draft']['metrics']===$metrics,'Queue geometry restores across sessions.');
    qcheck(qhttp($port,'get',$sessions['admin'],$id)[1]['draft']['barline_preparation']==='complete','Successful preparation is retained separately from saved scan geometry.');
    qcheck(qhttp($port,'draft',$sessions['owner'],$id,$save)[0]===400,'A stale tab cannot overwrite another saved draft.');
    $save['revision']=1;
    qcheck(qhttp($port,'publish',$sessions['admin'],$id,array_replace($save,['metrics'=>json_encode(array_slice($metrics,0,2))]))[0]===400,'Submission still requires all PDF pages.');
    file_put_contents($fixture.'/public/blocked-file','preserve');mkdir($fixture.'/public/pdfs');file_put_contents($fixture.'/public/pdfs/71-39.pdf','existing');
    qcheck(qhttp($port,'publish',$sessions['admin'],$id,$save)[0]===403,'Publication never overwrites an existing PDF.');
    qcheck(file_get_contents($fixture.'/public/pdfs/71-39.pdf')==='existing'&&(int)$db->query('SELECT COUNT(*) FROM metric_arr')->fetch_row()[0]===0,'Conflict preserves files and rolls back database changes.');unlink($fixture.'/public/pdfs/71-39.pdf');
    [$code,$published]=qhttp($port,'publish',$sessions['admin'],$id,$save);qcheck($code===200&&$published['item']['status']==='completed','Submit Part publishes directly without a review checkbox.');
    qcheck(hash_file('sha256',$source)===hash_file('sha256',$fixture.'/public/hd-pdfs/71-39.pdf'),'Published HD source is exact.');
    qcheck(is_file($fixture.'/snapshots.jsonl') && json_decode(file($fixture.'/snapshots.jsonl')[0],true)[0]===71,'Published parts refresh the shared library snapshot.');
    qcheck(json_decode(file_get_contents($fixture.'/public/data/metrics/'.$published['item']['metric_arr_id'].'.json'),true)===$metrics,'Static metrics are normalized and published.');
    qcheck(qhttp($port,'publish',$sessions['admin'],$id,$save)[0]===200&&(int)$db->query('SELECT COUNT(*) FROM metric_arr')->fetch_row()[0]===1,'Publication retry is idempotent.');
    // Duplicate uploads require explicit confirmation and retain the old work
    // until a replacement has uploaded and converted successfully.
    $originalInput=['name'=>'72-3.pdf','size'=>filesize($source),'piece_id'=>72,'instrument_id'=>3,'upload_token'=>bin2hex(random_bytes(16))];
    $original=qhttp($port,'create',$sessions['owner'],'',$originalInput)[1]['item'];$oldId=$original['id'];
    qhttp($port,'chunk',$sessions['owner'],$oldId,['offset'=>0,'chunk'=>new CURLFile($source)]);
    qhttp($port,'finish',$sessions['owner'],$oldId,[]);
    qcheck(qterminal($port,$sessions['owner'],$oldId)['status']==='ready','Original queued PDF is prepared.');
    $oldSave=array_replace($save,['piece_id'=>72,'instrument_id'=>3,'revision'=>0]);
    qcheck(qhttp($port,'draft',$sessions['admin'],$oldId,$oldSave)[0]===200,'Original queued barline edits can be saved.');
    $oldMetadata=hash_file('sha256',$fixture.'/queue/'.$oldId.'/item.json');
    $duplicateInput=array_replace($originalInput,['upload_token'=>bin2hex(random_bytes(16))]);
    [$code,$duplicate]=qhttp($port,'create',$sessions['owner'],'',$duplicateInput);
    qcheck($code===409&&$duplicate['duplicate']['count']===1,'A duplicate returns Already uploaded with an explicit overwrite choice.');
    qcheck(hash_file('sha256',$fixture.'/queue/'.$oldId.'/item.json')===$oldMetadata&&!is_dir($fixture.'/queue/'.$duplicateInput['upload_token']),'Declining the overwrite creates nothing and leaves the original untouched.');
    $oldSave['revision']=1;
    qhttp($port,'draft',$sessions['admin'],$oldId,$oldSave);
    [$code,$changed]=qhttp($port,'create',$sessions['owner'],'',$duplicateInput+['overwrite_token'=>$duplicate['duplicate']['token']]);
    qcheck($code===409,'New edits made after the prompt require a fresh overwrite confirmation.');
    $draftHash=hash_file('sha256',$fixture.'/queue/'.$oldId.'/draft.json');
    $bad=$fixture.'/bad.pdf';file_put_contents($bad,'%PDF-broken');
    $badInput=array_replace($duplicateInput,['size'=>filesize($bad),'overwrite_token'=>$changed['duplicate']['token']]);
    [$code,$replacement]=qhttp($port,'create',$sessions['owner'],'',$badInput);$badId=$replacement['item']['id'];
    qcheck($code===200&&$replacement['item']['replaces']===[$oldId],'Confirmed overwrite stages a replacement for the original upload.');
    qcheck(qhttp($port,'create',$sessions['owner'],'',$badInput)[1]['item']['id']===$badId,'A lost overwrite response can be retried without duplicating or deleting work.');
    qcheck(qhttp($port,'get',$sessions['owner'],$oldId)[1]['item']['status']==='ready','The original remains usable while replacement upload is incomplete.');
    qhttp($port,'chunk',$sessions['owner'],$badId,['offset'=>0,'chunk'=>new CURLFile($bad)]);
    qhttp($port,'finish',$sessions['owner'],$badId,[]);
    qcheck(qterminal($port,$sessions['owner'],$badId)['status']==='error','A corrupt replacement fails processing.');
    qcheck(qhttp($port,'get',$sessions['owner'],$oldId)[1]['item']['status']==='ready'&&hash_file('sha256',$fixture.'/queue/'.$oldId.'/draft.json')===$draftHash,'Failed replacement preserves the original PDF and barline edits.');
    $goodInput=array_replace($originalInput,['name'=>'72-3.PDF','upload_token'=>bin2hex(random_bytes(16))]);
    [$code,$duplicates]=qhttp($port,'create',$sessions['owner'],'',$goodInput);
    qcheck($code===409&&$duplicates['duplicate']['count']===2,'Duplicate filenames ignore case and include older failed copies.');
    [$code,$good]=qhttp($port,'create',$sessions['owner'],'',$goodInput+['overwrite_token'=>$duplicates['duplicate']['token']]);$goodId=$good['item']['id'];
    qhttp($port,'chunk',$sessions['owner'],$goodId,['offset'=>0,'chunk'=>new CURLFile($source)]);
    qhttp($port,'finish',$sessions['owner'],$goodId,[]);
    qcheck(qterminal($port,$sessions['owner'],$goodId,true)['status']==='ready','A successful replacement becomes the ready upload.');
    qcheck(qhttp($port,'get',$sessions['owner'],$oldId)[1]['item']['status']==='superseded'&&qhttp($port,'get',$sessions['owner'],$badId)[1]['item']['status']==='superseded','Only successful processing retires all confirmed duplicate queue entries.');
    qcheck(hash_file('sha256',$fixture.'/queue/'.$oldId.'/draft.json')===$draftHash&&hash_file('sha256',$fixture.'/queue/'.$oldId.'/hd.pdf')===hash_file('sha256',$source),'Previous PDFs and barline edits remain in the private backup.');
    $visible=array_filter(qhttp($port,'list',$sessions['owner'])[1]['items'],fn($i)=>strcasecmp($i['name'],'72-3.pdf')===0);
    qcheck(count($visible)===1&&array_values($visible)[0]['id']===$goodId,'The waiting list shows a single replacement instead of duplicate rows.');
    qcheck(qhttp($port,'draft',$sessions['admin'],$oldId,array_replace($oldSave,['revision'=>2]))[0]===400,'A stale tab cannot save edits over an overwritten queue entry.');
    $changedMetrics=$metrics;$changedMetrics[1]['bxs'][0]=[50,300,500,700,950];
    $libraryOverwrite=array_replace($save,['revision'=>0,'metrics'=>json_encode($changedMetrics),'overwrite_token'=>$duplicates['duplicate']['token']]);
    qcheck(qhttp($port,'publish',$sessions['admin'],$goodId,$libraryOverwrite)[0]===403,'Queue overwrite approval never authorizes replacing a published library part.');
    qcheck((int)$db->query('SELECT COUNT(*) FROM metric_arr')->fetch_row()[0]===1&&hash_file('sha256',$fixture.'/public/hd-pdfs/71-39.pdf')===hash_file('sha256',$source),'The published library part remains intact.');
    $tilted=$fixture.'/tilted.pdf';qfixturePdf($tilted,1.5);
    $skewInput=['name'=>'tilted.pdf','size'=>filesize($tilted),'piece_id'=>72,'instrument_id'=>39,'edition_label'=>'Corrected skew','fix_skew'=>'1','upload_token'=>bin2hex(random_bytes(16))];
    [$code,$skewUpload]=qhttp($port,'create',$sessions['owner'],'',$skewInput);$skewId=$skewUpload['item']['id'];
    qcheck($code===200&&$skewUpload['item']['fix_skew']===true,'Upload retains the Fix skew checkbox choice.');
    qhttp($port,'chunk',$sessions['owner'],$skewId,['offset'=>0,'chunk'=>new CURLFile($tilted)]);
    qhttp($port,'finish',$sessions['owner'],$skewId,[]);$skewReady=qterminal($port,$sessions['owner'],$skewId);
    qcheck($skewReady['status']==='ready'&&$skewReady['skew_corrected_pages']===2,'Actual background processing straightens both pages before compression: '.json_encode($skewReady));
    $skewFolder=$fixture.'/queue/'.$skewId;
    qcheck(hash_file('sha256',$skewFolder.'/hd.pdf')===hash_file('sha256',$tilted),'Raw upload stays intact for retry.');
    $masterHash=hash_file('sha256',$skewFolder.'/deskewed.pdf');$optimizedHash=hash_file('sha256',$skewFolder.'/optimized.pdf');
    qcheck($masterHash!==hash_file('sha256',$tilted)&&$masterHash===$skewReady['original_sha256'],'Canonical HD checksum describes the corrected master.');
    $download=curl_init('http://127.0.0.1:'.$port.'/editmode/part-pdf-queue.php?action=file&kind=hd&id='.$skewId);
    curl_setopt_array($download,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20,CURLOPT_COOKIE=>'PHPSESSID='.$sessions['owner']]);
    $downloaded=curl_exec($download);curl_close($download);
    qcheck(is_string($downloaded)&&hash('sha256',$downloaded)===$masterHash,'Queue HD downloads use the corrected master.');
    $skewSave=array_replace($save,['piece_id'=>72,'instrument_id'=>39,'edition_label'=>'Corrected skew','revision'=>0]);
    [$code,$skewPublished]=qhttp($port,'publish',$sessions['admin'],$skewId,$skewSave);
    qcheck($code===200&&$skewPublished['item']['status']==='completed','Corrected part publishes successfully.');
    $skewName=$skewPublished['item']['pdf_file'];
    qcheck(hash_file('sha256',$fixture.'/public/hd-pdfs/'.$skewName)===$masterHash&&hash_file('sha256',$fixture.'/public/pdfs/'.$skewName)===$optimizedHash,'Both published qualities come from corrected processing.');
    qcheck(!is_file($skewFolder.'/hd.pdf')&&!is_file($skewFolder.'/deskewed.pdf')&&!is_file($skewFolder.'/optimized.pdf'),'Publication removes all temporary PDF copies.');
    file_put_contents($skewFolder.'/deskewed.pdf','left over after interrupted cleanup');
    qcheck(qhttp($port,'publish',$sessions['admin'],$skewId,$skewSave)[0]===200&&!is_file($skewFolder.'/deskewed.pdf'),'Corrected publication retries are idempotent and finish cleanup.');
    $discardInput=array_replace($skewInput,['name'=>'discard-skew.pdf','upload_token'=>bin2hex(random_bytes(16))]);
    $discardId=qhttp($port,'create',$sessions['owner'],'',$discardInput)[1]['item']['id'];
    $discardFolder=$fixture.'/queue/'.$discardId;file_put_contents($discardFolder.'/deskewed.pdf','temporary correction');file_put_contents($discardFolder.'/.mw-deskew-interrupted.pdf','partial temporary output');
    qcheck(qhttp($port,'discard',$sessions['owner'],$discardId,[])[0]===200&&!is_file($discardFolder.'/deskewed.pdf')&&!is_file($discardFolder.'/.mw-deskew-interrupted.pdf'),'Removing a queued part also removes its corrected master and interrupted scratch output.');
    foreach ([4,5] as $selectedPart) {
        $edition='Combined from'.$selectedPart;
        $combinedInput=['name'=>'combined-'.$selectedPart.'.pdf','size'=>filesize($selectedPart===4?$tilted:$source),'piece_id'=>72,'instrument_id'=>$selectedPart,
            'edition_label'=>$edition,'combined_cello_bass'=>'1','fix_skew'=>$selectedPart===4?'1':'0','upload_token'=>bin2hex(random_bytes(16))];
        [$code,$combinedUpload]=qhttp($port,'create',$sessions['owner'],'',$combinedInput);$combinedId=$combinedUpload['item']['id'];
        qcheck($code===200&&$combinedUpload['item']['combined_cello_bass']===true,'Combined option is stored when instrument '.$selectedPart.' is selected.');
        qcheck(qhttp($port,'create',$sessions['owner'],'',$combinedInput)[1]['item']['id']===$combinedId,'Repeated creation preserves the combined upload.');
        qcheck(qhttp($port,'create',$sessions['owner'],'',array_replace($combinedInput,['combined_cello_bass'=>'0']))[0]===400,'The combined choice cannot change on a retried upload token.');
        qhttp($port,'chunk',$sessions['owner'],$combinedId,['offset'=>0,'chunk'=>new CURLFile($selectedPart===4?$tilted:$source)]);
        qhttp($port,'finish',$sessions['owner'],$combinedId,[]);$combinedReady=qterminal($port,$sessions['owner'],$combinedId);
        qcheck($combinedReady['status']==='ready','Combined upload processes once: '.json_encode($combinedReady));
        $combinedFolder=$fixture.'/queue/'.$combinedId;
        qcheck(!is_file($fixture.'/public/pdfs/'.buildPdfFilename(72,4,$edition))&&!is_file($fixture.'/public/pdfs/'.buildPdfFilename(72,5,$edition)),'Combined parts are not published until barline work is submitted.');
        $combinedSave=array_replace($save,['piece_id'=>72,'instrument_id'=>$selectedPart,'edition_label'=>$edition,'revision'=>0,'measures_version'=>3]);
        qcheck(qhttp($port,'draft',$sessions['admin'],$combinedId,array_replace($combinedSave,['instrument_id'=>6]))[0]===400,'A combined draft cannot be changed to Solo Cello.');
        qcheck(qhttp($port,'draft',$sessions['admin'],$combinedId,$combinedSave)[0]===200,'Combined barline data autosaves once.');
        qcheck(qhttp($port,'get',$sessions['admin'],$combinedId)[1]['item']['combined_cello_bass']===true,'The combined choice survives autosave and reload.');
        $combinedSave['revision']=1;
        qcheck(qhttp($port,'publish',$sessions['admin'],$combinedId,array_replace($combinedSave,['instrument_id'=>6]))[0]===400,'Combined publication cannot target Solo Cello.');
        [$code,$combinedPublished]=qhttp($port,'publish',$sessions['admin'],$combinedId,$combinedSave);
        qcheck($code===200&&count($combinedPublished['item']['published_parts'])===2,'One submission publishes both cello and bass: '.json_encode($combinedPublished).($code!==200?' Log: '.substr(file_get_contents($fixture.'/web.log'),-2000):''));
        qcheck($combinedPublished['item']['instrument_id']===$selectedPart,'Publication retains the selected instrument as the primary part.');
        $rows=$db->query("SELECT instrument_id,metric_arr_id,metric_arr_data,measures_version,edition_label FROM metric_arr WHERE piece_id=72 AND edition_label='$edition' ORDER BY instrument_id")->fetch_all(MYSQLI_ASSOC);
        qcheck(array_map(fn($r)=>(int)$r['instrument_id'],$rows)===[4,5],'Exactly instrument IDs 4 and 5 receive records.');
        foreach($rows as $row) {
            qcheck(json_decode($row['metric_arr_data'],true)===$metrics&&(int)$row['measures_version']===3&&$row['edition_label']===$edition,'Each part receives identical reviewed barlines, version and edition.');
            $filename=buildPdfFilename(72,$row['instrument_id'],$edition);
            qcheck(hash_file('sha256',$fixture.'/public/hd-pdfs/'.$filename)===$combinedReady['original_sha256']&&hash_file('sha256',$fixture.'/public/pdfs/'.$filename)===$combinedReady['optimized_sha256'],'Each part receives the same prepared HD and compressed PDFs.');
            qcheck(json_decode(file_get_contents($fixture.'/public/data/metrics/'.$row['metric_arr_id'].'.json'),true)===$metrics,'Each part has its own static geometry JSON.');
        }
        if($selectedPart===4)qcheck($combinedReady['skew_corrected_pages']===2,'The corrected master is shared by both parts after skew correction.');
        $purges=array_map(fn($line)=>json_decode($line,true),file($fixture.'/purges.jsonl',FILE_IGNORE_NEW_LINES));
        qcheck(array_map(fn($row)=>$row[2],array_slice($purges,-2))===[4,5],'Both published instruments have their caches purged.');
        qcheck(!is_file($combinedFolder.'/hd.pdf')&&!is_file($combinedFolder.'/deskewed.pdf')&&!is_file($combinedFolder.'/optimized.pdf'),'Combined publication releases temporary PDFs only after both copies are saved.');
        $completed=json_decode(file_get_contents($combinedFolder.'/item.json'),true);$completed['status']='ready';file_put_contents($combinedFolder.'/item.json',json_encode($completed));
        qcheck(qhttp($port,'publish',$sessions['admin'],$combinedId,$combinedSave)[0]===200&&(int)$db->query("SELECT COUNT(*) FROM metric_arr WHERE piece_id=72 AND edition_label='$edition'")->fetch_row()[0]===2,'Recovery after a lost completion update reuses both records without duplicating them.');
    }
    $rollbackInput=['name'=>'combined-rollback.pdf','size'=>filesize($source),'piece_id'=>72,'instrument_id'=>4,'edition_label'=>'Combined rollback','combined_cello_bass'=>'1'];
    $rollbackId=qhttp($port,'create',$sessions['owner'],'',$rollbackInput)[1]['item']['id'];
    qhttp($port,'chunk',$sessions['owner'],$rollbackId,['offset'=>0,'chunk'=>new CURLFile($source)]);qhttp($port,'finish',$sessions['owner'],$rollbackId,[]);
    qcheck(qterminal($port,$sessions['owner'],$rollbackId)['status']==='ready','Conflict fixture is ready.');
    $rollbackSave=array_replace($save,['piece_id'=>72,'instrument_id'=>4,'edition_label'=>'Combined rollback','revision'=>0]);
    $bassConflict=$fixture.'/public/pdfs/72-5-combined_rollback.pdf';file_put_contents($bassConflict,'keep existing bass PDF');
    qcheck(qhttp($port,'publish',$sessions['admin'],$rollbackId,$rollbackSave)[0]===403,'A bass filename conflict prevents combined publication.');
    qcheck(file_get_contents($bassConflict)==='keep existing bass PDF'&&!is_file($fixture.'/public/pdfs/72-4-combined_rollback.pdf')&&(int)$db->query("SELECT COUNT(*) FROM metric_arr WHERE edition_label='Combined rollback'")->fetch_row()[0]===0,'Conflict preserves the existing bass file and creates no partial cello entry.');unlink($bassConflict);
    $beforeStatic=glob($fixture.'/public/data/metrics/*.json');
    $db->query("CREATE TRIGGER reject_combined_bass BEFORE INSERT ON metric_arr FOR EACH ROW BEGIN IF NEW.instrument_id=5 AND NEW.edition_label='Combined rollback' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Test bass insert failure'; END IF; END");
    qcheck(qhttp($port,'publish',$sessions['admin'],$rollbackId,$rollbackSave)[0]===500,'A failure saving the second part is reported.');
    qcheck((int)$db->query("SELECT COUNT(*) FROM metric_arr WHERE edition_label='Combined rollback'")->fetch_row()[0]===0&&glob($fixture.'/public/data/metrics/*.json')===$beforeStatic,'Failure rolls back both database entries and all new geometry JSON.');
    foreach(['pdfs','hd-pdfs']as$directory)foreach([4,5]as$part)qcheck(!is_file($fixture.'/public/'.$directory.'/72-'.$part.'-combined_rollback.pdf'),'Failure removes newly created '.$directory.' copy for instrument '.$part.'.');
    qcheck(is_file($fixture.'/queue/'.$rollbackId.'/hd.pdf')&&is_file($fixture.'/queue/'.$rollbackId.'/optimized.pdf')&&qhttp($port,'get',$sessions['admin'],$rollbackId)[1]['item']['status']==='ready','Failed combined submission keeps its PDFs and barline work available for retry.');
    $db->query('DROP TRIGGER reject_combined_bass');
    qcheck(qhttp($port,'publish',$sessions['admin'],$rollbackId,$rollbackSave)[0]===200,'The same queued combined part can be submitted successfully after failure.');
    $singleInput=['name'=>'cello-only.pdf','size'=>filesize($source),'piece_id'=>72,'instrument_id'=>4,'edition_label'=>'Cello only'];
    $singleId=qhttp($port,'create',$sessions['owner'],'',$singleInput)[1]['item']['id'];
    qhttp($port,'chunk',$sessions['owner'],$singleId,['offset'=>0,'chunk'=>new CURLFile($source)]);qhttp($port,'finish',$sessions['owner'],$singleId,[]);
    qcheck(qterminal($port,$sessions['owner'],$singleId)['status']==='ready','Ordinary cello upload is ready.');
    $singleSave=array_replace($save,['piece_id'=>72,'instrument_id'=>4,'edition_label'=>'Cello only','revision'=>0,'combined_cello_bass'=>'1']);
    [$code,$singleResult]=qhttp($port,'publish',$sessions['admin'],$singleId,$singleSave);
    qcheck($code===200&&count($singleResult['item']['published_parts'])===1&&(int)$db->query("SELECT COUNT(*) FROM metric_arr WHERE edition_label='Cello only'")->fetch_row()[0]===1&&!is_file($fixture.'/public/pdfs/72-5-cello_only.pdf'),'An unchecked upload remains cello-only, even if a later request attempts to enable duplication.');
    // A private tutorial still uses the normal barline and recording workflow.
    $db->query("INSERT INTO pieces VALUES (73,'bachsuite1-tutorial',1)");
    $privateInput=['name'=>'bachsuite1-tutorial.pdf','size'=>filesize($source),'piece_id'=>73,'instrument_id'=>4];
    $privateItem=qhttp($port,'create',$sessions['owner'],'',$privateInput)[1]['item'];
    $privateId=$privateItem['id'];
    qcheck(!empty($privateItem['private_tutorial']),'Private tutorial status comes from the assigned piece.');
    qhttp($port,'chunk',$sessions['owner'],$privateId,['offset'=>0,'chunk'=>new CURLFile($source)]);
    qhttp($port,'finish',$sessions['owner'],$privateId,[]);
    qcheck(qterminal($port,$sessions['owner'],$privateId)['status']==='ready','Private tutorial is available for barline work.');
    $privateSave=array_replace($save,['piece_id'=>73,'instrument_id'=>4,'edition_label'=>'','revision'=>0]);
    qcheck(qhttp($port,'draft',$sessions['owner'],$privateId,array_replace($privateSave,['piece_id'=>71]))[0]===400,'Private queue drafts cannot accidentally be moved into a public piece.');
    qcheck(qhttp($port,'publish',$sessions['owner'],$privateId,array_replace($privateSave,['piece_id'=>71]))[0]===400,'Private queue publication cannot silently switch to a public piece.');
    [$code,$privateResult]=qhttp($port,'publish',$sessions['owner'],$privateId,$privateSave);
    qcheck($code===200&&!empty($privateResult['item']['private_tutorial'])&&$privateResult['item']['status']==='completed','Private tutorial barlines can be saved normally for YubSync.');
    qcheck((int)$db->query('SELECT COUNT(*) FROM metric_arr WHERE piece_id=73')->fetch_row()[0]===1&&is_file($fixture.'/public/pdfs/73-4.pdf'),'Private preparation retains normal piece and part IDs and PDF loading.');
    // The API schedules persistent scans without depending on an editor tab.
    define('MW_PDF_QUEUE_SCAN_ENABLED', true);
    $scanFolder=$fixture.'/queue/'.str_repeat('f',32);mkdir($scanFolder);
    copy($source,$scanFolder.'/optimized.pdf');
    $scanItem=['id'=>str_repeat('f',32),'name'=>'scan-settings-fixture.pdf','created_at'=>'2026-11-13T00:00:00Z','edition_label'=>null,'original_bytes'=>filesize($source),'status'=>'ready','piece_id'=>73,'instrument_id'=>4,'pages'=>2,'draft_revision'=>5];
    file_put_contents($scanFolder.'/item.json',json_encode($scanItem));
    try { mwPdfQueueRequestScan($scanItem,$scanFolder,['revision'=>4]); qcheck(false,'Stale scan request must be rejected.'); }
    catch (InvalidArgumentException $e) { qcheck(true,'Stale scan requests cannot replace newer work.'); }
    $settings=mwPdfQueueScanSettings(['settings'=>'{"width":1500,"drmpl":0.6,"eerst":1}']);
    qcheck($settings['width']===1500&&$settings['drmpl']===0.6&&$settings['eerst']===1,'Reruns preserve selected width and staff settings.');
    try { mwPdfQueueScanSettings(['settings'=>'{"width":999999}']); qcheck(false,'Invalid widths must be rejected.'); }
    catch (InvalidArgumentException $e) { qcheck(true,'Background settings keep render sizes bounded.'); }
    $scanStarted=mwPdfQueueRequestScan($scanItem,$scanFolder,['revision'=>5]);
    qcheck($scanStarted['status']==='queued'&&$scanStarted['scan_only']===true,'Background requests save a durable queue entry.');
    qcheck(mwPdfQueueRequestScan($scanStarted,$scanFolder,['revision'=>5])===$scanStarted,'Retrying the same scan request is idempotent.');
    file_put_contents($scanFolder.'/draft.json',json_encode(['metrics'=>$metrics,'barline_preparation'=>'complete']));
    qcheck(mwPdfQueueRequestScan($scanItem,$scanFolder,['revision'=>5])===$scanItem,'Reviewed barlines are restored without another scan.');
    qcheck(mwPdfQueueRequestScan($scanItem,$scanFolder,['revision'=>5,'force'=>1])['scan_only'],'Explicit reruns can replace a prepared scan.');
    file_put_contents($scanFolder.'/draft.json',json_encode(['metrics'=>$metrics,'barline_preparation'=>'failed']));
    qcheck(mwPdfQueueRequestScan($scanItem,$scanFolder,['revision'=>5])['scan_only'],'An incomplete scan can restart as a background job.');
    qcheck(mwPdfQueueRequestScan(array_replace($scanItem,['skip_barline_detection'=>true]),$scanFolder,['revision'=>5])['status']==='ready','Excluded piano and score PDFs are not scanned.');
    file_put_contents($scanFolder.'/item.json',json_encode(array_replace($scanItem,['status'=>'discarded'])));
    if(in_array('--background',$argv,true)) {
        touch($fixture.'/tools/.barline-worker-enabled');
        $capability=qhttp($port,'list',$sessions['owner']);
        qcheck(($capability[1]['background_barlines']??false)===true,'The queue reports persistent scanning capability: '.json_encode($capability));
        $backgroundSource=$root.'/assets/tutorials/yubsync-bach/score.pdf';
        $backgroundInput=['name'=>'background-tutorial.pdf','size'=>filesize($backgroundSource),'piece_id'=>73,'instrument_id'=>4];
        $backgroundId=qhttp($port,'create',$sessions['owner'],'',$backgroundInput)[1]['item']['id'];
        qhttp($port,'chunk',$sessions['owner'],$backgroundId,['offset'=>0,'chunk'=>new CURLFile($backgroundSource)]);
        qhttp($port,'finish',$sessions['owner'],$backgroundId,[]);
        // No editor, canvas or browser detector is opened. PHP releases the
        // request while the private worker prepares and saves the PDF.
        $prepared=qterminal($port,$sessions['owner'],$backgroundId,false,1200);
        qcheck($prepared['status']==='ready','The detached worker finishes after the initiating request ends: '.json_encode($prepared));
        $restored=qhttp($port,'get',$sessions['owner'],$backgroundId)[1];
        qcheck($restored['draft']['barline_preparation']==='complete'&&count($restored['draft']['metrics'][1]['cxs'])===8,'Returning to the queue restores fitted systems and completed detection.');
        qcheck(qhttp($port,'draft',$sessions['owner'],$backgroundId,array_replace($privateSave,['revision'=>0]))[0]===400,'An old editor tab cannot overwrite the completed server scan.');
    }
    if(in_array('--browser',$argv,true)){echo json_encode(['fixture'=>$fixture,'port'=>$port,'sessions'=>$sessions])."\nBrowser fixture ready. Press Enter.\n";fgets(STDIN);}
    echo "Passed $checks PDF queue checks.\n";
} finally { if(is_resource($server)){proc_terminate($server);proc_close($server);} $connection->query("DROP DATABASE IF EXISTS `$database`");if(is_dir($fixture))qremove($fixture); }
